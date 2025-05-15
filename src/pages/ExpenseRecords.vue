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
            type="tel"
            inputmode="numeric"
            pattern="[0-9]*"
            :error="!expenseData.amount && isSubmitted"
            error-message="Amount is required"
            @focus="clearZero"
            @blur="expenseData.amount = expenseData.amount || 0"
            @update:model-value="removeInvalid"
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
          <!-- 消費參與者選擇器 -->
          <q-select
            v-model="expenseData.involvedMembers"
            :options="members"
            label="Participants"
            multiple
            option-value="value"
            option-label="label"
            emit-value
            map-options
            :error="!expenseData.involvedMembers ||
                   expenseData.involvedMembers.length === 0 && isSubmitted"
            error-message="至少需要一名參與者"
          >
            <template v-slot:selected>
              <q-chip
                v-for="member in getSelectedMembers(expenseData.involvedMembers)"
                :key="member.value"
                removable
                dense
                @remove="removeParticipant(member.value)"
                class="q-mr-xs"
              >
                {{ member.label }}
              </q-chip>
              <q-btn
                v-if="!allParticipantsSelected"
                flat
                dense
                size="sm"
                icon="add"
                @click="selectAllParticipants"
                class="q-ml-xs"
              >
                <q-tooltip>Select All</q-tooltip>
              </q-btn>
            </template>
          </q-select>
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
  ref, onMounted, onUnmounted, watch, computed,
} from 'vue';
import {
  db, ref as dbRef, get, set, remove, onValue,
} from 'src/boot/firebase';
import dayjs from 'dayjs';
import { useRoute } from 'vue-router';
import { getAuth } from 'firebase/auth';
import { generateMonths } from 'src/utils/generateDate';

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
  involvedMembers: [], // 參與成員數組
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

// 消費金額只能輸入數字，並在focus時刪除0，並在blur時補0
const clearZero = () => {
  if (expenseData.value.amount === 0) {
    expenseData.value.amount = '';
  }
};
// 過濾掉非數字的字符
const removeInvalid = () => {
  expenseData.value.amount = expenseData.value.amount.replace(/[^0-9]/g, '');
};

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
      involvedMembers: members.value.map((member) => member.value), // 默認選擇所有成員
    };
  } else if (mode === 'edit' && record) {
    isEditMode.value = true;
    expenseData.value = { ...record };
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

// 獲取選定的成員對象
const getSelectedMembers = (selectedIds) => {
  if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) return [];
  // 確保members.value存在且是 Array
  if (!members.value || !Array.isArray(members.value)) return [];

  return members.value.filter((member) => member && member.value
    && selectedIds.includes(member.value));
};

// 從參與者中移除成員
const removeParticipant = (memberId) => {
  expenseData.value.involvedMembers = expenseData.value.involvedMembers
    .filter((id) => id !== memberId);
};

// 選擇所有參與者
const selectAllParticipants = () => {
  expenseData.value.involvedMembers = members.value.map((member) => member.value);
};

// 計算是否所有成員都已選中
const allParticipantsSelected = computed(() => expenseData.value.involvedMembers
    && members.value.length === expenseData.value.involvedMembers.length);

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
const saveExpense = async () => {
  isSubmitted.value = true;

  if (!expenseData.value.description || !expenseData.value.amount
    || !expenseData.value.payer || !expenseData.value.type || !expenseData.value.date
    || !expenseData.value.involvedMembers || expenseData.value.involvedMembers.length === 0) {
    return;
  }

  const month = expenseData.value.date.slice(0, 7);
  const recordId = expenseData.value.id || Date.now().toString();

  // 根據 involvedMembers 創建參與成員數組
  const involvedMembersObjects = members.value
    .filter((member) => expenseData.value.involvedMembers.includes(member.value));

  const record = {
    ...expenseData.value,
    id: recordId,
    members: involvedMembersObjects, // 使用選定的參與者而不是所有成員
    involvedMembers: expenseData.value.involvedMembers, // 保存參與者ID列表，方便編輯時使用
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
});

// 根據消費類型獲取圖示
const getIconForType = (type) => {
  const typeInfo = expenseTypes.value.find((t) => t.value === type.value);
  return typeInfo ? typeInfo.icon : 'more_horiz';
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
