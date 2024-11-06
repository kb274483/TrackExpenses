<template>
  <div class="flex flex-center containerHeight">
    <q-card class="tw-w-2/3 lg:tw-w-1/4 bg-secondary text-white">
      <q-card-section class="tw-h-full tw-items-center">
        <p class="tw-text-start tw-text-2xl">
          Welcome to
          <span
            style="color: #FFD700;"
            class="tw-block"
          >Expense Tracker</span>
        </p>
        <div class="tw-flex tw-justify-end tw-border-t-2 tw-border-white tw-pt-4">
          <q-btn color="white" text-color="black" label="Google LogIn" @click="login()" />
        </div>
      </q-card-section>
    </q-card>
  </div>
  <AlertDialog
    v-if="alertVisible"
    :message="alertMessage"
    :isConfirm="isConfirm"
    @ok="onOk"
    @cancel="onCancel"
  />
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
import AlertDialog from 'src/components/AlertDialog.vue';

// alert 狀態變數
const alertVisible = ref(false);
const alertMessage = ref('');
const isConfirm = ref(false);

// 顯示 AlertDialog
const showAlert = (message) => {
  alertMessage.value = message;
  isConfirm.value = false;
  alertVisible.value = true;
};

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
      }

      // 登入後跳轉首頁
      $router.push('/');
    }
  } catch (error) {
    showAlert('Login error');
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
