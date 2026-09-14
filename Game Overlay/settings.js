const skinSelect = document.getElementById('skin-select');
const closeSettings = document.getElementById('close-settings');
const swatches = document.getElementById('skin-swatches');
const skins = window.overlaySkins;
const layoutSelect = document.getElementById('layout-select');
const deviceSelect = document.getElementById('device-select');
const rememberedLayouts = { keyboard: 'keyboard', gamepad: 'dualsense' };
function syncDeviceControls() {
  const layout = window.overlayLayouts.find(item => item.id === currentLayout);
  deviceSelect.value = layout.device;
  rememberedLayouts[layout.device] = layout.id;
  layoutSelect.replaceChildren();
  for (const item of window.overlayLayouts.filter(item => item.device === layout.device)) {
    layoutSelect.add(new Option(item.name, item.id));
  }
  layoutSelect.value = currentLayout;
}
let currentLayout = 'keyboard';
const widthInput = document.getElementById('overlay-width');
const heightInput = document.getElementById('overlay-height');
const message = document.getElementById('settings-message');
let currentSize = null;
let pendingResize = null;
function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}
async function applySize(reportInvalid = true) {
  if (pendingResize) { await pendingResize.catch(() => {}); return applySize(reportInvalid); }
  const width = widthInput.valueAsNumber;
  const height = heightInput.valueAsNumber;
  if (!widthInput.checkValidity() || !heightInput.checkValidity() || !Number.isInteger(width) || !Number.isInteger(height)) {
    if (reportInvalid) showMessage(`Ширина: ${widthInput.min}–${widthInput.max}, высота: ${heightInput.min}–${heightInput.max} px.`, true);
    return false;
  }
  if (currentSize?.width === width && currentSize?.height === height) {
    showMessage('');
    return true;
  }
  pendingResize = window.keyboardOverlay.resizeOverlay({ width, height });
  try {
    const result = await pendingResize;
    showMessage(result.error || (result.ok ? 'Размер сохранён.' : 'Не удалось изменить размер.'), !result.ok || !!result.error);
    return result.ok;
  } catch {
    showMessage('Не удалось изменить размер. Попробуйте ещё раз.', true);
    return false;
  } finally { pendingResize = null; }
}
for (const skin of skins) skinSelect.add(new Option(skin.name, skin.id));
syncDeviceControls();

window.keyboardOverlay.onSettingsState(state => {
  currentLayout = state.layout;
  Object.assign(rememberedLayouts, state.rememberedLayouts);
  syncDeviceControls();
  const gamepad = deviceSelect.value === 'gamepad';
  const availableSkins = gamepad ? window.gamepadSkins[currentLayout] : skins;
  const skin = availableSkins.find(item => item.id === state.skin) || availableSkins[0];
  skinSelect.replaceChildren();
  for (const item of availableSkins) skinSelect.add(new Option(item.name, item.id));
  skinSelect.disabled = false;
  skinSelect.value = skin.id;
  skinSelect.setAttribute('aria-label', gamepad ? 'Скин геймпада' : 'Скин клавиатуры');
  const status = document.getElementById('gamepad-status');
  status.hidden = !gamepad || !state.gamepadError;
  const reconnect = document.getElementById('retry-gamepad');
  reconnect.title = gamepad ? 'Переподключить геймпад' : 'Переподключить клавиатуру и мышь';
  reconnect.setAttribute('aria-label', reconnect.title);
  document.getElementById('gamepad-status-text').textContent = state.gamepadError || '';
  status.classList.toggle('error', !!state.gamepadError);
  currentSize = { width: state.width, height: state.height };
  if (document.activeElement !== widthInput) widthInput.value = state.width;
  if (document.activeElement !== heightInput) heightInput.value = state.height;
  widthInput.min = state.minWidth; widthInput.max = state.maxWidth;
  heightInput.min = state.minHeight; heightInput.max = state.maxHeight;
  swatches.replaceChildren();
  for (const color of (gamepad ? skin.colors : skin.palette || [[0,150,255], [216,17,89], [255,164,42]]).slice(0, 3)) {
    const swatch = document.createElement('i');
    swatch.style.backgroundColor = typeof color === 'string' ? color : `rgb(${color.join(',')})`;
    swatches.append(swatch);
  }
});
document.getElementById('retry-gamepad').addEventListener('click', () => window.keyboardOverlay.retryGamepad());
skinSelect.addEventListener('change', () => window.keyboardOverlay.selectSkin(skinSelect.value));
async function changeLayout(target) {
  layoutSelect.disabled = true;
  deviceSelect.disabled = true;
  try {
    if (!(await applySize())) { layoutSelect.value = currentLayout; return; }
    const result = await window.keyboardOverlay.selectLayout(target);
    if (!result.ok) layoutSelect.value = currentLayout;
    showMessage(result.error || (result.ok ? 'Форм-фактор сохранён.' : 'Не удалось изменить форм-фактор.'), !result.ok || !!result.error);
  } catch {
    layoutSelect.value = currentLayout;
    showMessage('Не удалось изменить форм-фактор.', true);
  } finally { syncDeviceControls(); layoutSelect.disabled = false; deviceSelect.disabled = false; }
}
layoutSelect.addEventListener('change', () => changeLayout(layoutSelect.value));
deviceSelect.addEventListener('change', () => changeLayout(rememberedLayouts[deviceSelect.value]));
for (const input of [widthInput, heightInput]) {
  input.addEventListener('input', () => { void applySize(false); });
  input.addEventListener('blur', () => { void applySize(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void applySize(); }
  });
}
document.getElementById('move-overlay').addEventListener('click', async () => {
  if (await applySize()) window.keyboardOverlay.startMove();
});
document.getElementById('quit-app').addEventListener('click', () => window.keyboardOverlay.quit());
window.keyboardOverlay.onSettingsError(text => showMessage(text, true));
closeSettings.addEventListener('click', () => window.keyboardOverlay.closeSettings());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault(); window.keyboardOverlay.closeSettings();
  }
});
window.addEventListener('focus', () => deviceSelect.focus());
window.keyboardOverlay.ready();
