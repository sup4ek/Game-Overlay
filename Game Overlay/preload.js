const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keyboardOverlay', {
  ready(skin) { ipcRenderer.send('renderer-ready', skin); },
  selectSkin(id) { ipcRenderer.send('select-skin', id); },
  selectLayout(id) { return ipcRenderer.invoke('select-layout', id); },
  onLayoutChanged(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('layout-changed', listener);
    return () => ipcRenderer.removeListener('layout-changed', listener);
  },
  onMouseEvent(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('mouse-event', listener);
    return () => ipcRenderer.removeListener('mouse-event', listener);
  },
  closeSettings() { ipcRenderer.send('close-settings'); },
  resizeOverlay(size) { return ipcRenderer.invoke('resize-overlay', size); },
  retryGamepad() { ipcRenderer.send('retry-gamepad'); },
  startMove() { ipcRenderer.send('start-move'); },
  finishMove() { ipcRenderer.send('finish-move'); },
  quit() { ipcRenderer.send('quit-app'); },
  onSettingsError(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('settings-error', listener);
    return () => ipcRenderer.removeListener('settings-error', listener);
  },
  onSettingsState(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('settings-state', listener);
    return () => ipcRenderer.removeListener('settings-state', listener);
  },
  onSkinChanged(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('skin-changed', listener);
    return () => ipcRenderer.removeListener('skin-changed', listener);
  },
  onKeyEvent(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('key-event', listener);
    return () => ipcRenderer.removeListener('key-event', listener);
  },
  onLockStatusChanged(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('lock-status-changed', listener);
    return () => ipcRenderer.removeListener('lock-status-changed', listener);
  }
});
