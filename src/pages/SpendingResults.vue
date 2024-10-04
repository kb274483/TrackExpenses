<template>
  <q-page class="tw-p-4">
    <div class="tw-relative">
      <q-icon name="badge"
        class="tw-font-bold tw-text-gray-600 tw-text-2xl tw-relative -tw-top-1"
      />
      <span class="tw-font-bold tw-text-gray-600 tw-text-lg">{{ watchGroupName }}</span>
      帳目結算
    </div>
    <!-- 月份選擇器 -->
    <div class="tw-mb-4">
      <q-select
        v-model="selectedMonth"
        :options="months"
        label="Select Month"
        @update:model-value="calculateSettlements"
      />
    </div>

    <!-- 成員總花費列表 -->
    <div class="tw-mb-4">
      <p class="tw-text-gray-600 tw-font-semibold tw-mb-1">個人消費總額：</p>
      <q-list bordered class="tw-rounded">
        <q-item v-for="(total, index) in totalExpenses" :key="index">
          <q-item-label>
            <span class="tw-font-semibold tw-mr-2">{{ total.member }}</span>
            <span class="tw-font-bold tw-text-red-500">$：{{ total.amount }}</span>
          </q-item-label>
        </q-item>
      </q-list>
      <p class="tw-text-gray-600 tw-text-lg tw-font-semibold tw-mt-1 tw-text-end">
        {{ totalGroupExpense }}
      </p>
    </div>

    <!-- 結算列表 -->
    <p class="tw-text-gray-600 tw-font-semibold tw-mb-1">結算：</p>
    <q-list bordered class="tw-rounded">
      <q-item v-for="(settlement, index) in settlements" :key="index">
        <q-item-label class="tw-flex tw-justify-center tw-items-center tw-gap-1">
          <span class="tw-font-semibold">{{ settlement.payer }}</span>
          <q-icon name="money" class="tw-text-gray-600 tw-text-3xl" />
          <q-icon name="arrow_forward" class="tw-text-gray-600 tw-text-2xl" />
          <span class="tw-font-semibold tw-text-primary">{{ settlement.receiver }}</span>
          <span class="tw-font-bold tw-text-red-500"> ${{ settlement.amount }}</span>
        </q-item-label>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup>
import {
  ref, onMounted, watch, computed,
} from 'vue';
import { useRoute } from 'vue-router';
import { db, ref as dbRef, get } from 'src/boot/firebase';
import dayjs from 'dayjs';

// 月份選擇器
const selectedMonth = ref('');
const months = ref([]);

// 结果
const settlements = ref([]);
const totalExpenses = ref([]);

// 群组名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

// 生成月份
const generateMonths = () => {
  const today = dayjs();
  for (let i = 0; i < 6; i++) {
    const month = today.subtract(i, 'month');
    months.value.push({
      label: month.format('MMMM YYYY'),
      value: month.format('YYYY-MM'),
    });
  }
  selectedMonth.value = months.value[0].value;
};

// 取得群組成員
const members = ref([]);
const fetchMembers = async () => {
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}/members`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    members.value = Object.values(snapshot.val()).map((member) => ({
      label: member.name,
      value: member.id,
    }));
  }
};

// 取得成員名稱
const getMemberName = (memberId) => {
  const member = members.value.find((m) => m.value === memberId);
  return member ? member.label : 'Unknown';
};

// 生成結算列表
const generateSettlementList = (debtMap) => {
  const positiveDebt = []; // 應收款
  const negativeDebt = []; // 應付款

  // 將 debtMap 中的正數和負數分別加入到 positiveDebt 和 negativeDebt 中
  Object.entries(debtMap).forEach(([memberId, amount]) => {
    if (amount > 0) {
      positiveDebt.push({ memberId, amount }); // 應收款
    } else if (amount < 0) {
      negativeDebt.push({ memberId, amount: Math.abs(amount) }); // 應付款
    }
  });

  const settlementList = [];

  // 應收款人應該向應付款人索取錢
  positiveDebt.forEach((receiver) => {
    negativeDebt.forEach((payer) => {
      if (receiver.amount === 0 || payer.amount === 0) return; // 如果某一方金額已經為0則跳過

      const paymentAmount = Math.min(receiver.amount, payer.amount); // 確定支付的金額
      settlementList.push({
        payer: getMemberName(payer.memberId),
        receiver: getMemberName(receiver.memberId),
        amount: paymentAmount.toFixed(2),
      });

      receiver.amount -= paymentAmount; // 更新應收款人的金額
      payer.amount -= paymentAmount; // 更新應付款人的金額
    });
  });

  return settlementList;
};

// 計算 消費結果
const calculateSettlements = async () => {
  totalExpenses.value = [];
  const month = selectedMonth.value.value || new Date().toISOString().slice(0, 7);
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}/expenses/${month}`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    const expenses = Object.values(snapshot.val());
    const debtMap = {};
    const memberExpenses = {}; // 紀錄每個成員的花費

    // 初始化每個成員的債務關係 debtMap 和花費 memberExpenses
    members.value.forEach((member) => {
      debtMap[member.value] = 0;
      memberExpenses[member.value] = 0;
    });

    // 計算每個成員的應付金額和實際支付金額
    expenses.forEach((expense) => {
      const totalAmount = parseFloat(expense.amount); // 總金額
      const payerId = expense.payer.value; // 付款人ID
      const involvedMembers = expense.members; // 涉及的成員
      const perPersonAmount = totalAmount / involvedMembers.length; // 每個成員應付的金額

      // 付款人支付了整個金額，因此他的債務應加上這筆金額
      debtMap[payerId] += totalAmount;
      memberExpenses[payerId] += totalAmount; // 累加付款人的花費金額

      // 每個成員（包含付款人）應分擔的金額
      involvedMembers.forEach((member) => {
        debtMap[member.value] -= perPersonAmount; // 每個成員減去應付的分擔金額
      });
    });

    // 設置每個成員的花費總額
    totalExpenses.value = Object.entries(memberExpenses).map(([memberId, amount]) => ({
      member: getMemberName(memberId),
      amount: amount.toFixed(2),
    }));

    // 生成結算列表
    settlements.value = generateSettlementList(debtMap);
  } else {
    settlements.value = [];
  }
};

const totalGroupExpense = computed(() => {
  const total = totalExpenses.value.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  return `總花費: $${total.toFixed(2)}`;
});

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    watchGroupName.value = newGroupName;
    await fetchMembers();
    calculateSettlements();
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化
onMounted(async () => {
  generateMonths();
  await fetchMembers();
  calculateSettlements();
});
</script>
