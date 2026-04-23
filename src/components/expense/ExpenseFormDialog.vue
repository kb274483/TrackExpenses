<script setup>
import {
  computed, ref, watch,
} from 'vue';
import { normalizeScanItems } from 'src/api/scanResultShape';
import ExpenseItemsEditorDialog from './ExpenseItemsEditorDialog.vue';
import ReceiptScanPanel from './ReceiptScanPanel.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  isEditMode: {
    type: Boolean,
    default: false,
  },
  initialExpenseData: {
    type: Object,
    required: true,
  },
  members: {
    type: Array,
    default: () => [],
  },
  expenseTypes: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'save']);

const splitMethodOptions = [
  { label: '均分', value: 'equal' },
  { label: '份數', value: 'shares' },
  { label: '固定金額', value: 'exact' },
  { label: '百分比', value: 'percentage' },
];

const isSubmitted = ref(false);
const isItemsEditorOpen = ref(false);
const expenseData = ref({});
const splitValuesMap = ref({});
const buildDefaultExpenseData = (source = {}) => ({
  ...source,
  description: source.description || '',
  amount: source.amount ?? 0,
  date: source.date || new Date().toISOString().slice(0, 10),
  payer: source.payer || '',
  type: source.type || '',
  involvedMembers: Array.isArray(source.involvedMembers) ? [...source.involvedMembers] : [],
  items: normalizeScanItems(source.items) || [],
  splitMethod: source.splitMethod || 'equal',
});

const buildSplitValuesMap = (source = {}) => {
  const nextMap = {};

  if (Array.isArray(source.splits)) {
    source.splits.forEach((split) => {
      if (split?.memberId) {
        nextMap[split.memberId] = Number(split.value) || 0;
      }
    });
  }

  return nextMap;
};

const syncFromProps = () => {
  isSubmitted.value = false;
  expenseData.value = buildDefaultExpenseData(props.initialExpenseData);
  splitValuesMap.value = buildSplitValuesMap(props.initialExpenseData);
};

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      syncFromProps();
    }
  },
  { immediate: true },
);

watch(
  () => props.initialExpenseData,
  () => {
    if (props.modelValue) {
      syncFromProps();
    }
  },
  { deep: true },
);

watch(
  () => expenseData.value.involvedMembers,
  (newIds) => {
    const method = expenseData.value.splitMethod;
    if (!method || method === 'equal') return;

    const ids = newIds || [];
    const nextMap = { ...splitValuesMap.value };

    Object.keys(nextMap).forEach((key) => {
      if (!ids.includes(key)) delete nextMap[key];
    });

    ids.forEach((id) => {
      if (!(id in nextMap)) {
        nextMap[id] = method === 'shares' ? 1 : 0;
      }
    });

    splitValuesMap.value = nextMap;
  },
);

const closeDialog = () => {
  emit('update:modelValue', false);
};

const openItemsEditor = () => {
  isItemsEditorOpen.value = true;
};

const clearZero = () => {
  if (expenseData.value.amount === 0) {
    expenseData.value.amount = '';
  }
};

const removeInvalid = () => {
  expenseData.value.amount = String(expenseData.value.amount).replace(/[^0-9]/g, '');
};

const getSelectedMembers = (selectedIds) => {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return [];
  return props.members.filter((member) => selectedIds.includes(member.value));
};

const removeParticipant = (memberId) => {
  expenseData.value.involvedMembers = expenseData.value.involvedMembers
    .filter((id) => id !== memberId);
};

const selectAllParticipants = () => {
  expenseData.value.involvedMembers = props.members.map((member) => member.value);
};

const allParticipantsSelected = computed(() => (
  expenseData.value.involvedMembers
  && props.members.length === expenseData.value.involvedMembers.length
));

const selectedMembersForSplit = computed(() => {
  const selectedIds = expenseData.value.involvedMembers || [];
  return props.members.filter((member) => selectedIds.includes(member.value));
});

const splitValueSuffix = computed(() => {
  switch (expenseData.value.splitMethod) {
    case 'shares': return '份';
    case 'exact': return '$';
    case 'percentage': return '%';
    default: return '';
  }
});

const splitModeHint = computed(() => {
  switch (expenseData.value.splitMethod) {
    case 'shares': return '依份數比例分攤（預設每人 1 份）';
    case 'exact': return '各自指定金額，加總需等於消費總額';
    case 'percentage': return '各自指定百分比，加總需等於 100%';
    default: return '';
  }
});

const computeSplitAmounts = () => {
  const total = Number(expenseData.value.amount) || 0;
  const method = expenseData.value.splitMethod || 'equal';
  const memberIds = expenseData.value.involvedMembers || [];
  const values = splitValuesMap.value;
  const result = {};

  if (memberIds.length === 0) return result;

  if (method === 'equal') {
    const perPerson = total / memberIds.length;
    memberIds.forEach((id) => {
      result[id] = perPerson;
    });
    return result;
  }

  if (method === 'shares') {
    const totalShares = memberIds.reduce((sum, id) => sum + (Number(values[id]) || 0), 0);
    memberIds.forEach((id) => {
      result[id] = totalShares === 0 ? 0 : (total * (Number(values[id]) || 0)) / totalShares;
    });
    return result;
  }

  if (method === 'exact') {
    memberIds.forEach((id) => {
      result[id] = Number(values[id]) || 0;
    });
    return result;
  }

  if (method === 'percentage') {
    memberIds.forEach((id) => {
      result[id] = (total * (Number(values[id]) || 0)) / 100;
    });
  }

  return result;
};

const formatPreview = (memberId) => {
  const splitAmounts = computeSplitAmounts();
  return Math.round(splitAmounts[memberId] || 0).toLocaleString('zh-TW');
};

const splitStatusText = computed(() => {
  const method = expenseData.value.splitMethod;
  const total = Number(expenseData.value.amount) || 0;
  const memberIds = expenseData.value.involvedMembers || [];
  const sum = memberIds.reduce((acc, id) => acc + (Number(splitValuesMap.value[id]) || 0), 0);

  if (method === 'exact') {
    const diff = total - sum;
    const status = `已分配 $${sum.toLocaleString('zh-TW')} / 總額 $${total.toLocaleString('zh-TW')}`;
    if (diff === 0) return `${status} ✓`;
    return `${status}（${diff > 0 ? '尚差' : '超過'} $${Math.abs(diff).toLocaleString('zh-TW')}）`;
  }

  if (method === 'percentage') {
    const diff = 100 - sum;
    if (Math.abs(diff) < 0.01) return `已分配 ${sum.toFixed(1)}% ✓`;
    return `已分配 ${sum.toFixed(1)}%（${diff > 0 ? '尚差' : '超過'} ${Math.abs(diff).toFixed(1)}%）`;
  }

  if (method === 'shares') {
    return `總份數：${sum} 份`;
  }

  return '';
});

const splitValid = computed(() => {
  const method = expenseData.value.splitMethod;
  const total = Number(expenseData.value.amount) || 0;
  const memberIds = expenseData.value.involvedMembers || [];
  const sum = memberIds.reduce((acc, id) => acc + (Number(splitValuesMap.value[id]) || 0), 0);

  if (method === 'equal') return true;
  if (method === 'shares') return sum > 0;
  if (method === 'exact') return sum === total;
  if (method === 'percentage') return Math.abs(100 - sum) < 0.01;
  return true;
});

const updateSplitValue = (memberId, value) => {
  const numericValue = value === '' || value === null ? 0 : Number(value);
  splitValuesMap.value = {
    ...splitValuesMap.value,
    [memberId]: Number.isFinite(numericValue) ? numericValue : 0,
  };
};

const onSplitMethodChange = (method) => {
  const memberIds = expenseData.value.involvedMembers || [];
  const total = Number(expenseData.value.amount) || 0;
  const nextMap = {};

  if (method === 'shares') {
    memberIds.forEach((id) => {
      nextMap[id] = 1;
    });
  } else if (method === 'exact' && memberIds.length > 0) {
    const perPerson = Math.floor(total / memberIds.length);
    memberIds.forEach((id, index) => {
      nextMap[id] = index === memberIds.length - 1
        ? total - perPerson * (memberIds.length - 1)
        : perPerson;
    });
  } else if (method === 'percentage' && memberIds.length > 0) {
    const perPerson = Math.floor((100 / memberIds.length) * 10) / 10;
    memberIds.forEach((id, index) => {
      nextMap[id] = index === memberIds.length - 1
        ? Number((100 - perPerson * (memberIds.length - 1)).toFixed(1))
        : perPerson;
    });
  }

  splitValuesMap.value = nextMap;
};

const applyScannedResult = (result) => {
  if (result.description) {
    expenseData.value.description = result.description;
  }

  if (result.amount !== null) {
    expenseData.value.amount = String(result.amount);
  }

  if (result.date) {
    expenseData.value.date = result.date;
  }

  const mappedType = props.expenseTypes.find(
    (type) => type.value === result.suggestedType,
  ) || props.expenseTypes.find((type) => type.value === 'other');

  if (mappedType) {
    expenseData.value.type = mappedType;
  }

  expenseData.value.items = normalizeScanItems(result.items) || [];
};

const saveItems = (items) => {
  expenseData.value.items = items;
};

const submitExpense = () => {
  isSubmitted.value = true;

  if (!expenseData.value.description || !expenseData.value.amount
    || !expenseData.value.payer || !expenseData.value.type || !expenseData.value.date
    || !expenseData.value.involvedMembers || expenseData.value.involvedMembers.length === 0
    || !splitValid.value) {
    return;
  }

  const payload = {
    ...expenseData.value,
    amount: Number(expenseData.value.amount),
    involvedMembers: [...expenseData.value.involvedMembers],
    splitMethod: expenseData.value.splitMethod || 'equal',
    items: normalizeScanItems(expenseData.value.items) || [],
    splits: expenseData.value.splitMethod === 'equal'
      ? null
      : expenseData.value.involvedMembers.map((memberId) => ({
        memberId,
        value: Number(splitValuesMap.value[memberId]) || 0,
      })),
  };

  emit('save', payload);
};
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2 tw-pb-12">
      <q-card-section>
        <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
          <div class="text-h6">{{ isEditMode ? 'Edit' : 'Add' }} Expense</div>
          <ReceiptScanPanel @scanned="applyScannedResult" />
        </div>

        <q-input
          v-model="expenseData.description"
          label="Description"
          :error="!expenseData.description && isSubmitted"
          error-message="Description is required"
        />
        <div class="tw-flex tw-items-center tw-justify-end tw-gap-1">
          <q-btn
            size="10px"
            flat
            dense
            no-caps
            color="primary"
            label="查看明細"
            @click="openItemsEditor"
          />
        </div>
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
        <q-select
          v-model="expenseData.involvedMembers"
          :options="members"
          label="Participants"
          multiple
          option-value="value"
          option-label="label"
          emit-value
          map-options
          :error="(
            !expenseData.involvedMembers || expenseData.involvedMembers.length === 0
          ) && isSubmitted"
          error-message="至少需要一名參與者"
        >
          <template #selected>
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

        <div class="tw-mt-4">
          <div class="tw-mb-1 tw-text-sm tw-text-gray-600">分帳方式</div>
          <q-option-group
            v-model="expenseData.splitMethod"
            :options="splitMethodOptions"
            type="radio"
            inline
            dense
            color="primary"
            @update:model-value="onSplitMethodChange"
          />
        </div>

        <div
          v-if="expenseData.splitMethod && expenseData.splitMethod !== 'equal'"
          class="tw-mt-3"
        >
          <div class="tw-mb-2 tw-text-xs tw-text-gray-500">
            {{ splitModeHint }}
          </div>
          <div
            v-if="selectedMembersForSplit.length === 0"
            class="tw-text-sm tw-text-gray-400 tw-italic"
          >
            請先選擇參與者
          </div>
          <div
            v-for="member in selectedMembersForSplit"
            :key="member.value"
            class="tw-mb-1 tw-flex tw-items-center tw-gap-2"
          >
            <span class="tw-flex-1 tw-truncate tw-text-sm tw-text-gray-700">
              {{ member.label }}
            </span>
            <q-input
              :model-value="splitValuesMap[member.value]"
              @update:model-value="(value) => updateSplitValue(member.value, value)"
              type="tel"
              inputmode="decimal"
              dense
              outlined
              class="tw-w-24"
              :suffix="splitValueSuffix"
            />
            <span class="tw-w-24 tw-text-right tw-text-xs tw-text-gray-500">
              ≈ ${{ formatPreview(member.value) }}
            </span>
          </div>
          <div
            v-if="selectedMembersForSplit.length > 0"
            class="tw-mt-2 tw-text-right tw-text-xs"
            :class="splitValid ? 'tw-text-green-600' : 'tw-text-red-500'"
          >
            {{ splitStatusText }}
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="negative" @click="closeDialog" />
        <q-btn flat label="Save" color="primary" @click="submitExpense" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <ExpenseItemsEditorDialog
    v-model="isItemsEditorOpen"
    :items="expenseData.items || []"
    @save="saveItems"
  />
</template>
