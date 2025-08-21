import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

export async function installExtensions(): Promise<void> {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extension installed successfully: ${result.name}`);
  } catch (error) {
    console.error("Failed to install extensions:", error);
  }
}
