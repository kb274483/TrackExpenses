const RECEIPT_CATEGORIES = [
  'transportation',
  'food',
  'entertainment',
  'pets',
  'housing',
  'supplies',
  'investment',
  'shopping',
  'other',
];

const DEFAULT_CONFIDENCE = {
  amount: 0,
  date: 0,
  description: 0,
  type: 0,
};

const normalizeAmount = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeDate = (value) => {
  if (!value) return null;

  const normalizedValue = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : null;
};

const normalizeSuggestedType = (value) => {
  if (!value) return 'other';
  return RECEIPT_CATEGORIES.includes(value) ? value : 'other';
};

const normalizeConfidenceValue = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const normalizeConfidence = (confidence = {}) => ({
  amount: normalizeConfidenceValue(confidence.amount),
  date: normalizeConfidenceValue(confidence.date),
  description: normalizeConfidenceValue(confidence.description),
  type: normalizeConfidenceValue(confidence.type),
});

const normalizeItemName = (value) => {
  if (!value) return '';
  return String(value).trim();
};

const normalizeItemNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeScanItems = (items) => {
  if (!Array.isArray(items)) return undefined;

  const normalizedItems = items
    .map((item) => ({
      name: normalizeItemName(item?.name),
      quantity: normalizeItemNumber(item?.quantity),
      unitPrice: normalizeItemNumber(item?.unitPrice),
    }))
    .filter((item) => item.name || item.quantity !== null || item.unitPrice !== null);

  return normalizedItems.length > 0 ? normalizedItems : undefined;
};

const normalizeScanResult = (result = {}) => ({
  description: result.description || result.merchantName || '',
  amount: normalizeAmount(result.amount),
  date: normalizeDate(result.date),
  suggestedType: normalizeSuggestedType(result.suggestedType),
  merchantName: result.merchantName || '',
  confidence: {
    ...DEFAULT_CONFIDENCE,
    ...normalizeConfidence(result.confidence),
  },
  rawTextSnippet: result.rawTextSnippet || '',
  source: result.source === 'invoice-qr' ? 'invoice-qr' : 'ocr',
  items: normalizeScanItems(result.items),
});

export {
  RECEIPT_CATEGORIES,
  normalizeAmount,
  normalizeConfidence,
  normalizeDate,
  normalizeItemNumber,
  normalizeItemName,
  normalizeScanItems,
  normalizeScanResult,
  normalizeSuggestedType,
};
