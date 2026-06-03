import { plainText } from './rows';
import { parseDate } from './date';
import type { ReportType } from '../types';

export const MONTHS: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

export function detectReportType(html: string): ReportType {
  const t = plainText(html);
  if (t.includes('Yearly Statistics')) return 'yearly';
  if (t.includes('Contribution Analysis Report')) return 'channel';
  if (t.includes('Country Wise Reservation Statistics')) return 'country';
  if (t.includes('Arrival List')) return 'arrivals';
  if (t.includes('Monthly Statistics')) return 'monthly';
  return 'unknown';
}

export function extractDataAsOf(html: string): string | null {
  const t = plainText(html);
  const m = t.match(/Printed By\s*:?\s*\S+\s+on\s+(\d{2}\/\d{2}\/\d{4})/i);
  return m ? parseDate(m[1]) : null;
}
