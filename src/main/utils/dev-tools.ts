import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import { getLogger } from "./logger";

const devToolsLogger = getLogger("dev-tools");

export async function installExtensions(): Promise<void> {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    devToolsLogger.info("Extension installed successfully", { name: result.name });
  } catch (error) {
    devToolsLogger.error("Failed to install extensions", error);
  }
}
