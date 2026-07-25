const assert = require("node:assert/strict");
const fs = require("node:fs");

const playwrightPath = process.env.PLAYWRIGHT_MODULE;
if (!playwrightPath) throw new Error("PLAYWRIGHT_MODULE is required.");
const { chromium } = require(playwrightPath);

const email = process.env.E2E_PATIENT_EMAIL;
const password = process.env.E2E_PATIENT_PASSWORD;
if (!email || !password) throw new Error("E2E patient credentials are required.");

async function assertVisible(locator, name) {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await locator.isVisible(), true, `${name} should be visible`);
}

(async () => {
  fs.mkdirSync("test-results", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
  });
  const browserErrors = [];
  const externalNetworkErrors = [];

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/ERR_(NETWORK_CHANGED|CONNECTION_RESET)/.test(value)) {
      externalNetworkErrors.push(value);
      return;
    }
    browserErrors.push(value);
  });

  try {
    const response = await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
    assert.equal(response?.ok(), true, "Login page should return a successful response");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForFunction(() => window.location.pathname === "/dashboard", undefined, { timeout: 30_000 });
    await assertVisible(page.locator("h1"), "Dashboard heading");
    await assertVisible(page.locator('nav[aria-label="Patient navigation"]:visible'), "Mobile navigation");
    await page.screenshot({ path: "test-results/patient-dashboard-mobile.png", fullPage: true });

    await page.goto("http://127.0.0.1:3000/history", { waitUntil: "domcontentloaded" });
    await assertVisible(page.getByRole("heading", { name: "Consultation history" }), "History heading");
    await assertVisible(page.getByRole("tab", { name: "Upcoming" }), "Upcoming filter");

    await page.goto("http://127.0.0.1:3000/notifications", { waitUntil: "domcontentloaded" });
    await assertVisible(page.getByRole("heading", { name: "Notifications" }), "Notifications heading");

    await page.goto("http://127.0.0.1:3000/prescriptions", { waitUntil: "domcontentloaded" });
    await assertVisible(page.getByRole("heading", { name: "Prescriptions" }), "Prescriptions heading");
    await page.screenshot({ path: "test-results/patient-prescriptions-mobile.png", fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "domcontentloaded" });
    await assertVisible(page.locator("aside").getByRole("navigation", { name: "Patient navigation" }), "Desktop sidebar navigation");
    await assertVisible(page.getByText("Private and secure"), "Security guidance");
    await page.screenshot({ path: "test-results/patient-dashboard-desktop.png", fullPage: true });

    const overlay = await page.locator("[data-nextjs-dialog], #webpack-dev-server-client-overlay").count();
    assert.equal(overlay, 0, "No framework error overlay should be present");
    assert.deepEqual(browserErrors, [], `Browser errors: ${browserErrors.join(" | ")}`);

    process.stdout.write(JSON.stringify({
      status: "passed",
      routes: ["/dashboard", "/history", "/notifications", "/prescriptions"],
      viewports: ["390x844", "1440x900"],
      browserErrors: browserErrors.length,
      externalNetworkErrors: externalNetworkErrors.length,
    }));
  } catch (error) {
    await page.screenshot({
      path: "test-results/patient-verification-failure.png",
      fullPage: true,
    });
    const toasts = await page
      .locator("[data-sonner-toast]")
      .allTextContents()
      .catch(() => []);
    console.error(JSON.stringify({
      status: "failed",
      url: page.url(),
      toasts,
      browserErrors,
      externalNetworkErrors,
      screenshot: "test-results/patient-verification-failure.png",
    }));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
