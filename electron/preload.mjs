import { contextBridge, ipcRenderer } from 'electron';
// FIX: Removed `import process from 'process';`. The global `process` object provided by the Node.js environment should be used instead, which resolves the type error for `process.versions`.

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // This object is now empty after reverting the watch folders feature.
  // Other Electron APIs can be added here in the future if needed.
});

// Minimal preload script
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
});