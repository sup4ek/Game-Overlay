const overlayLayouts = Object.freeze([
  { id: 'keyboard', device: 'keyboard', name: 'Keyboard', width: 386, height: 351, minWidth: 200 },
  { id: 'keyboard-mouse', device: 'keyboard', name: 'Keyboard + Mouse', width: 600, height: 351, minWidth: 320 },
  { id: 'dualsense', device: 'gamepad', name: 'DualSense', width: 283, height: 283, minWidth: 200, baseWidth: 794, baseHeight: 639 },
  { id: 'xbox', device: 'gamepad', name: 'Xbox', width: 320, height: 283, minWidth: 200, baseWidth: 900, baseHeight: 800 }
]);
if (typeof module !== 'undefined' && module.exports) module.exports = overlayLayouts;
else window.overlayLayouts = overlayLayouts;
