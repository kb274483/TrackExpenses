<template>
  <q-layout view="hHh LpR fFf">

    <!-- Header -->
    <q-header elevated class="bg-secondary text-white">
      <q-toolbar>
        <q-btn v-if="userToken !== null"
          dense flat round icon="menu"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title>
          <div class="tw-flex tw-justify-between tw-items-center">
            <div>
              <q-icon name="account_balance" class="iconStyle" />
              Track expenses
            </div>
            <div class="tw-flex tw-items-center" v-if="userToken !== null">
              <div class="tw-w-10 tw-h-10 tw-rounded-md tw-overflow-hidden">
                <img :src="userData.photoURL" alt="">
              </div>
              <q-btn dense flat round icon="logout" @click="logout" />
            </div>
          </div>
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <!-- Drawer (側邊選單) -->
    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
      <div v-if="userToken" class="tw-text-gray-600 tw-p-2">
        <q-list>

          <!-- 回到首頁 -->
          <q-item clickable v-ripple @click="goToHome">
            <q-item-section avatar>
              <q-icon name="home" />
            </q-item-section>
            <q-item-section class="tw-font-bold tw-text-lg">
              Home
            </q-item-section>
          </q-item>

          <!-- 群組列表 -->
          <template v-if="userGroups.length > 0">
            <q-expansion-item v-for="group in userGroups" :key="group.name"
              expand-icon="arrow_drop_down"
              class="tw-font-semibold tw-text-lg tw-items-center
                tw-border tw-rounded tw-border-gray-300
              "
            >
              <template v-slot:header>
                {{ group.name }}
              </template>
              <q-item clickable v-ripple
                @click="goToGroupPage(group.name, 'records')"
              >
                <q-item-section avatar>
                  <q-icon name="receipt_long" />
                </q-item-section>
                <q-item-section>消費紀錄</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                @click="goToGroupPage(group.name, 'analysis')"
              >
                <q-item-section avatar>
                  <q-icon name="analytics" />
                </q-item-section>
                <q-item-section>消費分析</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                @click="goToGroupPage(group.name, 'settlement')"
              >
                <q-item-section avatar>
                  <q-icon name="price_check" />
                </q-item-section>
                <q-item-section>帳目結算</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                @click="goToGroupPage(group.name, 'members')"
              >
                <q-item-section avatar>
                  <q-icon name="groups_2" />
                </q-item-section>
                <q-item-section>群組成員</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                @click="goToGroupPage(group.name, 'setting')"
              >
                <q-item-section avatar>
                  <q-icon name="settings" />
                </q-item-section>
                <q-item-section>群組設定</q-item-section>
              </q-item>
            </q-expansion-item>
          </template>

        </q-list>
      </div>
      <q-list bordered v-else>
        <q-item v-ripple>
          <q-item-section class="tw-text-gray-600">Please login first</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!-- 主頁面 -->
    <q-page-container>
      <router-view @groupUpdated="loadUserGroups" />
    </q-page-container>

  </q-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { useRouter } from 'vue-router';
import {
  db, ref as dbRef, get,
} from 'src/boot/firebase';

const $router = useRouter();

const leftDrawerOpen = ref(false);
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value;
};

// firebase auth
const auth = getAuth();
const userToken = ref(null);
const userData = ref(null);
const userGroups = ref([]);

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

// 載入使用者加入的群組
const loadUserGroups = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      const userGroupsRef = dbRef(db, `/users/${user.uid}/groups`);
      const snapshot = await get(userGroupsRef);

      if (snapshot.exists()) {
        const groups = snapshot.val();
        userGroups.value = Object.keys(groups).map((groupName) => ({
          name: groupName,
        }));
      }
    }
  } catch (error) {
    console.error('Error loading user groups:', error);
  }
};
// 監聽創建或加入群組的事件
const emit = defineEmits(['group-updated']);
onMounted(() => {
  emit('group-updated', loadUserGroups);
});

// 導航到不同群組頁面
const goToGroupPage = (groupName, section) => {
  $router.push({ name: section, params: { groupName } });
};

// 回到首頁
const goToHome = () => {
  $router.push('/');
};

// 初始化
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userToken.value = user.accessToken;
      const { photoURL, email, displayName } = user;
      userData.value = { photoURL, email, displayName };
      loadUserGroups(); // 載入使用者的群組
    }
  });
});
</script>

<style lang="scss" scoped>
.iconStyle {
  color: white;
  cursor: pointer;
  font-size: 1.5em;
}
</style>
