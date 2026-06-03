import { extractRows } from './rows';
import { parseNum } from './num';
import type { MonthlyReport, DayRow, ParseResult } from '../types';

const MONTH_NAMES: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

function toDayRow(cells: string[], month: number, year: number): DayRow {
  const m = cells[0].match(/^(\d{1,2})\s+(\w{3})$/);
  const day = m ? Number(m[1]) : 0;
  const dayOfWeek = m ? m[2] : '';
  const date = day > 0
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : '';
  // Column order after date label (index 0):
  // cells[1]=availRooms, [2]=nightSold, [3]=complimentary, [4]=occ%, [5]=adr, [6]=revPar, [7]=pax, [8]=roomCharges
  return {
    date,
    dayOfWeek,
    availableRooms: parseNum(cells[1]),
    nightSold:      parseNum(cells[2]),
    occPct:         parseNum(cells[4]),
    adr:            parseNum(cells[5]),
    revPar:         parseNum(cells[6]),
    pax:            parseNum(cells[7]),
    roomCharges:    parseNum(cells[8]),
  };
}

export function parseMonthly(html: string): ParseResult<MonthlyReport> {
  const rows = extractRows(html);

  let month = 0;
  let year = 0;

  for (const r of rows) {
    for (const cell of r) {
      const m = cell.match(/Month\s+(\w+),(\d{4})/i);
      if (m) {
        month = MONTH_NAMES[m[1]] ?? 0;
        year = Number(m[2]);
        break;
      }
    }
    if (month) break;
  }

  if (!month || !year) {
    return { ok: false, reason: 'ไม่พบหัว Month/Year ใน Monthly Statistics' };
  }

  const seen = new Set<string>();
  const days: DayRow[] = [];

  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length === 0) continue;
    if (/^\d{1,2}\s+\w{3}$/.test(cells[0])) {
      const row = toDayRow(cells, month, year);
      if (row.date && !seen.has(row.date)) {
        seen.add(row.date);
        days.push(row);
      }
    }
  }

  if (days.length === 0) {
    return { ok: false, reason: 'ไม่พบข้อมูลรายวันใน Monthly Statistics' };
  }

  return { ok: true, data: { month, year, days } };
}
