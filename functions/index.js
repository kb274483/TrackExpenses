const functions = require('firebase-functions');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const dayjs = require('dayjs');

admin.initializeApp();

const db = admin.database();
const MAX_RECEIPT_FILE_SIZE = 5 * 1024 * 1024;
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const RECEIPT_CATEGORIES = new Set([
  'transportation',
  'food',
  'entertainment',
  'pets',
  'housing',
  'supplies',
  'investment',
  'shopping',
  'other',
]);
const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const normalizeAmount = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeDate = (value) => {
  if (!value) return null;

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
};

const normalizeSuggestedType = (value) => {
  if (!value) return 'other';
  return RECEIPT_CATEGORIES.has(value) ? value : 'other';
};

const normalizeConfidence = (confidence = {}) => ({
  amount: typeof confidence.amount === 'number' ? confidence.amount : 0,
  date: typeof confidence.date === 'number' ? confidence.date : 0,
  description:
    typeof confidence.description === 'number' ? confidence.description : 0,
  type: typeof confidence.type === 'number' ? confidence.type : 0,
});

const normalizeReceiptResult = (result = {}) => ({
  description: result.description || result.merchantName || '',
  amount: normalizeAmount(result.amount),
  date: normalizeDate(result.date),
  suggestedType: normalizeSuggestedType(result.suggestedType),
  merchantName: result.merchantName || '',
  confidence: normalizeConfidence(result.confidence),
  rawTextSnippet: result.rawTextSnippet || '',
});

const receiptScanJsonSchema = {
  name: 'receipt_scan_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      description: { type: 'string' },
      amount: { type: ['number', 'null'] },
      date: { type: ['string', 'null'] },
      suggestedType: {
        type: 'string',
        enum: Array.from(RECEIPT_CATEGORIES),
      },
      merchantName: { type: 'string' },
      confidence: {
        type: 'object',
        additionalProperties: false,
        properties: {
          amount: { type: 'number' },
          date: { type: 'number' },
          description: { type: 'number' },
          type: { type: 'number' },
        },
        required: ['amount', 'date', 'description', 'type'],
      },
      rawTextSnippet: { type: 'string' },
    },
    required: [
      'description',
      'amount',
      'date',
      'suggestedType',
      'merchantName',
      'confidence',
      'rawTextSnippet',
    ],
  },
};

const validateReceiptScanPayload = (data = {}) => {
  if (!data.imageBase64 && !data.imageUrl) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Receipt image is required.',
    );
  }

  if (data.mimeType && !ALLOWED_RECEIPT_MIME_TYPES.has(data.mimeType)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Only JPG, PNG, or WEBP images are supported.',
    );
  }

  if (data.size && Number(data.size) > MAX_RECEIPT_FILE_SIZE) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Receipt image must be 5MB or smaller.',
    );
  }
};

const buildMockReceiptResult = (data = {}) => normalizeReceiptResult({
  description: data.fileName
    ? data.fileName.replace(/\.[^.]+$/, '')
    : 'Receipt Expense',
  amount: 245,
  date: dayjs().format('YYYY-MM-DD'),
  suggestedType: 'food',
  merchantName: 'Mock Merchant',
  confidence: {
    amount: 0.94,
    date: 0.91,
    description: 0.83,
    type: 0.72,
  },
  rawTextSnippet: 'MOCK RECEIPT 245.00',
});

const buildOpenAiReceiptPrompt = () => [
  'You are a multilingual receipt and invoice parser. The image may be a receipt or invoice in any language, including Traditional/Simplified Chinese (e.g. 統一發票, 收據, 发票), English, or Japanese (e.g. レシート, 領収書, 請求書). Layout, currency, and date format vary by country — rely on semantic understanding, not fixed patterns.',
  '',
  'Return the result strictly matching the provided JSON schema. Use null for fields you cannot determine with reasonable confidence.',
  '',
  'Field rules:',
  '',
  '1. amount (number | null)',
  '   - The final amount actually paid by the customer (post-tax, post-discount, post-service-charge).',
  '   - Prefer lines labeled like: "Total", "Grand Total", "Amount Due", "應付金額", "總計", "合計", "小計 (when it is the final line)", "お会計", "合計金額", "税込合計", "お支払金額".',
  '   - Do NOT use subtotal, tax-only, tip-only, change (找零/お釣り), or per-item prices.',
  '   - If multiple candidates exist, pick the largest one that represents the customer payment (not the received cash amount).',
  '   - Output a plain number without currency symbols or thousand separators.',
  '',
  '2. date (string "YYYY-MM-DD" | null)',
  '   - The transaction / issue date of the receipt.',
  '   - Handle these formats: "2024-03-15", "2024/03/15", "15/03/2024", "03/15/2024", "2024年3月15日", "民國113年3月15日" (ROC calendar: add 1911 to year), "令和6年3月15日" (Japanese Reiwa era: Reiwa year + 2018), "平成" (Heisei + 1988), "Mar 15, 2024".',
  '   - When day/month order is ambiguous (e.g. 03/04/2024), infer from the receipt country/language: US English → MM/DD, most others → DD/MM. Lower the date confidence below 0.7 when ambiguous.',
  '   - Return null only if truly illegible or missing.',
  '',
  '3. merchantName (string)',
  '   - The store / vendor / issuer name as printed, in its original language (do not translate).',
  '   - For Taiwanese 統一發票, use the 賣方 / 商店名稱, not the 買方.',
  '   - For Japanese receipts, use the 店舗名 / 発行者.',
  '   - Empty string if not found.',
  '',
  '4. description (string)',
  '   - A concise human-readable label for this expense (max ~20 chars).',
  '   - Prefer the merchant name in its original language; if the receipt clearly shows a single dominant item/service, you may use that instead.',
  '   - Do NOT translate Chinese or Japanese merchant names into English.',
  '',
  '5. suggestedType (enum)',
  '   - Must be exactly one of: transportation, food, entertainment, pets, housing, supplies, investment, shopping, other.',
  '   - Mapping hints:',
  '     * food: restaurants, cafes, groceries, convenience stores (7-11, FamilyMart, ローソン), 餐廳, 飲食店',
  '     * transportation: taxi, train, MRT, 捷運, 高鐵, 新幹線, JR, fuel, parking, tolls',
  '     * entertainment: cinema, concerts, KTV, 娛樂, 映画',
  '     * shopping: clothing, electronics, department stores, 百貨, デパート',
  '     * supplies: hardware, office supplies, household items, 日用品',
  '     * housing: rent, utilities, furniture, 水電, 家賃',
  '     * pets: pet food, vet, 寵物, ペット',
  '     * investment: financial services, securities',
  '     * other: use only when no category clearly fits',
  '',
  '6. confidence (object of numbers 0-1)',
  '   - Honest self-assessment per field.',
  '   - Use < 0.5 when the value is guessed, the image is blurry, or the format is ambiguous.',
  '   - Use > 0.9 only when the field is explicitly and unambiguously printed.',
  '',
  '7. rawTextSnippet (string)',
  '   - Copy the actual lines (in the original language and characters) that contain the total amount and the date, separated by " | ". This is used for debugging and user review.',
  '   - Keep under ~100 characters.',
  '',
  'If the image is not a receipt or invoice, return all fields as null/empty with confidence 0.',
].join('\n');

const extractResponseText = (payload = {}) => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  const outputTextItem = outputItems
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .find(
      (contentItem) => contentItem.type === 'output_text'
        && typeof contentItem.text === 'string',
    );

  return outputTextItem?.text || '';
};

const normalizeReceiptScanError = (error) => {
  if (error instanceof functions.https.HttpsError) {
    return error;
  }

  const message = error?.message || 'Failed to parse receipt image.';
  const status = Number(error?.status);
  const errorCode = error?.code || error?.errorCode;

  if (status === 429 || errorCode === 'insufficient_quota') {
    return new functions.https.HttpsError(
      'resource-exhausted',
      'Receipt scan service quota has been exceeded. Please check OpenAI billing and quota.',
    );
  }

  if (
    status === 400
    || errorCode === 'invalid_image_format'
    || errorCode === 'invalid_image'
  ) {
    return new functions.https.HttpsError('invalid-argument', message);
  }

  if (status === 401 || status === 403) {
    return new functions.https.HttpsError(
      'failed-precondition',
      'Receipt scan service credentials are not configured correctly.',
    );
  }

  return new functions.https.HttpsError('internal', message);
};

const parseReceiptWithOpenAI = async (data = {}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_RECEIPT_SCAN_MODEL || 'gpt-4.1-mini';

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'OPENAI_API_KEY is missing for receipt scan.',
    );
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildOpenAiReceiptPrompt(),
            },
            {
              type: 'input_image',
              image_url: data.imageBase64 || data.imageUrl,
              detail: 'high',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          ...receiptScanJsonSchema,
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    logger.error('OpenAI receipt scan request failed.', {
      status: response.status,
      body: payload,
    });
    const requestError = new Error(
      payload?.error?.message || 'OpenAI receipt scan request failed.',
    );
    requestError.status = response.status;
    requestError.code = payload?.error?.code || payload?.error?.type || null;
    throw requestError;
  }

  const responseText = extractResponseText(payload);

  if (!responseText) {
    throw new Error('OpenAI receipt scan returned an empty response.');
  }

  return normalizeReceiptResult(JSON.parse(responseText));
};

const parseReceiptWithProvider = async (data = {}) => {
  const provider = process.env.RECEIPT_SCAN_PROVIDER || 'mock';

  if (provider === 'mock') {
    return buildMockReceiptResult(data);
  }

  if (provider === 'openai') {
    return parseReceiptWithOpenAI(data);
  }

  throw new functions.https.HttpsError(
    'failed-precondition',
    `Receipt scan provider "${provider}" is not configured yet.`,
  );
};

// 每天執行一次的 Scheduled Function
exports.autoAddFixedExpenses = functions.pubsub
  .schedule('every day 10:30')
  .timeZone('Asia/Taipei')
  .onRun(async () => {
    const today = dayjs().date(); // 取得今天的日期
    const currentMonth = dayjs().format('YYYY-MM'); // 取得當前月份，格式：2024-09

    try {
      // 取得所有群組的固定支出設定
      const groupsSnapshot = await db.ref('groups').once('value');
      const groups = groupsSnapshot.val();

      if (!groups) return null;

      // 檢查每個群組的設定
      Object.entries(groups).forEach(async ([groupName, groupData]) => {
        const fixedExpenses = groupData.groupSettings?.fixedExpenses || [];

        // 取得今天需要新增的固定支出
        const todayExpenses = Object.entries(fixedExpenses).filter(
          ([, expense]) => parseInt(expense.date.value, 10) === today,
        );

        // 今天沒有固定支出跳過
        if (todayExpenses.length < 0) return;

        // 將固定支出新增至當月的消費紀錄中
        todayExpenses.forEach(async ([expenseId, expense]) => {
          const expenseRecordId = Date.now().toString(); // 產生新的消費記錄 ID
          const newExpense = {
            id: expenseRecordId,
            description: expense.name,
            amount: expense.amount,
            date: new Date().toISOString().slice(0, 10),
            payer: {
              label: expense.payerId.label,
              value: expense.payerId.value,
            },
            members: groupData.members
              ? Object.values(groupData.members).map((member) => ({
                label: member.name,
                value: member.id,
              }))
              : [],
            type: { icon: 'stars', label: 'Fixed Expense', value: 'fixed' },
          };

          // 檢查是否有開啟期數設定
          if (expense.installments && expense.paymentTerms > 0) {
            // 更新期數
            const updatedPaymentTerms = parseInt(expense.paymentTerms, 10) - 1;
            // 更新支出項目的期數
            await db
              .ref(
                `/groups/${groupName}/groupSettings/fixedExpenses/${expenseId}`,
              )
              .update({
                paymentTerms: updatedPaymentTerms,
              });
            // 如果期數為 0，則移除支出項目
            if (updatedPaymentTerms === 0) {
              await db
                .ref(
                  `/groups/${groupName}/groupSettings/fixedExpenses/${expenseId}`,
                )
                .remove();
            }
          }

          // 將支出項目新增至當月的消費紀錄中
          await db
            .ref(
              `/groups/${groupName}/expenses/${currentMonth}/${expenseRecordId}`,
            )
            .set(newExpense);
        });
      });

      logger.info('Fixed expenses successfully added.');
      return null;
    } catch (error) {
      logger.error('Error adding fixed expenses.', error);
      return null;
    }
  });

exports.scanExpenseReceipt = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication is required.',
    );
  }

  validateReceiptScanPayload(data);

  try {
    const normalizedResult = await parseReceiptWithProvider(data);

    logger.info('scanExpenseReceipt succeeded.', {
      uid: context.auth.uid,
      provider: process.env.RECEIPT_SCAN_PROVIDER || 'mock',
      fileName: data.fileName || '',
      mimeType: data.mimeType || '',
      size: Number(data.size) || 0,
    });

    return normalizedResult;
  } catch (error) {
    const normalizedError = normalizeReceiptScanError(error);

    logger.error('scanExpenseReceipt failed.', {
      uid: context.auth.uid,
      provider: process.env.RECEIPT_SCAN_PROVIDER || 'mock',
      message: error.message || 'Unknown receipt scan error.',
      normalizedCode: normalizedError.code,
    });

    throw normalizedError;
  }
});
