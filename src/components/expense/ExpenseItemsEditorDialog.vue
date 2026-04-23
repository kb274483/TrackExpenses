<script setup>
import { computed, ref, watch } from 'vue';
import {
  normalizeItemName,
  normalizeItemNumber,
  normalizeScanItems,
} from 'src/api/scanResultShape';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  items: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'save']);

const editableItems = ref([]);

const normalizedItems = computed(() => normalizeScanItems(props.items) || []);

const createEmptyItem = () => ({
  name: '',
  quantity: null,
  unitPrice: null,
});

const syncFromProps = () => {
  editableItems.value = normalizedItems.value.length > 0
    ? normalizedItems.value.map((item) => ({ ...item }))
    : [];
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
  () => props.items,
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

const addItem = () => {
  editableItems.value = [...editableItems.value, createEmptyItem()];
};

const removeItem = (index) => {
  editableItems.value = editableItems.value.filter((_, itemIndex) => itemIndex !== index);
};

const updateItemField = (index, field, value) => {
  editableItems.value = editableItems.value.map((item, itemIndex) => {
    if (itemIndex !== index) return item;

    if (field === 'name') {
      return { ...item, name: normalizeItemName(value) };
    }

    return { ...item, [field]: normalizeItemNumber(value) };
  });
};

const saveItems = () => {
  emit('save', normalizeScanItems(editableItems.value) || []);
  closeDialog();
};
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-[42rem]">
      <q-card-section class="tw-flex tw-items-center tw-justify-between">
        <div class="text-h6">消費明細</div>
        <q-btn
          flat
          dense
          round
          icon="add"
          color="primary"
          aria-label="新增品項"
          @click="addItem"
        />
      </q-card-section>

      <q-separator />

      <q-card-section class="tw-max-h-[65vh] tw-overflow-y-auto tw-space-y-2">
        <div
          v-if="editableItems.length === 0"
          class="tw-rounded-lg tw-border tw-border-dashed tw-border-slate-300 tw-p-4
          tw-text-center tw-text-sm tw-text-slate-500"
        >
          尚無明細，掃描後會自動帶入，也可以手動新增。
        </div>

        <div
          v-for="(item, index) in editableItems"
          :key="index"
          class="tw-p-1 tw-rounded tw-border tw-border-dashed tw-border-slate-100/50"
        >
          <div class="tw-flex tw-items-center tw-justify-between">
            <div class="tw-text-sm tw-font-medium">
             {{ index + 1 }}.
            </div>
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="delete"
              aria-label="刪除品項"
              @click="removeItem(index)"
            />
          </div>

          <div class="tw-grid tw-grid-cols-6 tw-gap-2">
            <q-input
              class="tw-col-span-3"
              :model-value="item.name"
              label="品項名稱"
              @update:model-value="(value) => updateItemField(index, 'name', value)"
            />
            <q-input
              :model-value="item.quantity"
              label="數量"
              type="number"
              inputmode="decimal"
              @update:model-value="(value) => updateItemField(index, 'quantity', value)"
            />
            <q-input
              class="tw-col-span-2"
              :model-value="item.unitPrice"
              label="單價"
              type="number"
              inputmode="decimal"
              @update:model-value="(value) => updateItemField(index, 'unitPrice', value)"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="negative" @click="closeDialog" />
        <q-btn flat label="Save" color="primary" @click="saveItems" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
