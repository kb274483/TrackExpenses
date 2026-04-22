import { rocDateStringToIso } from '../utils/rocDate.js';
import categoryKeywords from './categoryKeywords.js';
import {
  normalizeScanResult,
} from './scanResultShape.js';

const LEFT_QR_HEADER_LENGTH = 77;
const RIGHT_QR_PREFIX = '**';

const parseHexAmount = (value) => {
  if (!/^[0-9a-fA-F]{8}$/.test(value)) return null;

  const amount = Number.parseInt(value, 16);
  return Number.isFinite(amount) ? amount : null;
};

const decodeLeftQr = (text) => {
  const normalizedText = String(text || '').trim();

  if (normalizedText.length < LEFT_QR_HEADER_LENGTH) {
    throw new Error('Not a Taiwan uniform invoice QR.');
  }

  const invoiceNumber = normalizedText.slice(0, 10);
  const rocDate = normalizedText.slice(10, 17);
  const randomCode = normalizedText.slice(17, 21);
  const salesAmountHex = normalizedText.slice(21, 29);
  const totalAmountHex = normalizedText.slice(29, 37);
  const buyerId = normalizedText.slice(37, 45);
  const sellerId = normalizedText.slice(45, 53);
  const encryptedCode = normalizedText.slice(53, 77);
  const tail = normalizedText.slice(77);

  if (!/^[A-Z]{2}\d{8}$/.test(invoiceNumber)) {
    throw new Error('Not a Taiwan uniform invoice QR.');
  }

  const amount = parseHexAmount(totalAmountHex);
  const salesAmount = parseHexAmount(salesAmountHex);
  const date = rocDateStringToIso(rocDate);

  if (amount === null || salesAmount === null || !date) {
    throw new Error('Not a Taiwan uniform invoice QR.');
  }

  const segments = tail.startsWith(':') ? tail.slice(1).split(':') : [];
  const leftItemCount = Number(segments[0] || 0);
  const rightItemCount = Number(segments[1] || 0);
  const encoding = Number(segments[2] || 1);

  return {
    rawText: normalizedText,
    invoiceNumber,
    date,
    rocDate,
    randomCode,
    salesAmount,
    amount,
    buyerId,
    sellerId,
    encryptedCode,
    leftItemCount: Number.isFinite(leftItemCount) ? leftItemCount : 0,
    rightItemCount: Number.isFinite(rightItemCount) ? rightItemCount : 0,
    encoding: encoding === 0 ? 0 : 1,
    tailSegments: segments,
  };
};

const decodeRightQr = (text) => {
  const normalizedText = String(text || '').trim();

  if (!normalizedText.startsWith(RIGHT_QR_PREFIX)) {
    throw new Error('Not a Taiwan uniform invoice QR.');
  }

  const payload = normalizedText.slice(RIGHT_QR_PREFIX.length);
  const segments = payload ? payload.split(':') : [];

  if (segments.length < 3 || segments.length % 3 !== 0) {
    throw new Error('Not a Taiwan uniform invoice QR.');
  }

  const items = [];

  for (let index = 0; index < segments.length; index += 3) {
    const name = (segments[index] || '').trim();
    const quantity = Number(segments[index + 1]);
    const unitPrice = Number(segments[index + 2]);

    if (!name) {
      throw new Error('Not a Taiwan uniform invoice QR.');
    }

    items.push({
      name,
      quantity: Number.isFinite(quantity) ? quantity : null,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    });
  }

  return {
    rawText: normalizedText,
    items,
  };
};

const scoreItemAgainstCategory = (itemName, keywords = []) => {
  const normalizedName = String(itemName || '').toLowerCase();

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    return normalizedName.includes(normalizedKeyword) ? score + 1 : score;
  }, 0);
};

const suggestTypeFromItems = (items = []) => {
  const scores = Object.keys(categoryKeywords).reduce((acc, category) => ({
    ...acc,
    [category]: 0,
  }), {});

  items.forEach((item) => {
    const weightBase = Number(item.quantity) * Number(item.unitPrice);
    const weight = Number.isFinite(weightBase) && weightBase > 0 ? weightBase : 1;

    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      const keywordScore = scoreItemAgainstCategory(item.name, keywords);
      if (keywordScore > 0) {
        scores[category] += keywordScore * weight;
      }
    });
  });

  const ranked = Object.entries(scores)
    .filter(([category]) => category !== 'other')
    .sort((a, b) => b[1] - a[1]);

  const [topCategory = 'other', topScore = 0] = ranked[0] || [];
  const [, secondScore = 0] = ranked[1] || [];

  if (topScore <= 0) {
    return { type: 'other', confidence: 0.3 };
  }

  if (topScore > secondScore * 2) {
    return { type: topCategory, confidence: 0.8 };
  }

  return { type: topCategory, confidence: 0.5 };
};

const buildDescription = (merchantName, items = []) => {
  const candidate = merchantName || items[0]?.name || '';
  return candidate.slice(0, 20);
};

const buildRawTextSnippet = (invoiceNumber, amount, items = []) => {
  const itemNames = items.slice(0, 3).map((item) => item.name).filter(Boolean).join(' / ');
  return [`發票 ${invoiceNumber}`, `總計 ${amount}`, itemNames].filter(Boolean).join(' | ');
};

const mergeInvoiceData = (left, right = null) => {
  const items = Array.isArray(right?.items) ? right.items : [];
  const { type, confidence } = suggestTypeFromItems(items);
  const merchantName = left.sellerId || '';

  return normalizeScanResult({
    description: buildDescription(merchantName, items),
    amount: left.amount,
    date: left.date,
    suggestedType: type,
    merchantName,
    confidence: {
      amount: 1,
      date: 1,
      description: merchantName ? 0.9 : 0.6,
      type: confidence,
    },
    rawTextSnippet: buildRawTextSnippet(left.invoiceNumber, left.amount, items),
    source: 'invoice-qr',
    items,
  });
};

export {
  decodeLeftQr,
  decodeRightQr,
  mergeInvoiceData,
  suggestTypeFromItems,
};
