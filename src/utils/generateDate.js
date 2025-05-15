import dayjs from 'dayjs';

export const generateMonths = () => {
  const months = [];
  const today = dayjs();
  for (let i = 0; i < 12; i++) {
    const month = today.subtract(i, 'month');
    months.push({
      label: month.format('MMMM YYYY'),
      value: month.format('YYYY-MM'),
    });
  }
  return months;
};
