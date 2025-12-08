<template>
  <view class="icon-wrapper" :style="{ width: size + 'px', height: size + 'px' }">
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      :style="{ width: '100%', height: '100%', color: color }"
    >
      <path v-for="(d, index) in paths" :key="index" :d="d" />
      <circle v-if="circle" :cx="circle.cx" :cy="circle.cy" :r="circle.r" />
      <line v-if="line" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" />
      <rect v-if="rect" :x="rect.x" :y="rect.y" :width="rect.width" :height="rect.height" :rx="rect.rx" :ry="rect.ry" />
      <polyline v-if="polyline" :points="polyline.points" />
    </svg>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
  color: { type: String, default: 'currentColor' }
});

const icons: Record<string, any> = {
  Wallet: { paths: ["M20 7l-2-2-2 2", "M16 11V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-5"], rect: { x:16, y:11, width:6, height:5, rx:1, ry:1 } }, 
  LayoutDashboard: { paths: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"] }, 
  List: { paths: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"] },
  Plus: { paths: ["M12 5v14", "M5 12h14"] },
  Moon: { paths: ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"] },
  Sun: { paths: ["M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"], circle: { cx:12, cy:12, r:5 } },
  Settings: { paths: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"], circle: { cx:12, cy:12, r:3 } },
  Calendar: { paths: ["M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"] },
  TrendingUp: { paths: ["M23 6l-9.5 9.5-5-5L1 18", "M17 6h6v6"] },
  Calculator: { paths: ["M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"], rect: { x:4, y:2, width:16, height:20, rx:2, ry:2 }, line: {x1:8, y1:6, x2:16, y2:6} }, 
  Sparkles: { paths: ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"] },
  Bot: { paths: ["M12 8V4H8", "M16 4h-4", "M2 14h2", "M20 14h2", "M15 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M9 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"], rect: { x:4, y:8, width:16, height:12, rx:2, ry:2 } },
  Check: { paths: ["M20 6L9 17l-5-5"] },
  X: { paths: ["M18 6L6 18", "M6 6l12 12"] },
  Edit2: { paths: ["M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"] },
  Trash2: { paths: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M10 11v6", "M14 11v6"] },
  CalendarClock: { paths: ["M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5", "M16 2v4", "M8 2v4", "M3 10h5", "M21 17h-2.57l-2.5-3"], circle: { cx:16.5, cy:17.5, r:4.5 } },
  ChevronLeft: { paths: ["M15 18l-6-6 6-6"] },
  ChevronRight: { paths: ["M9 18l6-6-6-6"] },
  Settings2: { paths: ["M17 21v-2a2 2 0 0 1 2-2h2", "M2 17h12", "M2 7h2", "M7 7h15", "M17 11v-2a2 2 0 0 0-2-2h-2", "M13 11V3", "M10 14V3", "M17 21V11"] },
  CalendarDays: { paths: ["M16 2v4", "M8 2v4", "M3 10h18", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01", "M16 18h.01"], rect: {x:3, y:4, width:18, height:18, rx:2, ry:2} },
  Upload: { paths: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"] },
  Image: { paths: ["M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7", "M16 5l-4.5 4.5a1.5 1.5 0 0 0 0 2.122l4.636 4.636"], circle: {cx:8.5, cy:8.5, r:1.5}, rect: {x:3, y:3, width:18, height:18, rx:2, ry:2} },
  
  // New Icons for Cloud Backup
  Cloud: { paths: ["M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"] },
  CloudUpload: { paths: ["M16 16l-4-4-4 4", "M12 12v9", "M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"], polyline: { points: "16 16 12 12 8 16" } },
  CloudDownload: { paths: ["M8 17l4 4 4-4", "M12 12v9", "M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"], polyline: { points: "8 17 12 21 16 17" } },
  Save: { paths: ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8V3"] },
  Eye: { paths: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"], circle: { cx:12, cy:12, r:3 } },
  EyeOff: { paths: ["M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24", "M1 1l22 22"] }
};

const iconData = computed(() => icons[props.name] || {});
const paths = computed(() => iconData.value.paths || []);
const circle = computed(() => iconData.value.circle);
const rect = computed(() => iconData.value.rect);
const line = computed(() => iconData.value.line);
const polyline = computed(() => iconData.value.polyline);
</script>

<style scoped>
.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>