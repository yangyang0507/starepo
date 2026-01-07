import { test, expect, _electron as electron } from "@playwright/test";
import { ElectronApplication, Page } from "playwright";
import path from "path";

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, "../../../out/main/index.js")],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("AI Settings E2E", () => {
  test("should navigate to settings page", async () => {
    await page.click('a[href="/settings"]');

    await expect(page).toHaveURL(/.*settings.*/);

    await expect(page.locator("text=设置")).toBeVisible();
  });

  test("should display AI providers list", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    await expect(page.locator("text=OpenAI")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Anthropic")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should allow selecting a provider", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    const openaiCard = page.locator('[data-provider-id="openai"]').first();
    await openaiCard.click();

    await expect(page.locator("text=API Key")).toBeVisible();
    await expect(page.locator("text=协议类型")).toBeVisible();
  });

  test("should save API key configuration", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    const openaiCard = page.locator('[data-provider-id="openai"]').first();
    await openaiCard.click();

    const apiKeyInput = page.locator('input[placeholder*="API Key"]');
    await apiKeyInput.fill("sk-test-key-for-e2e-testing");

    await page.waitForTimeout(1500);

    await expect(page.locator("text=已自动保存")).toBeVisible({
      timeout: 3000,
    });
  });

  test("should toggle provider enabled state", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    const openaiCard = page.locator('[data-provider-id="openai"]').first();
    await openaiCard.click();

    const enableSwitch = page.locator('button[role="switch"]').first();
    const initialState = await enableSwitch.getAttribute("aria-checked");

    await enableSwitch.click();

    const newState = await enableSwitch.getAttribute("aria-checked");
    expect(newState).not.toBe(initialState);
  });

  test("should test provider connection", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    const openaiCard = page.locator('[data-provider-id="openai"]').first();
    await openaiCard.click();

    const apiKeyInput = page.locator('input[placeholder*="API Key"]');
    await apiKeyInput.fill("sk-test-valid-key");
    await page.waitForTimeout(1500);

    const testButton = page.locator('button:has-text("测试连接")');
    await testButton.click();

    const result = page.locator("text=/连接成功|连接失败/");
    await expect(result).toBeVisible({ timeout: 10000 });
  });

  test("should load models list after API key is set", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    const openaiCard = page.locator('[data-provider-id="openai"]').first();
    await openaiCard.click();

    const apiKeyInput = page.locator('input[placeholder*="API Key"]');
    await apiKeyInput.fill("sk-test-key-with-models");
    await page.waitForTimeout(1500);

    const modelsSection = page.locator("text=可用模型");
    await expect(modelsSection).toBeVisible({ timeout: 5000 });
  });

  test("should handle errors gracefully", async () => {
    await page.click('a[href="/settings"]');
    await page.click('button:has-text("AI 设置")');

    const openaiCard = page.locator('[data-provider-id="openai"]').first();
    await openaiCard.click();

    const apiKeyInput = page.locator('input[placeholder*="API Key"]');
    await apiKeyInput.fill("invalid-key");
    await page.waitForTimeout(1500);

    const testButton = page.locator('button:has-text("测试连接")');
    await testButton.click();

    const errorMessage = page.locator("text=/错误|失败|无效/");
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
