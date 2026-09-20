import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const email = process.env.SEVAFIX_TEST_EMAIL;
const password = process.env.SEVAFIX_TEST_PASSWORD;
const baseUrl = process.env.SEVAFIX_FRONTEND_URL ?? "http://localhost:3000";
const executablePath = process.env.SEVAFIX_BROWSER_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

if (!email || !password) {
  throw new Error("SEVAFIX_TEST_EMAIL and SEVAFIX_TEST_PASSWORD are required");
}

const artifactDir = path.resolve("../artifacts/mock-run");
const documentDir = path.resolve("../output/pdf");
await fs.mkdir(artifactDir, { recursive: true });

const documents = [
  ["Class XII marksheet", "sevafix_mock_class_xii_marksheet.pdf"],
  ["Family income certificate", "sevafix_mock_income_certificate_FAULTY.pdf"],
  ["Admission/course/institution evidence", "sevafix_mock_admission_letter.pdf"],
  ["Identity evidence for consistency check", "sevafix_mock_identity_proof.pdf"],
];

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  syntheticIdentity: "Aarav Mehta",
  scheme: "pm-usp-csss",
  routes: [],
  documents: documents.map(([label, filename]) => ({ label, filename })),
  screenshots: [],
};

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const browserErrors = [];
const requestFailures = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("requestfailed", (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));

async function screenshot(name) {
  const file = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(path.relative(path.resolve(".."), file).replaceAll("\\", "/"));
}

async function chooseBoolean(label, answer) {
  await page.getByRole("group", { name: label }).getByRole("button", { name: answer, exact: true }).click();
}

async function recordRoute(route) {
  report.routes.push({ route, url: page.url(), at: new Date().toISOString() });
}

async function readinessSummary() {
  const values = {};
  for (const label of ["Passed", "Needs fixing", "Needs review", "Blocked"]) {
    const term = page.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();
    await term.waitFor({ timeout: 120_000 });
    values[label] = Number.parseInt(await term.locator("..").locator("dd").innerText(), 10);
  }
  return `${values.Passed} passed · ${values["Needs fixing"]} failed · ${values["Needs review"]} need review · ${values.Blocked} blocked`;
}

async function confirmPendingFacts(incomeValue) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const confirmButtons = page.getByRole("button", { name: "Confirm extracted information", exact: true });
    const countBefore = await confirmButtons.count();
    if (countBefore === 0) break;
    const button = confirmButtons.first();
    const form = button.locator("..");
    const primaryName = form.getByLabel(/Primaryname/i);
    if ((await primaryName.count()) > 0) await primaryName.fill("Aarav Mehta");
    const income = form.getByLabel(/Annualincomeinr/i);
    if ((await income.count()) > 0) await income.fill(String(incomeValue));
    await button.click();
    await page.waitForFunction(
      (previousCount) =>
        [...document.querySelectorAll("button")].filter(
          (candidate) => candidate.textContent?.trim() === "Confirm extracted information",
        ).length < previousCount,
      countBefore,
      { timeout: 30_000 },
    );
  }
  if ((await page.getByRole("button", { name: "Confirm extracted information", exact: true }).count()) > 0) {
    throw new Error("Some extracted document facts could not be confirmed");
  }
}

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.getByRole("heading", { name: /Your applications|applications$/i }).waitFor({ timeout: 8_000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.reload({ waitUntil: "networkidle" });
    }
  }
  await recordRoute("dashboard");
  await screenshot("01-dashboard");

  await page.getByRole("link", { name: "Browse supported schemes", exact: true }).click();
  await page.waitForURL("**/schemes");
  await page.getByRole("heading", { name: "Supported schemes", exact: true }).waitFor();
  const schemeNames = (await page.locator("h2").allTextContents()).map((name) => name.trim()).filter(Boolean);
  const officialPortalCount = await page.getByRole("link", { name: "Official portal" }).count();
  if (officialPortalCount < 10 || schemeNames.length < 10) {
    throw new Error(`Expected at least 10 schemes; found ${schemeNames.length} headings and ${officialPortalCount} official links`);
  }
  report.catalog = { count: schemeNames.length, schemeNames };
  await recordRoute("schemes");
  await screenshot("02-scheme-catalog");

  await page.getByRole("article").filter({ hasText: "PM-USP" }).getByRole("link", { name: "Start application", exact: true }).click();
  await page.getByRole("button", { name: "Create draft application", exact: true }).click();
  await page.waitForURL("**/applications/*/edit", { timeout: 30_000 });
  const appId = page.url().match(/\/applications\/([^/]+)\/edit/)?.[1];
  if (!appId) throw new Error("Could not read the new application ID from the URL");
  report.applicationId = appId;
  await recordRoute("draft");

  await page.getByLabel(/Application type/).selectOption("FRESH");
  await page.getByLabel(/Name as on Class XII/).fill("Aarav Mehta");
  await page.getByLabel(/Gross annual family income/).fill("350000");
  await page.getByLabel(/Class XII board percentile/).fill("92");
  await chooseBoolean(/Took a drop after Class XII/, "No");
  await chooseBoolean(/Receiving another scholarship/, "No");
  await chooseBoolean(/NSP One-Time Registration/, "Yes");
  await page.getByLabel(/Category/).selectOption("GENERAL");
  await chooseBoolean(/Claiming benchmark-disability/, "No");
  await chooseBoolean(/Bank account is ready for DBT/, "Yes");
  await page.getByLabel(/Enrolment mode/).selectOption("REGULAR");
  await page.getByLabel(/Course type/).selectOption("DEGREE");
  await page.getByLabel(/Current course year/).fill("1");
  await page.getByLabel(/Institution name/).fill("National Institute of Test Studies");
  await page.getByLabel(/AISHE code/).fill("C-99999");
  await chooseBoolean(/Recognized by the relevant regulatory body/, "Yes");
  await chooseBoolean(/Institution status is active on AISHE/, "Yes");
  await page.waitForFunction(
    () => {
      const saveButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Save now"));
      const hasUnsavedChanges = document.body.innerText.includes("Unsaved changes");
      return saveButton && hasUnsavedChanges && !saveButton.disabled;
    },
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await page.getByText("Unsaved changes", { exact: true }).waitFor({ state: "detached", timeout: 30_000 });
  await page.getByText(/^Saved /).waitFor({ timeout: 30_000 });
  await screenshot("03-completed-draft");

  await page.getByRole("link", { name: /^Documents/ }).click();
  await page.waitForURL("**/applications/*/documents");
  await recordRoute("documents");
  for (const [label, filename] of documents) {
    const slot = page.getByText(label, { exact: true }).locator('xpath=ancestor::div[.//input[@type="file"]][1]');
    await slot.locator('input[type="file"]').setInputFiles(path.join(documentDir, filename));
  }
  for (const documentType of ["Marksheet", "Income certificate", "Admission letter", "Identity proof"]) {
    await page.getByText(documentType, { exact: true }).waitFor({ timeout: 45_000 });
  }

  await page.waitForFunction(
    () => {
      const terminal = ["Extracted", "Needs your confirmation", "Confirmed", "Unsupported language", "Reading failed", "Quarantined"];
      const text = document.body.innerText;
      return terminal.reduce((sum, status) => sum + (text.match(new RegExp(status, "g")) || []).length, 0) >= 4;
    },
    { timeout: 300_000 },
  );

  await confirmPendingFacts(900000);
  report.documentPipeline = "PASS";
  report.documentPageText = await page.locator("body").innerText();
  await screenshot("04-documents-processed");

  await page.getByRole("link", { name: /^Checks/ }).click();
  await page.waitForURL("**/applications/*/check");
  await recordRoute("check");
  await page.getByRole("button", { name: /Run application checks|Run checks again/ }).click();
  const readinessText = await readinessSummary();
  if (!/[1-9][0-9]* failed/i.test(readinessText)) throw new Error(`Faulty document was not rejected: ${readinessText}`);
  await page.getByText("fresh income certificate match", { exact: true }).waitFor();
  report.faultyValidation = readinessText;
  await screenshot("05-fault-detected");

  await page.getByRole("link", { name: /^Review/ }).click();
  await page.waitForURL("**/applications/*/review");
  await recordRoute("review");
  await page.getByRole("button", { name: "Create submission version", exact: true }).click();
  await page.getByRole("button", { name: "Create version", exact: true }).click();
  await page.getByText("V01", { exact: true }).waitFor({ timeout: 30_000 });
  report.frozenVersion = 1;
  await screenshot("06-frozen-version");

  await page.getByRole("link", { name: /^Tracking/ }).click();
  await page.waitForURL("**/applications/*/tracking*");
  await recordRoute("tracking");
  const officialApplicationId = `NSP-MOCK-${Date.now()}`;
  await page.getByLabel("Official application ID").fill(officialApplicationId);
  await page.getByLabel("Submission date and time").fill("2026-09-20T02:00");
  await page.getByRole("button", { name: "Record submission", exact: true }).click();
  await page.getByText(/Official application ID · redacted/).waitFor({ timeout: 30_000 });
  await page.getByLabel("Details").fill("Synthetic full-flow mock run completed; no government submission was made.");
  await page.getByRole("button", { name: "Add to history", exact: true }).click();
  await page.getByText(/Synthetic full-flow mock run completed/).waitFor({ timeout: 30_000 });
  report.tracking = { officialApplicationId, noteRecorded: true, externalSubmissionMade: false };
  await screenshot("07-tracking-timeline");

  await page.getByRole("link", { name: "Diagnose Evidence and repair", exact: true }).click();
  await page.waitForURL("**/applications/*/diagnose");
  await recordRoute("diagnose");
  await page.getByLabel("Official reason, if provided").fill("");
  await page.getByRole("button", { name: "Review available evidence", exact: true }).click();
  await page.getByText("Likely issue", { exact: true }).waitFor({ timeout: 180_000 });
  await page.getByRole("heading", { name: "Income mismatch", exact: true }).waitFor();
  await page.getByText(/inference, not an official rejection reason/i).waitFor();
  const diagnosisCard = page.getByText("Likely issue", { exact: true }).locator("..");
  report.diagnosis = await diagnosisCard.innerText();
  await screenshot("08-diagnosis");

  const repairButton = page.getByRole("button", { name: "Create corrected version", exact: true });
  if (await repairButton.isEnabled()) {
    await repairButton.click();
    await page.waitForURL("**/applications/*/edit", { timeout: 30_000 });
    await recordRoute("repair-draft");
    report.repairDraftCreated = true;
    await screenshot("09-repair-draft");
  } else {
    report.repairDraftCreated = false;
  }

  await page.getByRole("link", { name: /^Documents/ }).click();
  await page.waitForURL("**/applications/*/documents");
  const faultyDocumentCard = page
    .getByText("Income certificate", { exact: true })
    .locator("xpath=ancestor::tr[1]");
  await faultyDocumentCard.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete document", exact: true }).click();
  await faultyDocumentCard.waitFor({ state: "detached", timeout: 30_000 });
  const incomeSlot = page.getByText("Family income certificate", { exact: true }).locator('xpath=ancestor::div[.//input[@type="file"]][1]');
  await incomeSlot.locator('input[type="file"]').setInputFiles(path.join(documentDir, "sevafix_mock_income_certificate_CORRECTED.pdf"));
  await page.getByText("Income certificate", { exact: true }).waitFor({ timeout: 45_000 });
  const correctedDocumentCard = page
    .getByText("Income certificate", { exact: true })
    .locator("xpath=ancestor::tr[1]");
  await correctedDocumentCard.getByText(/Extracted|Needs your confirmation|Confirmed/).waitFor({ timeout: 300_000 });
  await confirmPendingFacts(350000);
  await screenshot("10-corrected-document");

  await page.getByRole("link", { name: /^Checks/ }).click();
  await page.getByRole("button", { name: /Run application checks|Run checks again/ }).click();
  const correctedText = await readinessSummary();
  if (!/0 failed/i.test(correctedText) || !/0 blocked/i.test(correctedText)) {
    throw new Error(`Corrected application did not become ready: ${correctedText}`);
  }
  report.correctedValidation = correctedText;
  await screenshot("11-correction-passed");

  if (browserErrors.length) throw new Error(`Browser page errors: ${browserErrors.join(" | ")}`);
  report.status = "PASS";
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(artifactDir, "mock-run-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = "FAIL";
  report.failedAt = new Date().toISOString();
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  report.browserErrors = browserErrors;
  report.requestFailures = requestFailures;
  await page.screenshot({ path: path.join(artifactDir, "mock-run-failure.png"), fullPage: true });
  await fs.writeFile(path.join(artifactDir, "mock-run-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  throw error;
} finally {
  await browser.close();
}
