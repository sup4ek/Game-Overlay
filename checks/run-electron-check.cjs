const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dependencies = path.resolve(__dirname, '../Game Overlay/node_modules');
const name = process.argv[2];
if (!['renderer-smoke.cjs', 'gamepad-preview.cjs'].includes(name)) throw Error('Unknown check');
const result = spawnSync(path.join(dependencies, 'electron/dist/electron.exe'), [path.join(__dirname, name)], {
  windowsHide: true, encoding: 'utf8', timeout: 120000,
  env: { ...process.env, NODE_PATH: dependencies }
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
console.log('Electron exit code:', result.status);
if (result.error) console.error(result.error);
process.exitCode = result.status === 0 ? 0 : 1;
