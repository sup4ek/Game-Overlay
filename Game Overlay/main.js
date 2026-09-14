const { app, BrowserWindow, BrowserView, Tray, Menu, globalShortcut, ipcMain, screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const appIcon = path.join(__dirname, 'assets', 'app.ico');
let tray = null;

function openSettingsFromTray() {
  if (!win || quitting) return;
  if (!locked) finishMove();
  else setMenuOpen(true);
}

function createTray() {
  tray = new Tray(appIcon);
  tray.setToolTip('Game Overlay');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Настройки', click: openSettingsFromTray },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() }
  ]));
  tray.on('click', openSettingsFromTray);
}
const config = require('./config');
const skins = require('./skins');
const windowState = require('./window-state');
const layouts = require('./layouts');
const dualsenseConfig = require('./dualsense-config');
const gamepadSkins = require('./gamepad-skins');
const gamepadTheme = require('./gamepad-theme');
const gamepadSize = require('./gamepad-size');
const gamepadUrls = {
  dualsense: dualsenseConfig.OVERLAY_URL,
  xbox: 'https://gamepadviewer.com/?p=1&css=https%3A%2F%2Fjayraydee.me%2FAssets%2FFreeport%2FXSX-Black%2FXSX.css'
};
let selectedGamepadSkins = {};
let gamepadView = null;
let gamepadError = '';
let gamepadLoading = false;
let gamepadStyleChain = Promise.resolve();

function sizeGamepad() {
  if (!gamepadView || !win) return;
  const [width, height] = win.getSize();
  gamepadView.setBounds({ x: 0, y: 0, width, height });
  gamepadView.webContents.setZoomFactor(1);
  const view = gamepadView;
  if (view.overlayReady) {
    view.webContents.executeJavaScript(gamepadSize.resizeScript(width, height)).catch(error => {
      if (gamepadView === view) console.error('[gamepad] resize:', error);
    });
  }
}

function currentGamepadSkin() {
  const available = gamepadSkins[selectedLayout];
  return available?.find(skin => skin.id === selectedGamepadSkins[selectedLayout]) || available?.[0];
}

function themeGamepad() {
  const view = gamepadView;
  const theme = currentGamepadSkin();
  if (!view || !view.overlayReady || !theme || view.webContents.isDestroyed()) return;
  view.webContents.executeJavaScript(gamepadTheme.script(theme, selectedLayout)).catch(error => {
    if (gamepadView !== view) return;
    console.error('[gamepad] theme:', error);
    gamepadError = 'Не удалось применить скин. Выберите его повторно.';
    sendSettingsState();
  });
}

function styleGamepad() {
  const view = gamepadView;
  gamepadStyleChain = gamepadStyleChain.catch(() => {}).then(async () => {
    if (!view || view !== gamepadView || view.webContents.isDestroyed()) return;
    const previous = view.overlayStyle;
    view.overlayStyle = await view.webContents.insertCSS(`
      html, body { background: transparent !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      html, body, body * { -webkit-app-region: ${locked ? 'no-drag' : 'drag'} !important; cursor: ${locked ? 'default' : 'move'} !important; }
    `);
    if (previous && !view.webContents.isDestroyed()) await view.webContents.removeInsertedCSS(previous);
  }).catch(error => console.error('[dualsense] style:', error));
}

function syncGamepad() {
  if (gamepadView && gamepadView.overlayLayout !== selectedLayout) {
    const old = gamepadView;
    gamepadView = null;
    win.removeBrowserView(old);
    old.webContents.close();
    gamepadError = '';
  }
  if (!gamepadUrls[selectedLayout]) {
    if (gamepadView) {
      win.removeBrowserView(gamepadView);
      gamepadView.webContents.close();
      gamepadView = null;
    }
    gamepadError = '';
    gamepadLoading = false;
    return;
  }
  if (!gamepadView) {
    const view = new BrowserView({ webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false
    } });
    gamepadView = view;
    gamepadLoading = true;
    gamepadError = '';
    view.overlayLayout = selectedLayout;
    const url = gamepadUrls[selectedLayout];
    view.setBackgroundColor('#00000000');
    win.addBrowserView(view);
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event, target) => {
      if (target !== url) event.preventDefault();
    });
    view.webContents.on('did-finish-load', () => {
      if (gamepadView !== view) return;
      gamepadError = '';
      gamepadLoading = false;
      view.overlayReady = true;
      const layout = layouts.find(item => item.id === view.overlayLayout);
      view.webContents.executeJavaScript(gamepadSize.script(layout)).catch(error => {
        if (gamepadView !== view) return;
        console.error('[gamepad] size:', error);
        gamepadError = 'Не удалось настроить размер геймпада. Выберите его повторно.';
        sendSettingsState();
      });
      sizeGamepad(); styleGamepad(); themeGamepad(); sendSettingsState();
    });
    view.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'Enter' && !input.isAutoRepeat) finishMove();
    });
    view.webContents.on('render-process-gone', () => {
      if (gamepadView !== view || quitting) return;
      view.overlayReady = false;
      gamepadLoading = false;
      gamepadError = 'Страница геймпада остановилась. Нажмите «Переподключить».';
      sendSettingsState();
    });
    view.webContents.loadURL(url).catch(error => {
      if (gamepadView !== view) return;
      gamepadLoading = false;
      view.overlayReady = false;
      console.error('[dualsense] load:', error);
      gamepadError = 'Геймпад не загрузился. Проверьте интернет и нажмите «Переподключить».';
      sendSettingsState();
    });
  }
  sizeGamepad();
}

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let win = null;
let hook = null;
let restartTimer = null;
let locked = true;
let quitting = false;
let activeCodes = new Set();
const activeMouse = new Set();
const mouseButtons = new Set(['left', 'right', 'middle', 'side4', 'side5']);
let selectedLayout = 'keyboard';
let rememberedLayouts = { keyboard: 'keyboard', gamepad: 'dualsense' };
let layoutSizes = {};
let boundsFile = null;
let menuOpen = false;
let settingsWindow = null;
let settingsReady = false;
let selectedSkin = 'original';
let menuShortcutHeld = false;
let lastMenuToggleAt = 0;

const vkMap = {
  9:'Tab',
  20:'CapsLock',
  27:'Escape', 32:'Space',
  49:'Digit1', 50:'Digit2', 51:'Digit3', 52:'Digit4', 53:'Digit5',
  65:'KeyA', 67:'KeyC', 68:'KeyD', 69:'KeyE', 70:'KeyF', 71:'KeyG',
  81:'KeyQ', 82:'KeyR', 83:'KeyS', 84:'KeyT', 87:'KeyW', 88:'KeyX',
  86:'KeyV', 90:'KeyZ', 91:'MetaLeft',
  160:'ShiftLeft', 161:'ShiftLeft',
  162:'ControlLeft', 163:'ControlLeft',
  164:'AltLeft', 165:'AltLeft'
};

// Accept either side of Ctrl/Alt for the settings shortcut.
const heldVk = new Set();

function sendKey(code, event) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send('key-event', { code, event });
}

function handleKey(data) {
  if (!data || (data.event !== 'keydown' && data.event !== 'keyup')) return;
  const vk = Number(data.vk);
  const code = vkMap[vk];
  const wasHeld = heldVk.has(vk);

  if (data.event === 'keydown') heldVk.add(vk);
  else if (data.event === 'keyup') heldVk.delete(vk);

  // Settings and move confirmation work even when another window has focus.
  const ctrl = heldVk.has(162) || heldVk.has(163) || heldVk.has(17);
  const alt = heldVk.has(164) || heldVk.has(165) || heldVk.has(18);
  if (data.event === 'keyup' && vk === 77) menuShortcutHeld = false;
  if (data.event === 'keydown' && ctrl && alt && vk === 77 && !wasHeld) {
    toggleMenuShortcut();
  }
  if (data.event === 'keydown' && vk === 13 && !wasHeld && !locked) finishMove();

  if (!code) return;

  // Treat left/right Shift, Ctrl and Alt as one visual key. This prevents a
  // key-up from one physical side from turning the visual key off while the
  // other side is still held.
  if (data.event === 'keydown') {
    activeCodes.add(code);
    sendKey(code, 'keydown');
  } else if (data.event === 'keyup') {
    const stillHeld =
      (code === 'ShiftLeft' && (heldVk.has(160) || heldVk.has(161))) ||
      (code === 'ControlLeft' && (heldVk.has(162) || heldVk.has(163))) ||
      (code === 'AltLeft' && (heldVk.has(164) || heldVk.has(165)));
    if (!stillHeld) {
      activeCodes.delete(code);
      sendKey(code, 'keyup');
    }
  }
}

function sendMouse(button, event) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send('mouse-event', { button, event });
}

function handleInput(data) {
  if (data?.device !== 'mouse') { handleKey(data); return; }
  if (!mouseButtons.has(data.button) || !['mousedown', 'mouseup'].includes(data.event)) return;
  if (data.event === 'mousedown') activeMouse.add(data.button);
  else activeMouse.delete(data.button);
  sendMouse(data.button, data.event);
}

function stopHook() {
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (hook) {
    try { hook.kill(); } catch (_) {}
    hook = null;
  }
}

function scheduleRestart() {
  if (quitting || restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startHook();
  }, 300);
}

function startHook() {
  if (quitting || process.platform !== 'win32' || hook) return;
  const powershell = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';
  hook = spawn(powershell, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', (app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'keyboard-hook.ps1')
      : path.join(__dirname, 'keyboard-hook.ps1'))
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

  let buffer = '';
  hook.stdout.setEncoding('utf8');
  hook.stdout.on('data', chunk => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      try { handleInput(JSON.parse(text)); } catch (_) {}
    }
  });
  hook.stderr.setEncoding('utf8');
  hook.stderr.on('data', data => console.error('[keyboard-hook]', String(data).trim()));
  const child = hook;
  function recoverHook() {
    if (hook !== child) return;
    hook = null;
    if (!quitting) {
      // Do not leave a stuck key highlighted if Windows terminated the hook.
      for (const code of activeCodes) sendKey(code, 'keyup');
      activeCodes.clear();
      for (const button of activeMouse) sendMouse(button, 'mouseup');
      activeMouse.clear();
      heldVk.clear();
      menuShortcutHeld = false;
      if (!locked) finishMove();
      scheduleRestart();
    }
  }
  child.on('error', err => { console.error('[keyboard-hook]', err.message); recoverHook(); });
  child.on('exit', (code, signal) => {
    if (!quitting) console.error(`[keyboard-hook] stopped: ${code}/${signal}`);
    recoverHook();
  });
}

function setLocked(value) {
  locked = !!value;
  if (!win || win.isDestroyed()) return;

  // Locked = click-through. Unlocked = real mouse input + native frameless
  // drag region supplied by renderer.css. Do not focus the overlay here: it
  // must never steal focus from the game/chat/application being controlled.
  win.setIgnoreMouseEvents(locked);
  win.webContents.send('lock-status-changed', locked);
  styleGamepad();
}

function persistBounds() {
  if (!win || win.isDestroyed() || !boundsFile) return;
  const bounds = win.getBounds();
  layoutSizes[selectedLayout] = { width: bounds.width, height: bounds.height };
  try { windowState.saveBounds(boundsFile, bounds, selectedLayout, layoutSizes, selectedGamepadSkins, rememberedLayouts); return true; }
  catch (error) {
    console.error('[settings] cannot save window position/size:', error);
    if (settingsReady) settingsWindow.webContents.send('settings-error', 'Не удалось сохранить размер и положение окна.');
    return false;
  }
}

function keepOverlayVisible() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  win.setBounds(windowState.fitBounds(bounds, screen.getDisplayMatching(bounds).workArea, layouts.find(layout => layout.id === selectedLayout).minWidth));
}

function finishMove() {
  if (locked || !win || win.isDestroyed()) return;
  setLocked(true);
  keepOverlayVisible();
  persistBounds();
  setMenuOpen(true);
}

function setMenuOpen(value) {
  if (!win || win.isDestroyed()) return;
  menuOpen = !!value;
  if (!menuOpen) {
    settingsWindow?.hide();
    return;
  }
  if (!settingsWindow) createSettingsWindow();
  if (settingsReady) showSettingsWindow();
}

function sendSettingsState() {
  if (!settingsWindow || !settingsReady || !win || win.isDestroyed()) return;
  settingsWindow.webContents.send('settings-state', {
    skin: currentGamepadSkin()?.id || selectedSkin, layout: selectedLayout, rememberedLayouts, gamepadError, gamepadLoading, width: win.getSize()[0], height: win.getSize()[1],
    minWidth: layouts.find(layout => layout.id === selectedLayout).minWidth, minHeight: windowState.MIN_HEIGHT,
    maxWidth: screen.getDisplayMatching(win.getBounds()).workArea.width,
    maxHeight: screen.getDisplayMatching(win.getBounds()).workArea.height
  });
}

function showSettingsWindow() {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(386, area.width);
  const height = Math.min(540, area.height);
  settingsWindow.setBounds({
    x: area.x + Math.floor((area.width - width) / 2),
    y: area.y + Math.floor((area.height - height) / 2), width, height
  });
  sendSettingsState();
  settingsWindow.show();
  settingsWindow.focus();
}

function createSettingsWindow() {
  settingsReady = false;
  settingsWindow = new BrowserWindow({
    icon: appIcon,
    width: 386, height: 540, title: 'Keyboard Overlay — Настройки',
    frame: false, transparent: true, resizable: false, maximizable: false,
    minimizable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });
  settingsWindow.setMenu(null);
  settingsWindow.setAlwaysOnTop(true, 'screen-saver');
  settingsWindow.on('close', event => {
    if (!quitting) { event.preventDefault(); setMenuOpen(false); }
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null; settingsReady = false; menuOpen = false;
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html')).catch(error => {
    console.error('[settings] failed to load:', error);
    settingsWindow?.destroy();
  });
}

function toggleMenuShortcut() {
  if (!locked) return; // Enter confirms movement before settings reopen.
  const now = Date.now();
  // Hook + Electron may report the same press. Ignore repeat until M is released.
  if ((hook && menuShortcutHeld) || now - lastMenuToggleAt < 450) return;
  menuShortcutHeld = true;
  lastMenuToggleAt = now;
  setMenuOpen(!menuOpen);
}

ipcMain.on('close-settings', event => {
  if (settingsWindow && event.sender === settingsWindow.webContents) setMenuOpen(false);
});

ipcMain.on('renderer-ready', (event, savedSkin) => {
  if (win && event.sender === win.webContents) {
    selectedSkin = skins.some(skin => skin.id === savedSkin) ? savedSkin : 'original';
    win.webContents.send('lock-status-changed', locked);
    for (const code of activeCodes) sendKey(code, 'keydown');
    for (const button of activeMouse) sendMouse(button, 'mousedown');
    win.webContents.send('layout-changed', selectedLayout);
    sendSettingsState();
  } else if (settingsWindow && event.sender === settingsWindow.webContents) {
    settingsReady = true;
    if (menuOpen) showSettingsWindow();
  }
});

ipcMain.on('select-skin', (event, id) => {
  if (!settingsWindow || event.sender !== settingsWindow.webContents) return;
  if (gamepadSkins[selectedLayout]) {
    if (!gamepadSkins[selectedLayout].some(skin => skin.id === id)) return;
    selectedGamepadSkins[selectedLayout] = id;
    themeGamepad();
    persistBounds();
    sendSettingsState();
    return;
  }
  if (!skins.some(skin => skin.id === id)) return;
  selectedSkin = id;
  if (win && !win.isDestroyed()) win.webContents.send('skin-changed', id);
  sendSettingsState();
});

ipcMain.handle('resize-overlay', (event, size) => {
  if (!settingsWindow || event.sender !== settingsWindow.webContents || !win || !locked) return { ok: false };
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const minWidth = layouts.find(layout => layout.id === selectedLayout).minWidth;
  if (!size || !Number.isInteger(size.width) || !Number.isInteger(size.height) ||
      size.width < minWidth || size.height < windowState.MIN_HEIGHT ||
      size.width > area.width || size.height > area.height) {
    return { ok: false, error: `Ширина: ${minWidth}–${area.width}, высота: ${windowState.MIN_HEIGHT}–${area.height} px.` };
  }
  win.setBounds(windowState.fitBounds({ ...win.getBounds(), width: size.width, height: size.height }, area));
  sizeGamepad();
  const saved = persistBounds();
  sendSettingsState();
  return { ok: true, error: saved ? undefined : 'Размер изменён, но сохранить его не удалось.' };
});

ipcMain.handle('select-layout', (event, id) => {
  const layout = layouts.find(item => item.id === id);
  if (!settingsWindow || event.sender !== settingsWindow.webContents || !win || !locked || !layout) return { ok: false };
  if (selectedLayout !== id) {
    const bounds = win.getBounds();
    layoutSizes[selectedLayout] = { width: bounds.width, height: bounds.height };
    selectedLayout = id;
    rememberedLayouts[layout.device] = id;
    const size = layoutSizes[id] || layout;
    win.setBounds(windowState.fitBounds({ ...bounds, width: size.width, height: size.height }, screen.getDisplayMatching(bounds).workArea, layout.minWidth));
    win.webContents.send('layout-changed', id);
  }
  if (gamepadUrls[selectedLayout] && gamepadError && gamepadView) {
    win.removeBrowserView(gamepadView);
    gamepadView.webContents.close();
    gamepadView = null;
    gamepadError = '';
  }
  syncGamepad();
  const saved = persistBounds();
  sendSettingsState();
  return { ok: true, error: saved ? undefined : 'Форм-фактор изменён, но сохранить его не удалось.' };
});

ipcMain.on('retry-gamepad', event => {
  if (!settingsWindow || event.sender !== settingsWindow.webContents || !locked || !win) return;
  if (!gamepadUrls[selectedLayout]) {
    stopHook();
    for (const code of activeCodes) sendKey(code, 'keyup');
    activeCodes.clear();
    for (const button of activeMouse) sendMouse(button, 'mouseup');
    activeMouse.clear();
    heldVk.clear();
    menuShortcutHeld = false;
    startHook();
    return;
  }
  if (gamepadView) {
    const old = gamepadView;
    gamepadView = null;
    win.removeBrowserView(old);
    if (!old.webContents.isDestroyed()) old.webContents.close();
  }
  syncGamepad();
  sendSettingsState();
});

ipcMain.on('start-move', event => {
  if (!settingsWindow || event.sender !== settingsWindow.webContents || !menuOpen || !locked) return;
  setMenuOpen(false);
  setLocked(false);
});
ipcMain.on('finish-move', event => {
  if (win && event.sender === win.webContents) finishMove();
});
ipcMain.on('quit-app', event => {
  if (settingsWindow && event.sender === settingsWindow.webContents) app.quit();
});

function createWindow() {
  boundsFile = path.join(app.getPath('userData'), 'window-state.json');
  const savedLayout = windowState.readLayoutState(boundsFile);
  selectedLayout = savedLayout.layout;
  layoutSizes = savedLayout.sizes;
  Object.assign(rememberedLayouts, savedLayout.rememberedLayouts);
  rememberedLayouts[layouts.find(item => item.id === selectedLayout).device] = selectedLayout;
  selectedGamepadSkins = savedLayout.gamepadSkins || {};
  const area = screen.getPrimaryDisplay().workArea;
  const defaults = {
    width: config.window.width, height: config.window.height,
    x: area.x + Math.round((area.width - config.window.width) / 2),
    y: area.y + Math.round((area.height - config.window.height) / 2)
  };
  const saved = windowState.readBounds(boundsFile, defaults);
  const bounds = windowState.fitBounds(saved, screen.getDisplayMatching(saved).workArea, layouts.find(layout => layout.id === selectedLayout).minWidth);
  win = new BrowserWindow({
    icon: appIcon,
    ...bounds,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  win.setMenu(null);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'index.html')).catch(err => {
    console.error('[overlay] failed to load index.html:', err);
  });
  setLocked(true);
  syncGamepad();
  win.on('resize', sizeGamepad);
  startHook();

  win.on('closed', () => { win = null; app.quit(); });
}

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
else app.on('second-instance', () => {
  if (!win || quitting) return;
  if (!locked) finishMove();
  else setMenuOpen(true);
});

if (primaryInstance) app.whenReady().then(() => {
  createWindow();
  createTray();
  setMenuOpen(true);
  // Only the settings shortcut remains. Move and quit are menu actions.
  const menuRegistered = globalShortcut.register(config.hotkeys.menu, toggleMenuShortcut);
  if (!menuRegistered) console.warn('[hotkeys] Electron Ctrl+Alt+M registration unavailable; Windows hook remains active');
  for (const event of ['display-removed', 'display-metrics-changed']) {
    screen.on(event, () => {
      keepOverlayVisible(); persistBounds(); sendSettingsState();
      if (menuOpen && settingsReady) showSettingsWindow();
    });
  }
});

app.on('before-quit', () => {
  quitting = true;
  if (tray) { tray.destroy(); tray = null; }
  persistBounds();
  globalShortcut.unregisterAll();
  stopHook();
  if (gamepadView) {
    const view = gamepadView;
    gamepadView = null;
    if (win && !win.isDestroyed()) win.removeBrowserView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
});
app.on('window-all-closed', () => app.quit());
