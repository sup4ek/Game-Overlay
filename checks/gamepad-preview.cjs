const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../Game Overlay');
const skins = require(path.join(root, 'gamepad-skins'));
const theme = require(path.join(root, 'gamepad-theme'));
const artifacts = path.join(__dirname, 'artifacts/gamepad-skins');
fs.mkdirSync(artifacts, { recursive: true });
app.setPath('userData', path.join(artifacts, 'profile'));
app.disableHardwareAcceleration();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const previewLayouts = process.env.OVERLAY_PREVIEW_LAYOUT === 'xbox' ? ['xbox'] : ['dualsense', 'xbox'];
const urls = {
  dualsense: require(path.join(root, 'dualsense-config')).OVERLAY_URL,
  xbox: 'https://gamepadviewer.com/?p=1&css=https%3A%2F%2Fjayraydee.me%2FAssets%2FFreeport%2FXSX-Black%2FXSX.css'
};
const deadline = setTimeout(() => app.exit(1), 110000);
app.whenReady().then(async () => {
  try {
    for (const layout of previewLayouts) {
      const width = layout === 'dualsense' ? 794 : 900;
      const height = layout === 'dualsense' ? 639 : 800;
      const win = new BrowserWindow({ width, height, show: false, frame: false, transparent: true,
        webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: true } });
      await win.loadURL(urls[layout]);
      const run = code => win.webContents.executeJavaScript(code);
      for (let i = 0; i < 200; i++) {
        const ready = await run(`(() => { const c=document.querySelector('.controller.${layout === 'dualsense' ? 'ds4' : 'custom'}'); if(!c)return false; const d=c.classList.contains('disconnected');c.classList.remove('disconnected');const bg=getComputedStyle(c).backgroundImage;if(d)c.classList.add('disconnected');return bg.includes('${layout === 'dualsense' ? 'ZDjUbh0' : 'data:image/png'}'); })()`);
        if (ready) break;
        if (i === 199) throw Error(layout + ' source CSS did not load');
        await pause(100);
      }
      // Isolate a connected visual specimen from hardware polling for snapshots.
      await run(`(() => {
        const c=document.querySelector('.controller.${layout === 'dualsense' ? 'ds4' : 'custom'}').cloneNode(true);
        c.classList.remove('disconnected'); c.classList.add('active'); c.id='preview-controller';
        document.body.replaceChildren(c);
        const style=document.createElement('style'); style.textContent='html,body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden!important}.controller{display:block!important;position:absolute!important;top:0!important;left:0!important;margin:0!important;transform:none!important}'; document.head.append(style);
      })()`);
      let originalImage, originalBumpers;
      for (const skin of skins[layout]) {
        await run(theme.script(skin, layout));
        await pause(160);
        assert.equal(await run('document.documentElement.dataset.gamepadSkin'), skin.id);
        if (!skin.original) assert.ok(await run("document.querySelector('.controller').style.getPropertyValue('--overlay-shell').length > 0"));
        if (layout === 'dualsense') {
          const centers = await run(`(() => {
            const c=document.querySelector('.controller').getBoundingClientRect();
            return ['a','b','x','y'].map(name => { const r=document.querySelector('.abxy .'+name).getBoundingClientRect();return [r.x-c.x+r.width/2,r.y-c.y+r.height/2]; });
          })()`);
          assert.deepEqual(centers, [[645,295],[704,238],[586,237],[645,179]]);
        } else {
          const background = await run("getComputedStyle(document.querySelector('.controller')).backgroundImage");
          assert.equal((background.match(/url\(/g) || []).length, 1, 'Xbox must have only the body background');
          assert.ok(background.startsWith('url("data:image/png;'));
          assert.equal(await run("getComputedStyle(document.querySelector('.controller')).animationName"), 'none');
        }
        await pause(250);
        const screenshot = await win.webContents.capturePage();
        fs.writeFileSync(path.join(artifacts, `${layout}-${skin.id}.png`), screenshot.toPNG());
        if (layout === 'dualsense') {
          if (skin.original) originalImage = screenshot;
          else {
            assert.deepEqual(screenshot.crop({x:260,y:275,width:274,height:155}).toBitmap(),
              originalImage.crop({x:260,y:275,width:274,height:155}).toBitmap(),
              skin.id + ': black stick insert must remain unchanged');
            for (const [x,y] of [[110,520],[100,550],[90,575],[80,600],[65,618]]) {
              for (const left of [x,794-x-20]) {
                const strip = {x:left,y,width:20,height:5};
                assert.deepEqual(screenshot.crop(strip).toBitmap(), originalImage.crop(strip).toBitmap(),
                  skin.id + ': lower black strip at '+left+','+y);
              }
            }
            for (const [x,y] of [[100,122],[110,118],[120,114],[130,110],[140,107],[150,104],[160,102],[170,102],[180,102],[190,102]]) {
              for (const left of [x,794-x-3]) {
                const bumper = {x:left,y,width:3,height:5};
                assert.deepEqual(screenshot.crop(bumper).toBitmap(), originalImage.crop(bumper).toBitmap(),
                  skin.id + ': unpressed L1/R1 at '+left+','+y);
              }
            }
            const before = originalImage.toBitmap(), after = screenshot.toBitmap();
            const stride = screenshot.getSize().width;
            let lights = 0;
            for (let y=110;y<405;y++) for (let x=225;x<570;x++) {
              const i=(y*stride+x)*4;
              // NativeImage uses BGRA: select the original magenta light pixels.
              if (before[i+2]>120 && before[i]>60 && before[i+2]>before[i+1]*1.5 && before[i]>before[i+1]*1.3) {
                assert.deepEqual(after.subarray(i,i+4), before.subarray(i,i+4), skin.id + ': light at '+x+','+y);
                lights++;
              }
            }
            assert.ok(lights>500, 'light regression must cover both strips and center LED');
          }
        }
        fs.writeFileSync(path.join(artifacts, `${layout}-${skin.id}.png`), screenshot.toPNG());
        if (layout === 'dualsense') {
          await run("document.querySelectorAll('.bumper').forEach(b => b.classList.add('pressed'))");
          await pause(120);
          const bumpers = await win.webContents.capturePage();
          if (skin.original) originalBumpers = bumpers;
          for (const rect of [{x:100,y:100,width:100,height:10},{x:594,y:100,width:100,height:10}]) {
            assert.deepEqual(bumpers.crop(rect).toBitmap(), originalBumpers.crop(rect).toBitmap(), skin.id + ': pressed L1/R1');
            assert.notDeepEqual(bumpers.crop(rect).toBitmap(), screenshot.crop(rect).toBitmap(), skin.id + ': bumper press must remain visible');
          }
          fs.writeFileSync(path.join(artifacts, `${layout}-${skin.id}-bumpers-pressed.png`), bumpers.toPNG());
          await run("document.querySelectorAll('.bumper').forEach(b => b.classList.remove('pressed'))");
        }
      }
      await run("document.querySelector('.button.a').classList.add('pressed'); document.querySelector('.stick.left').style.transform='translate(15px, -10px)'");
      await pause(100);
      const pressed = (await win.webContents.capturePage()).toPNG();
      assert.notDeepEqual(pressed, fs.readFileSync(path.join(artifacts, `${layout}-${skins[layout].at(-1).id}.png`)));
      fs.writeFileSync(path.join(artifacts, `${layout}-pressed.png`), pressed);
      if (layout === 'xbox') {
        await run("document.querySelectorAll('.bumper').forEach(button => button.classList.add('pressed'))");
        await pause(100);
        fs.writeFileSync(path.join(artifacts, 'xbox-bumpers-pressed.png'), (await win.webContents.capturePage()).toPNG());
      }
      console.log('PASS: ' + layout + ', ' + skins[layout].length + ' themes rendered');
      win.destroy();
    }
    for (const layout of previewLayouts) {
      const html = `<html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#202329;color:#eee;font:15px Arial;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}figure{margin:0;padding:8px;background:#30343b;border-radius:8px;text-align:center}img{width:100%;height:215px;object-fit:contain}figcaption{padding:7px}</style></head><body>${skins[layout].map(skin => `<figure><img src="${layout}-${skin.id}.png"><figcaption>${skin.name}</figcaption></figure>`).join('')}</body></html>`;
      const file = path.join(artifacts, `${layout}-catalog.html`);
      fs.writeFileSync(file, html);
      const sheet = new BrowserWindow({width:1080,height:1450,show:false,frame:false,webPreferences:{offscreen:true}});
      await sheet.loadFile(file); await pause(200);
      fs.writeFileSync(path.join(artifacts,`${layout}-catalog.png`),(await sheet.webContents.capturePage()).toPNG());
      sheet.destroy();
    }
    clearTimeout(deadline); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(deadline); app.exit(1); }
});
app.on('window-all-closed', () => {});
