<script setup>
import { computed, watch } from 'vue';
import {
  SPLIT_METHOD_OPTIONS,
  computeSplitAmounts,
  getInitialSplitValues,
  getSplitStatusText,
  isSplitValid,
  normalizeParticipantIds,
  syncSplitValuesForParticipants,
} from 'src/utils/expenseSplits';

const props = defineProps({
  amount: {
    type: [Number, String],
    default: 0,
  },
  members: {
    type: Array,
    default: () => [],
  },
  participants: {
    type: Array,
    default: () => [],
  },
  splitMethod: {
    type: String,
    default: 'equal',
  },
  splitValues: {
    type: Object,
    default: () => ({}),
  },
  participantsLabel: {
    type: String,
    default: 'Participants',
  },
  participantsErrorMessage: {
    type: String,
    default: '至少需要一名參與者',
  },
  submitted: {
    type: Boolean,
    default: false,
  },
  valid: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits([
  'update:participants',
  'update:splitMethod',
  'update:splitValues',
  'update:valid',
]);

const participantIds = computed(() => normalizeParticipantIds(props.participants));

const selectedMembers = computed(() => (
  props.members.filter((member) => participantIds.value.includes(member.value))
));

const allParticipantsSelected = computed(() => (
  props.members.length > 0 && props.members.length === participantIds.value.length
));

const splitValueSuffix = computed(() => {
  switch (props.splitMethod) {
    case 'shares': return '份';
    case 'exact': return '$';
    case 'percentage': return '%';
    default: return '';
  }
});

const splitModeHint = computed(() => {
  switch (props.splitMethod) {
    case 'shares': return '依份數比例分攤（預設每人 1 份）';
    case 'exact': return '各自指定金額，加總需等於消費總額';
    case 'percentage': return '各自指定百分比，加總需等於 100%';
    default: return '';
  }
});

const splitStatusText = computed(() => getSplitStatusText({
  totalAmount: props.amount,
  splitMethod: props.splitMethod,
  participants: participantIds.value,
  splitValues: props.splitValues,
}));

const splitValid = computed(() => isSplitValid({
  totalAmount: props.amount,
  splitMethod: props.splitMethod,
  participants: participantIds.value,
  splitValues: props.splitValues,
}));

const formatPreview = (memberId) => {
  const splitAmounts = computeSplitAmounts({
    totalAmount: props.amount,
    splitMethod: props.splitMethod,
    participants: participantIds.value,
    splitValues: props.splitValues,
  });

  return Math.round(splitAmounts[memberId] || 0).toLocaleString('zh-TW');
};

const updateParticipants = (value) => {
  const nextParticipants = normalizeParticipantIds(value);
  emit('update:participants', nextParticipants);

  if (props.splitMethod && props.splitMethod !== 'equal') {
    emit('update:splitValues', syncSplitValuesForParticipants(
      props.splitMethod,
      nextParticipants,
      props.splitValues,
    ));
  }
};

const removeParticipant = (memberId) => {
  updateParticipants(participantIds.value.filter((id) => id !== memberId));
};

const selectAllParticipants = () => {
  updateParticipants(props.members.map((member) => member.value));
};

const updateSplitValue = (memberId, value) => {
  const numericValue = value === '' || value === null ? 0 : Number(value);
  emit('update:splitValues', {
    ...props.splitValues,
    [memberId]: Number.isFinite(numericValue) ? numericValue : 0,
  });
};

const onSplitMethodChange = (method) => {
  emit('update:splitMethod', method);
  emit('update:splitValues', getInitialSplitValues(
    method,
    participantIds.value,
    props.amount,
  ));
};

watch(
  () => splitValid.value,
  (isValid) => {
    emit('update:valid', isValid);
  },
  { immediate: true },
);
</script>

<template>
  <q-select
    :model-value="participantIds"
    :options="members"
    :label="participantsLabel"
    behavior="dialog"
    multiple
    option-value="value"
    option-label="label"
    emit-value
    map-options
    :error="participantIds.length === 0 && submitted"
    :error-message="participantsErrorMessage"
    @update:model-value="updateParticipants"
  >
    <template #selected>
      <q-chip
        v-for="member in selectedMembers"
        :key="member.value"
        removable
        dense
        @remove="removeParticipant(member.value)"
        class="q-mr-xs"
      >
        {{ member.label }}
      </q-chip>
      <q-btn
        v-if="members.length > 0 && !allParticipantsSelected"
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
      :model-value="splitMethod"
      :options="SPLIT_METHOD_OPTIONS"
      type="radio"
      inline
      dense
      color="primary"
      @update:model-value="onSplitMethodChange"
    />
  </div>

  <div
    v-if="splitMethod && splitMethod !== 'equal'"
    class="tw-mt-3"
  >
    <div class="tw-mb-2 tw-text-xs tw-text-gray-500">
      {{ splitModeHint }}
    </div>
    <div
      v-if="selectedMembers.length === 0"
      class="tw-text-sm tw-text-gray-400 tw-italic"
    >
      請先選擇參與者
    </div>
    <div
      v-for="member in selectedMembers"
      :key="member.value"
      class="tw-mb-1 tw-flex tw-items-center tw-gap-2"
    >
      <span class="tw-flex-1 tw-truncate tw-text-sm tw-text-gray-700">
        {{ member.label }}
      </span>
      <q-input
        :model-value="splitValues[member.value]"
        type="tel"
        inputmode="decimal"
        dense
        outlined
        class="tw-w-24"
        :suffix="splitValueSuffix"
        @update:model-value="(value) => updateSplitValue(member.value, value)"
      />
      <span class="tw-w-24 tw-text-right tw-text-xs tw-text-gray-500">
        ≈ ${{ formatPreview(member.value) }}
      </span>
    </div>
    <div
      v-if="selectedMembers.length > 0"
      class="tw-mt-2 tw-text-right tw-text-xs"
      :class="splitValid ? 'tw-text-green-600' : 'tw-text-red-500'"
    >
      {{ splitStatusText }}
    </div>
  </div>
</template>
