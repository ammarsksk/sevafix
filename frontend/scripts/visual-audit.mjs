import { chromium } from "playwright-core";

const baseUrl = process.env.SEVAFIX_FRONTEND_URL ?? "http://localhost:3000";
const executablePath = process.env.SEVAFIX_BROWSER_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ executablePath, headless: true });

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.screenshot({ path: `../artifacts/ui-home-${viewport.name}.png`, fullPage: true });
    if (errors.length) throw new Error(`${viewport.name}: ${errors.join(" | ")}`);
    await page.close();
  }
  console.log(JSON.stringify({ status: "PASS", viewports: ["1440x1000", "390x844"] }, null, 2));
} finally {
  await browser.close();
}
