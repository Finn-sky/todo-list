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
let isWindowHidden = false;
let hideTimeout = null;
let isAnimating = false;
let mouseLeaveTimeout = null;
const mouseLeaveDelay = 500; // 鼠标离开后延迟隐藏的时间

if (app.requestSingleInstanceLock()) {
    app.on("second-instance", (event, commandLine, workingDirectory) => {
        if (win) {
            setPosition();
        }
    });
} else {
    app.quit();
}

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { secure: true, standard: true } }
]);

createAppMenu();

function registerShortcut(shortcut) {
    globalShortcut.unregisterAll();

    if (shortcut) {
        try {
            const registered = globalShortcut.register(shortcut, () => {
                if (win) {
                    if (win.isVisible()) {
                        hideWindow();
                    } else {
                        showWindow();
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

function checkWindowPosition(win) {
    const winBounds = win.getBounds();
    const screen = require('electron').screen;
    const displays = screen.getAllDisplays();
    const statusBarHeight = 35;
    
    // 计算所有显示器的联合边界
    let combinedBounds = {
        left: Number.MAX_SAFE_INTEGER,
        top: Number.MAX_SAFE_INTEGER,
        right: Number.MIN_SAFE_INTEGER,
        bottom: Number.MIN_SAFE_INTEGER,
        width: 0,
        height: 0
    };
    
    displays.forEach(display => {
        combinedBounds.left = Math.min(combinedBounds.left, display.bounds.x);
        combinedBounds.top = Math.min(combinedBounds.top, display.bounds.y);
        combinedBounds.right = Math.max(combinedBounds.right, display.bounds.x + display.bounds.width);
        combinedBounds.bottom = Math.max(combinedBounds.bottom, display.bounds.y + display.bounds.height);
    });
    
    combinedBounds.width = combinedBounds.right - combinedBounds.left;
    combinedBounds.height = combinedBounds.bottom - combinedBounds.top;

    let isNearEdge = false;
    let isOutOfBounds = false;
    let direction = null;
    const edgeThreshold = 10;
    let hiddenBounds = { ...winBounds };

    // 检查是否超出所有显示器的联合边界
    if (winBounds.x < combinedBounds.left) {
        direction = 0;
        isOutOfBounds = true;
        hiddenBounds.x = combinedBounds.left - winBounds.width + 5;
    } else if (winBounds.x + winBounds.width > combinedBounds.right) {
        direction = 2;
        isOutOfBounds = true;
        hiddenBounds.x = combinedBounds.right - 5;
    }

    if (winBounds.y < combinedBounds.top) {
        direction = 1;
        isOutOfBounds = true;
        hiddenBounds.y = combinedBounds.top - winBounds.height + 5;
    } else if (winBounds.y + winBounds.height > combinedBounds.bottom - statusBarHeight) {
        direction = 3;
        isOutOfBounds = true;
        hiddenBounds.y = combinedBounds.bottom - statusBarHeight - 5;
    }

    if (isOutOfBounds) {
        return { isNearEdge: false, isOutOfBounds, direction, hiddenBounds };
    }

    // 检查是否靠近边缘
    if (winBounds.x <= combinedBounds.left + edgeThreshold) {
        direction = 0;
        isNearEdge = true;
        hiddenBounds.x = combinedBounds.left - winBounds.width + 5;
    } else if (winBounds.x + winBounds.width >= combinedBounds.right - edgeThreshold) {
        direction = 2;
        isNearEdge = true;
        hiddenBounds.x = combinedBounds.right - 5;
    }

    if (winBounds.y <= combinedBounds.top + edgeThreshold) {
        direction = 1;
        isNearEdge = true;
        hiddenBounds.y = combinedBounds.top - winBounds.height + 5;
    } else if (winBounds.y + winBounds.height >= combinedBounds.bottom - statusBarHeight - edgeThreshold) {
        direction = 3;
        isNearEdge = true;
        hiddenBounds.y = combinedBounds.bottom - statusBarHeight - 5;
    }

    return { isNearEdge, isOutOfBounds, direction, hiddenBounds };
}
function animateWindow(win, direction, hide = true) {
    if (isAnimating) return;
    isAnimating = true;

    const winBounds = win.getBounds();
    const screen = require('electron').screen;
    const displays = screen.getAllDisplays();
    const statusBarHeight = 35;
    const animationDuration = 200;
    const steps = 10;
    const stepDuration = animationDuration / steps;

    // 计算所有显示器的联合边界
    let combinedBounds = {
        left: Number.MAX_SAFE_INTEGER,
        top: Number.MAX_SAFE_INTEGER,
        right: Number.MIN_SAFE_INTEGER,
        bottom: Number.MIN_SAFE_INTEGER,
        width: 0,
        height: 0
    };

    displays.forEach(display => {
        combinedBounds.left = Math.min(combinedBounds.left, display.bounds.x);
        combinedBounds.top = Math.min(combinedBounds.top, display.bounds.y);
        combinedBounds.right = Math.max(combinedBounds.right, display.bounds.x + display.bounds.width);
        combinedBounds.bottom = Math.max(combinedBounds.bottom, display.bounds.y + display.bounds.height);
    });

    combinedBounds.width = combinedBounds.right - combinedBounds.left;
    combinedBounds.height = combinedBounds.bottom - combinedBounds.top;

    let targetX = winBounds.x;
    let targetY = winBounds.y;

    if (hide) {
        switch (direction) {
            case 0:
                targetX = combinedBounds.left - winBounds.width + 5;
                break;
            case 1:
                targetY = combinedBounds.top - winBounds.height + 5;
                break;
            case 2:
                targetX = combinedBounds.right - 5;
                break;
            case 3:
                targetY = combinedBounds.bottom - statusBarHeight - 5;
                break;
        }
    } else {
        switch (direction) {
            case 0:
                targetX = combinedBounds.left;
                break;
            case 1:
                targetY = combinedBounds.top;
                break;
            case 2:
                targetX = combinedBounds.right - winBounds.width;
                break;
            case 3:
                targetY = combinedBounds.bottom - statusBarHeight - winBounds.height;
                break;
        }
    }

    const deltaX = (targetX - winBounds.x) / steps;
    const deltaY = (targetY - winBounds.y) / steps;
    let currentStep = 0;

    const animate = () => {
        if (currentStep >= steps) {
            win.setPosition(targetX, targetY);
            if (hide) {
                win.hide();
                isWindowHidden = true;
            } else {
                isWindowHidden = false;
            }
            isAnimating = false;
            return;
        }

        win.setPosition(
            Math.round(winBounds.x + deltaX * currentStep),
            Math.round(winBounds.y + deltaY * currentStep)
        );
        currentStep++;
        setTimeout(animate, stepDuration);
    };

    animate();
}


function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 检查鼠标是否在屏幕边缘
function checkMouseAtEdge(mousePos, screenSize) {
    const edgeThreshold = 5;
    const { x, y } = mousePos;
    const { width, height } = screenSize;

    if (x <= edgeThreshold) return 0; // 左
    if (y <= edgeThreshold) return 1; // 上
    if (x >= width - edgeThreshold) return 2; // 右
    if (y >= height - edgeThreshold) return 3; // 下
    return null;
}


function hideWindow() {
    const positionStatus = checkWindowPosition(win);
    if (positionStatus.isNearEdge || positionStatus.isOutOfBounds) {
        animateWindow(win, positionStatus.direction, true);
    } else {
        win.hide();
        isWindowHidden = true;
    }
}

// 修改后的showWindow函数
function showWindow() {
    if (isWindowHidden && !isAnimating) {
        const positionStatus = checkWindowPosition(win);
        if (positionStatus.isOutOfBounds || positionStatus.isNearEdge) {
            win.setAlwaysOnTop(true)
            win.show();
            animateWindow(win, positionStatus.direction, false);
        } else {
            win.show();
            win.setAlwaysOnTop(false)
            isWindowHidden = false;
        }
    } else if (!isWindowHidden) {
        win.show();
    }
}

async function createWindow() {
    let mainWindowState = windowStateKeeper({
        defaultWidth: 320,
        defaultHeight: 290
    });
    let lastEdgeDirection = null;

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
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
            backgroundThrottling: false,
            disableHtmlFullscreenWindowResize: true
        }
    });

    mainWindowState.manage(win);

    if (mainWindowState.x == undefined || mainWindowState.y == undefined)
        setPosition();

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
        if (!process.env.IS_TEST) win.webContents.openDevTools();
    } else {
        createProtocol("app");
        win.loadURL("app://./index.html");
        autoUpdater.checkForUpdatesAndNotify();
    }

    // 鼠标移入移出检测
    win.on('blur', () => {
        const positionStatus = checkWindowPosition(win);
        if (!positionStatus.isNearEdge) {
            hideTimeout = null;
            return false;
        }
        if (!win.isDestroyed() && win.isVisible()) {
            hideTimeout = setTimeout(() => {
                hideWindow();
            }, 500);
        }
    });

    win.on('focus', () => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    });

    // 全局鼠标移动检测
    const screenSize = screen.getPrimaryDisplay().workAreaSize;
    let lastEdgeCheckTime = 0;
    setInterval(() => {
        const now = Date.now();
        if (now - lastEdgeCheckTime < 100) return;
        lastEdgeCheckTime = now;
        const mousePos = screen.getCursorScreenPoint();
        const edgeDirection = checkMouseAtEdge(mousePos, screenSize);
        const winBounds = win.getBounds();
        const positionStatus = checkWindowPosition(win);
        
        const isMouseInWindow = mousePos.x >= winBounds.x &&
            mousePos.x <= winBounds.x + winBounds.width &&
            mousePos.y >= winBounds.y &&
            mousePos.y <= winBounds.y + winBounds.height;
        // 检查鼠标是否在隐藏窗口区域内
        const isMouseInHiddenArea = positionStatus.hiddenBounds &&
            mousePos.x >= positionStatus.hiddenBounds.x &&
            mousePos.x <= positionStatus.hiddenBounds.x + winBounds.width &&
            mousePos.y >= positionStatus.hiddenBounds.y &&
            mousePos.y <= positionStatus.hiddenBounds.y + winBounds.height;
    
        if (isMouseInHiddenArea && isWindowHidden && !isAnimating) {
            lastEdgeDirection = positionStatus.direction;
            showWindow();
            if (mouseLeaveTimeout) {
                clearTimeout(mouseLeaveTimeout);
                mouseLeaveTimeout = null;
            }
        } else if (edgeDirection === null && !isWindowHidden && !isAnimating && lastEdgeDirection !== null && !isMouseInWindow) {
            // 只有当窗口处于贴边状态时才设置超时隐藏
            if (positionStatus.isNearEdge && !mouseLeaveTimeout) {
                mouseLeaveTimeout = setTimeout(() => {
                    const currentMousePos = screen.getCursorScreenPoint();
                    const currentEdge = checkMouseAtEdge(currentMousePos, screenSize);
                    const currentWinBounds = win.getBounds();
                    const currentIsMouseInWindow = currentMousePos.x >= currentWinBounds.x &&
                        currentMousePos.x <= currentWinBounds.x + currentWinBounds.width &&
                        currentMousePos.y >= currentWinBounds.y &&
                        currentMousePos.y <= currentWinBounds.y + currentWinBounds.height;
    
                    if (currentEdge === null && !currentIsMouseInWindow) {
                        hideWindow();
                    }
                    mouseLeaveTimeout = null;
                    lastEdgeDirection = null;
                }, mouseLeaveDelay);
            }
        }
    }, 100);
    



    win.on('move', debounce(() => {
        const positionStatus = checkWindowPosition(win);
        if (positionStatus.isOutOfBounds) {
            animateWindow(win, positionStatus.direction, true);
        }
        win.webContents.send('window-position-status', positionStatus);
    }, 200));

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
    globalShortcut.unregisterAll();
});

async function init() {
    await createWindow();
    initExtra();
    createTray(showWindow);

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

ipcMain.handle("setIgnoreMouseEvents", (event, ignore) => {
    if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
    else win.setIgnoreMouseEvents(false);
});

ipcMain.handle("hideWindow", event => {
    if (!win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(true);
    } else {
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
