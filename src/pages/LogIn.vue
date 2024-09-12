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
import {
  db, ref, get, set,
} from 'src/boot/firebase';

const $router = useRouter();
const auth = getAuth();
const provider = new GoogleAuthProvider();
const login = async () => {
  try {
    const res = await signInWithPopup(auth, provider);
    if (res) {
      const { user } = res;
      const userRef = ref(db, `/users/${user.uid}`); // user.uid be node key

      // 檢查使用者是否已經註冊過
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        // 如果使用者不存在，則寫入資料
        await set(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        console.log('User registered:', user.displayName);
      } else {
        console.log('User already registered:', user.displayName);
      }

      // 登入後跳轉首頁
      $router.push('/');
    }
  } catch (error) {
    console.error('Login error:', error);
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
