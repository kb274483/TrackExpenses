<script setup>
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  scanReceipt,
} from 'src/api/receiptScan';
import InvoiceQrScanner from './scanners/InvoiceQrScanner.vue';
import ReceiptCameraScanner from './scanners/ReceiptCameraScanner.vue';

const $q = useQuasar();

const emit = defineEmits(['scanned']);

const isQrDialogOpen = ref(false);
const isCameraDialogOpen = ref(false);
const isOcrMenuOpen = ref(false);
const isScanning = ref(false);

const libraryInputRef = ref(null);

const acceptedMimeTypes = ALLOWED_RECEIPT_MIME_TYPES.join(',');

const handleQrScanned = (result) => {
  isQrDialogOpen.value = false;
  emit('scanned', result);
};

const runReceiptScan = async (file) => {
  isScanning.value = true;
  try {
    const result = await scanReceipt(file);
    emit('scanned', result);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error?.message || '收據掃描失敗',
      timeout: 3000,
    });
  } finally {
    isScanning.value = false;
  }
};

const triggerLibraryPicker = () => {
  isOcrMenuOpen.value = false;
  libraryInputRef.value?.click();
};

const openCameraDialog = () => {
  isOcrMenuOpen.value = false;
  isCameraDialogOpen.value = true;
};

const handleCameraCaptured = async (file) => {
  isCameraDialogOpen.value = false;
  await runReceiptScan(file);
};

const handleSelectedFile = async (event) => {
  const [file] = event.target.files || [];
  event.target.value = '';
  if (!file) return;
  await runReceiptScan(file);
};
</script>

<template>
  <div class="tw-flex tw-items-center tw-gap-1">
    <q-btn
      round
      dense
      flat
      color="primary"
      icon="qr_code_scanner"
      aria-label="掃描統一發票 QR"
      @click="isQrDialogOpen = true"
    >
      <q-tooltip>統一發票 QR</q-tooltip>
    </q-btn>

    <q-btn
      round
      dense
      flat
      color="primary"
      icon="document_scanner"
      aria-label="拍照識別收據"
      :loading="isScanning"
    >
      <q-tooltip>拍照識別收據</q-tooltip>
      <q-menu
        v-model="isOcrMenuOpen"
        anchor="bottom right"
        self="top right"
      >
        <q-list dense style="min-width: 180px">
          <q-item
            v-ripple
            clickable
            @click="openCameraDialog"
          >
            <q-item-section avatar>
              <q-icon name="photo_camera" color="primary" />
            </q-item-section>
            <q-item-section>拍照掃描</q-item-section>
          </q-item>
          <q-item
            v-ripple
            clickable
            @click="triggerLibraryPicker"
          >
            <q-item-section avatar>
              <q-icon name="photo_library" color="primary" />
            </q-item-section>
            <q-item-section>從相簿選擇</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <input
      ref="libraryInputRef"
      class="tw-hidden"
      type="file"
      :accept="acceptedMimeTypes"
      @change="handleSelectedFile"
    >

    <q-dialog
      v-model="isQrDialogOpen"
      :maximized="$q.screen.lt.sm"
    >
      <q-card
        class="qr-dialog-card tw-flex tw-flex-col tw-w-full sm:tw-w-[min(92vw,28rem)]
        tw-rounded-none sm:tw-rounded-2xl"
      >
        <q-card-section
          class="qr-dialog-header tw-sticky tw-top-0 tw-z-10 tw-flex tw-items-center
          tw-justify-between tw-px-4 tw-py-3"
        >
          <div class="text-h6">發票 QRCODE</div>
          <q-btn
            v-close-popup
            flat
            dense
            round
            icon="close"
            aria-label="關閉"
          />
        </q-card-section>

        <q-separator />

        <div class="tw-flex-1 tw-overflow-y-auto tw-p-3">
          <InvoiceQrScanner
            v-if="isQrDialogOpen"
            auto-start
            @scanned="handleQrScanned"
          />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog
      v-model="isCameraDialogOpen"
      :maximized="$q.screen.lt.sm"
    >
      <q-card
        class="qr-dialog-card tw-flex tw-flex-col tw-w-full sm:tw-w-[min(92vw,28rem)]
        tw-rounded-none sm:tw-rounded-2xl"
      >
        <q-card-section
          class="qr-dialog-header tw-sticky tw-top-0 tw-z-10 tw-flex tw-items-center
          tw-justify-between tw-px-4 tw-py-3"
        >
          <div class="text-h6">拍照掃描收據</div>
          <q-btn
            v-close-popup
            flat
            dense
            round
            icon="close"
            aria-label="關閉"
          />
        </q-card-section>

        <q-separator />

        <div class="tw-flex-1 tw-overflow-y-auto tw-p-3">
          <ReceiptCameraScanner
            v-if="isCameraDialogOpen"
            @captured="handleCameraCaptured"
            @close="isCameraDialogOpen = false"
          />
        </div>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.qr-dialog-header {
  background: inherit;
}
</style>
