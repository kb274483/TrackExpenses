const functions = require('firebase-functions');
const admin = require('firebase-admin');
const dayjs = require('dayjs');

admin.initializeApp();

const db = admin.database();

// 每天執行一次的 Scheduled Function
exports.autoAddFixedExpenses = functions.pubsub.schedule('every day 10:30').timeZone('Asia/Taipei').onRun(async () => {
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
          payer: { label: expense.payerId.label, value: expense.payerId.value },
          members: groupData.members ? Object.values(groupData.members).map((member) => ({
            label: member.name,
            value: member.id,
          })) : [],
          type: { icon: 'stars', label: 'Fixed Expense', value: 'fixed' },
        };

        // 檢查是否有開啟期數設定
        if (expense.installments && expense.paymentTerms > 0) {
          // 更新期數
          const updatedPaymentTerms = parseInt(expense.paymentTerms, 10) - 1;
          // 更新支出項目的期數
          await db.ref(`/groups/${groupName}/groupSettings/fixedExpenses/${expenseId}`).update({
            paymentTerms: updatedPaymentTerms,
          });
          // 如果期數為 0，則移除支出項目
          if (updatedPaymentTerms === 0) {
            await db.ref(`/groups/${groupName}/groupSettings/fixedExpenses/${expenseId}`).remove();
          }
        }

        // 將支出項目新增至當月的消費紀錄中
        await db.ref(`/groups/${groupName}/expenses/${currentMonth}/${expenseRecordId}`).set(newExpense);
      });
    });

    console.log('Fixed expenses successfully added.');
    return null;
  } catch (error) {
    console.error('Error adding fixed expenses:', error);
    return null;
  }
});
