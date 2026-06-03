/**
 * eZee Auto-Export Script
 * Usage:
 *   npx tsx scripts/ezee-export.ts            # headless (cron)
 *   npx tsx scripts/ezee-export.ts --headed   # headed browser (debug)
 *   npx tsx scripts/ezee-export.ts --dry-run  # parse only, no upload
 *
 * ⚠️  On first run, use --headed to verify eZee navigation selectors.
 *    eZee UI selectors are marked with "VERIFY:" comments.
 */

import { config } from 'dotenv';
config(); // load .env from project root

import { chromium, type Page, type Browser } from 'playwright';
import { buildSnapshot } from '../src/ui/buildSnapshot.js';
import { buildReportConfig, type ReportDateConfig } from './ezee-export-config.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const HEADED = process.argv.includes('--headed');
const DRY_RUN = process.argv.includes('--dry-run');
const EZEE_URL = 'https://live.ipms247.com/login/';
const PROPERTY_CODE = process.env.EZEE_PROPERTY_CODE ?? '';
const USERNAME = process.env.EZEE_USERNAME ?? '';
const PASSWORD = process.env.EZEE_PASSWORD ?? '';
const DASHBOARD_URL = (process.env.DASHBOARD_URL ?? '').replace(/\/$/, '');
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD ?? '';
const TIMEOUT = 60_000; // 60 s per action

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
function warn(msg: string) {
  console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`);
}
function notify(title: string, msg: string) {
  // macOS notification (safe to call on non-Mac — will just fail silently)
  import('node:child_process').then(({ execSync }) => {
    try {
      execSync(`osascript -e 'display notification "${msg}" with title "${title}"'`);
    } catch { /* non-Mac */ }
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// eZee Login
// ---------------------------------------------------------------------------
async function loginEzee(page: Page): Promise<void> {
  log('Navigating to eZee login...');
  await page.goto(EZEE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

  // Selectors verified against live.ipms247.com/login/ — exact IDs from page source
  log(`Filling username="${USERNAME.trim()}" hotelcode="${PROPERTY_CODE.trim()}" password length=${PASSWORD.trim().length}`);

  // Click field first to focus, then type
  await page.locator('#username').click();
  await page.locator('#username').fill(USERNAME.trim());

  await page.locator('#hotelcode').click();
  await page.locator('#hotelcode').fill(PROPERTY_CODE.trim());

  await page.locator('#password').click();
  await page.locator('#password').fill(PASSWORD.trim());

  log('Submitting login form...');
  await page.locator('button#login').click();
  await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
  log(`Post-login URL: ${page.url()}`);

  // eZee shows a product selection page after login — click PMS
  const pmsBtnSelector = 'button:has-text("Property Management System"), button[onclick*="absfront"]';
  const pmsBtn = page.locator(pmsBtnSelector).first();
  const hasPmsBtn = await pmsBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasPmsBtn) {
    log('Product selection page detected — clicking PMS...');
    await pmsBtn.click();
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
    log(`After PMS click URL: ${page.url()}`);
  }

  log('Login complete ✓');
}

// Reports base URL (verified by user)
const REPORTS_URL = 'https://live.ipms247.com/index.php/page/cenreport.report?unity=1';

// ---------------------------------------------------------------------------
// Navigate to a specific report + set dates + export HTML
// ---------------------------------------------------------------------------
async function exportReport(page: Page, config: ReportDateConfig): Promise<string | null> {
  log(`Exporting: ${config.description}`);

  try {
    // Navigate directly to reports page
    await page.goto(REPORTS_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // Select the specific report from the list
    const reportLabel = getReportLabel(config);
    log(`  Clicking report: "${reportLabel}"`);
    await page.click(`text="${reportLabel}"`, { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

    // Set date parameters
    await setDates(page, config);

    // Click View/Generate to run the report
    await page.click('input[type="submit"], button:has-text("View"), button:has-text("Generate"), input[value="View Report"], input[value="Generate"]', { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

    // Get report HTML — check if it opened in a new tab
    const pages = page.context().pages();
    const reportPage = pages.length > 1 ? pages[pages.length - 1] : page;
    await reportPage.waitForLoadState('networkidle', { timeout: TIMEOUT });

    const html = await reportPage.content();
    log(`  ✓ ${config.id} — ${html.length} bytes`);

    // Close popup tab if it opened in new tab
    if (reportPage !== page) await reportPage.close();

    return html;

  } catch (err) {
    warn(`  Failed to export ${config.id}: ${(err as Error).message}`);
    try {
      const screenshotPath = `${process.env.HOME}/logs/ezee-error-${config.id}.png`;
      await page.screenshot({ path: screenshotPath });
      log(`  Screenshot saved: ${screenshotPath}`);
    } catch { /* ignore */ }
    return null;
  }
}

function getReportLabel(config: ReportDateConfig): string {
  // VERIFY: these are the exact names in eZee's report list
  switch (config.type) {
    case 'yearly':           return 'Yearly Statistics';
    case 'channel-ytd':
    case 'channel-monthly':  return 'Contribution Analysis';
    case 'country-ytd':
    case 'country-monthly':  return 'Country Wise Reservation Statistics';
    case 'arrivals':         return 'Arrival List';
    case 'monthly-current':
    case 'monthly-prev':     return 'Monthly Statistics';
  }
}

async function setDates(page: Page, config: ReportDateConfig): Promise<void> {
  // VERIFY: these selectors match eZee's date input fields
  if (config.year) {
    // Yearly Statistics: usually a Year dropdown
    await page.selectOption('select[name="Year"], select[id*="year" i]', String(config.year))
      .catch(() => page.fill('input[name="Year"], input[id*="year" i]', String(config.year)));
    return;
  }
  if (config.dateFrom) {
    await page.fill('input[name="DateFrom"], input[id*="from" i], input[placeholder*="From"]', config.dateFrom)
      .catch(() => warn(`  Could not fill DateFrom for ${config.id}`));
  }
  if (config.dateTo) {
    await page.fill('input[name="DateTo"], input[id*="to" i], input[placeholder*="To"]', config.dateTo)
      .catch(() => warn(`  Could not fill DateTo for ${config.id}`));
  }
  if (config.orderBy) {
    // Order By dropdown — may not exist for all reports
    await page.selectOption('select[name="OrderBy"], select[id*="order" i]', config.orderBy)
      .catch(() => { /* optional field — ignore */ });
  }
}

// ---------------------------------------------------------------------------
// Upload snapshot to dashboard
// ---------------------------------------------------------------------------
async function uploadToDashboard(htmls: string[]): Promise<void> {
  log('Building snapshot from parsed reports...');
  const { snapshot, errors } = buildSnapshot(htmls);

  if (errors.length > 0) {
    warn(`Parse errors (non-fatal): ${errors.join(', ')}`);
  }

  if (!snapshot.dataAsOf) {
    warn('No dataAsOf found — using today');
    snapshot.dataAsOf = new Date().toISOString().slice(0, 10);
  }

  const key = `snapshot/${snapshot.dataAsOf}`;
  log(`Uploading snapshot key="${key}" to ${DASHBOARD_URL}...`);

  // Step 1: Login to dashboard
  const authRes = await fetch(`${DASHBOARD_URL}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: DASHBOARD_PASSWORD }),
  });
  if (!authRes.ok) throw new Error(`Dashboard auth failed: ${authRes.status}`);

  const setCookie = authRes.headers.get('set-cookie') ?? '';
  const cookieMatch = setCookie.match(/cdy_auth=[^;]+/);
  if (!cookieMatch) throw new Error('No auth cookie in dashboard response');
  const cookie = cookieMatch[0];

  // Step 2: Upload snapshot
  const uploadRes = await fetch(`${DASHBOARD_URL}/api/snapshots`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ key, snapshot }),
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

  log(`✅ Snapshot uploaded: ${key}`);
  log(`   Reports: yearly=${!!snapshot.yearly} channels=${!!snapshot.channels} countries=${!!snapshot.countries} arrivals=${!!snapshot.arrivals} monthly=${snapshot.monthly?.length ?? 0} months`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!PROPERTY_CODE || !USERNAME || !PASSWORD) {
    console.error('Missing EZEE_PROPERTY_CODE, EZEE_USERNAME, or EZEE_PASSWORD in .env');
    process.exit(1);
  }
  if (!DRY_RUN && (!DASHBOARD_URL || !DASHBOARD_PASSWORD)) {
    console.error('Missing DASHBOARD_URL or DASHBOARD_PASSWORD in .env');
    process.exit(1);
  }

  log(`Starting eZee export (headed=${HEADED}, dry-run=${DRY_RUN})`);

  const browser: Browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage();

  try {
    await loginEzee(page);

    const configs = buildReportConfig(new Date());
    const htmls: string[] = [];

    for (const config of configs) {
      const html = await exportReport(page, config);
      if (html) htmls.push(html);
    }

    log(`Exported ${htmls.length}/${configs.length} reports`);

    if (htmls.length === 0) {
      throw new Error('No reports exported — aborting upload');
    }

    if (!DRY_RUN) {
      await uploadToDashboard(htmls);
      notify('Casa de Yim Export ✅', `อัปโหลด ${htmls.length} reports สำเร็จ`);
    } else {
      log('DRY RUN: skipping upload');
      const { snapshot, errors } = buildSnapshot(htmls);
      log(`Parsed snapshot: dataAsOf=${snapshot.dataAsOf} yearly=${!!snapshot.yearly} monthly=${snapshot.monthly?.length ?? 0}`);
      if (errors.length) log(`Errors: ${errors.join(', ')}`);
    }

  } catch (err) {
    const msg = (err as Error).message;
    warn(`Export failed: ${msg}`);
    notify('Casa de Yim Export ❌', `มีปัญหา: ${msg.slice(0, 60)}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
