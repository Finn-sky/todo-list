<template>
  <div id="app" :class="{ unfocused: ignoreMouse }">
    <div class="mask"></div>
    <div class="drag-nav">
      <b @dblclick="startEditing('title')">{{ title }}</b>
      <i @dblclick="startEditing('subtitle')" > {{ subtitle }}</i >
    </div >
    <div class="nav">
        <div class="link">
            <router-link draggable="false" to="/">Todo</router-link> |
            <router-link draggable="false" to="/done">Done</router-link>|
            <router-link draggable="false" to="/setting">Setting</router-link>
        </div>
        <div class="tools">
            <transition-group name="fade" mode="out-in">
            <i class="iconfont icon-export" key="export" @click="exportData"></i>
            <i class="iconfont icon-eye-close" key="hide" @click="hideWindow"></i>
            <i
            :class="['iconfont', ignoreMouse ? 'icon-lock' : 'icon-unlock']"
            key="lock"
            @mouseenter="setIgnoreMouseEvents(false)"
            @mouseleave="setIgnoreMouseEvents(ignoreMouse)"
            @click="ignoreMouse = !ignoreMouse"
          ></i>
        </transition-group >
      </div >
    </div >
    <div class="main scrollbar scrollbar-y">
        <transition name="fade-transform" mode="out-in">
            <!-- <keep-alive> -->
        <router-view @update-title="handleTitleUpdate" @update-opacity="handleOpacityUpdate"/>
                <!-- </keep-alive> -->
      </transition>
    </div>
  </div >
</template >

<script>
// import pkg from "../package.json";
import { ipcRenderer } from "electron";
import DB from "@/utils/db";

export default {
  data() {
    return {
      title: "Todo",
      subtitle: "井井有条",
      ignoreMouse: false,
      bgopacity:1,
      opacity:1,
    };
  },
  methods: {
    handleTitleUpdate(key,value){
      this[key] = value
    },
    getTitle(){
      this.title = DB.get("title").title
      this.subtitle = DB.get("title").subtitle
    },
    getOpacity(){
      this.bgopacity = DB.get("setting").bgopacity
      this.opacity = DB.get("setting").opacity
      console.log(this.bgopacity,this.opacity)
      this.handleOpacityUpdate("bg", this.opacity);
      this.handleOpacityUpdate("body", this.opacity);
    },
    setIgnoreMouseEvents(ignore) {
      ipcRenderer.invoke("setIgnoreMouseEvents", ignore);
    },
    exportData() {
      ipcRenderer.invoke("exportData");
    },
    hideWindow() {
      ipcRenderer.invoke("hideWindow");
    },
    startEditing(type) {
      this[`isEditing${this.capitalizeFirstLetter(type)}`] = true;
      this.$nextTick(() => {
        this.$refs[`${type}Input`].focus();
      });
    },
    saveEdit(type) {
      this[`isEditing${this.capitalizeFirstLetter(type)}`] = false;
      this[`original${this.capitalizeFirstLetter(type)}`] = this[`edited${this.capitalizeFirstLetter(type)}`];
      if (type === 'title') {
        this.appName = this.editedTitle;
      }
      // 这里可以添加保存到数据库或文件的逻辑
    },
    cancelEdit(type) {
      this[`isEditing${this.capitalizeFirstLetter(type)}`] = false;
      this[`edited${this.capitalizeFirstLetter(type)}`] = this[`original${this.capitalizeFirstLetter(type)}`];
    },
    capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    },
    handleOpacityUpdate(key,val) {
      if (key == 'bg'){
        // 获取app元素
        const appElement = document.getElementById('app');
        if (appElement) {
          // 更新背景颜色的alpha值
          appElement.style.backgroundColor = `rgba(0, 0, 0, ${val})`;
        }
      }
      if (key == 'body'){
        // 获取app元素
        const appElement = document.body
        if (appElement) {
          // 更新背景颜色的alpha值
          appElement.style.opacity = val;
        }
      }
    }
  },
  created() {
    ipcRenderer.invoke("getDataPath").then((storePath) => {
      DB.initDB(storePath);
      this.getTitle();
      this.getOpacity()
    });
  },
};
</script>
<style lang="scss" scoped>
        #app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: rgba($color: #000000, $alpha: 0.6);
  border-radius: 5px;
  .mask {
    display: none;
    position: absolute;
    z-index: 999;
    width: 100%;
    height: 100%;
  }
  .drag-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    -webkit-app-region: drag;
    width: 100%;
    height: 20px;
    padding: 0 20px;
    box-sizing: border-box;
    font-size: 12px;
    b,i {
    cursor: text;
    &:hover {
      color: rgba($color: #ffffff, $alpha: 0.6);
    }
    }
    input {
    background: transparent;
    border: none;
    color: rgba($color: #ffffff, $alpha: 0.3);
    font-size: 12px;
    outline: none;
    width: auto;
    max-width: 200px;
    }
  }
.iconbtn{
  width: 16px;
  height: 16px;
  color:#eee
}

  .nav {
    display: flex;
    justify-content: space-between;
    height: 26px;
    padding: 0 20px;
    color: #cccccc;
    user-select: none;
    .link {
      a {
        font-weight: bold;
        color: #cccccc;
        text-decoration: none;
        &.router-link-exact-active {
          font-size: 20px;
          color: #ffffff;
        }
        &:hover {
          color: rgba($color: #ffffff, $alpha: 0.6);
        }
      }
    }
    .tools {
      display: flex;
      i {
        font-size: 20px;
        line-height: 26px;
        padding: 0 5px;
        cursor: pointer;
      }
    }
  }
  .main {
    flex: 1;
    margin: 10px 0;
    overflow-y: auto;
    &:hover::-webkit-scrollbar-thumb {
      display: block;
    }
  }
}
#app.unfocused {
  opacity: 0.8;
  .mask {
    display: block;
  }
  .tools {
    z-index: 1000;
  }
}
</style>
