<template>
  <q-page class="tw-p-4">
    <!-- 新增消費記錄按鈕 -->
    <div class="tw-flex tw-justify-end">
      <q-btn icon="add" color="primary" label="Add Expense"
        outline style="color: goldenrod;"
        @click="showAddExpenseDialog = true"
      />
    </div>

    <!-- 月份選擇器 -->
    <div class="tw-mb-4">
      <q-select
        v-model="selectedMonth"
        :options="months"
        label="Select Month"
        @input="fetchRecords"
      />
    </div>

    <!-- 消費記錄列表 -->
    <q-list>
      <q-item v-for="(record) in visibleRecords" :key="record.id" class="fade-in">
        <q-item-section avatar>
          <q-icon :name="getIconForType(record.type)" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ record.description }}</q-item-label>
          <q-item-label caption>
            {{ record.amount }} {{ record.currency }} - {{ record.date }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- 加載更多的滾動效果 -->
    <q-infinite-scroll @load="loadMoreRecords" />

    <!-- 新增消費記錄對話框 -->
    <q-dialog v-model="showAddExpenseDialog">
      <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
        <q-card-section>
          <div class="text-h6">Add New Expense</div>
          <q-input v-model="newExpense.description" label="Description" />
          <q-input v-model="newExpense.amount" label="Amount" type="number" />

          <!-- 付款人選擇 -->
          <q-select
            v-model="newExpense.payer"
            :options="members"
            label="Select Payer"
            option-value="value"
            option-label="label"
          />

          <q-select
            v-model="newExpense.type"
            :options="expenseTypes"
            label="Expense Type"
          />

          <q-input v-model="newExpense.date" label="Date" type="date" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="negative" @click="showAddExpenseDialog = false" />
          <q-btn flat label="Add" color="primary" @click="addExpense" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  db, ref as dbRef, get, set,
} from 'src/boot/firebase';
import { useRoute } from 'vue-router';
import { getAuth } from 'firebase/auth';
import dayjs from 'dayjs';

// 假設我們從路由參數中獲取群組名稱
const route = useRoute();
const { groupName } = route.params;

// 獲取當前登入用戶
const auth = getAuth();
const user = auth.currentUser;

// 選擇月份和當月記錄的狀態
const selectedMonth = ref('');
const months = ref([]); // 用來存儲過去半年的月份
const records = ref([]); // 存放所有的消費記錄
const visibleRecords = ref([]); // 存放可見的消費記錄
const showAddExpenseDialog = ref(false);

// 存放群組成員
const members = ref([]); // 用來存儲群組中的成員
// 消費類型選項
const expenseTypes = ref([
  { label: 'Transportation', value: 'transportation', icon: 'directions_bus' },
  { label: 'Food', value: 'food', icon: 'restaurant' },
  { label: 'Entertainment', value: 'entertainment', icon: 'theaters' },
  { label: 'Pets', value: 'pets', icon: 'pets' },
  { label: 'Housing', value: 'housing', icon: 'home' },
  { label: 'Utilities', value: 'utilities', icon: 'bolt' },
  { label: 'Daily Supplies', value: 'supplies', icon: 'shopping_cart' },
  { label: 'Other', value: 'other', icon: 'more_horiz' },
]);

// 新增消費記錄的數據
const newExpense = ref({
  description: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10), // 預設為當前日期
  payer: '', // 預設付款人
});

// 生成過去半年的月份
const generateMonths = () => {
  const today = dayjs();
  for (let i = 0; i < 6; i++) {
    const month = today.subtract(i, 'month');
    months.value.push({
      label: month.format('MMMM YYYY'),
      value: month.format('YYYY-MM'),
    });
  }
  // 預設為當前月份
  selectedMonth.value = months.value[0].value;
};

// 獲取群組成員
const fetchMembers = async () => {
  const groupRef = dbRef(db, `/groups/${groupName}/members`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    members.value = Object.values(snapshot.val()).map((member) => ({
      label: member.name,
      value: member.id,
    }));
    console.log('Members:', members.value);
    // 確保user已定義，並將預設付款人設為當前登入用戶
    if (user) {
      newExpense.value.payer = members.value.find((m) => m.value === user.uid)?.value;
    }
  }
};

// 加載當月消費記錄
const fetchRecords = async () => {
  const month = selectedMonth.value || new Date().toISOString().slice(0, 7); // 當前月份
  const groupRef = dbRef(db, `/groups/${groupName}/expenses/${month}`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    records.value = Object.values(snapshot.val());
    visibleRecords.value = records.value.slice(0, 10); // 首次顯示前10筆記錄
  }
};

// 滾動加載更多的消費記錄
const loadMoreRecords = () => {
  const currentLength = visibleRecords.value.length;
  if (currentLength < records.value.length) {
    const nextRecords = records.value.slice(currentLength, currentLength + 10);
    visibleRecords.value.push(...nextRecords);
  }
};

// 新增消費記錄
const addExpense = async () => {
  const month = newExpense.value.date.slice(0, 7);
  // const groupRef = dbRef(db, `/groups/${groupName}/expenses/${month}`);
  const newRecord = {
    id: Date.now().toString(),
    description: newExpense.value.description,
    amount: newExpense.value.amount,
    currency: 'TWD',
    date: newExpense.value.date,
    payer: newExpense.value.payer,
    type: newExpense.value.type,
  };

  await set(dbRef(db, `/groups/${groupName}/expenses/${month}/${newRecord.id}`), newRecord);
  showAddExpenseDialog.value = false;

  // 添加完畢後刷新記錄列表
  fetchRecords();
};

const getIconForType = (type) => {
  const typeInfo = expenseTypes.value.find((t) => t.value === type);
  return typeInfo ? typeInfo.icon : 'more_horiz';
};

// 初始加載消費記錄和群組成員
onMounted(() => {
  generateMonths(); // 生成月份選項
  fetchRecords(); // 加載當月的記錄
  fetchMembers(); // 加載群組成員
});
</script>

<style scoped>
.fade-in {
  animation: fadeIn 1s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
