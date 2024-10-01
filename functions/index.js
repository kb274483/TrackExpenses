const functions = require('firebase-functions');
const admin = require('firebase-admin');
const dayjs = require('dayjs');

admin.initializeApp();

const db = admin.database();

// 每天執行一次的 Scheduled Function
exports.autoAddFixedExpenses = functions.pubsub.schedule('every day 02:30').onRun(async () => {
  const today = dayjs().date(); // 取得今天的日期
  const currentMonth = dayjs().format('YYYY-MM'); // 取得當前月份，格式：2024-09

  try {
    // 取得所有群組的固定支出設定
    const groupsSnapshot = await db.ref('groups').once('value');
    const groups = groupsSnapshot.val();

    if (!groups) return null;

    // 逐一檢查每個群組的設定
    Object.entries(groups).forEach(async ([groupName, groupData]) => {
      const fixedExpenses = groupData.groupSettings?.fixedExpenses || [];

      // 篩選出今天需要新增的固定支出
      const todayExpenses = fixedExpenses.filter(
        (expense) => parseInt(expense.date.value, 10) === today,
      );

      if (todayExpenses.length > 0) {
        todayExpenses.forEach(async (expense) => {
          const expenseId = Date.now().toString(); // 產生新的消費記錄 ID
          const newExpense = {
            id: expenseId,
            description: expense.name,
            amount: expense.amount,
            date: new Date().toISOString().slice(0, 10),
            payer: { label: expense.payerId.label, value: expense.payerId.value },
            members: groupData.members ? Object.values(groupData.members).map((member) => ({
              label: member.name,
              value: member.id,
            })) : [],
            type: { icon: 'stars', label: 'Fixed Expense', value: 'fixed' },
          };

          // 將支出項目新增至當月的消費紀錄中
          await db.ref(`/groups/${groupName}/expenses/${currentMonth}/${expenseId}`).set(newExpense);
        });
      }
    });

    console.log('Fixed expenses successfully added.');
    return null;
  } catch (error) {
    console.error('Error adding fixed expenses:', error);
    return null;
  }
});
