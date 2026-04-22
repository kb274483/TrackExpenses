<template>
  <q-page class="tw-py-4 tw-px-2">
    <!-- 新增消費記錄按鈕 -->
    <div class="tw-flex tw-justify-between tw-items-center">
      <div class="tw-relative">
        <q-icon name="badge"
          class="tw-font-bold tw-text-gray-600 tw-text-2xl tw-relative -tw-top-1"
        />
        <span class="tw-font-bold tw-text-gray-600 tw-text-lg">{{ watchGroupName }}</span>
        消費紀錄
      </div>
      <q-btn icon="add" label="Add Expense"
        push color="white" text-color="secondary"
        @click="openExpenseDialog('add')"
      />
    </div>

    <!-- 月份選擇器 -->
    <div class="tw-mb-4">
      <q-select
        v-model="selectedMonth"
        :options="months"
        label="Select Month"
        @update:model-value="handleMonthChange"
      />
    </div>

    <!-- 消費記錄列表 -->
    <q-list>
      <q-item class="tw-p-2"
        v-for="(record) in records" :key="record.id" :ref="setRecordRef"
      >
        <q-item-section avatar>
          <q-icon :name="getIconForType(record.type)" class="tw-text-gray-600" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            <div class="tw-grid tw-grid-cols-2 tw-gap-2">
              <strong>
                {{ record.description }}
                <q-chip
                  v-if="record.splitMethod && record.splitMethod !== 'equal'"
                  dense square size="sm"
                  color="primary" text-color="white"
                  :label="getSplitMethodLabel(record.splitMethod)"
                  class="tw-ml-1"
                />
              </strong>
              <span class="tw-truncate">{{ record.payer.label}}</span>
            </div>
          </q-item-label>
          <q-item-label>
            <div class="tw-grid tw-grid-cols-2 tw-gap-2">
              <strong>$:{{ record.amount }}</strong>
              <span>{{ record.date.split('-')[1] }}-{{record.date.split('-')[2]}}</span>
            </div>
          </q-item-label>
        </q-item-section>
        <div class="tw-flex tw-gap-2">
          <q-btn @click="openExpenseDialog('edit', record)"
            icon="edit" push color="white" text-color="primary"
          />
          <q-btn @click="confirmDelete(record)"
            push icon="delete" color="white" text-color="negative"
          />
        </div>
      </q-item>
    </q-list>

    <ExpenseFormDialog
      v-model="showExpenseDialog"
      :is-edit-mode="isEditMode"
      :initial-expense-data="expenseData"
      :members="members"
      :expense-types="expenseTypes"
      @save="saveExpense"
    />

    <!-- 確認刪除對話框 -->
    <q-dialog persistent v-model="showDeleteConfirmDialog">
      <q-card>
        <q-card-section>
          <div class="tw-text-gray-600 tw-text-lg">你確定要刪除這筆消費嗎？</div>
          <div class="tw-font-bold tw-mt-2">
            {{ recordToDelete?.description }} - ${{ recordToDelete?.amount }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" @click="showDeleteConfirmDialog = false" />
          <q-btn flat label="Delete" color="negative" @click="deleteExpenseConfirmed" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import {
  ref, onMounted, onUnmounted, watch,
} from 'vue';
import {
  db, ref as dbRef, get, set, remove, onValue,
} from 'src/boot/firebase';
import dayjs from 'dayjs';
import { useRoute } from 'vue-router';
import { getAuth } from 'firebase/auth';
import { generateMonths } from 'src/utils/generateDate';
import ExpenseFormDialog from 'src/components/expense/ExpenseFormDialog.vue';

// 儲存DB監聽器
let dbValueWatch = null;

// 獲取群組名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

// 獲取當前用戶
const auth = getAuth();
const user = auth.currentUser;

// 狀態變數
const showExpenseDialog = ref(false);
const showDeleteConfirmDialog = ref(false);
const isEditMode = ref(false);
const expenseData = ref({
  description: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  payer: '',
  type: '',
  involvedMembers: [], // 參與成員數組
  splitMethod: 'equal', // 分帳方式：equal | shares | exact | percentage
});

const recordToDelete = ref(null);
const members = ref([]);
const customExpenseTypes = ref([]);
const defaultExpenseTypes = ref([
  { label: 'Transportation-交通', value: 'transportation', icon: 'commute' },
  { label: 'Food-飲食', value: 'food', icon: 'restaurant' },
  { label: 'Entertainment-娛樂', value: 'entertainment', icon: 'theaters' },
  { label: 'Pets-寵物', value: 'pets', icon: 'pets' },
  { label: 'Housing-住家', value: 'housing', icon: 'home' },
  { label: 'Daily Supplies-日常用品', value: 'supplies', icon: 'shopping_cart' },
  { label: 'Investment-投資', value: 'investment', icon: 'savings' },
  { label: 'Shopping-購物', value: 'shopping', icon: 'shopping_cart' },
  { label: 'Other-其他', value: 'other', icon: 'more_horiz' },
]);
const expenseTypes = ref([]);

const records = ref([]);
const selectedMonth = ref('');
const months = ref([]);

// 使用 IntersectionObserver 判斷元素是否進入視窗
const observer = ref(null);
const recordRefs = ref([]);

// 開啟對話框
const openExpenseDialog = (mode, record = null) => {
  if (mode === 'add') {
    isEditMode.value = false;
    expenseData.value = {
      description: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      payer: user ? { label: user.displayName, value: user.uid } : '',
      type: '',
      involvedMembers: members.value.map((member) => member.value), // 默認選擇所有成員
      splitMethod: 'equal',
    };
  } else if (mode === 'edit' && record) {
    isEditMode.value = true;
    expenseData.value = {
      ...record,
      splitMethod: record.splitMethod || 'equal', // 舊資料預設均分
    };
    // 如果編輯的記錄中沒有 involvedMembers 欄位，則創建一個（兼容舊數據）
    if (!expenseData.value.involvedMembers || !Array.isArray(expenseData.value.involvedMembers)) {
      // 從members數組獲取ID，確保處理可能的undefined情況
      const memberIds = record.members && Array.isArray(record.members)
        ? record.members.map((member) => member.value).filter(Boolean)
        : members.value.map((member) => member.value);

      expenseData.value.involvedMembers = memberIds;
    }
  }
  showExpenseDialog.value = true;
};

// 分帳方式的顯示 label（for 列表 badge）
const getSplitMethodLabel = (method) => {
  const map = { shares: '份數', exact: '指定金額', percentage: '百分比' };
  return map[method] || '';
};

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

// 合併自定義與內建類型
const mergeExpenseTypes = () => {
  expenseTypes.value = [...defaultExpenseTypes.value, ...customExpenseTypes.value];
  expenseTypes.value.push({
    label: 'Fixed Expense-固定支出', value: 'fixed', icon: 'stars', disable: true,
  });
};

// 獲取自定義消費類型
const fetchCustomExpenseTypes = async () => {
  customExpenseTypes.value = [];
  const expenseTypesRef = dbRef(db, `/groups/${watchGroupName.value}/expenseTypes/custom`);
  const snapshot = await get(expenseTypesRef);
  if (snapshot.exists()) {
    customExpenseTypes.value = Object.values(snapshot.val());
  }
  mergeExpenseTypes();
};

// 加載消費記錄和群組成員
const fetchRecords = async () => {
  if (dbValueWatch) {
    dbValueWatch();
    dbValueWatch = null;
  }

  // Clean up the observer
  if (observer.value) {
    recordRefs.value.forEach((el) => {
      if (el) observer.value.unobserve(el);
    });
    recordRefs.value = [];
  }

  const month = typeof selectedMonth.value === 'object' && selectedMonth.value !== null
    ? selectedMonth.value.value
    : selectedMonth.value || new Date().toISOString().slice(0, 7);

  const groupRef = dbRef(db, `/groups/${watchGroupName.value}/expenses/${month}`);

  dbValueWatch = onValue(groupRef, (snapshot) => {
    if (snapshot.exists()) {
      records.value = Object.values(snapshot.val()).map((record) => ({
        ...record,
        show: false,
      })).sort((a, b) => (dayjs(b.date).isAfter(dayjs(a.date)) ? 1 : -1));
    } else {
      records.value = [];
    }
  });
};

// 確認刪除
const confirmDelete = (record) => {
  recordToDelete.value = record;
  showDeleteConfirmDialog.value = true;
};

// 刪除消費記錄
const deleteExpenseConfirmed = async () => {
  const month = recordToDelete.value.date.slice(0, 7);
  await remove(dbRef(db, `/groups/${watchGroupName.value}/expenses/${month}/${recordToDelete.value.id}`));
  showDeleteConfirmDialog.value = false;
  fetchRecords();
};

// 保存消費記錄
const saveExpense = async (formExpenseData) => {
  const month = formExpenseData.date.slice(0, 7);
  const recordId = formExpenseData.id || Date.now().toString();

  // 根據 involvedMembers 創建參與成員數組
  const involvedMembersObjects = members.value
    .filter((member) => formExpenseData.involvedMembers.includes(member.value));

  const record = {
    ...formExpenseData,
    id: recordId,
    members: involvedMembersObjects, // 使用選定的參與者而不是所有成員
    involvedMembers: formExpenseData.involvedMembers, // 保存參與者ID列表，方便編輯時使用
  };

  await set(dbRef(db, `/groups/${watchGroupName.value}/expenses/${month}/${recordId}`), record);
  showExpenseDialog.value = false;
  fetchRecords();
};

const setRecordRef = (el) => {
  if (!el) return;
  recordRefs.value.push(el.$el);

  // Initialize the observer
  if (!observer.value) {
    observer.value = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
        } else {
          entry.target.classList.remove('fade-in');
        }
      });
    }, {
      root: null,
      threshold: 0.1,
    });
  }

  observer.value.observe(el.$el);
};

// 初始化
const initializeData = async (newGroupName) => {
  watchGroupName.value = newGroupName;
  await fetchMembers();
  await fetchCustomExpenseTypes();
  await fetchRecords();
};

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    await initializeData(newGroupName);
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化數據
onMounted(() => {
  months.value = generateMonths();
  const [firstMonth] = months.value;
  selectedMonth.value = firstMonth;
});

onUnmounted(() => {
  // 在組件卸載時取消監聽
  if (dbValueWatch) {
    dbValueWatch();
  }

  // Clean up the observer
  if (observer.value) {
    recordRefs.value.forEach((el) => {
      if (el) observer.value.unobserve(el);
    });
    observer.value.disconnect();
  }
});

// 根據消費類型獲取圖示
const getIconForType = (type) => {
  const typeValue = typeof type === 'string' ? type : type?.value;
  const typeInfo = expenseTypes.value.find((t) => t.value === typeValue);
  return typeInfo ? typeInfo.icon : 'more_horiz';
};

// 添加handleMonthChange函数
const handleMonthChange = async () => {
  // Reset scroll position
  window.scrollTo(0, 0);
  // Get new month's records
  await fetchRecords();
};
</script>

<style scoped>
.fade-in {
  animation: fadeIn 0.6s ease-in-out forwards;
  opacity: 0;
}

.fade-out {
  opacity: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
