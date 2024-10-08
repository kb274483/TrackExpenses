<template>
  <q-page class="tw-p-4">
    <div class="tw-relative tw-mb-4">
      <q-icon name="badge"
        class="tw-font-bold tw-text-gray-600 tw-text-2xl tw-relative -tw-top-1"
      />
      <span class="tw-font-bold tw-text-gray-600 tw-text-lg">
        {{ watchGroupName }}
      </span> 群組設定
    </div>
    <q-tabs
      v-model="tab"
      class="text-teal tw-mb-4"
    >
      <q-tab name="fixedExpense" label="固定支出" />
      <q-tab name="expenseType" label="自訂消費類別" />
    </q-tabs>

    <!-- 新增固定支出按鈕 -->
    <div v-if="tab === 'fixedExpense'"
      class="tw-flex tw-justify-end tw-mb-4">
      <q-btn icon="add" label="新增固定支出"
        push color="white" text-color="secondary"
        @click="openFixedExpenseDialog"
      />
    </div>
    <div v-if="tab === 'expenseType'"
      class="tw-flex tw-justify-end tw-mb-4"
    >
      <q-btn icon="add" label="新增自訂消費類別"
        push color="white" text-color="secondary"
        @click="openExpenseTypeDialog"
      />
    </div>

    <!-- 固定支出列表 -->
    <q-list v-if="tab === 'fixedExpense'">
      <q-item v-for="(expense, index) in fixedExpenses" :key="index"
        class="tw-border tw-border-gray-300 tw-rounded tw-my-2"
      >
        <div class="tw-grid tw-grid-cols-6 tw-gap-2">
          <div class="tw-col-span-2">
            <span class="block tw-font-bold">{{ expense.name }}</span>
            {{ expense.amount }} 元
          </div>
          <div class="tw-col-span-3">
            <span class="block">{{ expense.date.label }}</span>
            <span class="tw-font-bold">{{ getMemberName(expense.payerId.value) }}</span> 付款
          </div>
          <q-btn icon="delete" color="negative" flat @click="deleteFixedExpense(index)" />
        </div>
      </q-item>
    </q-list>

    <!-- 自定義消費類型列表 -->
    <q-list v-if="tab === 'expenseType'">
      <q-item v-for="(type, index) in customExpenseTypes" :key="index"
        class="tw-border tw-border-gray-300 tw-rounded tw-my-2"
      >
        <q-item-section class="tw-flex">
          <span class="tw-font-bold tw-text-gray-600 tw-text-xl">
            <q-icon :name="type.icon" class="tw-text-gray-600 tw-text-xl" />
            {{ type.label }}
          </span>
        </q-item-section>
        <q-btn icon="delete" color="negative" flat @click="deleteExpenseType(index)" />
      </q-item>
    </q-list>

    <!-- 新增/編輯固定支出對話框 -->
    <q-dialog persistent v-model="showFixedExpenseDialog">
      <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
        <q-card-section>
          <div class="text-h6">固定支出設定</div>
          <q-input v-model="expenseData.name"
            label="支出名稱"
            :error="!expenseData.name && isSubmitted"
            error-message="必須填寫名稱"
          />
          <q-input v-model="expenseData.amount"
            label="支出金額" type="number"
            :error="!expenseData.amount && isSubmitted"
            error-message="必須填寫金額"
          />
          <q-select v-model="expenseData.date"
            :options="dateOptions" label="每月支出日期"
            :error="!expenseData.date && isSubmitted"
            error-message="必須選擇日期"
          />
          <q-select v-model="expenseData.payerId"
            :options="memberOptions" label="付款人"
            option-value="value" option-label="label"
            :error="!expenseData.payerId && isSubmitted"
            error-message="必須選擇付款人"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" color="negative"
            @click="showFixedExpenseDialog = false, isSubmitted = false"
          />
          <q-btn flat label="儲存" color="primary" @click="saveFixedExpense" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 新增自訂消費類別對話框 -->
    <q-dialog persistent v-model="showExpenseTypeDialog">
      <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
        <q-card-section>
          <div class="text-h6">新增自訂消費類別</div>
          <q-input v-model="newExpenseType.label"
            label="類型名稱"
            :error="!newExpenseType.label && isSubmitted"
            error-message="必須填寫名稱"
          />
          <q-select
            v-model="newExpenseType.icon"
            :options="iconOptions"
            label="選擇圖示"
            option-value="value"
            option-label="label"
            option-slot
            :error="!newExpenseType.icon && isSubmitted"
            error-message="必須選擇圖示"
          >
            <template v-slot:option="scope">
              <q-item class="tw-text-gray-600">
                <q-item-section avatar v-close-popup
                  @click="newExpenseType.icon = scope.opt.value"
                >
                  <q-icon :name="scope.opt.value" />
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" color="negative"
            @click="showExpenseTypeDialog = false,
              isSubmitted = false, newExpenseType = { label: '', value: '', icon: '' }
            "
          />
          <q-btn flat label="新增" color="primary" @click="addExpenseType" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, watch } from 'vue';
import {
  db, ref as dbRef, get, set, push,
} from 'src/boot/firebase';
import { useRoute } from 'vue-router';

// 狀態變數
const tab = ref('fixedExpense');
const showFixedExpenseDialog = ref(false);
const showExpenseTypeDialog = ref(false);
const expenseData = ref({
  name: '', amount: 0, date: '', payerId: '',
});
const newExpenseType = ref({ label: '', value: '', icon: '' });
const fixedExpenses = ref([]);
const customExpenseTypes = ref([]);
const members = ref([]);
const memberOptions = ref([]);
const dateOptions = ref([]);
const isSubmitted = ref(false);

// 圖示選項
const iconOptions = ref([
  { label: 'shopping', value: 'shopping_bag' },
  { label: 'celebration', value: 'celebration' },
  { label: 'camera', value: 'photo_camera' },
  { label: 'lock', value: 'lock' },
  { label: 'redeem', value: 'redeem' },
  { label: 'favorite', value: 'favorite' },
  { label: 'rocket', value: 'rocket_launch' },
  { label: 'car', value: 'directions_car' },
  { label: 'computer', value: 'computer' },
  { label: 'lightbulb', value: 'lightbulb' },
  { label: 'phone', value: 'phone_iphone' },
  { label: 'coffee', value: 'coffee' },
  { label: 'landscape', value: 'landscape' },
  { label: 'book', value: 'menu_book' },
  { label: 'airplane', value: 'airplanemode_active' },
  { label: 'clothing', value: 'checkroom' },
  { label: 'savings', value: 'savings' },
  { label: 'currency', value: 'monetization_on' },
  { label: 'gym', value: 'fitness_center' },
  { label: 'savings', value: 'savings' },
  { label: 'currency', value: 'monetization_on' },
]);

// 取得群組名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

// 初始化日期選項
for (let i = 1; i <= 31; i++) {
  dateOptions.value.push({ label: `每月 ${i} 日`, value: i });
}

// 開啟新增固定支出對話框
const openFixedExpenseDialog = () => {
  showFixedExpenseDialog.value = true;
  expenseData.value = {
    name: '', amount: 0, date: '', payerId: '',
  };
};

// 開啟新增自訂消費類別對話框
const openExpenseTypeDialog = () => {
  showExpenseTypeDialog.value = true;
  newExpenseType.value = { label: '', value: '', icon: '' };
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

// 取得自定義消費類型
const fetchCustomExpenseTypes = async () => {
  const expenseTypesRef = dbRef(db, `/groups/${watchGroupName.value}/expenseTypes/custom`);
  const snapshot = await get(expenseTypesRef);
  if (snapshot.exists()) {
    customExpenseTypes.value = Object.values(snapshot.val());
  }
};

// 新增自訂消費類別
const addExpenseType = async () => {
  isSubmitted.value = true;
  // 檢查是否有空值
  if (!newExpenseType.value.label || !newExpenseType.value.icon) {
    return;
  }
  const expenseTypesRef = dbRef(db, `/groups/${watchGroupName.value}/expenseTypes/custom`);
  const newKey = push(expenseTypesRef).key;
  newExpenseType.value.value = newKey;

  const updatedTypes = [...customExpenseTypes.value, { ...newExpenseType.value }];
  await set(expenseTypesRef, updatedTypes);
  customExpenseTypes.value = updatedTypes;
  showExpenseTypeDialog.value = false;
};

// 刪除自訂消費類別
const deleteExpenseType = async (index) => {
  const expenseTypesRef = dbRef(db, `/groups/${watchGroupName.value}/expenseTypes/custom`);
  const updatedTypes = [...customExpenseTypes.value];
  updatedTypes.splice(index, 1);
  await set(expenseTypesRef, updatedTypes);
  customExpenseTypes.value = updatedTypes;
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

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    watchGroupName.value = newGroupName;
    await fetchMembers();
    await fetchFixedExpenses();
    await fetchCustomExpenseTypes();
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化
// onMounted(() => {
//   fetchMembers();
//   fetchCustomExpenseTypes();
// });
</script>

<style scoped>
.tw-rounded {
  border-radius: 8px;
}
</style>
