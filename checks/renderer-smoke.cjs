const electron = require('electron');
const { app, ipcMain, screen } = electron;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../Game Overlay');
const artifacts = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
app.setPath('userData', path.join(artifacts, 'electron-profile'));
fs.mkdirSync(app.getPath('userData'), { recursive: true });
fs.writeFileSync(path.join(app.getPath('userData'), 'window-state.json'), '{}');
app.disableHardwareAcceleration();
const windows = [], errors = [], shortcuts = new Map();
class HiddenWindow extends electron.BrowserWindow {
  constructor(options) {
    super({ ...options, show: false, webPreferences: { ...options.webPreferences, offscreen: windows.length > 0, backgroundThrottling: false } });
    windows.push(this);
    if (windows.length === 1) {
      // BrowserView needs a native host participating in window layout.
      // Keep it fully transparent and do not activate it during the checks.
      this.setOpacity(0);
      this.showInactive();
    }
    this.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  }
  show() { this.testVisible = true; }
  hide() { this.testVisible = false; }
  focus() {}
  setIgnoreMouseEvents(value) { this.testIgnoresMouse = value; super.setIgnoreMouseEvents(value); }
}
const hook = new EventEmitter();
hook.stdout = new EventEmitter(); hook.stderr = new EventEmitter();
hook.stdout.setEncoding = hook.stderr.setEncoding = () => {};
hook.kill = () => { hook.killed = true; };
vm.runInNewContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), {
  __dirname: root, process, console, setTimeout, clearTimeout,
  require(name) {
    if (name === 'electron') return { ...electron, BrowserWindow: HiddenWindow,
      globalShortcut: { register(key, fn) { shortcuts.set(key, fn); return true; }, unregisterAll() {} } };
    if (name === 'child_process') return { spawn: () => hook };
    if (name.startsWith('./')) return require(path.join(root, name));
    return require(name);
  }
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await pause(50); }
  throw new Error('Condition timed out');
}
const run = (win, code) => win.webContents.executeJavaScript(code);
async function verifyGamepadResize(menu, overlay, view, layout) {
  for (let i = 0; i < 250; i++) {
    if (!view.webContents.isLoading() && await run(view, "!!document.getElementById('overlay-gamepad-size')")) break;
    if (i === 249) throw Error('Gamepad sizing did not initialize: ' + layout);
    await pause(100);
  }
  const geometry = `(() => {
    const controller = document.querySelector('.controller.active') || document.querySelector('.controller');
    controller.style.setProperty('display', 'block', 'important');
    controller.classList.remove('disconnected');
    const r = controller.getBoundingClientRect();
    const button = controller.querySelector('.button.a').getBoundingClientRect();
    return { x:r.x, y:r.y, width:r.width, height:r.height, buttonWidth:button.width, buttonHeight:button.height, viewportWidth:innerWidth, viewportHeight:innerHeight };
  })()`;
  for (const [width, height] of [[400,320],[620,320],[620,500],[240,500],[240,200],[400,320]]) {
    assert.equal(await run(menu, `widthInput.value='${width}';heightInput.value='${height}';applySize()`), true);
    let measured;
    for (let attempt = 0; attempt < 50; attempt++) {
      await pause(40);
      measured = await run(view, geometry);
      if (measured.viewportWidth === width && measured.viewportHeight === height) break;
    }
    assert.equal(view.webContents.getZoomFactor(), 1);
    assert.equal(measured.viewportWidth, width);
    assert.equal(measured.viewportHeight, height);
    for (const [key, expected] of Object.entries({ x:width*.02, y:height*.02, width:width*.96, height:height*.96 })) {
      assert.ok(Math.abs(measured[key]-expected)<.2, `${layout} ${width}x${height} ${key}: ${measured[key]} != ${expected}`);
    }
    if (layout === 'dualsense') {
      assert.ok(Math.abs(measured.buttonWidth - 54*width*.96/794)<.2);
      assert.ok(Math.abs(measured.buttonHeight - 54*height*.96/639)<.2);
    }
    assert.equal(overlay.getBrowserViews()[0], view, 'Resizing must not recreate the page');
  }
  console.log('PASS: ' + layout + ' independent width/height, full drawing fits, page retained');
}
const timer = setTimeout(() => app.exit(1), 55000);
app.whenReady().then(async () => {
  try {
    await waitFor(() => windows[0] && !windows[0].webContents.isLoading());
    const overlay = windows[0];
    await run(overlay, "localStorage.clear()");
    await overlay.loadFile(path.join(root, 'index.html'));
    assert.equal(await run(overlay, "document.querySelectorAll('.key').length"), 27);
    assert.equal(await run(overlay, "document.querySelector('.settings-menu') === null"), true);
    assert.equal(await run(overlay, "document.body.classList.contains('monochrome')"), true);
    const bounds = overlay.getBounds();
    const geometry = await run(overlay, "keys.map(key => { const r = key.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })");

    await waitFor(() => windows[1]?.testVisible);
    const menu = windows[1];
    assert.deepEqual(overlay.getBounds(), bounds);
    assert.equal(overlay.testIgnoresMouse, true);
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    assert.equal(menu.getBounds().x, area.x + Math.floor((area.width - menu.getBounds().width) / 2));
    assert.equal(menu.getBounds().y, area.y + Math.floor((area.height - menu.getBounds().height) / 2));
    assert.equal(await run(menu, 'skinSelect.options.length'), 6);
    assert.equal(await run(menu, "document.getElementById('overlay-width').value"), '386');
    assert.equal(await run(menu, "(() => { const r = document.querySelector('.settings-menu').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()"), true);
    assert.equal(await run(menu, "(() => { const layer = document.querySelector('.settings-layer'); return layer.scrollHeight <= layer.clientHeight; })()"), true);
    assert.equal(await run(menu, "!!document.querySelector('.settings-header #retry-gamepad')"), true);
    await run(menu, "widthInput.focus(); widthInput.value='486'; widthInput.dispatchEvent(new Event('input'))");
    await waitFor(() => overlay.getBounds().width === 486);
    await run(menu, "widthInput.value=''; widthInput.dispatchEvent(new Event('input'))");
    await pause(60);
    assert.equal(overlay.getBounds().width,486);
    await run(menu, "widthInput.value='386'; widthInput.dispatchEvent(new Event('input'))");
    await waitFor(() => overlay.getBounds().width === 386);
    await run(menu, 'widthInput.blur()');
    await pause(120);
    fs.writeFileSync(path.join(artifacts, 'settings-independent.png'), (await menu.webContents.capturePage()).toPNG());
    overlay.webContents.send('key-event', { code: 'KeyW', event: 'keydown' });
    for (const id of ['spring', 'summer', 'autumn', 'winter', 'custom', 'original']) {
      await run(menu, 'skinSelect.value = ' + JSON.stringify(id) + '; skinSelect.dispatchEvent(new Event("change"))');
      await pause(80);
      assert.equal(await run(overlay, "localStorage.getItem('keyboard-overlay.skin')"), id);
      assert.equal(await run(overlay, "byCode.get('KeyW').classList.contains('active')"), true);
    }
    overlay.webContents.send('key-event', { code: 'KeyW', event: 'keyup' });
    await pause(80);
    assert.deepEqual(await run(overlay, "keys.map(key => { const r = key.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })"), geometry);
    await run(menu, "skinSelect.value = 'winter'; skinSelect.dispatchEvent(new Event('change'))");
    await pause(80);
    await run(menu, 'closeSettings.click()');
    await waitFor(() => !menu.testVisible);
    assert.equal(overlay.isDestroyed(), false);
    await overlay.loadFile(path.join(root, 'index.html'));
    assert.equal(await run(overlay, 'savedSkin'), 'winter');
    await pause(500);
    hook.stdout.emit('data', '{"event":"keyup","vk":77}\n');
    shortcuts.get('Control+Alt+M')();
    await waitFor(() => menu.testVisible);
    assert.equal(windows.length, 2);
    assert.equal(await run(menu, 'skinSelect.value'), 'winter');
    assert.deepEqual([...shortcuts.keys()], ['Control+Alt+M']);
    await run(menu, "widthInput.value = '500'; heightInput.value = '300'; widthInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
    await waitFor(() => overlay.getSize()[0] === 500);
    assert.deepEqual(overlay.getSize(), [500, 300]);
    const geometryFile = path.join(app.getPath('userData'), 'window-state.json');
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).width, 500);
    await run(menu, "widthInput.value = ''; widthInput.dispatchEvent(new Event('blur'))");
    await pause(100);
    assert.deepEqual(overlay.getSize(), [500, 300]);
    assert.equal(await run(menu, "message.classList.contains('error')"), true);
    await run(menu, "widthInput.value = '500'; document.getElementById('move-overlay').click()");
    await waitFor(() => !menu.testVisible && !overlay.testIgnoresMouse);
    assert.equal(await run(overlay, "document.body.classList.contains('drag-mode')"), true);
    const destination = screen.getDisplayMatching(overlay.getBounds()).workArea;
    overlay.setPosition(destination.x + 40, destination.y + 50);
    hook.stdout.emit('data', '{"event":"keydown","vk":13}\n');
    await waitFor(() => menu.testVisible && overlay.testIgnoresMouse);
    assert.equal(await run(overlay, "document.body.classList.contains('drag-mode')"), false);
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).x, destination.x + 40);
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).y, destination.y + 50);
    hook.stdout.emit('data', '{"event":"keyup","vk":13}\n');
    hook.stdout.emit('data', '{"event":"keydown","vk":13}\n');
    assert.equal(overlay.testIgnoresMouse, true);
    await pause(100);
    fs.writeFileSync(path.join(artifacts, 'settings-controls.png'), (await menu.webContents.capturePage()).toPNG());
    assert.equal(await run(menu, 'layoutSelect.options.length'), 2);
    assert.equal(await run(menu, 'layoutSelect.disabled'), false);
    await run(menu, "layoutSelect.value = 'keyboard-mouse'; layoutSelect.dispatchEvent(new Event('change'))");
    await waitFor(() => overlay.getSize()[0] === 600);
    await pause(100);
    assert.equal(await run(overlay, "document.body.dataset.layout"), 'keyboard-mouse');
    assert.equal(await run(overlay, "document.querySelectorAll('.key').length"), 27);
    assert.equal(await run(overlay, "document.querySelectorAll('.mini-key').length"), 0);
    assert.equal(await run(overlay, "document.querySelectorAll('[data-part]').length"), 5);
    assert.equal(await run(overlay, "(() => { const k = document.querySelector('.keyboard').getBoundingClientRect(); const m = document.querySelector('.mouse').getBoundingClientRect(); return k.right <= m.left && m.right <= innerWidth && m.bottom <= innerHeight; })()"), true);
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).layout, 'keyboard-mouse');
    await run(menu, "skinSelect.value = 'original'; skinSelect.dispatchEvent(new Event('change'))");
    await pause(100);
    assert.equal(await run(overlay, "getComputedStyle(byCode.get('KeyW')).textShadow"), 'none');
    fs.writeFileSync(path.join(artifacts, 'keyboard-mouse-black.png'), (await overlay.webContents.capturePage()).toPNG());
    for (const button of ['left', 'right', 'middle', 'side4', 'side5']) {
      hook.stdout.emit('data', JSON.stringify({ device: 'mouse', button, event: 'mousedown' }) + '\n');
    }
    await run(menu, "skinSelect.value = 'summer'; skinSelect.dispatchEvent(new Event('change'))");
    await pause(100);
    assert.equal(await run(overlay, "document.querySelectorAll('.mouse-button.active').length"), 5);
    assert.equal(await run(overlay, "byCode.get('KeyW').style.getPropertyValue('--color')"), 'rgb(0,150,255)');
    assert.equal(await run(overlay, "byCode.get('KeyA').style.getPropertyValue('--color')"), 'rgb(216,17,89)');
    await run(menu, "layoutSelect.value = 'keyboard'; layoutSelect.dispatchEvent(new Event('change'))");
    await waitFor(() => overlay.getSize()[0] === 500);
    await pause(100);
    assert.equal(await run(overlay, "getComputedStyle(document.querySelector('.mouse-area')).display"), 'none');
    await run(menu, "layoutSelect.value = 'keyboard-mouse'; layoutSelect.dispatchEvent(new Event('change'))");
    await waitFor(() => overlay.getSize()[0] === 600);
    await pause(100);
    assert.equal(await run(overlay, "document.querySelectorAll('.mouse-button.active').length"), 5);
    fs.writeFileSync(path.join(artifacts, 'keyboard-mouse-summer-pressed.png'), (await overlay.webContents.capturePage()).toPNG());
    for (const button of ['left', 'right', 'middle', 'side4', 'side5']) {
      hook.stdout.emit('data', JSON.stringify({ device: 'mouse', button, event: 'mouseup' }) + '\n');
    }
    await pause(100);
    assert.equal(await run(overlay, "document.querySelectorAll('.mouse-button.active').length"), 0);
    fs.writeFileSync(path.join(artifacts, 'keyboard-mouse-summer.png'), (await overlay.webContents.capturePage()).toPNG());
    await overlay.loadFile(path.join(root, 'index.html'));
    await pause(100);
    assert.equal(await run(overlay, 'document.body.dataset.layout'), 'keyboard-mouse');
    await run(overlay, "localStorage.setItem('keyboard-overlay.skin', 'original'); localStorage.removeItem('keyboard-overlay.skin-version')");
    await overlay.loadFile(path.join(root, 'index.html'));
    assert.equal(await run(overlay, 'savedSkin'), 'summer');
    for (const id of ['spring', 'summer', 'autumn', 'winter', 'custom', 'original']) {
      await run(menu, 'skinSelect.value = ' + JSON.stringify(id) + '; skinSelect.dispatchEvent(new Event("change"))');
      await pause(60);
      assert.equal(await run(overlay, 'document.body.dataset.skin'), id);
    }
    await run(menu, "deviceSelect.value = 'gamepad'; deviceSelect.dispatchEvent(new Event('change'))");
    await waitFor(() => overlay.getBrowserViews().length === 1);
    await pause(150);
    const gamepad = overlay.getBrowserViews()[0];
    assert.equal(await run(menu, 'layoutSelect.value'), 'dualsense');
    assert.equal(await run(menu, 'layoutSelect.options.length'), 2);
    assert.equal(await run(menu, 'skinSelect.options.length'), 15);
    assert.equal(await run(menu, 'skinSelect.disabled'), false);
    assert.equal(await run(overlay, "getComputedStyle(document.querySelector('.keyboard')).display"), 'none');
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).layout, 'dualsense');
    assert.deepEqual(gamepad.getBounds(), { x: 0, y: 0, width: 283, height: 283 });
    fs.writeFileSync(path.join(artifacts, 'settings-gamepad.png'), (await menu.webContents.capturePage()).toPNG());
    await run(menu, "widthInput.value = '400'; heightInput.value = '320'; applySize()");
    await pause(100);
    assert.equal(gamepad.getBounds().width, 400);
    await run(menu, "document.getElementById('move-overlay').click()");
    await pause(100);
    assert.equal(overlay.testIgnoresMouse, false);
    hook.stdout.emit('data', JSON.stringify({ vk: 13, event: 'keyup' }) + '\n');
    hook.stdout.emit('data', JSON.stringify({ vk: 13, event: 'keydown' }) + '\n');
    await pause(100);
    assert.equal(overlay.testIgnoresMouse, true);
    await run(menu, "deviceSelect.value = 'keyboard'; deviceSelect.dispatchEvent(new Event('change'))");
    await waitFor(() => overlay.getBrowserViews().length === 0);
    assert.equal(await run(menu, 'layoutSelect.value'), 'keyboard-mouse');
    assert.equal(await run(menu, 'skinSelect.disabled'), false);
    await run(menu, "deviceSelect.value = 'gamepad'; deviceSelect.dispatchEvent(new Event('change'))");
    await waitFor(() => overlay.getBrowserViews().length === 1);
    assert.equal(overlay.getBounds().width, 400);
    const liveGamepad = overlay.getBrowserViews()[0];
    for (let i = 0; i < 300 && liveGamepad.webContents.isLoading(); i++) await pause(100);
    console.log('DualSense page:', liveGamepad.webContents.getURL());
    console.log('DualSense document:', await liveGamepad.webContents.executeJavaScript('document.title + " | " + document.body.innerText.slice(0, 160)'));
    assert.equal(await liveGamepad.webContents.executeJavaScript('typeof window.keyboardOverlay'), 'undefined');
    assert.match(await liveGamepad.webContents.executeJavaScript('document.title'), /GamePad Viewer/);
    console.log('DualSense skin:', await liveGamepad.webContents.executeJavaScript('JSON.stringify([...document.styleSheets].map(sheet => sheet.href))'));
    await verifyGamepadResize(menu, overlay, liveGamepad, 'dualsense');
    await run(menu, "skinSelect.value = 'remix-green'; skinSelect.dispatchEvent(new Event('change'))");
    await pause(200);
    assert.equal(await run(liveGamepad, 'document.documentElement.dataset.gamepadSkin'), 'remix-green');
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).gamepadSkins.dualsense, 'remix-green');
    await run(menu, "layoutSelect.value = 'xbox'; layoutSelect.dispatchEvent(new Event('change'))");
    await pause(200);
    const xbox = overlay.getBrowserViews()[0];
    assert.notEqual(xbox, liveGamepad);
    assert.equal(await run(menu, 'skinSelect.options.length'), 14);
    assert.equal(await run(menu, 'skinSelect.value'), 'carbon-black');
    assert.equal(await run(overlay, 'document.body.dataset.layout'), 'xbox');
    await verifyGamepadResize(menu, overlay, xbox, 'xbox');
    await run(menu, "skinSelect.value = 'heart-breaker'; skinSelect.dispatchEvent(new Event('change'))");
    assert.equal(JSON.parse(fs.readFileSync(geometryFile)).gamepadSkins.xbox, 'heart-breaker');
    fs.writeFileSync(path.join(artifacts, 'settings-xbox.png'), (await menu.webContents.capturePage()).toPNG());
    await run(menu, "layoutSelect.value = 'dualsense'; layoutSelect.dispatchEvent(new Event('change'))");
    await pause(200);
    assert.equal(await run(menu, 'skinSelect.value'), 'remix-green');
    await run(menu, "layoutSelect.value = 'xbox'; layoutSelect.dispatchEvent(new Event('change'))");
    await pause(200);
    assert.equal(await run(menu, 'skinSelect.value'), 'heart-breaker');
    await run(overlay, 'localStorage.clear()');
    assert.deepEqual(errors, []);
    app.once('before-quit', () => {
      assert.equal(hook.killed, true);
      console.log('PASS: both layouts and sizes, black Original, legacy Original to Summer, five mouse buttons, held inputs across skin/layout changes, geometry persistence, move mode and Exit cleanup.');
      clearTimeout(timer);
    });
    void run(menu, "document.getElementById('quit-app').click()").catch(() => {});
  } catch (error) { console.error(error); clearTimeout(timer); app.exit(1); }
});
