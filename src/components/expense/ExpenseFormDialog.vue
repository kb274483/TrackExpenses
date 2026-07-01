<script setup>
import {
  ref, watch,
} from 'vue';
import { normalizeScanItems } from 'src/api/scanResultShape';
import { buildSplitValuesMap, normalizeSplits } from 'src/utils/expenseSplits';
import ExpenseItemsEditorDialog from './ExpenseItemsEditorDialog.vue';
import ExpenseSplitEditor from './ExpenseSplitEditor.vue';
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

const isSubmitted = ref(false);
const isItemsEditorOpen = ref(false);
const splitValid = ref(true);
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

const syncFromProps = () => {
  isSubmitted.value = false;
  splitValid.value = true;
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
    splits: normalizeSplits(
      expenseData.value.splitMethod,
      expenseData.value.involvedMembers,
      splitValuesMap.value,
    ),
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
          behavior="dialog"
          option-value="value"
          option-label="label"
          :error="!expenseData.payer && isSubmitted"
          error-message="Payer is required"
        />
        <q-select
          v-model="expenseData.type"
          :options="expenseTypes"
          label="Expense Type"
          behavior="dialog"
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
        <ExpenseSplitEditor
          v-model:participants="expenseData.involvedMembers"
          v-model:split-method="expenseData.splitMethod"
          v-model:split-values="splitValuesMap"
          v-model:valid="splitValid"
          :amount="expenseData.amount"
          :members="members"
          :submitted="isSubmitted"
        />
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
