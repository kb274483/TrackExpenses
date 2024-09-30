<template>
  <q-page class="tw-p-4">
    <!-- 新增消費記錄按鈕 -->
    <div class="tw-flex tw-justify-end">
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
        @update:model-value="fetchRecords"
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
              <strong>{{ record.description }}</strong>
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

    <!-- 新增與編輯消費記錄對話框 -->
    <q-dialog persistent v-model="showExpenseDialog">
      <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
        <q-card-section>
          <div class="text-h6">{{ isEditMode ? 'Edit' : 'Add' }} Expense</div>
          <q-input
            v-model="expenseData.description"
            label="Description"
            :error="!expenseData.description && isSubmitted"
            error-message="Description is required"
          />
          <q-input
            v-model="expenseData.amount"
            label="Amount"
            type="number"
            :error="!expenseData.amount && isSubmitted"
            error-message="Amount is required"
          />
          <q-select
            v-model="expenseData.payer"
            :options="members"
            label="Select Payer"
            option-value="value"
            option-label="label"
            :error="!expenseData.payer && isSubmitted"
            error-message="Payer is required"
          />
          <q-select
            v-model="expenseData.type"
            :options="expenseTypes"
            label="Expense Type"
            :error="!expenseData.type && isSubmitted"
            error-message="Type is required"
          />
          <q-input
            v-model="expenseData.date"
            label="Date"
            type="date"
            :error="!expenseData.date && isSubmitted"
            error-message="Date is required"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="negative" @click="showExpenseDialog = false" />
          <q-btn flat label="Save" color="primary" @click="saveExpense" />
        </q-card-actions>
      </q-card>
    </q-dialog>

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
import { useRoute } from 'vue-router';
import dayjs from 'dayjs';
import { getAuth } from 'firebase/auth';

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
const isSubmitted = ref(false);

const expenseData = ref({
  description: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  payer: '',
  type: '',
});

const recordToDelete = ref(null);
const members = ref([]);
const expenseTypes = ref([
  { label: 'Transportation-交通', value: 'transportation', icon: 'directions_bus' },
  { label: 'Food-飲食', value: 'food', icon: 'restaurant' },
  { label: 'Entertainment-娛樂', value: 'entertainment', icon: 'theaters' },
  { label: 'Pets-寵物', value: 'pets', icon: 'pets' },
  { label: 'Housing-住家', value: 'housing', icon: 'home' },
  { label: 'Daily Supplies-日常用品', value: 'supplies', icon: 'shopping_cart' },
  { label: 'Other-其他', value: 'other', icon: 'more_horiz' },
]);

const records = ref([]);
const selectedMonth = ref('');
const months = ref([]);

// 開啟對話框
const openExpenseDialog = (mode, record = null) => {
  isSubmitted.value = false;
  if (mode === 'add') {
    isEditMode.value = false;
    expenseData.value = {
      description: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      payer: user ? { label: user.displayName, value: user.uid } : '',
      type: '',
    };
  } else if (mode === 'edit' && record) {
    isEditMode.value = true;
    expenseData.value = { ...record };
  }
  showExpenseDialog.value = true;
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

// 加載消費記錄和群組成員
const fetchRecords = async () => {
  const month = selectedMonth.value.value || new Date().toISOString().slice(0, 7);
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
const saveExpense = async () => {
  isSubmitted.value = true;

  if (!expenseData.value.description || !expenseData.value.amount || !expenseData.value.payer
    || !expenseData.value.type || !expenseData.value.date) {
    return;
  }

  const month = expenseData.value.date.slice(0, 7);
  const recordId = expenseData.value.id || Date.now().toString();
  const record = {
    ...expenseData.value,
    id: recordId,
    members: members.value,
  };

  await set(dbRef(db, `/groups/${watchGroupName.value}/expenses/${month}/${recordId}`), record);
  showExpenseDialog.value = false;
  fetchRecords();
};

// 使用 IntersectionObserver 判斷元素是否進入視窗
const setRecordRef = (el) => {
  if (!el) return;
  const observer = new IntersectionObserver((entries) => {
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

  observer.observe(el.$el);
};

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
  selectedMonth.value = months.value[0].value;
};

// 根據消費類型獲取圖示
const getIconForType = (type) => {
  const typeInfo = expenseTypes.value.find((t) => t.value === type.value);
  return typeInfo ? typeInfo.icon : 'more_horiz';
};

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    watchGroupName.value = newGroupName;
    await fetchMembers();
    await fetchRecords();
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化數據
onMounted(() => {
  generateMonths();
  fetchMembers();
  fetchRecords();
});

onUnmounted(() => {
  // 在組件卸載時取消監聽
  if (dbValueWatch) {
    dbValueWatch();
  }
});
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
