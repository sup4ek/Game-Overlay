const fs = require('fs');
const path = require('path');
const layouts = require('./layouts');
const gamepadSkins = require('./gamepad-skins');

const MIN_WIDTH = 200;
const MIN_HEIGHT = 180;

function fitBounds(bounds, area, minWidth = MIN_WIDTH) {
  const width = Math.min(area.width, Math.max(minWidth, Math.round(bounds.width)));
  const height = Math.min(area.height, Math.max(MIN_HEIGHT, Math.round(bounds.height)));
  return {
    width, height,
    x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)))
  };
}

function readBounds(file, defaults) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || !['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(data[key]))) return defaults;
    if (Math.abs(data.x) > 10000000 || Math.abs(data.y) > 10000000) return defaults;
    if (data.width < MIN_WIDTH || data.height < MIN_HEIGHT || data.width > 32768 || data.height > 32768) return defaults;
    return { x: data.x, y: data.y, width: data.width, height: data.height };
  } catch { return defaults; }
}

function readLayoutState(file) {
  const result = { layout: 'keyboard', sizes: {}, gamepadSkins: {} };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (layouts.some(layout => layout.id === data?.layout)) result.layout = data.layout;
    const remembered = {};
    for (const device of ['keyboard', 'gamepad']) {
      const id = data?.rememberedLayouts?.[device];
      if (layouts.some(item => item.device === device && item.id === id)) remembered[device] = id;
    }
    if (Object.keys(remembered).length) result.rememberedLayouts = remembered;
    for (const [device, skins] of Object.entries(gamepadSkins)) {
      const id = data?.gamepadSkins?.[device];
      if (skins.some(skin => skin.id === id)) result.gamepadSkins[device] = id;
    }
    for (const layout of layouts) {
      const size = data?.layoutSizes?.[layout.id];
      if (size && Number.isInteger(size.width) && Number.isInteger(size.height) &&
          size.width >= layout.minWidth && size.width <= 32768 && size.height >= MIN_HEIGHT && size.height <= 32768) {
        result.sizes[layout.id] = { width: size.width, height: size.height };
      }
    }
  } catch { /* Previous versions have no layout state. */ }
  return result;
}

function saveBounds(file, bounds, layout = 'keyboard', layoutSizes = {}, gamepadSkins = {}, rememberedLayouts = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify({ version: 4, ...bounds, layout, layoutSizes, gamepadSkins, rememberedLayouts }, null, 2), 'utf8');
  fs.renameSync(temporary, file);
}

module.exports = { MIN_WIDTH, MIN_HEIGHT, fitBounds, readBounds, readLayoutState, saveBounds };
