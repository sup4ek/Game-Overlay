// Runs inside the isolated Gamepad Viewer page. Changes appearance only;
// Gamepad Viewer's existing input mapping, sprites and stick motion remain active.
function installTheme(theme, layout) {
  window.__overlayTheme = { theme, layout };
  clearTimeout(window.__overlayThemeTimer);
  const svgUrl = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27') + '")';
  const colors = theme.colors;
  let paint = `linear-gradient(160deg, ${colors[0]}, ${colors[colors.length - 1]})`;
  if (theme.remix) paint = `linear-gradient(180deg, #090b0d 17%, ${colors[1]} 58%, ${colors[1]} 100%)`;
  if (theme.finish === 'shadow') paint = `linear-gradient(180deg, ${colors[0]} 25%, ${colors[1]} 43%, ${colors[2]} 78%)`;
  if (theme.finish === 'shift') paint = `radial-gradient(ellipse at 50% 27%, ${colors[0]}, ${colors[1]} 45%, ${colors[2]} 90%)`;
  if (theme.finish === 'metal') paint = `linear-gradient(115deg, ${colors[1]}, ${colors[0]} 27%, ${colors[1]} 48%, ${colors[0]} 70%, ${colors[1]})`;
  if (theme.finish === 'camo') {
    let shapes = '';
    let seed = 79;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 155; i++) {
      const x = random() * 900, y = random() * 800, size = 18 + random() * 72;
      shapes += `<path fill="${colors[i % colors.length]}" d="M${x},${y}l${size},${-size / 3}l${-size / 4},${size / 2}l${size / 2},${size / 3}l${-size},${size / 3}Z"/>`;
    }
    paint = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800"><rect width="900" height="800" fill="#422952"/>${shapes}</svg>`);
  }
  if (theme.finish === 'vapor') {
    paint = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800"><defs><filter id="marble"><feTurbulence type="fractalNoise" baseFrequency=".009 .017" numOctaves="3" seed="12"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues=".06 .15 .38 .60"/><feFuncG type="table" tableValues=".11 .23 .49 .70"/><feFuncB type="table" tableValues=".19 .36 .66 .84"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter></defs><rect width="900" height="800" filter="url(#marble)"/></svg>`);
  }

  // The shell overlays are clipped above the original black insert and triggers.
  // Keeping the original body underneath preserves holes and transparent edges.
  // Follow the inward curve alongside the touchpad before widening towards
  // the handles. The face buttons belong entirely on these outer panels.
  // Keep light strips and the black stick insert outside every finish, including pearl.
  // The lower seam bends outward to the handle tips; do not curve back into the black strip.
  // Trace below the curved L1/R1 silhouettes rather than painting from their top edge.
  const dsPlates = 'M0 138H90C120 123 168 114 204 113L228 119L240 209Q244 246 250 267C192 319 130 415 99 521C91 550 81 583 69 603Q60 617 50 624V639H0Z M566 119L590 113C626 114 674 123 704 138H794V639H744V624Q734 617 725 603C713 583 703 550 695 521C664 415 602 319 544 267Q550 246 554 209Z';
  const dsTouchpad = 'M248 109Q397 100 546 109L527 225Q524 251 499 253H292Q268 251 262 225Z';
  const circle = (x, y, r) => `M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;
  // Follow the curved seam below LB/RB instead of cutting straight across them.
  const xboxShell = 'M0 242H134C171 211 231 190 307 189Q450 185 593 189C669 190 729 211 766 242H900V800H0Z' + circle(450, 244, 36) + circle(331, 481, 73) + circle(385, 333, 23) + circle(515, 333, 23) + 'M436 368H464Q478 368 478 383Q478 398 464 398H436Q422 398 422 383Q422 368 436 368Z';
  const clip = layout === 'dualsense'
    ? `path("${dsPlates}${theme.remix ? '' : dsTouchpad}")`
    : `path(evenodd, "${xboxShell}")`;
  const selector = layout === 'dualsense' ? '.controller.ds4' : '.controller.custom';
  let style = document.getElementById('overlay-gamepad-theme');
  if (!style) { style = document.createElement('style'); style.id = 'overlay-gamepad-theme'; document.head.append(style); }
  style.textContent = `
    /* Keep the four live sprites aligned with the circles in the original body. */
    .controller.ds4 .abxy { left: 559px !important; top: 152px !important; width: 181px !important; height: 181px !important; }
    .controller.ds4 .abxy .button { width: 54px !important; height: 54px !important; margin: 0 !important; right: auto !important; bottom: auto !important; }
    .controller.ds4 .abxy .a { left: 59px !important; top: 116px !important; }
    .controller.ds4 .abxy .b { left: 118px !important; top: 59px !important; }
    .controller.ds4 .abxy .x { left: 0 !important; top: 58px !important; }
    .controller.ds4 .abxy .y { left: 59px !important; top: 0 !important; }
    /* The supplied Xbox CSS puts an animated promo before the body layer.
       Hide that layer during loading, then retain only the actual body image. */
    .controller.custom { animation: none !important; background-position: 0 -2000px, 0 0 !important; }
    .controller.custom[data-overlay-shell]:not(.disconnected) { background-image: var(--overlay-shell) !important; background-position: 0 0 !important; }
    ${selector} { isolation: isolate; }
    ${selector} > div { z-index: 2; }
    ${selector}::before, ${selector}::after {
      content: ''; display: ${theme.original ? 'none' : 'block'}; position: absolute;
      inset: 0; pointer-events: none; z-index: 0; clip-path: ${clip};
    }
    ${selector}::before {
      background-image: var(--overlay-shell); background-position: 0 0; background-repeat: no-repeat;
      filter: grayscale(1) contrast(.72) brightness(3.9);
    }
    ${selector}::after {
      background: ${paint}; background-size: 100% 100%; mix-blend-mode: multiply;
      -webkit-mask-image: var(--overlay-shell); -webkit-mask-position: 0 0; -webkit-mask-repeat: no-repeat;
    }
    ${selector}.disconnected::before, ${selector}.disconnected::after { display: none; }
  `;
  document.documentElement.dataset.gamepadSkin = theme.id;
  let attempts = 0;
  function findShell() {
    let ready = false;
    for (const controller of document.querySelectorAll(selector)) {
      // The disconnected rule replaces the body image. Read the connected rule
      // synchronously, then restore the input engine's actual connection state.
      const disconnected = controller.classList.contains('disconnected');
      controller.classList.remove('disconnected');
      const background = getComputedStyle(controller).backgroundImage;
      if (disconnected) controller.classList.add('disconnected');
      const urls = [...background.matchAll(/url\("([^"]*)"\)/g)].map(match => match[0]);
      const shell = layout === 'dualsense' ? 'url("https://philipbry.github.io/ZDjUbh0.png")' : urls[urls.length - 1];
      if (shell && (layout === 'dualsense' || shell.includes('data:image/png'))) {
        controller.style.setProperty('--overlay-shell', shell);
        controller.setAttribute('data-overlay-shell', 'ready');
        ready = true;
      }
    }
    if (!ready && ++attempts < 150) window.__overlayThemeTimer = setTimeout(findShell, 100);
  }
  findShell();
}

module.exports = { script: (theme, layout) => `(${installTheme.toString()})(${JSON.stringify(theme)}, ${JSON.stringify(layout)})` };
