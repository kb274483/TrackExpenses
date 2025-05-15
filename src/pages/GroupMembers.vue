<template>
  <q-page class="tw-p-4">
    <div class="tw-relative">
      <q-icon name="badge"
        class="tw-font-bold tw-text-gray-600 tw-text-2xl tw-relative -tw-top-1"
      />
      <span class="tw-font-bold tw-text-gray-600 tw-text-lg">{{ watchGroupName }}</span>
      群組成員
    </div>

    <!-- 顯示群組ID -->
    <div v-if="groupId" class="tw-bg-gray-100 tw-p-3 tw-rounded tw-mb-4 tw-mt-2">
      <div class="tw-flex tw-justify-between tw-items-center">
        <div>
          <div class="tw-text-sm tw-text-gray-500">群組ID</div>
          <div class="tw-font-medium">{{ groupId }}</div>
        </div>
        <q-btn flat round icon="content_copy" color="primary" @click="copyGroupId">
          <q-tooltip>複製群組ID</q-tooltip>
        </q-btn>
      </div>
      <div class="tw-text-xs tw-text-gray-500 tw-mt-1">
        分享此ID給朋友，他們可以使用此ID加入群組
      </div>
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

    <!-- Copy Group ID Success -->
    <q-dialog v-model="showCopySuccess" position="bottom">
      <q-card class="tw-bg-gray-600 text-white">
        <q-card-section class="row items-center">
          <q-icon name="check_circle" class="text-h6 q-mr-sm" />
          <span>Copy Group ID Success</span>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import {
  db, ref as dbRef, get, update, set,
} from 'src/boot/firebase';
import { useRoute } from 'vue-router';
import { getAuth } from 'firebase/auth';
import AlertDialog from 'components/AlertDialog.vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

// 取得群組名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

const auth = getAuth();
const user = auth.currentUser;

// 群組成員
const members = ref([]);
const isGroupCreator = ref(false);
const groupId = ref('');
const showCopySuccess = ref(false);

//  AlertDialog 相關狀態
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

// 為沒有group id的現有群組生成ID
const generateAndSaveGroupId = async () => {
  try {
    // 創建基於時間戳的唯一ID（添加一個隨機數以防重複）
    const newGroupId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 更新群組數據 groupId
    const groupRef = dbRef(db, `/groups/${watchGroupName.value}`);
    await update(groupRef, { groupId: newGroupId });
    const groupIdsRef = dbRef(db, `/groupIds/${newGroupId}`);
    await set(groupIdsRef, { name: watchGroupName.value });

    // 更新本地狀態
    groupId.value = newGroupId;

    $q.notify({
      color: 'positive',
      position: 'bottom',
      message: '已為此群組生成ID',
      icon: 'info',
      timeout: 3000,
    });
  } catch (error) {
    $q.notify({
      color: 'negative',
      position: 'bottom',
      message: '生成群組ID失敗',
      icon: 'error',
    });
  }
};

// 獲取群組成員和判斷是否為創建者
const fetchGroupMembers = async () => {
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    const groupData = snapshot.val();
    members.value = Object.values(groupData.members);
    isGroupCreator.value = groupData.createdBy === user.uid;

    // 取得群组ID
    if (groupData.groupId) {
      groupId.value = groupData.groupId;
    } else if (isGroupCreator.value) {
      await generateAndSaveGroupId();
    }
  }
};

// 複製群組ID到剪貼簿
const copyGroupId = async () => {
  try {
    await navigator.clipboard.writeText(groupId.value);
    showCopySuccess.value = true;
    setTimeout(() => {
      showCopySuccess.value = false;
    }, 2000);
  } catch (err) {
    $q.notify({
      color: 'negative',
      position: 'bottom',
      message: '複製失敗，請手動複製',
      icon: 'error',
    });
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

// 處理取消操作
const onCancel = () => {
  alertVisible.value = false;
  memberToDelete.value = null;
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
