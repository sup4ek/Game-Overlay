// Build separately while the user is running dist/win-unpacked.
const build = require('../Game Overlay/package.json').build;
module.exports = { ...build, directories: { output: '../build-resize-fix' }, files: ['**/*', '!dist/**'] };
