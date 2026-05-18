<template>
  <q-page class="home-page">
    <div class="home-page__blob home-page__blob--moss" />
    <div class="home-page__blob home-page__blob--clay" />

    <q-card class="home-card">
      <q-card-section class="home-card__header">
        <div class="home-card__eyebrow">
          Track expenses
        </div>
        <div class="home-card__title">
          Choose to join or create.
        </div>
        <div class="home-card__subtitle">
          a group to start managing expenses.
        </div>
      </q-card-section>

      <q-separator class="home-card__separator" inset />

      <q-card-actions vertical class="home-card__actions">
        <q-btn flat align="start"
          class="home-action home-action--primary"
          @click="showCreateGroup = true"
        >
          <q-icon name="group_add" class="home-action__icon" />
          <span>Create group</span>
        </q-btn>

        <!-- <q-separator inset /> -->

        <q-btn flat align="start"
          class="home-action home-action--outline"
          @click="showJoinGroup = true"
        >
          <q-icon name="person_add" class="home-action__icon" />
          <span>Join group</span>
        </q-btn>
      </q-card-actions>

      <!-- 創建群組對話框 -->
      <q-dialog persistent v-model="showCreateGroup" >
        <q-card class="group-dialog">
          <q-card-section class="group-dialog__body">
            <div class="group-dialog__title">Create a Group</div>
            <q-input
              v-model="groupName"
              label="Group Name"
              filled
              class="organic-input"
            />
          </q-card-section>

          <q-card-actions align="right" class="group-dialog__actions">
            <q-btn
              flat
              label="Cancel"
              class="dialog-action dialog-action--ghost"
              @click="showCreateGroup = false"
            />
            <q-btn
              flat
              label="Create"
              class="dialog-action dialog-action--primary"
              @click="createGroup"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- 加入群組對話框 -->
      <q-dialog persistent v-model="showJoinGroup">
        <q-card class="group-dialog">
          <q-card-section class="group-dialog__body">
            <div class="group-dialog__title">Join a Group</div>
            <q-input
              v-model="joinGroupId"
              label="Group ID"
              filled
              class="organic-input"
            />
          </q-card-section>

          <q-card-actions align="right" class="group-dialog__actions">
            <q-btn
              flat
              label="Cancel"
              class="dialog-action dialog-action--ghost"
              @click="showJoinGroup = false"
            />
            <q-btn
              flat
              label="Join"
              class="dialog-action dialog-action--primary"
              @click="joinGroup"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- 全局AlertDialog -->
      <AlertDialog
        v-if="alertVisible"
        :message="alertMessage"
        :isConfirm="isConfirm"
        @ok="onOk"
        @cancel="onCancel"
      />
    </q-card>
  </q-page>
</template>

<script setup>
import { getAuth } from 'firebase/auth';
import { ref, defineEmits } from 'vue';
import {
  db, ref as dbRef, get, set,
} from 'src/boot/firebase';
import AlertDialog from 'components/AlertDialog.vue';

const emit = defineEmits(['group-updated']);
// 狀態變數
const showCreateGroup = ref(false);
const showJoinGroup = ref(false);
const groupName = ref('');
const joinGroupId = ref('');

// 全局 alert 狀態變數
const alertVisible = ref(false);
const alertMessage = ref('');
const isConfirm = ref(false);

// 取得目前登入的使用者
const auth = getAuth();
const user = auth.currentUser;

// 顯示 AlertDialog
const showAlert = (message) => {
  alertMessage.value = message;
  isConfirm.value = false;
  alertVisible.value = true;
};

// 創建群組函數
const createGroup = async () => {
  if (!groupName.value) {
    showAlert('Please enter group name.');
    return;
  }

  try {
    // 確認用戶資訊
    if (!user || !user.uid || !user.displayName) {
      showAlert('User information not available. Please try logging in again.');
      return;
    }

    // 檢查群組名稱是否已存在
    const groupRef = dbRef(db, `/groups/${groupName.value}`);
    const snapshot = await get(groupRef);

    if (snapshot.exists()) {
      showAlert('Group name already exists. Please choose another name.');
      return;
    }

    // 創建唯一的Group ID
    const groupId = Date.now().toString();

    // 分步驟創建，先創建基本結構，再添加成員
    // 1. 先創建基本群組結構
    await set(groupRef, {
      name: groupName.value,
      createdBy: user.uid,
      groupId,
      expenses: {},
      members: {},
    });

    // 2. 將成員加入群組
    const memberRef = dbRef(db, `/groups/${groupName.value}/members/${user.uid}`);
    await set(memberRef, {
      name: user.displayName,
      id: user.uid,
    });

    // 3. 在groupIds下記錄映射關係
    const groupIdsRef = dbRef(db, `/groupIds/${groupId}`);
    await set(groupIdsRef, {
      name: groupName.value,
    });

    // 4. 將群組加入到使用者的資料中
    const userGroupsRef = dbRef(db, `/users/${user.uid}/groups/${groupName.value}`);
    await set(userGroupsRef, true);

    // 成功建立群組
    emit('group-updated');
    showAlert(`Group created successfully! Your Group ID is: ${groupId}`);
    showCreateGroup.value = false;
    groupName.value = '';
  } catch (error) {
    showAlert(`Error creating group: ${error.message || 'Please try again.'}`);
  }
};

const joinGroup = async () => {
  if (!joinGroupId.value) {
    showAlert('Please enter Group ID.');
    return;
  }

  try {
    // 確認用戶資訊
    if (!user || !user.uid || !user.displayName) {
      showAlert('User information not available. Please try logging in again.');
      return;
    }

    // 1. 先通過Group ID查找對應的Group Name
    const groupIdsRef = dbRef(db, `/groupIds/${joinGroupId.value}`);
    const groupIdSnapshot = await get(groupIdsRef);

    if (!groupIdSnapshot.exists()) {
      showAlert('Group does not exist.');
      return;
    }

    const groupData = groupIdSnapshot.val();
    const targetGroupName = groupData.name;

    // 2. 檢查群組是否存在
    const groupRef = dbRef(db, `/groups/${targetGroupName}`);
    const snapshot = await get(groupRef);

    if (!snapshot.exists()) {
      showAlert('Group does not exist.');
      return;
    }

    // 3. 將使用者加入該群組
    const memberRef = dbRef(db, `/groups/${targetGroupName}/members/${user.uid}`);
    await set(memberRef, {
      name: user.displayName,
      id: user.uid,
    });

    // 4. 更新使用者的群組列表
    const userGroupRef = dbRef(db, `/users/${user.uid}/groups/${targetGroupName}`);
    await set(userGroupRef, true);

    emit('group-updated');

    showAlert('Successfully joined the group!');
    showJoinGroup.value = false;
    joinGroupId.value = '';
  } catch (error) {
    showAlert(`Error joining group: ${error.message || 'Please try again.'}`);
  }
};
</script>

<style lang="scss" scoped>
.home-page {
  position: relative;
  display: flex;
  min-height: calc(100vh - 50px);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 6rem 1rem;
  color: var(--organic-foreground);
}

.home-page__blob {
  position: absolute;
  pointer-events: none;
  filter: blur(30px);
  opacity: 0.42;
}

.home-page__blob--moss {
  top: 8%;
  left: 8%;
  width: min(34vw, 24rem);
  aspect-ratio: 1;
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  background: rgba(93, 112, 82, 0.22);
}

.home-page__blob--clay {
  right: 6%;
  bottom: 8%;
  width: min(42vw, 28rem);
  aspect-ratio: 1;
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  background: rgba(193, 140, 93, 0.2);
}

.home-card {
  position: relative;
  z-index: 1;
  width: min(100%, 34rem);
  overflow: hidden;
  border: 1px solid rgba(222, 216, 207, 0.72);
  border-radius: 3.2rem 2rem 4.4rem 2.4rem;
  background:
    linear-gradient(145deg, rgba(254, 254, 250, 0.96), rgba(240, 235, 229, 0.78));
  box-shadow: var(--organic-shadow-float);
  color: var(--organic-foreground);
}

.home-card::before {
  content: '';
  position: absolute;
  inset: 1rem auto auto 1.25rem;
  width: 6.5rem;
  aspect-ratio: 1;
  border-radius: 67% 33% 45% 55% / 52% 44% 56% 48%;
  background: rgba(230, 220, 205, 0.62);
}

.home-card__header {
  position: relative;
  padding: 3rem 2rem 2rem;
  text-align: center;
}

.home-card__eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.25rem 1rem;
  border: 1px solid rgba(193, 140, 93, 0.36);
  border-radius: 999px;
  background: rgba(230, 220, 205, 0.44);
  color: var(--organic-secondary);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0;
}

.home-card__title {
  margin-top: 1.25rem;
  color: var(--organic-foreground);
  font-family: var(--organic-font-heading);
  font-size: clamp(2.25rem, 8vw, 3.8rem);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
}

.home-card__subtitle {
  max-width: 18rem;
  margin: 1rem auto 0;
  color: var(--organic-muted-foreground);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.55;
}

.home-card__separator {
  background: rgba(222, 216, 207, 0.82);
}

.home-card__actions {
  gap: 0.8rem;
  padding: 1.4rem 1.35rem 1.65rem;
}

.home-action {
  min-height: 3.55rem;
  border-radius: 999px;
  font-family: var(--organic-font-body);
  font-size: 1rem;
  font-weight: 800;
  text-transform: none;
  transition: transform 300ms ease, box-shadow 300ms ease, background 300ms ease;
}

.home-action:hover {
  transform: translateY(-2px) scale(1.02);
}

.home-action:active {
  transform: scale(0.97);
}

.home-action--primary {
  background: var(--organic-primary);
  box-shadow: var(--organic-shadow-soft);
  color: var(--organic-primary-foreground);
}

.home-action--primary:hover {
  box-shadow: 0 10px 28px -8px rgba(93, 112, 82, 0.38);
}

.home-action--outline {
  border: 2px solid rgba(193, 140, 93, 0.78);
  background: rgba(255, 255, 255, 0.38);
  color: var(--organic-secondary);
}

.home-action--outline:hover {
  background: rgba(193, 140, 93, 0.1);
  box-shadow: 0 8px 24px -14px rgba(193, 140, 93, 0.48);
}

.home-action__icon {
  margin-right: 1rem;
  font-size: 1.45rem;
}

.group-dialog {
  width: min(calc(100vw - 2rem), 32rem);
  border: 1px solid rgba(222, 216, 207, 0.75);
  border-radius: 2.2rem 3.6rem 2.4rem 2rem;
  background: var(--organic-surface);
  box-shadow: var(--organic-shadow-float);
  color: var(--organic-foreground);
}

.group-dialog__body {
  padding: 2rem 1.6rem 1rem;
}

.group-dialog__title {
  margin-bottom: 1.25rem;
  color: var(--organic-foreground);
  font-family: var(--organic-font-heading);
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: 0;
}

.group-dialog__actions {
  gap: 0.6rem;
  padding: 0 1.4rem 1.4rem;
}

.dialog-action {
  min-height: 2.75rem;
  border-radius: 999px;
  padding-inline: 1.25rem;
  font-weight: 800;
  text-transform: none;
  transition: transform 250ms ease, background 250ms ease;
}

.dialog-action:active {
  transform: scale(0.96);
}

.dialog-action--ghost {
  color: var(--organic-destructive);
}

.dialog-action--ghost:hover {
  background: rgba(168, 84, 72, 0.1);
}

.dialog-action--primary {
  background: var(--organic-primary);
  color: var(--organic-primary-foreground);
  box-shadow: var(--organic-shadow-soft);
}

.organic-input :deep(.q-field__control) {
  min-height: 3rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  color: var(--organic-foreground);
}

.organic-input :deep(.q-field__control::before) {
  border-color: var(--organic-border);
}

.organic-input :deep(.q-field__control::after) {
  border-color: rgba(93, 112, 82, 0.48);
}

.organic-input :deep(.q-field__label),
.organic-input :deep(.q-field__native) {
  color: var(--organic-muted-foreground);
  font-family: var(--organic-font-body);
}

@media (max-width: 640px) {
  .home-page {
    align-items: flex-start;
    min-height: calc(100vh - 50px);
    padding: 5.25rem 1rem 2rem;
  }

  .home-card {
    border-radius: 2.4rem 1.65rem 3.1rem 1.8rem;
  }

  .home-card__header {
    padding: 2.4rem 1.35rem 1.65rem;
  }

  .home-card__actions {
    padding-inline: 1rem;
  }
}
</style>
