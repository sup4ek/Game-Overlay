// Shared skins for the cropped keyboard and mouse. Summer is the former Original;
// Original is now monochrome. Seasonal palettes come from ../skins/babel.txt.
// Geometry and the original .key.active animation are shared by every skin.
const overlaySkins = Object.freeze([
  { id: 'original', name: 'Оригинальный', monochrome: true, palette: [[110,110,110]] },
  { id: 'spring', name: 'Spring', palette: [[174,195,214], [135,172,139], [204,213,132], [175,121,219], [92,140,154]] },
  { id: 'summer', name: 'Summer', legacyKeyColors: true, palette: [[0,150,255], [216,17,89], [255,164,42]], mousePalette: [[0,150,255], [216,17,89], [255,164,42], [0,150,255], [216,17,89]] },
  { id: 'autumn', name: 'Autumn', palette: [[96,108,56], [140,159,104], [214,210,184], [221,161,94], [188,108,37]] },
  { id: 'winter', name: 'Winter', palette: [[89,187,255], [190,233,232], [98,182,203], [202,233,255], [95,168,211]] },
  { id: 'custom', name: 'Custom', palette: [[0,83,255], [0,239,255], [0,255,135], [70,191,176]] }
]);
if (typeof module !== 'undefined' && module.exports) module.exports = overlaySkins;
else window.overlaySkins = overlaySkins;
