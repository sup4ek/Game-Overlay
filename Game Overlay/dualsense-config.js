// Ссылка из README philipbry/dualsense_overlay.
// Вариант А — без стороннего софта (DualSense напрямую, современный Chrome
// нормально маппит кнопки, включая d-pad):
const URL_PLAIN = 'https://gamepadviewer.com/?p=1&s=5&editcss=https%3A%2F%2Fphilipbry.github.io%2Fdualsense_skin.css';

// Вариант Б — с DS4Windows (геймпад виден как Xbox 360, самый проверенный путь):
const URL_DS4W = 'https://gamepadviewer.com/?p=1&s=5&editcss=https%3A%2F%2Fphilipbry.github.io%2Fdualsense_skin.css&map=%7B%22mapping%22%3A%5B%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%220%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%221%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%221%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%222%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%222%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%220%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%223%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%223%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%224%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%224%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%225%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%225%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%226%22%2C%22disabled%22%3Afalse%2C%22axesConfig%22%3A%7B%22type%22%3A%22trigger%22%2C%22lowValue%22%3A%22-1%22%2C%22highValue%22%3A%221%22%7D%2C%22choiceOperand%22%3A%22-%22%2C%22choiceType%22%3A%22axes%22%2C%22choice%22%3A%223%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%227%22%2C%22disabled%22%3Afalse%2C%22axesConfig%22%3A%7B%22type%22%3A%22trigger%22%2C%22lowValue%22%3A%22-1%22%2C%22highValue%22%3A%221%22%7D%2C%22choiceOperand%22%3A%22-%22%2C%22choiceType%22%3A%22axes%22%2C%22choice%22%3A%224%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%228%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%228%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%229%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%229%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%2210%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%2210%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%2211%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%2211%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%2216%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%2212%22%7D%2C%7B%22targetType%22%3A%22buttons%22%2C%22target%22%3A%2217%22%2C%22disabled%22%3Afalse%2C%22choiceType%22%3A%22buttons%22%2C%22choice%22%3A%2213%22%7D%5D%7D';

// ---- Размер оверлея ----------------------------------------------------
// Хочется «5 на 5 сантиметров». Electron работает в логических пикселях
// (DIP), где 1 дюйм = 96 px. Значит 1 см = 96 / 2.54 ≈ 37.8 px,
// и 7.5 см ≈ 283 px. При масштабе Windows 125%/150% физические пиксели
// будут больше, но физический размер на экране останется тем же.
const SIZE_CM = 7.5;
const SIZE_PX = Math.round(SIZE_CM * 96 / 2.54); // ≈ 283

module.exports = {
  OVERLAY_URL: URL_PLAIN, // поменяй на URL_DS4W, если пользуешься DS4Windows
  WIDTH: SIZE_PX,
  HEIGHT: SIZE_PX
};
