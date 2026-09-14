// Размер окна оверлея. Сохранены размеры исходного визуального проекта.
const WIDTH_CM = 10.2;
const HEIGHT_CM = 9.3;
const CM_TO_PX = 96 / 2.54;

const WIDTH = Math.round(WIDTH_CM * CM_TO_PX);
const HEIGHT = Math.round(HEIGHT_CM * CM_TO_PX);

module.exports = {
  // Старый формат — оставлен для совместимости.
  WIDTH,
  HEIGHT,

  // Формат, который использует main.js.
  window: {
    width: WIDTH,
    height: HEIGHT,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    resizable: false
  },

  // Управление остальными действиями находится в меню.
  hotkeys: {
    menu: 'Control+Alt+M'
  }
};
