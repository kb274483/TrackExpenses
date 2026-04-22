<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import {
  decodeLeftQr,
  decodeRightQr,
  mergeInvoiceData,
} from 'src/api/taiwanInvoiceQr';

const props = defineProps({
  autoStart: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['scanned']);

const qrScannerInstance = ref(null);
const scannerModule = ref(null);
const videoRef = ref(null);
const leftFileInputRef = ref(null);
const rightFileInputRef = ref(null);

const leftRawText = ref('');
const rightRawText = ref('');
const leftData = ref(null);
const rightData = ref(null);
const scanStage = ref('idle');
const isCameraActive = ref(false);
const isStartingCamera = ref(false);
const scanError = ref('');
const scanWarning = ref('');

const CHIP_DONE_CLASS = 'tw-border-emerald-300 tw-bg-emerald-50 tw-text-emerald-700 '
  + 'dark:tw-border-emerald-700 dark:tw-bg-emerald-950/40 dark:tw-text-emerald-200';
const CHIP_PENDING_CLASS = 'tw-border-slate-200 tw-bg-white tw-text-slate-600 '
  + 'dark:tw-border-slate-700 dark:tw-bg-slate-800 dark:tw-text-slate-300';

const leftChipClass = computed(() => (leftData.value ? CHIP_DONE_CLASS : CHIP_PENDING_CLASS));
const rightChipClass = computed(() => (rightData.value ? CHIP_DONE_CLASS : CHIP_PENDING_CLASS));

const stageLabel = computed(() => ({
  idle: '尚未開始',
  'scanning-left': '掃描左側 QR 中',
  'captured-left': '左側 QR 已捕獲',
  'scanning-right': '掃描右側 QR 中',
  'captured-both': '左右 QR 已捕獲',
}[scanStage.value] || '尚未開始'));

const emitScannedResult = () => {
  if (!leftData.value || !rightData.value) return;
  emit('scanned', mergeInvoiceData(leftData.value, rightData.value));
};

const safeVibrate = () => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(80);
  }
};

const resetScannerInstance = () => {
  qrScannerInstance.value?.stop();
  qrScannerInstance.value?.destroy();
  qrScannerInstance.value = null;
  isCameraActive.value = false;
};

const resetAll = () => {
  resetScannerInstance();
  leftRawText.value = '';
  rightRawText.value = '';
  leftData.value = null;
  rightData.value = null;
  scanStage.value = 'idle';
  scanError.value = '';
  scanWarning.value = '';
};

const handleDecodedText = (text) => {
  scanError.value = '';

  if (!leftData.value) {
    try {
      const decoded = decodeLeftQr(text);
      leftData.value = decoded;
      leftRawText.value = text;
      scanStage.value = rightData.value ? 'captured-both' : 'captured-left';
      safeVibrate();
      resetScannerInstance();
      if (rightData.value) nextTick(emitScannedResult);
      return;
    } catch (error) {
      scanStage.value = 'scanning-left';
      scanError.value = '這不是統一發票左側 QR';
      return;
    }
  }

  try {
    const decoded = decodeRightQr(text);
    rightData.value = decoded;
    rightRawText.value = text;
    scanStage.value = 'captured-both';
    safeVibrate();
    resetScannerInstance();

    if (leftData.value.rightItemCount && leftData.value.rightItemCount !== decoded.items.length) {
      scanWarning.value = `右側 QR 品項數 ${decoded.items.length} 筆，與左側宣告 ${leftData.value.rightItemCount} 筆不一致。`;
    } else {
      scanWarning.value = '';
    }

    nextTick(emitScannedResult);
  } catch (error) {
    scanStage.value = 'scanning-right';
    scanError.value = '這不是統一發票右側 QR';
  }
};

const loadQrScannerModule = async () => {
  if (scannerModule.value) return scannerModule.value;

  const module = await import('qr-scanner');
  scannerModule.value = module.default;
  return scannerModule.value;
};

const startCameraScan = async () => {
  scanError.value = '';
  scanWarning.value = '';
  isStartingCamera.value = true;

  try {
    const QrScanner = await loadQrScannerModule();
    const videoElement = videoRef.value;

    if (!videoElement) {
      throw new Error('Camera preview is unavailable.');
    }

    resetScannerInstance();

    qrScannerInstance.value = new QrScanner(
      videoElement,
      (result) => {
        const data = typeof result === 'string' ? result : result?.data;
        if (data) {
          handleDecodedText(data);
        }
      },
      {
        preferredCamera: 'environment',
        returnDetailedScanResult: true,
      },
    );

    await qrScannerInstance.value.start();
    isCameraActive.value = true;
    scanStage.value = leftData.value ? 'scanning-right' : 'scanning-left';
  } catch (error) {
    scanError.value = '無法啟用相機，請改用圖片上傳解碼。';
    resetScannerInstance();
  } finally {
    isStartingCamera.value = false;
  }
};

const triggerFilePicker = () => {
  if (leftData.value) {
    rightFileInputRef.value?.click();
    scanStage.value = 'scanning-right';
    return;
  }

  leftFileInputRef.value?.click();
  scanStage.value = 'scanning-left';
};

const handleFileDecode = async (event, side) => {
  const [file] = event.target.files || [];
  event.target.value = '';

  if (!file) return;

  scanError.value = '';

  try {
    const QrScanner = await loadQrScannerModule();
    const result = await QrScanner.scanImage(file, {
      returnDetailedScanResult: true,
    });
    const text = typeof result === 'string' ? result : result?.data;

    if (!text) {
      throw new Error('Unable to decode QR.');
    }

    if (side === 'left' && leftData.value) {
      leftData.value = null;
      leftRawText.value = '';
    }

    if (side === 'right' && rightData.value) {
      rightData.value = null;
      rightRawText.value = '';
    }

    handleDecodedText(text);
  } catch (error) {
    scanError.value = side === 'left'
      ? '這不是統一發票左側 QR'
      : '這不是統一發票右側 QR';
  }
};

onMounted(() => {
  if (props.autoStart) {
    startCameraScan();
  }
});

onBeforeUnmount(() => {
  resetScannerInstance();
});
</script>

<template>
  <div class="tw-space-y-4">
    <div class="tw-flex tw-items-start tw-justify-between tw-gap-3">

      <div class="tw-flex tw-gap-2">
        <q-btn
          dense
          outline
          color="primary"
          icon="photo_camera"
          label="使用相機"
          no-caps
          :loading="isStartingCamera"
          @click="startCameraScan"
        />
        <q-btn
          dense
          flat
          color="primary"
          icon="upload"
          label="上傳圖片"
          no-caps
          @click="triggerFilePicker"
        />
      </div>
    </div>

    <input
      ref="leftFileInputRef"
      class="tw-hidden"
      type="file"
      accept="image/*"
      @change="handleFileDecode($event, 'left')"
    >
    <input
      ref="rightFileInputRef"
      class="tw-hidden"
      type="file"
      accept="image/*"
      @change="handleFileDecode($event, 'right')"
    >

    <div class="tw-flex tw-items-center tw-gap-2">
      <div
        class="tw-flex-1 tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5
        tw-text-xs tw-font-medium tw-border tw-transition-colors"
        :class="leftChipClass"
      >
        <q-icon
          :name="leftData ? 'check_circle' : 'looks_one'"
          size="xs"
        />
        <span class="tw-truncate">
          {{ leftData ? `左側 ${leftData.invoiceNumber}` : '左側 QR' }}
        </span>
      </div>
      <div
        class="tw-flex-1 tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5
        tw-text-xs tw-font-medium tw-border tw-transition-colors"
        :class="rightChipClass"
      >
        <q-icon
          :name="rightData ? 'check_circle' : 'looks_two'"
          size="xs"
        />
        <span class="tw-truncate">
          {{ rightData ? `右側 ${rightData.items.length} 品項` : '右側 QR' }}
        </span>
      </div>
    </div>

    <div
      v-if="isCameraActive || isStartingCamera"
      class="viewfinder tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-black"
    >
      <video
        ref="videoRef"
        class="tw-absolute tw-inset-0 tw-h-full tw-w-full tw-object-cover"
        muted
        playsinline
      />
      <div class="tw-absolute tw-inset-0 viewfinder-mask" />
      <div class="viewfinder-box">
        <span class="corner corner-tl" />
        <span class="corner corner-tr" />
        <span class="corner corner-bl" />
        <span class="corner corner-br" />
        <span class="scan-line" />
      </div>
      <div
        class="tw-absolute tw-top-3 tw-left-1/2 -tw-translate-x-1/2 tw-rounded-full
        tw-bg-black/60 tw-px-3 tw-py-1 tw-text-xs tw-text-white tw-font-medium tw-backdrop-blur"
      >
        {{ stageLabel }}
      </div>
    </div>

    <q-banner
      v-else
      dense
      class="tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white
      dark:tw-border-slate-700 dark:tw-bg-slate-800 dark:tw-text-slate-100"
      inline-actions
    >
      {{ stageLabel }}
    </q-banner>

    <q-banner
      v-if="scanError"
      dense
      class="tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-text-red-700
      dark:tw-border-red-900 dark:tw-bg-red-950/40 dark:tw-text-red-200"
      inline-actions
    >
      {{ scanError }}
    </q-banner>

    <q-banner
      v-if="scanWarning"
      dense
      class="tw-rounded-lg tw-border tw-border-amber-200 tw-bg-amber-50 tw-text-amber-800
      dark:tw-border-amber-900 dark:tw-bg-amber-950/30 dark:tw-text-amber-200"
      inline-actions
    >
      {{ scanWarning }}
    </q-banner>

    <div
      v-if="leftData || rightData"
      class="tw-flex tw-justify-end"
    >
      <q-btn
        outline
        dense
        color="primary"
        label="重新掃描"
        no-caps
        @click="resetAll"
      />
    </div>

    <details class="tw-rounded-lg tw-bg-slate-100 tw-p-3 dark:tw-bg-slate-900/80">
      <summary
        class="tw-cursor-pointer tw-text-xs tw-font-medium tw-text-slate-700
        dark:tw-text-slate-200"
      >
        原始解碼字串（debug）
      </summary>
      <div class="tw-mt-2 tw-space-y-2 tw-break-all tw-font-mono tw-text-xs
        tw-text-slate-600 dark:tw-text-slate-300"
      >
        <div>左側：{{ leftRawText || '尚未掃描' }}</div>
        <div>右側：{{ rightRawText || '尚未掃描' }}</div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.viewfinder {
  aspect-ratio: 1 / 1;
  max-height: 60vh;
}

.viewfinder-mask {
  background:
    radial-gradient(
      circle at center,
      transparent 0,
      transparent 38%,
      rgba(0, 0, 0, 0.55) 60%
    );
  pointer-events: none;
}

.viewfinder-box {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 70%;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border-color: #10b981;
  border-style: solid;
  border-width: 0;
}

.corner-tl {
  top: 0; left: 0;
  border-top-width: 3px; border-left-width: 3px;
  border-top-left-radius: 6px;
}
.corner-tr {
  top: 0; right: 0;
  border-top-width: 3px; border-right-width: 3px;
  border-top-right-radius: 6px;
}
.corner-bl {
  bottom: 0; left: 0;
  border-bottom-width: 3px; border-left-width: 3px;
  border-bottom-left-radius: 6px;
}
.corner-br {
  bottom: 0; right: 0;
  border-bottom-width: 3px; border-right-width: 3px;
  border-bottom-right-radius: 6px;
}

.scan-line {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #10b981 50%, transparent);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
  animation: scan-sweep 2.2s ease-in-out infinite;
}

@keyframes scan-sweep {
  0%   { top: 2%; opacity: 0.2; }
  50%  { top: 96%; opacity: 1; }
  100% { top: 2%; opacity: 0.2; }
}
</style>
