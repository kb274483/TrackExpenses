<template>
  <q-page class="tw-flex tw-justify-center tw-items-center">
    <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2 tw-mx-4 bg-secondary tw-text-white">
      <q-card-section>
        <div class="tw-text-2xl tw-text-center">
          Choose to join or create.
        </div>
        <div class="tw-text-sm tw-text-center">
          a group to start managing expenses.
        </div>
      </q-card-section>

      <q-separator color='white' inset />

      <q-card-actions vertical class="tw-mx-2">
        <q-btn flat align="start"
          class="tw-mb-1"
          style="background-color: white; color: #555555;"
          @click="showCreateGroup = true"
        >
          <q-icon name="group_add" class="tw-mr-4" />
          <span>Create group</span>
        </q-btn>

        <!-- <q-separator inset /> -->

        <q-btn flat align="start"
          style="background-color: white; color: #555555;"
          @click="showJoinGroup = true"
        >
          <q-icon name="person_add" class="tw-mr-4" />
          <span>Join group</span>
        </q-btn>
      </q-card-actions>

      <!-- 創建群組對話框 -->
      <q-dialog persistent v-model="showCreateGroup" >
        <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
          <q-card-section>
            <div class="text-h6">Create a Group</div>
            <q-input v-model="groupName" label="Group Name" filled />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="negative" @click="showCreateGroup = false" />
            <q-btn flat label="Create" color="primary" @click="createGroup" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- 加入群組對話框 -->
      <q-dialog persistent v-model="showJoinGroup">
        <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2">
          <q-card-section>
            <div class="text-h6">Join a Group</div>
            <q-input v-model="joinGroupId" label="Group ID" filled />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="negative" @click="showJoinGroup = false" />
            <q-btn flat label="Join" color="primary" @click="joinGroup" />
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
