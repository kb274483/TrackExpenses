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

    <!-- 幣別選擇器（轉換成新台幣） -->
    <div class="tw-mb-4">
      <q-select
        v-model="selectedCurrency"
        :options="currencyOptions"
        label="幣別（轉換成新台幣）"
        emit-value
        map-options
        @update:model-value="onCurrencyChange"
      />
    </div>

    <!-- 成員總花費列表 -->
    <div class="tw-mb-4">
      <p class="tw-text-gray-600 tw-font-semibold tw-mb-1">個人消費總額：</p>
      <q-list bordered class="tw-rounded">
        <q-item class="tw-p-2"
          v-for="(total, index) in totalExpenses" :key="index"
        >
          <q-item-label class="tw-flex tw-items-center">
            <span class="tw-font-semibold tw-mr-2">{{ total.member }}</span>
            <span class="tw-font-bold tw-text-red-500">$：{{ formatAmount(total.amount) }}</span>
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
      <q-item class="tw-p-2"
        v-for="(settlement, index) in settlements" :key="index"
      >
        <q-item-label class="tw-flex tw-justify-center tw-items-center tw-gap-1">
          <span class="tw-font-semibold">{{ settlement.payer }}</span>
          <q-icon name="money" class="tw-text-gray-600 tw-text-3xl" />
          <q-icon name="arrow_forward" class="tw-text-gray-600 tw-text-2xl" />
          <span class="tw-font-semibold tw-text-primary">{{ settlement.receiver }}</span>
          <span class="tw-font-bold tw-text-red-500"> ${{ formatAmount(settlement.amount) }}</span>
        </q-item-label>
        <q-checkbox
          keep-color size="lg"
          v-model="settlement.paid"
          :color="isReceiver(settlement) ? 'teal' : 'grey'"
          :disable="!isReceiver(settlement)"
          @update:model-value="updateSettlementStatus(index, settlement.paid)"
        />
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup>
import {
  ref, onMounted, watch, computed,
} from 'vue';
import { useRoute } from 'vue-router';
import {
  db, ref as dbRef, get, set,
} from 'src/boot/firebase';
import { getAuth } from 'firebase/auth';
import { generateMonths } from 'src/utils/generateDate';
import axios from 'axios';

// 獲取當前用戶
const auth = getAuth();
const user = auth.currentUser;

// 月份選擇器
const selectedMonth = ref('');
const months = ref([]);

// 结果
const settlements = ref([]);
const totalExpenses = ref([]);

// 匯率/幣別
const selectedCurrency = ref(null); // null 代表不轉換，選擇外幣時轉為 TWD
const currencyOptions = [
  { label: '不轉換', value: null },
  { label: '美金 USD → TWD', value: 'USD' },
  { label: '日幣 JPY → TWD', value: 'JPY' },
  { label: '歐元 EUR → TWD', value: 'EUR' },
];
const conversionRate = ref(1); // 以選擇的幣別換算成 TWD 的比率

// 群组名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

// 生成月份
// const generateMonths = () => {
//   const today = dayjs();
//   for (let i = 0; i < 12; i++) {
//     const month = today.subtract(i, 'month');
//     months.value.push({
//       label: month.format('MMMM YYYY'),
//       value: month.format('YYYY-MM'),
//     });
//   }
//   selectedMonth.value = months.value[0].value;
// };

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
        payerId: payer.memberId,
        receiver: getMemberName(receiver.memberId),
        receiverId: receiver.memberId,
        amount: Math.round(paymentAmount),
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
  const debtRef = dbRef(db, `/groups/${watchGroupName.value}/settlements/${month}`);
  const snapshot = await get(groupRef);
  const debtStatus = await get(debtRef);

  if (snapshot.exists()) {
    const expenses = Object.values(snapshot.val());
    const debtMap = {};
    const memberExpenses = {}; // 紀錄每個成員的花費
    const memberMapById = new Map();

    (members.value || []).forEach((m) => {
      if (m && m.value) memberMapById.set(m.value, { label: m.label, value: m.value });
    });
    // 再掃過當月所有紀錄，把付款人與參與人補齊
    expenses.forEach((expense) => {
      const payer = expense && expense.payer;
      if (payer && payer.value) {
        if (!memberMapById.has(payer.value)) {
          memberMapById.set(payer.value, { label: payer.label || 'Unknown', value: payer.value });
        }
      }
      const involved = Array.isArray(expense.members) ? expense.members : [];
      involved.forEach((mem) => {
        if (mem && mem.value && !memberMapById.has(mem.value)) {
          memberMapById.set(mem.value, { label: mem.label || 'Unknown', value: mem.value });
        }
      });
    });
    // 用合併後的名單替換本頁的 members，以利後續 getMemberName 與計算使用
    members.value = Array.from(memberMapById.values());

    // 初始化每個成員的債務關係 debtMap 和花費 memberExpenses（使用合併後的 members）
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

      if (debtMap[payerId] === undefined) {
        debtMap[payerId] = 0;
        memberExpenses[payerId] = 0;
      }
      debtMap[payerId] += totalAmount; // 累加付款人的應付金額
      memberExpenses[payerId] += totalAmount; // 累加付款人的花費金額

      // 每個成員（包含付款人）應分擔的金額
      involvedMembers.forEach((member) => {
        if (debtMap[member.value] === undefined) {
          debtMap[member.value] = 0;
          memberExpenses[member.value] = memberExpenses[member.value] || 0;
        }
        debtMap[member.value] -= perPersonAmount; // 每個成員減去應付的分擔金額
      });
    });

    // 設置每個成員的花費總額（四捨五入到整數）
    totalExpenses.value = Object.entries(memberExpenses).map(([memberId, amount]) => ({
      member: getMemberName(memberId),
      amount: Math.round(amount),
    }));

    // 讀取既有的已付款狀態，以逐筆保留
    const existingPaidMap = new Map();
    if (debtStatus.exists()) {
      const raw = debtStatus.val();
      const existingList = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
      existingList.forEach((item) => {
        if (!item) return;
        const keyByIds = `${item.payerId || ''}-${item.receiverId || ''}`;
        const keyByNames = `${item.payer}-${item.receiver}`;
        existingPaidMap.set(keyByIds, !!item.paid);
        existingPaidMap.set(keyByNames, !!item.paid);
      });
    }
    // 生成結算列表（金額四捨五入到整數），並合併既有已付款狀態
    settlements.value = generateSettlementList(debtMap).map((settlement) => {
      const keyByIds = `${settlement.payerId}-${settlement.receiverId}`;
      const keyByNames = `${settlement.payer}-${settlement.receiver}`;
      const paid = existingPaidMap.has(keyByIds)
        ? existingPaidMap.get(keyByIds)
        : (existingPaidMap.get(keyByNames) || false);
      return { ...settlement, paid };
    });
  } else {
    settlements.value = [];
  }
};

const totalGroupExpense = computed(() => {
  const baseTotal = totalExpenses.value.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const converted = Math.round(baseTotal * Number(conversionRate.value || 1));
  return `總花費: $${converted}`;
});

// 判斷是否為應收款人
const isReceiver = computed(() => (settlement) => (user && settlement.receiverId === user.uid));

// 更新結算狀態
const updateSettlementStatus = async () => {
  const month = selectedMonth.value.value || new Date().toISOString().slice(0, 7);
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}/settlements/${month}`);

  // 更新資料庫狀態
  await set(groupRef, settlements.value);
};

// 即時匯率：將選擇的幣別轉為 TWD 的匯率
const fetchConversionRate = async (fromCurrency) => {
  try {
    if (!fromCurrency) {
      conversionRate.value = 1;
      return;
    }
    const { data } = await axios.get(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    const primaryRate = data && data.result === 'success' && data.rates && data.rates.TWD
      ? Number(data.rates.TWD)
      : null;
    if (primaryRate && Number.isFinite(primaryRate)) {
      conversionRate.value = primaryRate;
      return;
    }
    // 備用匯率來源
    const fallbackUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${String(fromCurrency)
      .toLowerCase()}/twd.json`;
    const fallback = await axios.get(fallbackUrl);
    const fallbackRate = (fallback && fallback.data && fallback.data.twd)
      ? Number(fallback.data.twd)
      : 1;
    conversionRate.value = fallbackRate || 1;
  } catch (e) {
    conversionRate.value = 1;
  }
};

const onCurrencyChange = async (val) => {
  await fetchConversionRate(val);
};

// 將金額依據 conversionRate 轉為 TWD 並四捨五入
const formatAmount = (amount) => {
  const num = Number(amount) || 0;
  return Math.round(num * Number(conversionRate.value || 1));
};

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
  months.value = generateMonths();
  const [firstMonth] = months.value;
  selectedMonth.value = firstMonth;
});
</script>
