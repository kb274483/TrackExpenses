<template>
  <q-layout view="hHh LpR fFf">

    <!-- Header -->
    <q-header class="app-header">
      <q-toolbar class="app-toolbar">
        <q-btn v-if="userToken !== null"
          dense flat round icon="menu"
          class="app-icon-button"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title class="app-toolbar__title">
          <div class="app-toolbar__content">
            <div class="app-brand">
              <span class="app-brand__mark">
                <q-icon name="account_balance" class="iconStyle" />
              </span>
              <span class="app-brand__text">Track expenses</span>
            </div>
            <div class="app-actions" v-if="userToken !== null">
              <q-btn dense flat round
                :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
                class="app-icon-button"
                @click="toggleDark"
              >
                <q-tooltip>
                  {{ $q.dark.isActive ? '切換淺色模式' : '切換深色模式' }}
                </q-tooltip>
              </q-btn>
              <div class="app-avatar">
                <img :src="userData.photoURL" alt="">
              </div>
              <q-btn
                dense
                flat
                round
                icon="logout"
                class="app-icon-button"
                @click="logout"
              />
            </div>
          </div>
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <!-- Drawer (側邊選單) -->
    <q-drawer
      show-if-above
      v-model="leftDrawerOpen"
      side="left"
      bordered
      class="app-drawer"
    >
      <div v-if="userToken" class="app-drawer__inner">
        <q-list class="app-nav">

          <!-- 回到首頁 -->
          <q-item clickable v-ripple class="app-nav__item app-nav__item--home" @click="goToHome">
            <q-item-section avatar>
              <span class="app-nav__icon">
                <q-icon name="home" />
              </span>
            </q-item-section>
            <q-item-section class="app-nav__label">
              Home
            </q-item-section>
          </q-item>

          <!-- 群組列表 -->
          <template v-if="userGroups.length > 0">
            <q-expansion-item v-for="group in userGroups" :key="group.name"
              expand-icon="arrow_drop_down"
              class="app-nav__group"
            >
              <template v-slot:header>
                <div class="app-nav__group-title">
                  {{ group.name }}
                </div>
              </template>
              <q-item clickable v-ripple
                class="app-nav__subitem"
                @click="goToGroupPage(group.name, 'records')"
              >
                <q-item-section avatar>
                  <span class="app-nav__subicon">
                    <q-icon name="receipt_long" />
                  </span>
                </q-item-section>
                <q-item-section>消費紀錄</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                class="app-nav__subitem"
                @click="goToGroupPage(group.name, 'analysis')"
              >
                <q-item-section avatar>
                  <span class="app-nav__subicon">
                    <q-icon name="analytics" />
                  </span>
                </q-item-section>
                <q-item-section>消費分析</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                class="app-nav__subitem"
                @click="goToGroupPage(group.name, 'settlement')"
              >
                <q-item-section avatar>
                  <span class="app-nav__subicon">
                    <q-icon name="price_check" />
                  </span>
                </q-item-section>
                <q-item-section>帳目結算</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                class="app-nav__subitem"
                @click="goToGroupPage(group.name, 'members')"
              >
                <q-item-section avatar>
                  <span class="app-nav__subicon">
                    <q-icon name="groups_2" />
                  </span>
                </q-item-section>
                <q-item-section>群組成員</q-item-section>
              </q-item>

              <q-item clickable v-ripple
                class="app-nav__subitem"
                @click="goToGroupPage(group.name, 'setting')"
              >
                <q-item-section avatar>
                  <span class="app-nav__subicon">
                    <q-icon name="settings" />
                  </span>
                </q-item-section>
                <q-item-section>群組設定</q-item-section>
              </q-item>
            </q-expansion-item>
          </template>

        </q-list>
      </div>
      <q-list v-else class="app-drawer__empty">
        <q-item v-ripple class="app-nav__item">
          <q-item-section>Please login first</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!-- 主頁面 -->
    <q-page-container>
      <router-view @groupUpdated="loadUserGroups" />
    </q-page-container>

    <AlertDialog
      v-if="alertVisible"
      :message="alertMessage"
      :isConfirm="isConfirm"
      @ok="onOk"
      @cancel="onCancel"
    />

  </q-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { useRouter } from 'vue-router';
import {
  db, ref as dbRef, get,
} from 'src/boot/firebase';
import { toggleDarkMode } from 'src/boot/darkMode';
import AlertDialog from 'src/components/AlertDialog.vue';

const $q = useQuasar();
const $router = useRouter();

const toggleDark = () => toggleDarkMode();

const leftDrawerOpen = ref(false);
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value;
};

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
    showAlert('Error signing out');
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
    showAlert('Error loading');
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
  color: var(--organic-primary-foreground);
  cursor: pointer;
  font-size: 1.25rem;
}

.app-header {
  background: transparent;
  color: var(--organic-foreground);
  padding: 0.75rem 0.75rem 0;
}

.app-toolbar {
  min-height: 4rem;
  border: 1px solid rgba(222, 216, 207, 0.72);
  border-radius: 999px;
  background: rgba(253, 252, 248, 0.78);
  box-shadow: var(--organic-shadow-soft);
  backdrop-filter: blur(18px);
}

.app-toolbar__title {
  padding-left: 0.45rem;
}

.app-toolbar__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.app-brand,
.app-actions {
  display: flex;
  align-items: center;
}

.app-brand {
  min-width: 0;
  gap: 0.72rem;
}

.app-brand__mark {
  display: inline-flex;
  width: 2.35rem;
  height: 2.35rem;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 67% 33% 45% 55% / 52% 44% 56% 48%;
  background: var(--organic-primary);
  box-shadow: var(--organic-shadow-soft);
}

.app-brand__text {
  overflow: hidden;
  color: var(--organic-foreground);
  font-family: var(--organic-font-heading);
  font-size: clamp(1.15rem, 3vw, 1.45rem);
  font-weight: 700;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-actions {
  gap: 0.35rem;
}

.app-icon-button {
  color: var(--organic-primary);
  transition: background 240ms ease, transform 240ms ease;
}

.app-icon-button:hover {
  background: rgba(93, 112, 82, 0.1);
  transform: translateY(-1px);
}

.app-avatar {
  width: 2.35rem;
  height: 2.35rem;
  overflow: hidden;
  border: 2px solid rgba(193, 140, 93, 0.45);
  border-radius: 60% 40% 50% 50% / 55% 45% 55% 45%;
  background: var(--organic-muted);
}

.app-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-drawer {
  border-right: 1px solid rgba(222, 216, 207, 0.72);
  background:
    radial-gradient(circle at 10% 6%, rgba(230, 220, 205, 0.68), transparent 12rem),
    var(--organic-surface);
  color: var(--organic-foreground);
}

.app-drawer__inner,
.app-drawer__empty {
  padding: 5.25rem 0.8rem 1rem;
}

.app-nav {
  display: grid;
  gap: 0.7rem;
}

.app-nav__item,
.app-nav__group {
  overflow: hidden;
  border: 1px solid rgba(222, 216, 207, 0.62);
  border-radius: 1.4rem;
  background: rgba(255, 255, 255, 0.42);
  color: var(--organic-foreground);
  font-weight: 800;
  transition: background 240ms ease, border-color 240ms ease, transform 240ms ease;
}

.app-nav__item:hover,
.app-nav__group:hover {
  border-color: rgba(193, 140, 93, 0.45);
  background: rgba(230, 220, 205, 0.46);
  transform: translateY(-1px);
}

.app-nav__item--home {
  border-radius: 1.8rem 1.15rem 1.45rem 1.15rem;
}

.app-nav__icon,
.app-nav__subicon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
}

.app-nav__icon {
  width: 2.25rem;
  height: 2.25rem;
  background: rgba(93, 112, 82, 0.12);
  color: var(--organic-primary);
}

.app-nav__subicon {
  width: 2rem;
  height: 2rem;
  background: rgba(193, 140, 93, 0.12);
  color: var(--organic-secondary);
}

.app-nav__label {
  font-size: 1.05rem;
}

.app-nav__group :deep(.q-item) {
  min-height: 2.5rem;
  padding: 0 1.2rem;
}

.app-nav__group :deep(.q-item__section--main) {
  min-width: 0;
  flex: 1 1 auto;
}

.app-nav__group :deep(.q-expansion-item__toggle-icon) {
  margin-left: auto;
}

.app-nav__group :deep(.q-item__section--side) {
  min-width: 1.75rem;
  padding-left: 0.5rem;
  align-items: flex-end;
  color: var(--organic-muted-foreground);
}

.app-nav__group :deep(.q-expansion-item__content) {
  padding: 0.25rem 0.55rem 0.7rem;
}

.app-nav__group-title {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--organic-foreground);
  font-family: var(--organic-font-heading);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-nav__subitem {
  margin-top: 0.3rem;
  border-radius: 999px;
  color: var(--organic-muted-foreground);
  font-weight: 800;
  transition: background 240ms ease, color 240ms ease;
}

.app-nav__subitem:hover {
  background: rgba(93, 112, 82, 0.1);
  color: var(--organic-foreground);
}

@media (max-width: 640px) {
  .app-header {
    padding-inline: 0.5rem;
  }

  .app-toolbar {
    min-height: 3.65rem;
  }

  .app-brand {
    gap: 0.55rem;
  }

  .app-brand__mark,
  .app-avatar {
    width: 2.05rem;
    height: 2.05rem;
  }

  .app-actions {
    gap: 0.1rem;
  }
}
</style>
