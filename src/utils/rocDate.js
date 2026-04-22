const rocDateStringToIso = (value) => {
  const normalized = String(value || '').replace(/\D/g, '');

  if (normalized.length !== 7) return null;

  const rocYear = Number(normalized.slice(0, 3));
  const month = Number(normalized.slice(3, 5));
  const day = Number(normalized.slice(5, 7));

  if (!Number.isInteger(rocYear) || rocYear <= 0) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  const year = rocYear + 1911;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return iso;
};

export {
  rocDateStringToIso,
};
