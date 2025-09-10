// 定义窗口 API 类型
interface ElectronWindow {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

declare global {
  interface Window {
    electronWindow: ElectronWindow;
  }
}

export async function minimizeWindow() {
  await window.electronWindow.minimize();
}
export async function maximizeWindow() {
  await window.electronWindow.maximize();
}
export async function closeWindow() {
  await window.electronWindow.close();
}
