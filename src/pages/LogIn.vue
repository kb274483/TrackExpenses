<template>
  <div class="login-page">
    <div class="login-page__blob login-page__blob--moss" />
    <div class="login-page__blob login-page__blob--clay" />

    <q-card class="login-card">
      <q-card-section class="login-card__body">
        <p class="login-card__title">
          Welcome to
          <span class="login-card__accent">Expense Tracker</span>
        </p>
        <div class="login-card__footer">
          <q-btn
            flat
            label="Google LogIn"
            class="login-card__button"
            @click="login()"
          />
        </div>
      </q-card-section>
    </q-card>
    <AlertDialog
      v-if="alertVisible"
      :message="alertMessage"
      :isConfirm="isConfirm"
      @ok="onOk"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged,
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { onMounted, ref as vueRef } from 'vue';
import { db } from 'src/boot/firebase';
import AlertDialog from 'src/components/AlertDialog.vue';

// alert 狀態變數
const alertVisible = vueRef(false);
const alertMessage = vueRef('');
const isConfirm = vueRef(false);

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
      const userRef = ref(db, `/users/${user.uid}`);

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

<style lang="scss" scoped>
.login-page {
  position: relative;
  display: flex;
  min-height: calc(100dvh - 52px);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 2rem 1rem;
  color: var(--organic-foreground);
}

.login-page__blob {
  position: absolute;
  pointer-events: none;
  filter: blur(30px);
  opacity: 0.36;
}

.login-page__blob--moss {
  top: 18%;
  left: 8%;
  width: min(42vw, 18rem);
  aspect-ratio: 1;
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  background: rgba(93, 112, 82, 0.18);
}

.login-page__blob--clay {
  right: 10%;
  bottom: 20%;
  width: min(44vw, 20rem);
  aspect-ratio: 1;
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  background: rgba(193, 140, 93, 0.16);
}

.login-card {
  position: relative;
  z-index: 1;
  width: min(100%, 30rem);
  border: 1px solid rgba(222, 216, 207, 0.72);
  border-radius: 2.8rem 1.8rem 3.6rem 2rem;
  background:
    linear-gradient(145deg, rgba(254, 254, 250, 0.96), rgba(240, 235, 229, 0.78));
  box-shadow: var(--organic-shadow-float);
  color: var(--organic-foreground);
}

.login-card__body {
  padding: 2rem 1.8rem 1.4rem;
}

.login-card__title {
  margin: 0;
  color: var(--organic-foreground);
  font-family: var(--organic-font-heading);
  font-size: clamp(2rem, 9vw, 3rem);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.05;
}

.login-card__accent {
  display: block;
  color: var(--organic-secondary);
}

.login-card__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.35rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(222, 216, 207, 0.9);
}

.login-card__button {
  min-height: 3rem;
  border-radius: 999px;
  background: var(--organic-primary);
  color: var(--organic-primary-foreground);
  font-weight: 800;
  text-transform: none;
  transition: transform 240ms ease, background 240ms ease;
}

.login-card__button:hover {
  transform: translateY(-1px);
}

.login-card__button:active {
  transform: scale(0.97);
}

@media (max-width: 640px) {
  .login-page {
    align-items: center;
    padding: 1.4rem 1rem;
  }

  .login-card {
    width: min(100%, 18rem);
    border-radius: 1.1rem 0.8rem 1.25rem 0.9rem;
  }

  .login-card__body {
    padding: 1rem 0.95rem 0.8rem;
  }

  .login-card__title {
    font-size: 1.45rem;
  }

  .login-card__footer {
    margin-top: 0.8rem;
    padding-top: 0.7rem;
  }

  .login-card__button {
    min-height: 2.5rem;
    padding-inline: 1rem;
    font-size: 0.78rem;
  }
}
</style>
