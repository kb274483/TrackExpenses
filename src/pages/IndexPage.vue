<template>
  <q-page class="tw-flex tw-justify-center tw-items-center">
    <q-card class="tw-w-full xs:tw-w-2/3 lg:tw-w-1/2 tw-mx-4 bg-secondary tw-text-white">
      <q-card-section>
        <div class="text-h6 tw-text-center">
          Choose to join or create.
        </div>
      </q-card-section>

      <q-separator color='white' inset />

      <q-card-actions vertical>
        <q-btn flat align="start" @click="showCreateGroup = true">
          <q-icon name="group_add" class="tw-mr-4" />
          <span>Create group</span>
        </q-btn>

        <q-separator inset />

        <q-btn flat align="start" @click="showJoinGroup = true">
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
            <q-input v-model="groupPassword" label="Password" type="password" filled />
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
            <q-input v-model="joinGroupName" label="Group Name" filled />
            <q-input v-model="joinGroupPassword" label="Password" type="password" filled />
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
  db, ref as dbRef, get, update, set,
} from 'src/boot/firebase';
import bcrypt from 'bcryptjs';
import AlertDialog from 'components/AlertDialog.vue';

const emit = defineEmits(['group-updated']);
// 狀態變數
const showCreateGroup = ref(false);
const showJoinGroup = ref(false);
const groupName = ref('');
const groupPassword = ref('');
const joinGroupName = ref('');
const joinGroupPassword = ref('');

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
  if (!groupName.value || !groupPassword.value) {
    showAlert('Please enter group name and password.');
    return;
  }

  try {
    // 檢查群組名稱是否已存在
    const groupRef = dbRef(db, `/groups/${groupName.value}`);
    const snapshot = await get(groupRef);

    if (snapshot.exists()) {
      showAlert('Group name already exists. Please choose another name.');
      return;
    }

    // 使用 bcrypt 加密密碼
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(groupPassword.value, salt);

    // 創建新的群組
    await set(groupRef, {
      name: groupName.value,
      password: hashedPassword,
      createdBy: user.uid,
      members: {
        [user.uid]: {
          name: user.displayName,
          id: user.uid,
        },
      },
      expenses: {},
    });

    // 將群組加入到使用者的資料中
    const userGroupsRef = dbRef(db, `/users/${user.uid}/groups`);

    // 更新使用者的群組列表
    await update(userGroupsRef, {
      [groupName.value]: true,
    });

    emit('group-updated');

    showAlert('Group created successfully!');
    showCreateGroup.value = false;
    groupName.value = '';
    groupPassword.value = '';
  } catch (error) {
    console.error('Error creating group:', error);
  }
};

// 加入群組函數
const joinGroup = async () => {
  if (!joinGroupName.value || !joinGroupPassword.value) {
    showAlert('Please enter group name and password.');
    return;
  }

  try {
    // 檢查群組是否存在
    const groupRef = dbRef(db, `/groups/${joinGroupName.value}`);
    const snapshot = await get(groupRef);

    if (!snapshot.exists()) {
      showAlert('Group does not exist.');
      return;
    }

    const groupData = snapshot.val();
    const hashedPassword = groupData.password;

    // 比對密碼
    const isPasswordCorrect = bcrypt.compareSync(joinGroupPassword.value, hashedPassword);
    if (!isPasswordCorrect) {
      showAlert('Incorrect password.');
      return;
    }

    // 如果密碼正確，將使用者加入該群組
    const groupMembersRef = dbRef(db, `/groups/${joinGroupName.value}/members`);
    await update(groupMembersRef, {
      [user.uid]: {
        name: user.displayName,
        id: user.uid,
      },
    });

    // 更新使用者的群組列表
    const userGroupsRef = dbRef(db, `/users/${user.uid}/groups`);
    await update(userGroupsRef, {
      [joinGroupName.value]: true,
    });

    emit('group-updated');

    showAlert('Successfully joined the group!');
    showJoinGroup.value = false;
    joinGroupName.value = '';
    joinGroupPassword.value = '';
  } catch (error) {
    console.error('Error joining group:', error);
  }
};
</script>
