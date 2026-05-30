import { extractRows } from './rows';
import { parseNum, parsePax } from './num';
import { parseDate } from './date';
import type { ChannelReport, ChannelRow, ParseResult } from '../types';

// Regular data row: source, roomSold, occ%, pax, revenue, rev%, adr
function toChannelRow(cells: string[]): ChannelRow {
  const pax = parsePax(cells[3] ?? '');
  return {
    source: cells[0],
    roomSold: parseNum(cells[1]),
    occPct: parseNum(cells[2]),
    pax: pax.adults,
    paxChild: pax.children,
    revenue: parseNum(cells[4]),
    revPct: parseNum(cells[5]),
    adr: parseNum(cells[6]),
  };
}

// Grand Total row has an extra empty cell at index 1, shifting everything right:
// source, '', roomSold, occ%, pax, revenue, rev%, adr
function toTotalRow(cells: string[]): ChannelRow {
  const pax = parsePax(cells[4] ?? '');
  return {
    source: cells[0],
    roomSold: parseNum(cells[2]),
    occPct: parseNum(cells[3]),
    pax: pax.adults,
    paxChild: pax.children,
    revenue: parseNum(cells[5]),
    revPct: parseNum(cells[6]),
    adr: parseNum(cells[7]),
  };
}

export function parseChannel(html: string): ParseResult<ChannelReport> {
  const rows = extractRows(html);

  let periodFrom: string | null = null;
  let periodTo: string | null = null;

  // Date appears in a single cell like: "Date From 01/05/2026 To 31/05/2026 ..."
  for (const r of rows) {
    for (const cell of r) {
      const mFrom = cell.match(/Date\s+From\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (mFrom) {
        periodFrom = parseDate(mFrom[1]);
        const mTo = cell.match(/\bTo\s+(\d{2}\/\d{2}\/\d{4})/i);
        if (mTo) periodTo = parseDate(mTo[1]);
        break;
      }
    }
    if (periodFrom) break;
  }

  const dataRows: ChannelRow[] = [];
  let total: ChannelRow | null = null;
  let seenHeader = false;

  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length === 0) continue;

    // Header row: first cell is "Business Source"
    if (/^Business Source$/i.test(cells[0])) {
      seenHeader = true;
      continue;
    }

    if (!seenHeader) continue;

    // Grand Total row: raw row has 8 cells with empty at index 1
    if (/Grand Total/i.test(cells[0])) {
      total = toTotalRow(r);
      continue;
    }

    // Regular data rows have 7 cells
    if (cells.length >= 7) {
      dataRows.push(toChannelRow(cells));
    }
  }

  if (!seenHeader) return { ok: false, reason: 'ไม่พบหัวตาราง Business Source' };
  if (!total) total = toChannelRow(['Grand Total', '', '', '', '', '', '']);

  const scope: 'ytd' | 'month' = periodFrom?.slice(5) === '01-01' ? 'ytd' : 'month';

  return { ok: true, data: { periodFrom, periodTo, scope, rows: dataRows, total } };
}
