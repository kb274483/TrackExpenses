<template>
  <q-page class="tw-p-4">
    <div class="tw-relative">
      <q-icon name="badge"
        class="tw-font-bold tw-text-gray-600 tw-text-2xl tw-relative -tw-top-1"
      />
      <span class="tw-font-bold tw-text-gray-600 tw-text-lg">{{ watchGroupName }}</span>
      群組成員
    </div>
    <!-- 顯示群組成員 -->
    <q-list>
      <q-item
        v-for="(member, index) in members" :key="index"
        class="tw-border tw-my-1 tw-border-gray-200
          tw-rounded tw-flex tw-justify-between tw-items-center
        "
      >
        <div class="tw-flex tw-items-center tw-gap-2">
          <q-icon name="person" class="tw-text-3xl tw-text-gray-600" />
          <q-item-label>{{ member.name }}</q-item-label>
        </div>

        <!-- 群組創建者，顯示移除成員按鈕 -->
        <!-- <q-btn v-if="isGroupCreator"
          icon="delete" color="negative"
          @click="confirmDeleteMember(member)"
        /> -->
      </q-item>
    </q-list>

    <!-- 確認刪除對話框 -->
    <AlertDialog
      v-if="alertVisible"
      :message="alertMessage"
      :isConfirm="isConfirm"
      @ok="removeMember"
      @cancel="onCancel"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import {
  db, ref as dbRef, get, update,
} from 'src/boot/firebase';
import { useRoute } from 'vue-router';
import { getAuth } from 'firebase/auth';
import AlertDialog from 'components/AlertDialog.vue';

// 獲取群組名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

const auth = getAuth();
const user = auth.currentUser;

// 存放群組成員
const members = ref([]);
const isGroupCreator = ref(false);

// 用於確認的 AlertDialog 相關狀態
const alertVisible = ref(false);
const alertMessage = ref('');
const isConfirm = ref(false);
const memberToDelete = ref(null);

// 顯示 AlertDialog
const showAlert = (message, confirm = false) => {
  alertMessage.value = message;
  isConfirm.value = confirm;
  alertVisible.value = true;
};

// 獲取群組成員和判斷是否為創建者
const fetchGroupMembers = async () => {
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    const groupData = snapshot.val();
    members.value = Object.values(groupData.members);
    isGroupCreator.value = groupData.createdBy === user.uid;
  }
};

// 確認刪除成員前的提示
// const confirmDeleteMember = (member) => {
//   memberToDelete.value = member;
//   showAlert(`你確定要刪除 ${member.name} 嗎？`, true);
// };

// 移除成員功能
const removeMember = async () => {
  if (!isGroupCreator.value) return;
  if (memberToDelete.value) {
    if (memberToDelete.value.id === user.uid) {
      alertVisible.value = false;
      memberToDelete.value = null;
      setTimeout(() => showAlert('You cannot remove yourself from the group.'), 100);
      return;
    }
    // 移除成員
    const groupRef = dbRef(db, `/groups/${groupName}/members/${memberToDelete.value.id}`);
    await update(groupRef, null);

    // 移除成員的群組
    const userGroupRef = dbRef(db, `/users/${memberToDelete.value.id}/groups/${groupName}`);
    await update(userGroupRef, null);

    fetchGroupMembers(); // 重新獲取群組成員
    // 重置狀態
    alertVisible.value = false;
    memberToDelete.value = null;
  }
};

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    watchGroupName.value = newGroupName;
    await fetchGroupMembers();
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化
onMounted(() => {
  fetchGroupMembers();
});
</script>
