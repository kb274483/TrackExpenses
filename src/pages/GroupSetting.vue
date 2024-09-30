<template>
  <q-page class="tw-p-4">
    <div class="tw-font-semibold tw-text-lg tw-text-gray-600">群組設定</div>
    <!-- 新增固定支出按鈕 -->
    <div class="tw-flex tw-justify-end tw-mb-4">
      <q-btn icon="add" label="Add fixed expenses"
        push color="white" text-color="secondary"
        @click="openFixedExpenseDialog"
      />
    </div>

    <!-- 固定支出列表 -->
    <q-list bordered class="tw-rounded">
      <q-item v-for="(expense, index) in fixedExpenses" :key="index">
        <div class="tw-grid tw-grid-cols-6 tw-gap-2">
          <div class="tw-col-span-2">
            <span class="block tw-font-bold">{{ expense.name }}</span>
            {{ expense.amount }} 元
          </div>
          <div class="tw-col-span-3">
            <span class="block">{{ expense.date.label }}</span>
            <span class="tw-font-bold">
              {{ getMemberName(expense.payerId.value) }}
            </span>
            付款
          </div>
        </div>
        <q-btn icon="delete"
          class="tw-ml-auto"
          color="negative" flat
          @click="deleteFixedExpense(index)"
        />
      </q-item>
    </q-list>

    <!-- 新增/編輯固定支出對話框 -->
    <q-dialog persistent v-model="showFixedExpenseDialog">
      <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
        <q-card-section>
          <div class="text-h6">Fixed expenses</div>
          <q-input v-model="expenseData.name"
            label="Expense name"
            :error="!expenseData.name && isSubmitted"
            error-message="Expense name is required"
          />
          <q-input v-model="expenseData.amount"
            label="Expense amount" type="number"
            :error="!expenseData.amount && isSubmitted"
            error-message="Expense amount is required"
          />
          <q-select
            v-model="expenseData.date"
            :options="dateOptions"
            label="Monthly payment date"
            :error="!expenseData.date && isSubmitted"
            error-message="Expense date is required"
          />
          <q-select
            v-model="expenseData.payerId"
            :options="memberOptions"
            label="Payer"
            option-value="value"
            option-label="label"
            :error="!expenseData.payerId && isSubmitted"
            error-message="Payer is required"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="negative"
            @click="showFixedExpenseDialog = false, isSubmitted = false"
          />
          <q-btn flat label="Save" color="primary" @click="saveFixedExpense" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import {
  db, ref as dbRef, get, set,
} from 'src/boot/firebase';
import { useRoute } from 'vue-router';

// 狀態變數
const showFixedExpenseDialog = ref(false);
const expenseData = ref({
  name: '', amount: 0, date: '', payerId: '',
});
const fixedExpenses = ref([]);
const members = ref([]);
const memberOptions = ref([]);
const dateOptions = ref([]);
const isSubmitted = ref(false);

// 取得群組名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

// 初始化日期選項
for (let i = 1; i <= 31; i++) {
  dateOptions.value.push({ label: `每月 ${i} 日`, value: i });
}

// 開啟對話框
const openFixedExpenseDialog = () => {
  showFixedExpenseDialog.value = true;
  expenseData.value = {
    name: '', amount: 0, date: '', payerId: '',
  };
};

// 取得群組成員
const fetchMembers = async () => {
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}/members`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    members.value = Object.values(snapshot.val());
    memberOptions.value = members.value.map((member) => ({
      label: member.name,
      value: member.id,
    }));
  }
};

// 取得成員名稱
const getMemberName = (memberId) => {
  const member = members.value.find((m) => m.id === memberId);
  return member ? member.name : '未知成員';
};

// 儲存固定支出設定
const saveFixedExpense = async () => {
  isSubmitted.value = true;
  // 檢查是否有空值
  if (!expenseData.value.name
    || !expenseData.value.amount
    || !expenseData.value.date
    || !expenseData.value.payerId
  ) {
    return;
  }
  const groupSettingsRef = dbRef(db, `/groups/${watchGroupName.value}/groupSettings/fixedExpenses`);
  const updatedExpenses = [...fixedExpenses.value, { ...expenseData.value }];
  await set(groupSettingsRef, updatedExpenses);
  fixedExpenses.value = updatedExpenses;
  showFixedExpenseDialog.value = false;
};

// 取得現有固定支出設定
const fetchFixedExpenses = async () => {
  fixedExpenses.value = [];
  const groupSettingsRef = dbRef(db, `/groups/${watchGroupName.value}/groupSettings/fixedExpenses`);
  const snapshot = await get(groupSettingsRef);

  if (snapshot.exists()) {
    fixedExpenses.value = snapshot.val() || [];
  }
};

// 刪除固定支出
const deleteFixedExpense = async (index) => {
  const groupSettingsRef = dbRef(db, `/groups/${watchGroupName.value}/groupSettings/fixedExpenses`);
  const updatedExpenses = [...fixedExpenses.value];
  updatedExpenses.splice(index, 1);
  await set(groupSettingsRef, updatedExpenses);
  fixedExpenses.value = updatedExpenses;
};

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    watchGroupName.value = newGroupName;
    await fetchMembers();
    await fetchFixedExpenses();
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化
onMounted(() => {
  fetchMembers();
  fetchFixedExpenses();
});
</script>

<style scoped>
.tw-rounded {
  border-radius: 8px;
}
</style>
