import { extractRows } from './rows';
import { parseNum } from './num';
import { MONTHS } from './detect';
import type { YearlyReport, MonthRow, ParseResult } from '../types';

// Month row column order after the label:
// [0] availableRooms, [1] nightSold, [2] complimentary, [3] occ%,
// [4] adr, [5] revPar, [6] pax, [7] roomCharges, ...
function toMonthRow(label: string, nums: (number | null)[], monthIndex: number): MonthRow {
  return {
    month: label,
    monthIndex,
    availableRooms: nums[0] ?? null,
    nightSold: nums[1] ?? null,
    occPct: nums[3] ?? null,
    adr: nums[4] ?? null,
    revPar: nums[5] ?? null,
    pax: nums[6] ?? null,
    roomCharges: nums[7] ?? null,
  };
}

export function parseYearly(html: string): ParseResult<YearlyReport> {
  const rows = extractRows(html);

  // Extract year from a cell like "Year 2026"
  let year = 0;
  for (const r of rows) {
    for (const cell of r) {
      const m = cell.match(/^Year\s+(\d{4})$/i);
      if (m) {
        year = Number(m[1]);
        break;
      }
    }
    if (year) break;
  }

  const months: MonthRow[] = [];
  let grandTotal: MonthRow | null = null;

  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length === 0) continue;
    const label = cells[0];

    if (MONTHS[label] !== undefined) {
      // Month row: label followed by data columns
      const nums = cells.slice(1).map(parseNum);
      months.push(toMonthRow(label, nums, MONTHS[label]));
    } else if (/grand total/i.test(label)) {
      // Grand Total row has an extra empty cell at index 1 (before availableRooms)
      // After filtering empty cells: [label, availableRooms, nightSold, complimentary, occ%, adr, revPar, pax, roomCharges, ...]
      const nums = cells.slice(1).map(parseNum);
      grandTotal = toMonthRow('Grand Total', nums, 0);
    }
  }

  if (months.length === 0) {
    return { ok: false, reason: 'ไม่พบข้อมูลรายเดือนใน Yearly Statistics' };
  }
  if (!grandTotal) grandTotal = toMonthRow('Grand Total', [], 0);

  return { ok: true, data: { year, months, grandTotal } };
}
