export async function minimizeWindow() {
  await (window as any).electronWindow.minimize();
}
export async function maximizeWindow() {
  await (window as any).electronWindow.maximize();
}
export async function closeWindow() {
  await (window as any).electronWindow.close();
}
