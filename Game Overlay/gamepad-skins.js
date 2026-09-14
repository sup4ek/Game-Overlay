// Names and colors follow the user's photos in «Макеты джойстика».
// Palettes are applied to the existing animated controller, not to a static photo.
const gamepadSkins = Object.freeze({
  dualsense: [
    { id: 'black-midnight', name: 'Black Midnight', colors: ['#242529'], original: true },
    { id: 'white', name: 'White', colors: ['#f0f1f7', '#c6cbd8'] },
    { id: 'remix-green', name: 'Remix Green', colors: ['#090b0a', '#a3df2c'], remix: true },
    { id: 'techno-red', name: 'Techno Red', colors: ['#090909', '#f22442'], remix: true },
    { id: 'rhythm-blue', name: 'Rhythm Blue', colors: ['#080d11', '#00bfe9'], remix: true },
    { id: 'rich-blue-green', name: 'Rich blue-green', colors: ['#85cda2', '#13a8ad', '#073d49'], finish: 'shift' },
    { id: 'rich-pearl', name: 'Rich pearl', colors: ['#e1f4ec', '#e6deef', '#d0dce6'], finish: 'shift' },
    { id: 'rich-indigo', name: 'Rich indigo', colors: ['#46a4f8', '#5a49d7', '#29195e'], finish: 'shift' },
    { id: 'coin-silver', name: 'Coin silver', colors: ['#d4dbe9', '#8f99ae'], finish: 'metal' },
    { id: 'volcanic-red', name: 'Volcanic Red', colors: ['#ed2048', '#950724'], finish: 'metal' },
    { id: 'cobalt-blue', name: 'Cobalt blue', colors: ['#4345ef', '#171e9d'], finish: 'metal' },
    { id: 'galactic-purple', name: 'Galactic purple', colors: ['#7545c6', '#452186'] },
    { id: 'pink-supernova', name: 'Pink supernova', colors: ['#fa52b1', '#cf2483'] },
    { id: 'starry-blue', name: 'Starry Blue', colors: ['#59ccf6', '#289cd5'] },
    { id: 'cosmic-red', name: 'Cosmic red', colors: ['#c92b68', '#820d36'] }
  ],
  xbox: [
    { id: 'carbon-black', name: 'Carbon Black', colors: ['#303234'], original: true },
    { id: 'robot-white', name: 'Robot White', colors: ['#f3f4fa', '#cdd1df'] },
    { id: 'aqua-shift', name: 'Aqua Shift', colors: ['#8ceff0', '#58a6dc', '#244c86'], finish: 'shift' },
    { id: 'astral-purple', name: 'Astral Purple', colors: ['#79568f', '#452950'] },
    { id: 'deep-pink', name: 'Deep Pink', colors: ['#ff66a5', '#d52b6b'] },
    { id: 'electric-volt', name: 'Electric Volt', colors: ['#e4fa42', '#b6d700'] },
    { id: 'gold-shadow', name: 'Gold Shadow', colors: ['#dfcc91', '#a79765', '#10100e'], finish: 'shadow' },
    { id: 'heart-breaker', name: 'Heart Breaker', colors: ['#d63198', '#713b83', '#28a9bc'], finish: 'camo' },
    { id: 'lunar-shift', name: 'Lunar Shift', colors: ['#ede9cd', '#adafa6', '#3b3e40'], finish: 'shift' },
    { id: 'pulse-red', name: 'Pulse Red', colors: ['#f53224', '#b8120c'] },
    { id: 'shock-blue', name: 'Shock Blue', colors: ['#437edf', '#18458b'] },
    { id: 'stellar-shift', name: 'Stellar Shift', colors: ['#58c1f0', '#6964b2', '#342947'], finish: 'shift' },
    { id: 'stormcloud-vapor', name: 'Stormcloud Vapor', colors: ['#839bbd', '#435e82', '#203752'], finish: 'vapor' },
    { id: 'velocity-green', name: 'Velocity Green', colors: ['#65ef62', '#24a133'] }
  ]
});
if (typeof module !== 'undefined' && module.exports) module.exports = gamepadSkins;
else window.gamepadSkins = gamepadSkins;
