<template>
  <div class="flex flex-center containerHeight">
    <q-card class="tw-w-2/3 lg:tw-w-1/4 bg-secondary text-white">
      <q-card-section class="tw-h-full tw-items-center">
        <p class="tw-text-center tw-text-2xl">Hello!</p>
        <div class="tw-flex tw-justify-end tw-border-t-2 tw-border-white tw-pt-4">
          <q-btn color="white" text-color="black" label="LogIn" @click="login()" />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged,
} from 'firebase/auth';
import { onMounted } from 'vue';

const $router = useRouter();
const auth = getAuth();
const provider = new GoogleAuthProvider();
const login = async () => {
  try {
    const res = await signInWithPopup(auth, provider);
    // 跳轉首頁
    if (res) $router.push('/');
  } catch (error) {
    console.error(error);
  }
};
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) $router.push('/');
  });
});

</script>

<style scoped>
.containerHeight{
  height : calc(100dvh - 52px);
}
</style>
