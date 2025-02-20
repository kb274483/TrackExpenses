<template>
  <q-page class="tw-p-4">
    <div class="tw-relative">
      <q-icon name="badge"
        class="tw-font-bold tw-text-gray-600 tw-text-2xl tw-relative -tw-top-1"
      />
      <span class="tw-font-bold tw-text-gray-600 tw-text-lg">{{ watchGroupName }}</span>
      消費分析
    </div>

    <!-- 月份選擇器 -->
    <div class="tw-mb-4">
      <q-select
        v-model="selectedMonth"
        :options="months"
        label="Select Month"
        @update:model-value="calculateCategoryTotals"
      />
    </div>

    <!-- 圓餅圖 -->
    <div class="tw-flex tw-justify-center">
      <div id="pieChart" style="width: 400px; height: 400px;"></div>
    </div>

    <!-- 消費類別表格 -->
    <q-table
      :rows="categoryTotals"
      :columns="columns"
      row-key="category"
      :rows-per-page-label="[0]"
      v-model:pagination="pagination"
      flat
    >
      <template v-slot:body-cell="props">
        <q-td :props="props"
          :style="{
            color: props.row.color, fontWeight: 'bold' ,fontSize: '1.2em'
          }"
        >
          <span v-if="props.col.name === 'total'">
            $ {{ props.row.total }}
          </span>
          <span v-else>
            {{ props.row[props.col.name] }}
          </span>
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { db, ref as dbRef, get } from 'src/boot/firebase';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

// 獲取群組名稱
const route = useRoute();
const { groupName } = route.params;
const watchGroupName = ref(groupName);

// 狀態變數
const selectedMonth = ref('');
const months = ref([]);
const categoryTotals = ref([]);

// 分頁
const pagination = ref({
  rowsPerPage: 10,
});

// 消費類別和圖表
const chart = ref(null);
const customExpenseTypes = ref([]);
const defaultExpenseTypes = ref([
  {
    label: 'Transportation-交通',
    value: 'transportation',
    icon: 'commute',
    color: '#879AD7',
  },
  {
    label: 'Food-飲食',
    value: 'food',
    icon: 'restaurant',
    color: '#B2DB9E',
  },
  {
    label: 'Entertainment-娛樂',
    value: 'entertainment',
    icon: 'theaters',
    color: '#FBD88A',
  },
  {
    label: 'Pets-寵物',
    value: 'pets',
    icon: 'pets',
    color: '#F39393',
  },
  {
    label: 'Housing-住家',
    value: 'housing',
    icon: 'home',
    color: '#9DD2E7',
  },
  {
    label: 'Daily Supplies-日常用品',
    value: 'supplies',
    icon: 'shopping_cart',
    color: '#75BD9C',
  },
  {
    label: 'Investment-投資',
    value: 'investment',
    icon: 'savings',
    color: '#238BD3',
  },
  {
    label: 'Shopping-購物',
    value: 'shopping',
    icon: 'shopping_cart',
    color: '#8591B6',
  },
  {
    label: 'Other-其他',
    value: 'other',
    icon: 'more_horiz',
    color: '#FCA885',
  },
]);
const expenseTypes = ref([]);

const columns = [
  {
    name: 'category',
    label: '消費類別',
    align: 'left',
    field: 'category',
  },
  {
    name: 'total',
    label: '總額',
    align: 'right',
    field: 'total',
  },
];

// 自定類別色彩
const additionalColors = [
  '#8591B6',
  '#FFCCBC',
  '#CE93D8',
  '#81D4FA',
  '#15E4C6',
  '#B39DDB',
  '#FFD54F',
  '#797289',
  '#9BA4B5',
  '#E6A7C8',
  '#92BE8D',
];

// 合併內建與自定義消費類別
const mergeExpenseTypes = () => {
  expenseTypes.value = [...defaultExpenseTypes.value, ...customExpenseTypes.value];
  expenseTypes.value.push({
    label: 'Fixed Expense-固定支出', value: 'fixed', icon: 'stars', color: '#9D9B9C',
  });
};

// 從資料庫取得自定義消費類別
const fetchCustomExpenseTypes = async () => {
  const customTypesRef = dbRef(db, `/groups/${watchGroupName.value}/expenseTypes/custom`);
  const snapshot = await get(customTypesRef);
  if (snapshot.exists()) {
    customExpenseTypes.value = Object.values(snapshot.val()).map((type, index) => ({
      ...type,
      value: type.value,
      color: additionalColors[index],
    }));
  }
  mergeExpenseTypes();
};

// 生成月份選項
const generateMonths = () => {
  const today = dayjs();
  for (let i = 0; i < 6; i++) {
    const month = today.subtract(i, 'month');
    months.value.push({
      label: month.format('MMMM YYYY'),
      value: month.format('YYYY-MM'),
    });
  }
  selectedMonth.value = months.value[0].value;
};

// 更新圓餅圖
const updatePieChart = (data) => {
  const chartData = data
    .filter((item) => item.total > 0)
    .map((item) => ({
      value: item.total,
      name: item.category,
      itemStyle: { color: item.color },
    }));

  chart.value.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: $ {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: '50%',
        data: chartData,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
        },
      },
    ],
  });
};

// 計算每個消費類別的總額
const calculateCategoryTotals = async () => {
  const month = selectedMonth.value.value || new Date().toISOString().slice(0, 7);
  const groupRef = dbRef(db, `/groups/${watchGroupName.value}/expenses/${month}`);
  const snapshot = await get(groupRef);

  if (snapshot.exists()) {
    const expenses = Object.values(snapshot.val());
    const totals = {};

    expenseTypes.value.forEach((type) => {
      totals[type.value] = 0;
    });

    expenses.forEach((expense) => {
      totals[expense.type.value] += parseFloat(expense.amount);
    });

    categoryTotals.value = expenseTypes.value.map((type) => ({
      category: type.label,
      total: totals[type.value].toFixed(2),
      color: type.color,
    }));

    updatePieChart(categoryTotals.value);
  } else {
    categoryTotals.value = [];
    updatePieChart([]);
  }
};

watch(
  () => route.params.groupName, // 監聽路由參數中的 groupName
  async (newGroupName) => {
    watchGroupName.value = newGroupName;
    await fetchCustomExpenseTypes();
    calculateCategoryTotals();
  },
  { immediate: true }, // 當組件初始化時立即執行一次
);

// 初始化圖表和數據
onMounted(() => {
  generateMonths();

  const chartDom = document.getElementById('pieChart');
  chart.value = echarts.init(chartDom);
  calculateCategoryTotals();
});
</script>
