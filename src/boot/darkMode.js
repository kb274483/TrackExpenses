import { boot } from 'quasar/wrappers';
import { Dark } from 'quasar';

const STORAGE_KEY = 'accounting-pwa-dark-mode';

// 同步 Quasar dark 狀態到 html 的 class，讓 Tailwind 的 dark: variant 也生效
const syncHtmlClass = (isDark) => {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const setDarkMode = (isDark) => {
  Dark.set(isDark);
  syncHtmlClass(isDark);
  try {
    localStorage.setItem(STORAGE_KEY, String(isDark));
  } catch (e) {
    // localStorage 不可用時忽略
  }
};

export const toggleDarkMode = () => {
  setDarkMode(!Dark.isActive);
};

export default boot(() => {
  let initial = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true' || saved === 'false') {
      initial = saved === 'true';
    } else if (window.matchMedia) {
      // 首次進站：跟系統偏好走
      initial = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  } catch (e) {
    initial = false;
  }
  setDarkMode(initial);
});
