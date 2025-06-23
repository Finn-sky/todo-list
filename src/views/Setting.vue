<template>
  <div class="container">
    <div class="input-group">
      <label class="input-label">Title</label>
      <input type="text" class="input-field" placeholder="请输入标题" v-model="title">
    </div>
    <div class="input-group">
      <label class="input-label">Subtitle</label>
      <input type="text" class="input-field" placeholder="请输入副标题" v-model="subtitle">
    </div>
    <div class="input-group">
      <label class="input-label">BgOpacity</label>
      <input
        type="number"
        class="input-field"
        @change="handleBgOpacityChange"
        placeholder="请输入透明度(0-1)" 
        v-model="bgopacity"
        min="0"
        max="1"
        step="0.1"
      >
    </div>
    <div class="input-group">
      <label class="input-label">Opacity</label>
      <input
        type="number"
        class="input-field"
        @change="handleOpacityChange"
        placeholder="请输入透明度(0-1)" 
        v-model="opacity"
        min="0"
        max="1"
        step="0.1"
      >
    </div>
  </div>
</template>

<script>
import DB from "@/utils/db";
import { ipcRenderer } from "electron";
export default {
  data() {
    return {
      title: "",
      subtitle: "",
      opacity: 1,
      bgopacity: 1,
    };
  },
  methods: {
    getDefault() {
      this.title = DB.get("title").title;
      this.subtitle = DB.get("title").subtitle;
      this.bgopacity = DB.get("setting").bgopacity
      this.opacity = DB.get("setting").opacity
    },
    updateDB(key, value) {
      this.$emit('update-title', key, value);
      DB.set("title", { ...DB.get("title"), [key]: value });
    },
    validateOpacity(value) {
      // 确保值在0-1之间
      const num = parseFloat(value);
      if (isNaN(num)) return false;
      return num >= 0.1 && num <= 1;
    },
    
    async handleBgOpacityChange() {
      if (!this.validateOpacity(this.bgopacity)) {
        this.bgopacity = 1;
        return;
      }
      this.$emit('update-opacity', "bg", this.bgopacity);
      DB.set("setting", { ...DB.get("setting"), ["bgopacity"]: this.bgopacity });
    },
    async handleOpacityChange() {
      if (!this.validateOpacity(this.opacity)) {
        this.opacity = 1;
        return;
      }
      this.$emit('update-opacity', "body", this.opacity);
      DB.set("setting", { ...DB.get("setting"), ["opacity"]: this.opacity });
    }
  },
  created() {
    ipcRenderer.invoke("getDataPath").then((storePath) => {
      DB.initDB(storePath);
      this.getDefault();
    });
  },
  watch: {
    title(newVal) {
      this.updateDB('title', newVal);
    },
    subtitle(newVal) {
      this.updateDB('subtitle', newVal);
    }
  },
}
</script>
<style scoped>
.container {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    max-width: 300px;
    /* margin: 16px auto; */
    padding: 16px;
    color: black;
}

.input-group {
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 30px;
}

.input-label {
  font-size: 14px;
  color: #fdfdfd;
  width: 50px; /* 固定label宽度，使输入框对齐 */
  text-align: left;
}

.input-field {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  color: black;
}

.input-field:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
}
</style>
