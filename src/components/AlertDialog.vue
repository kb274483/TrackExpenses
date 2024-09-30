<template>
  <q-dialog persistent v-model="visible">
    <q-card>
      <q-card-section>
        <div v-html="message" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-if="props.isConfirm" flat label="Cancel" color="negative" @click="onCancel" />
        <q-btn flat label="OK" color="primary" @click="onOk" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue';

// 傳遞事件
const emit = defineEmits(['ok', 'cancel']);
// 接收外部參數：message 和 isConfirm
const props = defineProps({
  message: String,
  isConfirm: {
    type: Boolean,
    default: false,
  },
});

// 控制對話框顯示狀態
const visible = ref(true);

// OK 按鈕事件
const onOk = () => {
  visible.value = false;
  // 傳遞 ok 事件給父組件
  emit('ok');
};

// Cancel 按鈕事件（只有確認框才會顯示）
const onCancel = () => {
  visible.value = false;
  // 傳遞 cancel 事件給父組件
  emit('cancel');
};

</script>
