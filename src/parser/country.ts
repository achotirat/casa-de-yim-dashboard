import { extractRows } from './rows';
import { parseNum } from './num';
import { parseDate } from './date';
import type { CountryReport, CountryRow, ParseResult } from '../types';

// Columns: country, revenue, reservations, guests, nights, avgPerNight
function toCountryRow(cells: string[]): CountryRow {
  return {
    country: cells[0],
    revenue: parseNum(cells[1]),
    reservations: parseNum(cells[2]),
    guests: parseNum(cells[3]),
    nights: parseNum(cells[4]),
    avgPerNight: parseNum(cells[5]),
  };
}

// Header row pattern — used to detect and skip repeated headers on page 2
const HEADER_COUNTRY_CELL = /^Country$/i;

export function parseCountry(html: string): ParseResult<CountryReport> {
  const rows = extractRows(html);

  let periodFrom: string | null = null;
  let periodTo: string | null = null;

  // Date appears in a single cell: "Arrival Date From 01/01/2026 To 29/05/2026"
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    for (const cell of cells) {
      const m = cell.match(/Arrival Date From\s+(\d{2}\/\d{2}\/\d{4})\s+To\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (m) {
        periodFrom = parseDate(m[1]);
        periodTo = parseDate(m[2]);
        break;
      }
    }
    if (periodFrom) break;
  }

  // A data row has >= 6 non-empty cells and its 2nd cell (revenue) parses as a number.
  // This naturally skips headers, repeated page headers, Printed By rows, Total rows, etc.
  const dataRows: CountryRow[] = [];
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length < 6) continue;
    // Skip header rows (first cell is "Country")
    if (HEADER_COUNTRY_CELL.test(cells[0])) continue;
    // Revenue column must parse as a number
    if (parseNum(cells[1]) === null) continue;
    dataRows.push(toCountryRow(cells));
  }

  if (dataRows.length === 0) return { ok: false, reason: 'ไม่พบข้อมูลรายประเทศ' };

  const scope: 'ytd' | 'month' = periodFrom?.endsWith('-01-01') ? 'ytd' : 'month';
  return { ok: true, data: { periodFrom, periodTo, scope, rows: dataRows } };
}
