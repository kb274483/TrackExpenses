<template>
  <q-layout view="hHh LpR fFf">

    <q-header elevated class="bg-secondary text-white">
      <q-toolbar>
        <q-btn dense flat rzound icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <div class="tw-flex tw-justify-between tw-items-center">
            <div>
              <q-icon name="account_balance" class="iconStyle" />
              Track expenses
            </div>
            <div class="tw-flex tw-items-center"
              v-if="userToken !== null"
            >
              <div class="tw-w-10 tw-h-10 tw-rounded-md tw-overflow-hidden">
                <img :src="userData.photoURL" alt="">
              </div>
              <q-btn dense flat rzound icon="logout" @click="logout" />
            </div>
          </div>
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
      <div v-if="userToken"
        class="tw-text-gray-600 tw-p-2"
      >
      </div>
      <q-list bordered v-else>
        <q-item v-ripple>
          <q-item-section class="tw-text-gray-600">Please login first</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { useRouter } from 'vue-router';

const $router = useRouter();

const leftDrawerOpen = ref(false);
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value;
};
// firebase auth
const auth = getAuth();
const userToken = ref(null);
const userData = ref(null);

// 登出
const logout = async () => {
  userToken.value = null;
  userData.value = null;
  try {
    await auth.signOut();
    $router.push('/login');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};
// 初始化
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userToken.value = user.accessToken;
      const { photoURL, email, displayName } = user;
      userData.value = { photoURL, email, displayName };
    }
  });
});
</script>

<style lang="scss" scoped>
.iconStyle {
  color: white;
  cursor:pointer ;
  font-size: 1.5em
}

</style>
