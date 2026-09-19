import { chromium } from "playwright-core";

const email = process.env.SEVAFIX_TEST_EMAIL;
const password = process.env.SEVAFIX_TEST_PASSWORD;
const baseUrl = process.env.SEVAFIX_FRONTEND_URL ?? "http://localhost:3000";
const executablePath = process.env.SEVAFIX_BROWSER_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

if (!email || !password) throw new Error("SEVAFIX_TEST_EMAIL and SEVAFIX_TEST_PASSWORD are required");

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));

const chooseBoolean = async (label, answer) => {
  await page.getByRole("group", { name: label }).getByRole("button", { name: answer, exact: true }).click();
};

try {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await page.getByRole("heading", { name: /Welcome/ }).waitFor();

  await page.getByRole("link", { name: "New application", exact: true }).click();
  await page.getByRole("heading", { name: "Create a new application" }).waitFor();
  await page.getByRole("link", { name: "Start application" }).click();
  await page.getByRole("button", { name: "Create draft application" }).click();
  await page.waitForURL("**/applications/*/edit", { timeout: 30_000 });

  await page.getByLabel(/Application type/).selectOption("FRESH");
  await page.getByLabel(/Name as on Class XII/).fill("Aditi Sharma");
  await page.getByLabel(/Gross annual family income/).fill("350000");
  await page.getByLabel(/Class XII board percentile/).fill("91");
  await chooseBoolean(/Took a drop after Class XII/, "No");
  await chooseBoolean(/Receiving another scholarship/, "No");
  await chooseBoolean(/NSP One-Time Registration/, "Yes");
  await page.getByLabel(/Category/).selectOption("GENERAL");
  await chooseBoolean(/Claiming benchmark-disability/, "No");
  await chooseBoolean(/Bank account is ready for DBT/, "Yes");
  await page.getByLabel(/Enrolment mode/).selectOption("REGULAR");
  await page.getByLabel(/Course type/).selectOption("DEGREE");
  await page.getByLabel(/Current course year/).fill("1");
  await page.getByLabel(/Institution name/).fill("Fictional National College");
  await page.getByLabel(/AISHE code/).fill("C-DEMO-001");
  await chooseBoolean(/Recognized by the relevant regulatory body/, "Yes");
  await chooseBoolean(/Institution status is active on AISHE/, "Yes");
  await page.getByText(/Last saved/).waitFor({ timeout: 30_000 });

  await page.getByRole("link", { name: "Documents", exact: true }).click();
  const incomeDocumentSlot = page.getByText("Family income certificate").locator("..");
  await incomeDocumentSlot.locator('input[type="file"]').setInputFiles(
    "../SevaFix — Government Application Companion (First Commit by AWS).pdf",
  );
  await page.getByText("INCOME_CERTIFICATE").waitFor({ timeout: 30_000 });
  await page
    .getByText(/Extracted|Needs your confirmation|Unsupported language|Reading failed/)
    .waitFor({ timeout: 180_000 });
  const documentPopup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "View", exact: true }).click();
  const openedDocument = await documentPopup;
  await openedDocument.close();

  await page.getByRole("link", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Run validation" }).click();
  await page.getByText(/blocked/).waitFor({ timeout: 30_000 });

  await page.getByRole("link", { name: "Review & freeze" }).click();
  await page.getByRole("button", { name: "Freeze this version" }).click();
  await page.getByRole("button", { name: "Freeze version" }).click();
  await page.getByText("Version 1").waitFor({ timeout: 30_000 });

  await page.getByRole("link", { name: "Tracking", exact: true }).click();
  await page.getByLabel("Official application ID").fill(`NSP-SMOKE-${Date.now()}`);
  await page.getByLabel("Submitted at").fill("2026-09-19T12:00");
  await page.getByRole("button", { name: "Record submission" }).click();
  await page.getByText(/Recorded:/).waitFor({ timeout: 30_000 });
  await page.getByLabel("Details").fill("Live frontend timeline smoke test");
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByText(/Live frontend timeline smoke test/).waitFor({ timeout: 30_000 });

  await page.getByRole("link", { name: "Diagnose", exact: true }).click();
  await page.getByLabel("Rejection reason").fill("The application was returned because family income does not match the income certificate.");
  await page.getByRole("button", { name: "Diagnose", exact: true }).click();
  await page.getByText("Latest diagnosis").waitFor({ timeout: 120_000 });
  await page
    .getByText(/MISSING DOCUMENT|INCOME MISMATCH|NAME MISMATCH|INELIGIBLE COURSE|OTHER SCHOLARSHIP CONFLICT|PERCENTILE NOT VERIFIED|APPLICATION DATA ERROR|DEADLINE OR PROCESS|UNKNOWN/i)
    .waitFor();
  await page.getByText(/AI-assisted with openai.gpt-oss-20b/).waitFor();
  await page.getByText(/Sources:/).waitFor();

  await page.goto(`${baseUrl}/review/policies`);
  await page.getByRole("heading", { name: "Policies", exact: true }).waitFor({ timeout: 30_000 });
  await page.goto(`${baseUrl}/review/source-changes`);
  await page.getByRole("heading", { name: "Source changes", exact: true }).waitFor({ timeout: 30_000 });

  await page.goto(`${baseUrl}/grievances`);
  await page.getByRole("heading", { name: "Diagnose a failed application", exact: true }).waitFor();
  await page.getByLabel("Official application ID").fill(`NSP-EXTERNAL-${Date.now()}`);
  await page.getByLabel("Rejection reason").fill("The application was returned because the income certificate did not match.");
  await page.getByRole("button", { name: "Continue to AI diagnosis" }).click();
  await page.waitForURL("**/applications/*/diagnose", { timeout: 30_000 });
  const importedReason = await page.getByLabel("Rejection reason").inputValue();
  if (!importedReason.includes("income certificate")) throw new Error("Imported grievance reason was not carried into diagnosis");

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByLabel('Type "DELETE" to confirm').fill("DELETE");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.waitForURL("**/login", { timeout: 30_000 });

  if (browserErrors.length) throw new Error(`Browser page errors: ${browserErrors.join(" | ")}`);
  console.log(JSON.stringify({ status: "PASS", routes: ["login", "dashboard", "new-application", "draft", "documents", "check", "review", "tracking", "diagnose", "reviewer-policies", "reviewer-source-changes", "direct-grievance", "settings"], documentPipeline: "PASS", aiDiagnosis: "PASS", directGrievance: "PASS", reviewerAccess: "PASS", deletionQueued: "PASS" }, null, 2));
} catch (error) {
  await page.screenshot({ path: "../artifacts/frontend-smoke-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
