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

// Polyfill DOMParser for Node.js (parsers normally run in browser/jsdom)
import { JSDOM } from 'jsdom';
if (typeof (globalThis as any).DOMParser === 'undefined') {
  (globalThis as any).DOMParser = class {
    parseFromString(str: string, type: string) {
      return new JSDOM(str, { contentType: type }).window.document;
    }
  };
}

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
  await page.goto(EZEE_URL, { waitUntil: 'load', timeout: TIMEOUT });

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

  // eZee auto-redirects to stayview after login — just wait for URL to leave /login/
  log('Waiting for redirect away from login...');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('load', { timeout: TIMEOUT });
  log(`Login complete ✓  URL: ${page.url()}`);
}

// Reports base URL (verified by user)
const REPORTS_URL = 'https://live.ipms247.com/index.php/page/cenreport.report?unity=1';

// ---------------------------------------------------------------------------
// Navigate to a specific report + set dates + export HTML
// ---------------------------------------------------------------------------
// iframe URL suffix for each report (verified from browser debug run)
const IFRAME_URL_SUFFIX: Record<string, string> = {
  'Yearly Statistics':                   'yearlystatistics',
  'Contribution Analysis Report':        'contributionanalysis',
  'Country Wise Reservation Statistics': 'countrywisebooking',
  'Arrival List':                        'arrival_list',
  'Monthly Statistics':                  'monthlystatistics',
};

// Category each report lives in (must be expanded before clicking the report)
const REPORT_CATEGORY: Record<string, string | null> = {
  'Yearly Statistics':                   'Statistical Report',
  'Monthly Statistics':                  'Statistical Report',
  'Contribution Analysis Report':        'Statistical Report',
  'Country Wise Reservation Statistics': 'Reservation Report',
  'Arrival List':                        'Reservation Report',
};

async function exportReport(page: Page, config: ReportDateConfig): Promise<string | null> {
  log(`Exporting: ${config.description}`);

  try {
    // Navigate to reports page fresh each time
    await page.goto(REPORTS_URL, { waitUntil: 'load', timeout: TIMEOUT });
    await page.waitForTimeout(1500); // let sidebar JS render

    const reportLabel = getReportLabel(config);
    log(`  Clicking report: "${reportLabel}"`);

    // Expand the category if needed (eZee sidebar uses non-<a> click handlers)
    const category = REPORT_CATEGORY[reportLabel];
    if (category) {
      const alreadyVisible = await page.evaluate((label) => {
        return [...document.querySelectorAll('li')].some(
          el => el.textContent?.trim().startsWith(label) && (el as HTMLElement).offsetWidth > 0
        );
      }, reportLabel).catch(() => false);
      if (!alreadyVisible) {
        log(`  Expanding category: "${category}"`);
        await page.evaluate((cat) => {
          const els = [...document.querySelectorAll('li, div, span, h4, h5')];
          const header = els.find(el =>
            el.textContent?.trim() === cat && (el as HTMLElement).offsetWidth > 0
          );
          if (header) (header as HTMLElement).click();
        }, category);
        await page.waitForTimeout(800);
      }
    }

    // Click the report via JS (sidebar uses li/span with onclick, not <a> tags)
    const clicked = await page.evaluate((label) => {
      const els = [...document.querySelectorAll('li, span, div')];
      const target = els.find(el =>
        el.textContent?.trim().startsWith(label) &&
        (el as HTMLElement).offsetWidth > 0 &&
        (el as HTMLElement).offsetHeight > 0
      );
      if (target) { (target as HTMLElement).click(); return true; }
      return false;
    }, reportLabel);

    if (!clicked) throw new Error(`Could not find sidebar item: "${reportLabel}"`);

    // Wait for report_iframe to update to this specific report's URL AND fully load
    const urlSuffix = IFRAME_URL_SUFFIX[reportLabel] ?? reportLabel.toLowerCase().replace(/\s+/g, '');
    log(`  Waiting for iframe to load: "${urlSuffix}"`);
    await page.waitForFunction(
      (suffix: string) => {
        const iframe = document.getElementById('report_iframe') as HTMLIFrameElement | null;
        if (!iframe || !iframe.src.includes(suffix) || !iframe.offsetWidth) return false;
        try {
          // Also wait for the iframe document to be fully loaded
          return iframe.contentDocument?.readyState === 'complete';
        } catch { return false; }
      },
      urlSuffix,
      { timeout: TIMEOUT }
    );
    log(`  iframe loaded ✓`);

    // Use frameLocator('#report_iframe') — handles frame timing automatically, no Frame object needed
    const fl = page.frameLocator('#report_iframe');

    // Wait for Report button to appear (implies iframe content has loaded)
    const reportBtn = fl.locator('#ctl0_popup_btnReport, input[value="Report"], button:has-text("Report"), a.btn1:has-text("Report")').first();
    log(`  Waiting for Report button in #report_iframe...`);
    await reportBtn.waitFor({ state: 'visible', timeout: TIMEOUT });

    // Also find the Frame object for evaluate calls (datepicker/month selectors)
    let reportFrame = page.frames().find(f => f !== page.mainFrame() && f.url().includes(urlSuffix));
    if (!reportFrame) {
      await page.waitForTimeout(500);
      reportFrame = page.frames().find(f => f !== page.mainFrame() && f.url().includes(urlSuffix));
    }
    log(`  Frame: ${reportFrame?.url() ?? 'using frameLocator only'}`);

    // Set date / year parameters
    if (reportFrame) {
      await setDates(reportFrame, config);
    }
    await page.waitForTimeout(300);

    // Click Report button via frameLocator (most reliable)
    await reportBtn.click();

    // Report may open in a new tab or navigate within the iframe
    await page.waitForTimeout(3000);
    const allPages = page.context().pages();
    if (allPages.length > 1) {
      const reportPage = allPages[allPages.length - 1];
      await reportPage.waitForLoadState('load', { timeout: TIMEOUT });
      const html = await reportPage.content();
      log(`  ✓ ${config.id} — ${html.length} bytes (new tab)`);
      await reportPage.close();
      return html;
    } else {
      // Report navigated within iframe
      await reportFrame.waitForLoadState('load', { timeout: TIMEOUT });
      const html = await reportFrame.content();
      log(`  ✓ ${config.id} — ${html.length} bytes (iframe)`);
      return html;
    }

  } catch (err) {
    warn(`  Failed to export ${config.id}: ${(err as Error).message}`);
    try {
      const screenshotPath = `${process.env.HOME}/logs/ezee-error-${config.id}.png`;
      await page.screenshot({ path: screenshotPath });
      log(`  Screenshot: ${screenshotPath}`);
    } catch { /* ignore */ }
    return null;
  }
}

function getReportLabel(config: ReportDateConfig): string {
  // VERIFY: these are the exact names in eZee's report list
  switch (config.type) {
    case 'yearly':           return 'Yearly Statistics';
    case 'channel-ytd':
    case 'channel-monthly':  return 'Contribution Analysis Report';
    case 'country-ytd':
    case 'country-monthly':  return 'Country Wise Reservation Statistics';
    case 'arrivals':         return 'Arrival List';
    case 'monthly-current':
    case 'monthly-prev':     return 'Monthly Statistics';
  }
}

// frame is the report_iframe Frame object (same locator API as Page)
async function setDates(frame: import('playwright').Frame, config: ReportDateConfig): Promise<void> {
  // Monthly Statistics: uses Year + Month dropdowns (not a date range picker)
  if (config.type === 'monthly-current' || config.type === 'monthly-prev') {
    if (config.dateFrom) {
      const parts = config.dateFrom.split('/');
      const month = parseInt(parts[1], 10); // "06" → 6
      const year = parts[2];               // "2026"
      await frame.locator('select[id*="Year" i], select[name*="Year" i]').first().selectOption(year);
      await frame.locator('select[id*="Month" i], select[name*="Month" i]').first().selectOption(String(month));
      log(`  Month set: ${month}/${year}`);
    }
    return;
  }

  if (config.year) {
    // Yearly Statistics: select year from dropdown (verified id=ctl0_popup_lstYear)
    await frame.locator('#ctl0_popup_lstYear').selectOption(String(config.year));
    return;
  }

  if (!config.dateFrom && !config.dateTo) return;

  // eZee date inputs are disabled + jQuery datepicker — set via frame.evaluate (runs inside iframe)
  const result = await frame.evaluate(([from, to]) => {
    try {
      const jq = (window as any).jQuery || (window as any).$;
      if (!jq) return 'no-jquery';
      const inputs = jq('input.hasDatepicker');
      if (!inputs || inputs.length === 0) return 'no-datepicker-inputs';
      if (from) { inputs.eq(0).datepicker('setDate', from); inputs.eq(0).trigger('change'); }
      if (to && inputs.length > 1) { inputs.eq(1).datepicker('setDate', to); inputs.eq(1).trigger('change'); }
      return `ok: ${inputs.length} inputs from="${from}" to="${to}"`;
    } catch (e: any) { return `error: ${e.message}`; }
  }, [config.dateFrom ?? '', config.dateTo ?? '']);

  log(`  Date set: ${result}`);
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
