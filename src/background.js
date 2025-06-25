"use strict";

import { app, protocol, BrowserWindow, screen, ipcMain, globalShortcut } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
//import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
const isDevelopment = process.env.NODE_ENV !== "production";

import { initExtra, createTray, createAppMenu } from "@/utils/backgroundExtra";
import DB from "./utils/db";
import { autoUpdater } from "electron-updater";
import windowStateKeeper from "electron-window-state";
import pkg from "../package.json";

let win;

if (app.requestSingleInstanceLock()) {
    app.on("second-instance", (event, commandLine, workingDirectory) => {
        if (win) {
            setPosition();
        }
    });
} else {
    app.quit();
}

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { secure: true, standard: true } }
]);

createAppMenu();

function registerShortcut(shortcut) {
    // 先取消所有已注册的快捷键
    globalShortcut.unregisterAll();

    if (shortcut) {
        try {
            const registered = globalShortcut.register(shortcut, () => {
                if (win) {
                    if (win.isVisible()) {
                        win.hide();
                        
                    } else {
                        win.show();
                    }
                }
            });

            if (!registered) {
                console.error('快捷键注册失败:', shortcut);
            }
        } catch (err) {
            console.error('快捷键注册错误:', err);
        }
    }
}

async function createWindow() {
    // Load the previous state with fallback to defaults
    let mainWindowState = windowStateKeeper({
        defaultWidth: 320,
        defaultHeight: 290
    });

    // Create the browser window.
    win = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        backgroundColor: "#00000000",
        minWidth: 320,
        minHeight: 290,
        type: "toolbar",
        frame: false,
        title: pkg.name,
        //resizable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        //closable: false,
        //show: false,
        transparent: true,
        //alwaysOnTop: true,
        //useContentSize: true,
        webPreferences: {
            // Use pluginOptions.nodeIntegration, leave this alone
            // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
            nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
            backgroundThrottling: false,
            disableHtmlFullscreenWindowResize: true
        }
    });

    // Let us register listeners on the window, so we can update the state
    // automatically (the listeners will be removed when the window is closed)
    // and restore the maximized or full screen state
    mainWindowState.manage(win);

    if (mainWindowState.x == undefined || mainWindowState.y == undefined)
        setPosition();

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
        if (!process.env.IS_TEST) win.webContents.openDevTools();
    } else {
        createProtocol("app");
        // Load the index.html when not in development
        win.loadURL("app://./index.html");
        autoUpdater.checkForUpdatesAndNotify();
    }

    win.on("closed", () => {
        win = null;
    });
}

app.commandLine.appendSwitch("wm-window-animations-disabled");

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) init();
});

app.on("ready", async () => {
    init();
});

app.on("will-quit", () => {
    // 退出前取消所有快捷键注册
    globalShortcut.unregisterAll();
});

async function init() {
    await createWindow();
    initExtra();
    createTray(showWindow);

    // 从数据库读取快捷键设置并注册
    try {
        const setting = await DB.get('setting');
        if (setting && setting.shortcut) {
            registerShortcut(setting.shortcut);
        }
    } catch (error) {
        console.error('读取快捷键设置失败:', error);
    }
}

if (isDevelopment) {
    if (process.platform === "win32") {
        process.on("message", data => {
            if (data === "graceful-exit") {
                app.quit();
            }
        });
    } else {
        process.on("SIGTERM", () => {
            app.quit();
        });
    }
}

function setPosition() {
    const size = screen.getPrimaryDisplay().workAreaSize;
    const winSize = win.getSize();
    win.setPosition(size.width - winSize[0] - 30, 30);
}

function showWindow() {
    win.show();
}

ipcMain.handle("setIgnoreMouseEvents", (event, ignore) => {
    if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
    else win.setIgnoreMouseEvents(false);
});

ipcMain.handle("hideWindow", event => {
    if (!win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(true);
    }else{
      win.setAlwaysOnTop(false);
    }
});

ipcMain.handle('set-window-opacity', async (event, opacity) => {
    if (win && !win.isDestroyed()) {
        win.setOpacity(opacity);
        win.setIgnoreMouseEvents(false);
        return true;
    }
    return false;
});

ipcMain.handle('set-shortcut', async (event, shortcut) => {
    console.log('快捷键注册:', shortcut);
    registerShortcut(shortcut);
    return true;
});

ipcMain.handle('get-window-opacity', () => {
    return win ? win.getOpacity() : 1;
});
