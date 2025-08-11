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

    <!-- 新增虛擬成員 -->
    <div class="tw-bg-gray-50 tw-p-3 tw-rounded tw-mb-3 tw-flex tw-gap-2 tw-items-end">
      <div class="tw-flex-1">
        <q-input v-model="newVirtualName" label="虛擬成員名稱" dense />
      </div>
      <q-btn color="primary" icon="person_add" label="新增虛擬成員" @click="addVirtualMember" />
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
          <q-chip
            v-if="member.isVirtual"
            size="sm"
            color="teal"
            text-color="white"
            outline
          >
            Virtual
          </q-chip>
        </div>

        <!-- 僅允許移除虛擬成員（任何群組成員皆可） -->
        <q-btn v-if="member.isVirtual"
          icon="delete" color="negative" flat
          @click="confirmDeleteVirtual(member)"
        />
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
  db, ref as dbRef, get, update, set, remove,
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
const newVirtualName = ref('');

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

// 新增虛擬成員
const addVirtualMember = async () => {
  const name = (newVirtualName.value || '').trim();
  if (!name) return;
  const virtualId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const memberRef = dbRef(db, `/groups/${watchGroupName.value}/members/${virtualId}`);
  await set(memberRef, { name, id: virtualId, isVirtual: true });
  newVirtualName.value = '';
  await fetchGroupMembers();
  $q.notify({ color: 'positive', message: '已新增虛擬成員', position: 'bottom' });
};

// 確認刪除虛擬成員
const confirmDeleteVirtual = (member) => {
  memberToDelete.value = member;
  showAlert(`你確定要刪除虛擬成員「${member.name}」嗎？`, true);
};

// 移除成員功能
const removeMember = async () => {
  if (!memberToDelete.value) return;
  const target = memberToDelete.value;
  const isVirtual = !!target.isVirtual;

  // 非虛擬成員：僅允許創建者刪除
  if (!isVirtual && !isGroupCreator.value) {
    alertVisible.value = false;
    memberToDelete.value = null;
    return;
  }
  if (!isVirtual && target.id === user.uid) {
    alertVisible.value = false;
    memberToDelete.value = null;
    setTimeout(() => showAlert('You cannot remove yourself from the group.'), 100);
    return;
  }

  // 移除群組成員節點
  const groupMemberRef = dbRef(db, `/groups/${groupName}/members/${target.id}`);
  await remove(groupMemberRef);

  // 若為真實用戶，同步移除其 users 下的群組映射
  if (!isVirtual) {
    const userGroupRef = dbRef(db, `/users/${target.id}/groups/${groupName}`);
    await remove(userGroupRef);
  }

  await fetchGroupMembers();
  alertVisible.value = false;
  memberToDelete.value = null;
  $q.notify({ color: 'positive', message: '已移除成員', position: 'bottom' });
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
