const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../Game Overlay');

function setup(savedBounds = null, savedLayout = { layout: 'keyboard', sizes: {} }, primary = true, keepStartupMenu = false) {
  let now = 1000;
  const messages = [];
  const ipcMain = new EventEmitter();
  const handlers = new Map(), saved = [];
  ipcMain.handle = (name, fn) => handlers.set(name, fn);
  const area = { x: -1920, y: 0, width: 1920, height: 1040 };
  const screen = new EventEmitter();
  screen.getCursorScreenPoint = () => ({ x: -500, y: 200 });
  screen.getDisplayNearestPoint = screen.getDisplayMatching = screen.getPrimaryDisplay = () => ({ workArea: area });
  const trays = [];
  class Tray extends EventEmitter {
    constructor(icon) { super(); this.icon=icon; trays.push(this); }
    setToolTip(text) { this.tooltip=text; }
    setContextMenu(menu) { this.menu=menu; }
    destroy() { this.destroyed=true; }
  }
  const Menu={buildFromTemplate: template=>template};
  const shortcuts = new Map();
  const hook = new EventEmitter();
  hook.stdout = new EventEmitter();
  hook.stderr = new EventEmitter();
  hook.stdout.setEncoding = hook.stderr.setEncoding = () => {};
  hook.kill = () => { hook.killed = true; };
  let win; const windows = [];
  class BrowserView {
    constructor(options) {
      this.options = options;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        isDestroyed: () => !!this.closed,
        close: () => { this.closed = true; },
        setWindowOpenHandler() {},
        loadURL: url => { this.url = url; return Promise.resolve(); },
        setZoomFactor: zoom => { this.zoom = zoom; },
        insertCSS: async css => { this.css = css; return 'style'; },
        removeInsertedCSS: async () => {},
        executeJavaScript: async script => { this.themeScript = script; }
      });
    }
    setBounds(bounds) { this.bounds = bounds; }
    setBackgroundColor() {}
  }
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); win = this; windows.push(this); this.bounds = { x: options.x || 0, y: options.y || 0, width: options.width, height: options.height };
      this.webContents = { isDestroyed: () => false, send: (...args) => messages.push(args) };
    }
    isDestroyed() { return false; }
    getSize() { return [this.bounds.width, this.bounds.height]; }
    getBounds() { return { ...this.bounds }; }
    setBounds(bounds) { this.bounds = bounds; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    setIgnoreMouseEvents(value) { this.ignoresMouse = value; }
    setMenu() {}
    setAlwaysOnTop() {}
    addBrowserView(view) { this.view = view; }
    removeBrowserView() { this.view = null; }
    loadFile() { return Promise.resolve(); }
    focus() { this.focused = true; }
    isFocused() { return this.focused; }
    blur() { this.focused = false; }
  }
  const app = new EventEmitter();
  app.requestSingleInstanceLock = () => primary;
  app.commandLine = { appendSwitch() {} };
  app.whenReady = () => ({ then: fn => fn() });
  app.getPath = () => root;
  app.quit = () => { app.quitCalled = true; app.emit('before-quit'); };
  const context = vm.createContext({
    require(name) {
      if (name === 'electron') return { app, BrowserWindow, BrowserView, Tray, Menu, ipcMain, screen, globalShortcut: { register: (key, fn) => { shortcuts.set(key, fn); return true; }, unregisterAll: () => shortcuts.clear() } };
      if (name === 'child_process') return { spawn: () => hook };
      if (name === './window-state') return { ...require(path.join(root, 'window-state.js')), readBounds: (_file, defaults) => savedBounds || defaults, readLayoutState: () => savedLayout, saveBounds: (_file, bounds, layout, sizes, gamepadSkins) => saved.push({ ...bounds, layout, layoutSizes: structuredClone(sizes), gamepadSkins: structuredClone(gamepadSkins) }) };
      if (name === './layouts') return require(path.join(root, 'layouts.js'));
      if (name === './skins') return require(path.join(root, 'skins.js'));
      if (name === './config') return require(path.join(root, 'config.js'));
      if (name.startsWith('./')) return require(path.join(root, name));
      return require(name);
    },
    process: { platform: 'win32', env: {} }, __dirname: root,
    console: { log() {}, error() {}, warn() {} },
    Date: { now: () => now }, setTimeout: () => 1, clearTimeout() {}
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), context);
  if (primary && !keepStartupMenu) ipcMain.emit('close-settings', { sender: windows[1].webContents });
  return {
    trays, win: windows[0], ipcMain, messages, shortcuts, windows, handlers, saved, app, hook,
    get settings() { return windows[1]; },
    ready() { ipcMain.emit('renderer-ready', { sender: windows[1].webContents }); },
    advance: () => { now += 1000; },
    key: (vk, event = 'keydown') => hook.stdout.emit('data', JSON.stringify({ vk, event }) + '\n'),
    open: () => shortcuts.get('Control+Alt+M')()
  };
}

test('separate centered settings window leaves overlay click-through untouched', () => {
  const s = setup(); s.open(); s.ready();
  assert.equal(s.windows.length, 2);
  assert.equal(s.win.ignoresMouse, true);
  assert.equal(s.win.focused, undefined);
  assert.equal(s.settings.visible, true);
  assert.equal(s.settings.bounds.x, -1153);
  assert.equal(s.settings.bounds.y, Math.floor((1040 - s.settings.bounds.height) / 2));
  s.ipcMain.emit('close-settings', { sender: s.win.webContents });
  assert.equal(s.settings.visible, true);
  s.ipcMain.emit('close-settings', { sender: s.settings.webContents });
  assert.equal(s.settings.visible, false);
  assert.equal(s.win.ignoresMouse, true);
});

test('DualSense shares settings, saves sizes, rejects remote IPC and closes on keyboard selection', async () => {
  const s = setup(); s.open(); s.ready();
  const select = id => s.handlers.get('select-layout')({ sender: s.settings.webContents }, id);
  assert.equal(select('dualsense').ok, true);
  const view = s.win.view;
  assert.equal(view.options.webPreferences.nodeIntegration, false);
  assert.equal(view.options.webPreferences.preload, undefined);
  assert.equal(view.url, require(path.join(root, 'dualsense-config')).OVERLAY_URL);
  assert.equal(view.bounds.width, 283);
  assert.equal(s.saved.at(-1).layout, 'dualsense');
  assert.equal(s.handlers.get('select-layout')({ sender: view.webContents }, 'keyboard').ok, false);
  s.ipcMain.emit('quit-app', { sender: view.webContents });
  assert.equal(s.app.quitCalled, undefined);
  s.handlers.get('resize-overlay')({ sender: s.settings.webContents }, { width: 410, height: 330 });
  select('keyboard');
  assert.equal(view.closed, true);
  assert.equal(s.win.view, null);
  assert.equal(s.win.getSize()[0], 386);
  select('dualsense');
  assert.equal(s.win.getSize()[0], 410);
  const restored = setup({ x: 0, y: 0, width: 410, height: 330 }, { layout: 'dualsense', sizes: {} });
  assert.equal(restored.win.view.bounds.width, 410);
  assert.equal(restored.win.ignoresMouse, true);
  restored.app.quit();
  assert.equal(restored.win.view, null);
});

test('gamepad skins are independent, applied without reloading, validated and restored', async () => {
  const s = setup(); s.open(); s.ready();
  const select = id => s.handlers.get('select-layout')({ sender: s.settings.webContents }, id);
  const skin = id => s.ipcMain.emit('select-skin', { sender: s.settings.webContents }, id);
  select('dualsense');
  const ds = s.win.view;
  ds.webContents.emit('did-finish-load');
  skin('remix-green');
  assert.equal(s.win.view, ds);
  assert.match(ds.themeScript, /remix-green/);
  assert.equal(s.saved.at(-1).gamepadSkins.dualsense, 'remix-green');
  skin('heart-breaker');
  assert.equal(s.messages.at(-1)[1].skin, 'remix-green');
  select('xbox');
  assert.equal(ds.closed, true);
  assert.match(s.win.view.url, /XSX-Black/);
  assert.equal(s.win.view.bounds.width, 320);
  skin('heart-breaker');
  const stored = s.saved.at(-1);
  assert.deepEqual(stored.gamepadSkins, { dualsense: 'remix-green', xbox: 'heart-breaker' });
  select('dualsense');
  assert.equal(s.messages.at(-1)[1].skin, 'remix-green');
  select('keyboard');
  assert.equal(s.messages.at(-1)[1].skin, 'original');
  const restored = setup(stored, { layout: 'xbox', sizes: stored.layoutSizes, gamepadSkins: stored.gamepadSkins });
  restored.open(); restored.ready();
  assert.equal(restored.messages.at(-1)[1].skin, 'heart-breaker');
});

test('gamepad skin storage rejects stale IDs and preserves valid selections', () => {
  const state = require(path.join(root, 'window-state'));
  const file = path.join(fs.mkdtempSync(path.join(__dirname, 'skin-test-')), 'window-state.json');
  state.saveBounds(file, { x: 0, y: 0, width: 320, height: 283 }, 'xbox', {}, { xbox: 'stellar-shift', dualsense: 'rich-pearl' });
  assert.deepEqual(state.readLayoutState(file).gamepadSkins, { dualsense: 'rich-pearl', xbox: 'stellar-shift' });
  state.saveBounds(file, { x: 0, y: 0, width: 320, height: 283 }, 'xbox', {}, { xbox: 'remix-green', dualsense: '<script>' });
  assert.deepEqual(state.readLayoutState(file).gamepadSkins, {});
});
test('hook and Electron share one toggle, ignore repeat, reuse the same window', () => {
  const s = setup(); s.key(163); s.key(165); s.key(77); s.open(); s.ready();
  assert.equal(s.settings.visible, true);
  s.advance(); s.key(77); s.open();
  assert.equal(s.settings.visible, true);
  s.key(77, 'keyup'); s.advance(); s.key(77); s.open();
  assert.equal(s.settings.visible, false);
  s.key(77, 'keyup'); s.advance(); s.open(); s.key(77);
  assert.equal(s.settings.visible, true);
  assert.equal(s.windows.length, 2);
});
test('closing before settings finishes loading never shows a late window', () => {
  const s = setup(); s.open(); s.key(77, 'keyup'); s.advance(); s.open(); s.ready();
  assert.notEqual(s.settings.visible, true);
});
test('validated settings selection is delivered to overlay, foreign IPC rejected', () => {
  const s = setup(); s.open(); s.ready(); s.messages.length = 0;
  s.ipcMain.emit('select-skin', { sender: {} }, 'winter');
  s.ipcMain.emit('select-skin', { sender: s.settings.webContents }, 'missing');
  assert.equal(s.messages.length, 0);
  s.ipcMain.emit('select-skin', { sender: s.settings.webContents }, 'winter');
  assert.equal(s.messages[0][0], 'skin-changed');
  assert.equal(s.messages[0][1], 'winter');
  assert.equal(s.messages[1][1].skin, 'winter');
});
test('overlay ready restores skin, held keys and authoritative lock state', () => {
  const s = setup(); s.open(); s.ready(); s.key(87); s.messages.length = 0;
  s.ipcMain.emit('renderer-ready', { sender: s.win.webContents }, 'autumn');
  assert.equal(s.messages[0][0], 'lock-status-changed');
  assert.equal(s.messages[0][1], true);
  assert.equal(s.messages[1][1].code, 'KeyW');
  assert.equal(s.messages.find(([name]) => name === 'settings-state')[1].skin, 'autumn');
});

test('resize validates IPC and values, saves dimensions and keeps overlay visible', () => {
  const s = setup(); s.open(); s.ready(); const resize = s.handlers.get('resize-overlay');
  const original = s.win.getBounds();
  assert.equal(resize({ sender: {} }, { width: 500, height: 300 }).ok, false);
  for (const width of [0, -1, 2.5, NaN, Infinity, '500', 3000]) {
    assert.equal(resize({ sender: s.settings.webContents }, { width, height: 300 }).ok, false);
  }
  assert.deepEqual(s.win.getBounds(), original);
  assert.equal(resize({ sender: s.settings.webContents }, { width: 500, height: 300 }).ok, true);
  assert.deepEqual(s.win.getSize(), [500, 300]);
  assert.equal(s.saved.at(-1).width, 500);
});
test('move is menu-only, Enter confirms once, saves coordinates and returns menu', () => {
  const s = setup(); s.open(); s.ready();
  s.ipcMain.emit('start-move', { sender: {} }); assert.equal(s.win.ignoresMouse, true);
  s.ipcMain.emit('start-move', { sender: s.settings.webContents });
  assert.equal(s.settings.visible, false); assert.equal(s.win.ignoresMouse, false);
  s.win.setBounds({ x: -1500, y: 120, width: 386, height: 351 });
  s.key(13);
  assert.equal(s.win.ignoresMouse, true); assert.equal(s.settings.visible, true);
  assert.equal(s.saved.at(-1).x, -1500);
  const count = s.saved.length; s.key(13); s.key(13, 'keyup'); s.key(13);
  assert.equal(s.saved.length, count);
});
test('legacy hotkeys do nothing and menu Exit stops hook', () => {
  const s = setup();
  assert.deepEqual([...s.shortcuts.keys()], ['Control+Alt+M']);
  s.key(162); s.key(164); s.key(76); s.key(81);
  assert.equal(s.win.ignoresMouse, true); assert.notEqual(s.app.quitCalled, true);
  s.open(); s.ready();
  s.ipcMain.emit('quit-app', { sender: {} }); assert.notEqual(s.app.quitCalled, true);
  s.ipcMain.emit('quit-app', { sender: s.settings.webContents });
  assert.equal(s.app.quitCalled, true); assert.equal(s.hook.killed, true);
  assert.equal(s.shortcuts.size, 0);
});
test('saved bounds are restored locked and off-screen bounds return to display', () => {
  const s = setup({ x: -1600, y: 100, width: 600, height: 400 });
  assert.equal(s.win.getBounds().x, -1600); assert.deepEqual(s.win.getSize(), [600, 400]);
  assert.equal(s.win.ignoresMouse, true);
  const missing = setup({ x: 8000, y: 6000, width: 600, height: 400 });
  assert.equal(missing.win.getBounds().x, -600); assert.equal(missing.win.getBounds().y, 640);
});
test('geometry file roundtrip and corrupt data fallback', () => {
  const state = require(path.join(root, 'window-state.js'));
  const directory = fs.mkdtempSync(path.join(__dirname, 'geometry-test-'));
  const file = path.join(directory, 'window-state.json');
  const defaults = { x: 0, y: 0, width: 386, height: 351 };
  assert.deepEqual(state.readBounds(file, defaults), defaults);
  const bounds = { x: -800, y: 90, width: 500, height: 300 };
  state.saveBounds(file, bounds); assert.deepEqual(state.readBounds(file, defaults), bounds);
  fs.writeFileSync(file, '{broken'); assert.deepEqual(state.readBounds(file, defaults), defaults);
  fs.writeFileSync(file, JSON.stringify({ ...bounds, width: '500' }));
  assert.deepEqual(state.readBounds(file, defaults), defaults);
});

test('layout selection preserves custom sizes, rejects invalid IPC and restores saved layout', () => {
  const s = setup(); s.open(); s.ready();
  const sender = { sender: s.settings.webContents };
  const select = s.handlers.get('select-layout');
  const resize = s.handlers.get('resize-overlay');
  assert.equal(select({ sender: {} }, 'keyboard-mouse').ok, false);
  assert.equal(select(sender, 'unknown').ok, false);
  resize(sender, { width: 500, height: 300 });
  assert.equal(select(sender, 'keyboard-mouse').ok, true);
  assert.deepEqual(s.win.getSize(), [600, 351]);
  assert.equal(resize(sender, { width: 250, height: 300 }).ok, false);
  resize(sender, { width: 700, height: 350 });
  select(sender, 'keyboard'); assert.deepEqual(s.win.getSize(), [500, 300]);
  select(sender, 'keyboard-mouse'); assert.deepEqual(s.win.getSize(), [700, 350]);
  const stored = s.saved.at(-1);
  assert.equal(stored.layout, 'keyboard-mouse');
  const restored = setup(stored, { layout: stored.layout, sizes: stored.layoutSizes });
  restored.open(); restored.ready();
  assert.equal(restored.messages.at(-1)[1].layout, 'keyboard-mouse');
  assert.deepEqual(restored.win.getSize(), [700, 350]);
});

test('mouse input persists across hidden layout and clears when hook exits', () => {
  const s = setup();
  const mouse = (button, event) => s.hook.stdout.emit('data', JSON.stringify({ device: 'mouse', button, event }) + '\n');
  mouse('left', 'mousedown'); mouse('side5', 'mousedown');
  s.messages.length = 0;
  s.ipcMain.emit('renderer-ready', { sender: s.win.webContents }, 'summer');
  assert.equal(s.messages.filter(([name, data]) => name === 'mouse-event' && data.event === 'mousedown').length, 2);
  s.messages.length = 0;
  mouse('unknown', 'mousedown'); mouse('right', 'invalid');
  assert.equal(s.messages.length, 0);
  s.hook.emit('exit', 1, null);
  assert.equal(s.messages.filter(([name, data]) => name === 'mouse-event' && data.event === 'mouseup').length, 2);
});

test('layout metadata roundtrip, backward compatibility and invalid size fallback', () => {
  const state = require(path.join(root, 'window-state.js'));
  const file = path.join(fs.mkdtempSync(path.join(__dirname, 'layout-test-')), 'window-state.json');
  assert.deepEqual(state.readLayoutState(file), { layout: 'keyboard', sizes: {}, gamepadSkins: {} });
  state.saveBounds(file, { x: 50, y: 50, width: 700, height: 350 }, 'keyboard-mouse', {
    keyboard: { width: 500, height: 300 }, 'keyboard-mouse': { width: 700, height: 350 }
  });
  assert.equal(state.readLayoutState(file).layout, 'keyboard-mouse');
  assert.equal(state.readLayoutState(file).sizes.keyboard.width, 500);
  fs.writeFileSync(file, JSON.stringify({ layout: 'unknown', layoutSizes: { keyboard: { width: '500', height: 300 } } }));
  assert.deepEqual(state.readLayoutState(file), { layout: 'keyboard', sizes: {}, gamepadSkins: {} });
});


test('second launch creates no windows; primary opens settings on second-instance', () => {
  const secondary = setup(null, undefined, false);
  assert.equal(secondary.windows.length, 0);
  assert.equal(secondary.app.quitCalled, true);
  const primary = setup();
  primary.app.emit('second-instance'); primary.ready();
  assert.equal(primary.settings.visible, true);
});

test('gamepad crash is reported and retry replaces view without changing selection', async () => {
  const s=setup(); s.open(); s.ready();
  await s.handlers.get('select-layout')({sender:s.settings.webContents}, 'xbox');
  const old=s.win.view;
  old.webContents.emit('render-process-gone', {}, {reason:'crashed'});
  const state=s.messages.filter(([name])=>name==='settings-state').at(-1)[1];
  assert.ok(state.gamepadError); assert.equal(state.gamepadLoading,false);
  s.ipcMain.emit('retry-gamepad',{sender:s.win.webContents});
  assert.equal(s.win.view,old);
  s.ipcMain.emit('retry-gamepad',{sender:s.settings.webContents});
  assert.notEqual(s.win.view,old); assert.equal(old.closed,true);
  s.win.view.webContents.emit('did-finish-load');
  const ready=s.messages.filter(([name])=>name==='settings-state').at(-1)[1];
  assert.equal(ready.gamepadError,''); assert.equal(ready.layout,'xbox');
});

test('remembered device layouts survive storage and reject mismatched devices', () => {
  const state=require(path.join(root,'window-state'));
  const file=path.join(fs.mkdtempSync(path.join(__dirname,'layout-test-')),'window-state.json');
  state.saveBounds(file,{x:0,y:0,width:500,height:300},'keyboard',{}, {}, {keyboard:'keyboard-mouse',gamepad:'xbox'});
  const stored=state.readLayoutState(file);
  assert.deepEqual(stored.rememberedLayouts,{keyboard:'keyboard-mouse',gamepad:'xbox'});
  const s=setup(null,stored);s.open();s.ready();
  const value=s.messages.filter(([name])=>name==='settings-state').at(-1)[1];
  assert.equal(value.rememberedLayouts.gamepad,'xbox');
  fs.writeFileSync(file,JSON.stringify({rememberedLayouts:{keyboard:'xbox',gamepad:'unknown'}}));
  assert.equal(state.readLayoutState(file).rememberedLayouts,undefined);
});

test('startup opens settings while overlay remains click-through', () => {
  const s=setup(null,undefined,true,true);s.ready();
  assert.equal(s.settings.visible,true);
  assert.equal(s.win.ignoresMouse,true);
});

test('tray opens settings, exits cleanly and is absent in a second instance', () => {
  const s=setup();s.ready();
  assert.equal(s.trays.length,1);
  assert.ok(fs.existsSync(s.trays[0].icon));
  s.trays[0].emit('click');assert.equal(s.settings.visible,true);
  s.ipcMain.emit('close-settings',{sender:s.settings.webContents});
  s.trays[0].menu[0].click();assert.equal(s.settings.visible,true);
  s.trays[0].menu[2].click();assert.equal(s.app.quitCalled,true);
  assert.equal(s.trays[0].destroyed,true);
  assert.equal(setup(null,undefined,false).trays.length,0);
});

test('keyboard reconnect clears held inputs and rejects foreign requests', () => {
  const s=setup();s.open();s.ready();s.key(87);
  s.hook.stdout.emit('data',JSON.stringify({device:'mouse',button:'left',event:'mousedown'})+'\n');
  s.ipcMain.emit('retry-gamepad',{sender:s.win.webContents});
  assert.equal(s.hook.killed,undefined);
  s.messages.length=0;
  s.ipcMain.emit('retry-gamepad',{sender:s.settings.webContents});
  assert.equal(s.hook.killed,true);
  assert.ok(s.messages.some(([name,data])=>name==='key-event' && data.code==='KeyW' && data.event==='keyup'));
  assert.ok(s.messages.some(([name,data])=>name==='mouse-event' && data.button==='left' && data.event==='mouseup'));
});
