const keyColors = {
  Escape: [0,150,255], Digit1: [0,150,255], Digit2: [0,150,255],
  Digit3: [216,17,89], Digit4: [4,150,255], Digit5: [216,17,89],
  Tab: [0,150,255], KeyQ: [4,150,255], KeyW: [0,150,255],
  KeyE: [4,150,255], KeyR: [255,164,42], KeyT: [0,150,255],
  CapsLock: [216,17,89], KeyA: [216,17,89], KeyS: [216,17,89],
  KeyD: [216,17,89], KeyF: [255,164,42], KeyG: [216,17,89],
  ShiftLeft: [216,17,89], KeyZ: [4,150,255], KeyX: [255,164,42],
  KeyC: [216,17,89], KeyV: [4,150,255],
  ControlLeft: [255,164,42], MetaLeft: [0,150,255],
  AltLeft: [255,164,42], Space: [216,17,89]
};

const keys = [...document.querySelectorAll('.key')];
const byCode = new Map(keys.map(key => [key.dataset.key, key]));
const skins = window.overlaySkins;
const mouse = document.querySelector('.mouse');
const mouseParts = new Map([...document.querySelectorAll('[data-part]')].map(part => [part.dataset.part, part]));

function applySkin(id) {
  const skin = skins.find(item => item.id === id) || skins[0];
  document.body.dataset.skin = skin.id;
  document.body.classList.toggle('monochrome', !!skin.monochrome);
  keys.forEach(key => {
    const hash = [...key.dataset.key].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
    const c = skin.legacyKeyColors ? keyColors[key.dataset.key] || [0,150,255] : skin.palette[hash % skin.palette.length];
    key.style.setProperty('--color', 'rgb(' + c.join(',') + ')');
    key.style.setProperty('--glow', 'rgba(' + c.join(',') + ',.55)');
    key.style.setProperty('--inner', 'rgba(' + c.join(',') + ',.09)');
  });
  const palette = skin.mousePalette || skin.palette;
  ['left', 'right', 'middle', 'side4', 'side5'].forEach((role, index) => {
    mouse.style.setProperty('--' + role, 'rgb(' + palette[index % palette.length].join(',') + ')');
  });
  mouse.style.setProperty('--rim', 'rgb(' + palette[0].join(',') + ')');
  return skin.id;
}
let savedSkin = 'original';
try {
  const previous = localStorage.getItem('keyboard-overlay.skin');
  // Existing users of the colorful Original keep that look under its new name.
  savedSkin = previous === 'original' && localStorage.getItem('keyboard-overlay.skin-version') !== '2' ? 'summer' : previous || savedSkin;
  localStorage.setItem('keyboard-overlay.skin-version', '2');
  localStorage.setItem('keyboard-overlay.skin', savedSkin);
}
catch (error) { console.warn('Unable to read saved skin:', error); }
savedSkin = applySkin(savedSkin);
window.keyboardOverlay?.onSkinChanged(id => {
  savedSkin = applySkin(id);
  try { localStorage.setItem('keyboard-overlay.skin', savedSkin); }
  catch (error) { console.warn('Unable to save skin:', error); }
});
window.keyboardOverlay?.onKeyEvent(data => {
  if (!data || !data.code) return;
  byCode.get(data.code)?.classList.toggle('active', data.event === 'keydown');
});
window.keyboardOverlay?.onMouseEvent(data => {
  mouseParts.get(data?.button)?.classList.toggle('active', data.event === 'mousedown');
});
window.keyboardOverlay?.onLayoutChanged(id => {
  document.body.classList.toggle('layout-keyboard-mouse', id === 'keyboard-mouse');
  document.body.dataset.layout = id;
});
window.keyboardOverlay?.onLockStatusChanged(locked => {
  document.body.classList.toggle('drag-mode', !locked);
  document.body.classList.toggle('locked-mode', !!locked);
});
document.body.classList.add('locked-mode');
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.repeat && document.body.classList.contains('drag-mode')) {
    window.keyboardOverlay?.finishMove();
  }
});
window.keyboardOverlay?.ready(savedSkin);
