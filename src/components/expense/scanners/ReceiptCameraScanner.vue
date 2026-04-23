<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits(['captured', 'close']);

const videoRef = ref(null);
const isStarting = ref(true);
const isCapturing = ref(false);
const error = ref('');

let mediaStream = null;

const stopStream = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (videoRef.value) {
    try { videoRef.value.srcObject = null; } catch (_) { /* noop */ }
  }
};

const start = async () => {
  isStarting.value = true;
  error.value = '';

  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '此裝置不支援相機預覽，請改用相簿上傳。';
    isStarting.value = false;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    mediaStream = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      videoRef.value.muted = true;
      videoRef.value.playsInline = true;
      await videoRef.value.play();
    }
  } catch (_) {
    error.value = '無法啟用相機，請確認權限或改用相簿上傳。';
    stopStream();
  } finally {
    isStarting.value = false;
  }
};

const capture = async () => {
  if (!videoRef.value || !mediaStream) return;
  isCapturing.value = true;

  try {
    const video = videoRef.value;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      throw new Error('Video not ready.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    if (!blob) throw new Error('Capture failed.');

    const file = new File([blob], `receipt-${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    emit('captured', file);
  } catch (_) {
    error.value = '擷取失敗，請再試一次。';
  } finally {
    isCapturing.value = false;
  }
};

onMounted(start);
onBeforeUnmount(stopStream);
</script>

<template>
  <div class="tw-space-y-3">
    <div class="viewfinder tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-black">
      <video
        ref="videoRef"
        class="tw-absolute tw-inset-0 tw-h-full tw-w-full tw-object-cover"
        muted
        playsinline
      />
      <div class="viewfinder-box">
        <span class="corner corner-tl" />
        <span class="corner corner-tr" />
        <span class="corner corner-bl" />
        <span class="corner corner-br" />
      </div>
      <div
        v-if="isStarting"
        class="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center
        tw-text-xs tw-text-white/80"
      >
        相機啟動中…
      </div>
    </div>

    <q-banner
      v-if="error"
      dense
      class="tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-text-red-700
      dark:tw-border-red-900 dark:tw-bg-red-950/40 dark:tw-text-red-200"
      inline-actions
    >
      {{ error }}
    </q-banner>

    <div class="tw-flex tw-justify-center tw-gap-3">
      <q-btn
        unelevated
        color="primary"
        icon="camera"
        label="擷取收據"
        no-caps
        :loading="isCapturing"
        :disable="isStarting || !!error"
        @click="capture"
      />
      <q-btn
        outline
        color="primary"
        icon="close"
        label="取消"
        no-caps
        @click="emit('close')"
      />
    </div>
  </div>
</template>

<style scoped>
.viewfinder {
  aspect-ratio: 3 / 4;
  max-height: 65vh;
}

.viewfinder-box {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 82%;
  height: 82%;
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
</style>
