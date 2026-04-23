import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from 'src/boot/firebase';
import {
  RECEIPT_CATEGORIES,
  normalizeScanResult,
} from './scanResultShape';

const MAX_RECEIPT_FILE_SIZE = 5 * 1024 * 1024;
const RECEIPT_SCAN_CALLABLE_NAME = 'scanExpenseReceipt';
const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const functions = getFunctions(app);

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read the selected file.'));
  reader.readAsDataURL(file);
});

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const createMockResult = (file) => {
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

  return normalizeScanResult({
    description: baseName || 'Receipt Expense',
    amount: 245,
    date: getTodayDateString(),
    suggestedType: 'food',
    merchantName: baseName || 'Mock Merchant',
    items: [
      {
        name: 'Sample Item A',
        quantity: 1,
        unitPrice: 120,
      },
      {
        name: 'Sample Item B',
        quantity: 1,
        unitPrice: 125,
      },
    ],
    confidence: {
      amount: 0.94,
      date: 0.91,
      description: 0.83,
      type: 0.72,
    },
    rawTextSnippet: 'MOCK RECEIPT 245.00',
  });
};

const validateReceiptFile = (file) => {
  if (!file) {
    throw new Error('Please choose one receipt image.');
  }

  if (!ALLOWED_RECEIPT_MIME_TYPES.includes(file.type)) {
    throw new Error('Only JPG, PNG, or WEBP images are supported.');
  }

  if (file.size > MAX_RECEIPT_FILE_SIZE) {
    throw new Error('Receipt image must be 5MB or smaller.');
  }
};

const buildReceiptScanPayload = async (file) => ({
  imageBase64: await fileToDataUrl(file),
  mimeType: file.type,
  fileName: file.name,
  size: file.size,
});

const normalizeCallableError = (error) => {
  if (error?.code === 'functions/unauthenticated') {
    return new Error('Please sign in again before scanning a receipt.');
  }

  if (error?.code === 'functions/invalid-argument') {
    return new Error(error.message || 'Receipt image is invalid.');
  }

  if (error?.code === 'functions/failed-precondition') {
    return new Error(error.message || 'Receipt scan service is not configured yet.');
  }

  if (error?.code === 'functions/resource-exhausted') {
    return new Error(error.message || 'Receipt scan service quota has been exceeded.');
  }

  return new Error(error?.message || 'Receipt scan failed.');
};

const scanReceipt = async (file) => {
  validateReceiptFile(file);

  if (import.meta.env.VITE_USE_MOCK_RECEIPT_SCAN !== 'false') {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    return createMockResult(file);
  }

  try {
    const payload = await buildReceiptScanPayload(file);
    const scanExpenseReceipt = httpsCallable(functions, RECEIPT_SCAN_CALLABLE_NAME);
    const response = await scanExpenseReceipt(payload);
    return normalizeScanResult(response.data);
  } catch (error) {
    throw normalizeCallableError(error);
  }
};

export {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE,
  RECEIPT_CATEGORIES,
  buildReceiptScanPayload,
  normalizeScanResult,
  scanReceipt,
  validateReceiptFile,
};
