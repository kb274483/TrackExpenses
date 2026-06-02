// 將金額依據 conversionRate 轉為 TWD，四捨五入並加上千分位
export const formatAmount = (amount, conversionRate = 1) => {
  const num = Number(amount) || 0;
  const converted = Math.round(num * Number(conversionRate));
  return Number.isFinite(converted)
    ? converted.toLocaleString('zh-TW')
    : '0';
};
