import { detectReportType, extractDataAsOf } from './detect';
import { parseYearly } from './yearly';
import { parseChannel } from './channel';
import { parseCountry } from './country';
import { parseArrivals } from './arrivals';
import type { ReportType, ParseResult } from '../types';

export { extractDataAsOf };

export interface ParsedFile {
  type: ReportType;
  result: ParseResult<unknown>;
}

export function parseFile(html: string): ParsedFile {
  const type = detectReportType(html);
  switch (type) {
    case 'yearly':
      return { type, result: parseYearly(html) };
    case 'channel':
      return { type, result: parseChannel(html) };
    case 'country':
      return { type, result: parseCountry(html) };
    case 'arrivals':
      return { type, result: parseArrivals(html) };
    default:
      return { type: 'unknown', result: { ok: false, reason: 'ไม่รู้จักชนิดรายงานนี้ (หาหัวตารางที่รองรับไม่เจอ)' } };
  }
}
