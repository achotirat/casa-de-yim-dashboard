import { extractRows } from './rows';
import { parseNum, parsePax } from './num';
import { parseDate } from './date';
import type { ArrivalsReport, ArrivalRow, ParseResult } from '../types';

// Booking row cell layout (raw indices):
// [0]resNo  [1]guest  [2]''  [3]room  [4]rate  [5]''  [6]arrival  [7]departure
// [8]pax  [9-12]''  [13]resType  [14]''  [15]channel
function toArrivalRow(c: string[]): ArrivalRow {
  const { adults, children } = parsePax(c[8]);
  return {
    resNo: c[0] ?? '',
    guest: c[1] ?? '',
    room: c[3] ?? '',
    rate: parseNum(c[4]),
    arrival: parseDate(c[6]),
    departure: parseDate(c[7]),
    pax: adults,
    children,
    resType: c[13] ?? '',
    channel: c[15] ?? '',
    notes: '',
  };
}

function isBookingRow(c: string[]): boolean {
  // resNo is a pure integer, rate parses as a number, arrival contains a date
  return (
    /^\d+$/.test(c[0] ?? '') &&
    parseNum(c[4]) !== null &&
    /\d{2}\/\d{2}\/\d{4}/.test(c[6] ?? '')
  );
}

export function parseArrivals(html: string): ParseResult<ArrivalsReport> {
  const rows = extractRows(html);

  let periodFrom: string | null = null;
  let periodTo: string | null = null;

  for (const r of rows) {
    // "Date From 29/05/2026 To 30/06/2026 ..." — all in one cell
    const joined = r.join(' ');
    const mFrom = joined.match(/Date From\s+(\d{2}\/\d{2}\/\d{4})/i);
    const mTo = joined.match(/\bTo\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (mFrom) {
      periodFrom = parseDate(mFrom[1]);
      if (mTo) periodTo = parseDate(mTo[1]);
      break;
    }
  }

  const out: ArrivalRow[] = [];
  let last: ArrivalRow | null = null;

  for (const r of rows) {
    if (isBookingRow(r)) {
      last = toArrivalRow(r);
      out.push(last);
      continue;
    }

    // Note/continuation row: non-empty text, not a header, attach to last booking
    if (last) {
      const text = r
        .filter((c) => c !== '')
        .join(' ')
        .trim();
      // Skip header rows and totals
      if (
        text &&
        !/^Res\.\s*No/i.test(text) &&
        !/^Casa de Yim/i.test(text) &&
        !/^Printed/i.test(text) &&
        !/^Date From/i.test(text) &&
        !/^Total Reservation/i.test(text)
      ) {
        last.notes = last.notes ? last.notes + ' ' + text : text;
      }
    }
  }

  if (out.length === 0) {
    return { ok: false, reason: 'ไม่พบรายการจองใน Arrival List' };
  }

  return { ok: true, data: { periodFrom, periodTo, rows: out } };
}
