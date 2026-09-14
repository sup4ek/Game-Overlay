// Scale the complete controller, including its sprites and skin masks.
// Page zoom is deliberately left at 1: Electron shares it between same-origin pages.
function installSize(baseWidth, baseHeight) {
  if (window.__overlayResizeListener) window.removeEventListener('resize', window.__overlayResizeListener);
  let style = document.getElementById('overlay-gamepad-size');
  if (!style) {
    style = document.createElement('style');
    style.id = 'overlay-gamepad-size';
    document.head.append(style);
  }
  window.__overlayResize = (width = window.innerWidth, height = window.innerHeight) => {
    const scaleX = width * 0.96 / baseWidth;
    const scaleY = height * 0.96 / baseHeight;
    style.textContent = `
      html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      .controller {
        position: fixed !important;
        left: 2vw !important; top: 2vh !important;
        right: auto !important; bottom: auto !important; margin: 0 !important;
        width: ${baseWidth}px !important; height: ${baseHeight}px !important;
        max-width: none !important; max-height: none !important;
        transform-origin: 0 0 !important;
        transform: scale(${scaleX}, ${scaleY}) !important;
      }
    `;
  };
  window.__overlayResizeListener = () => window.__overlayResize();
  window.addEventListener('resize', window.__overlayResizeListener);
  window.__overlayResize();
}

module.exports = {
  script: layout => `(${installSize.toString()})(${layout.baseWidth}, ${layout.baseHeight})`,
  resizeScript: (width, height) => `window.__overlayResize?.(${width}, ${height})`
};
