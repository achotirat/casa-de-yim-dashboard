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
    await page.waitForTimeout(1500); // wait for AJAX form update

    // Debug: list iframes on page
    const iframes = await page.evaluate(() =>
      [...document.querySelectorAll('iframe')].map(f => ({ id: f.id, src: (f as HTMLIFrameElement).src, w: (f as HTMLElement).offsetWidth }))
    );
    log(`  Iframes: ${JSON.stringify(iframes)}`);

    // Set date / year parameters (handles iframe traversal internally)
    await setDates(page, config);
    await page.waitForTimeout(300);

    // Click "Report" button — traverse main frame + iframes via JS
    const reportClicked = await page.evaluate(() => {
      function findAndClickReport(doc: Document): boolean {
        const els = [...doc.querySelectorAll<HTMLElement>('input, button, a, div, span')];
        const btn = els.find(el => {
          const val = (el as HTMLInputElement).value?.trim();
          const txt = el.textContent?.trim();
          return (val === 'Report' || txt === 'Report') && el.offsetWidth > 0 && el.offsetHeight > 0;
        });
        if (btn) { btn.click(); return true; }
        for (const iframe of [...doc.querySelectorAll<HTMLIFrameElement>('iframe')]) {
          try { if (iframe.contentDocument && findAndClickReport(iframe.contentDocument)) return true; } catch { /* cross-origin */ }
        }
        return false;
      }
      return findAndClickReport(document);
    });
    if (!reportClicked) throw new Error('Report button not found in any frame');

    // Report may open in new tab
    await page.waitForTimeout(3000);
    const allPages = page.context().pages();
    const reportPage = allPages.length > 1 ? allPages[allPages.length - 1] : page;
    await reportPage.waitForLoadState('load', { timeout: TIMEOUT });

    const html = await reportPage.content();
    log(`  ✓ ${config.id} — ${html.length} bytes`);

    if (reportPage !== page) await reportPage.close();
    return html;

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

async function setDates(page: Page, config: ReportDateConfig): Promise<void> {
  if (config.year) {
    // Yearly Statistics: verified selector id="ctl0_popup_lstYear"
    await page.locator('#ctl0_popup_lstYear').selectOption(String(config.year));
    return;
  }

  if (!config.dateFrom && !config.dateTo) return;

  // eZee uses jQuery datepicker with disabled inputs — traverse main frame + iframes
  const result = await page.evaluate(([from, to]) => {
    function setInDoc(doc: Document): string {
      try {
        const win = doc.defaultView as any;
        const jq = win?.jQuery || win?.$;
        if (jq) {
          const inputs = jq('input.hasDatepicker');
          if (inputs.length > 0) {
            if (from) { inputs.eq(0).datepicker('setDate', from); inputs.eq(0).trigger('change'); }
            if (to && inputs.length > 1) { inputs.eq(1).datepicker('setDate', to); inputs.eq(1).trigger('change'); }
            return `ok: ${inputs.length} inputs from="${from}" to="${to}"`;
          }
        }
        // Try iframes
        for (const iframe of [...doc.querySelectorAll<HTMLIFrameElement>('iframe')]) {
          try { if (iframe.contentDocument) { const r = setInDoc(iframe.contentDocument); if (r.startsWith('ok')) return r; } } catch { /* cross-origin */ }
        }
        return 'no-datepicker-inputs-found';
      } catch (e: any) { return `error: ${e.message}`; }
    }
    return setInDoc(document);
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
