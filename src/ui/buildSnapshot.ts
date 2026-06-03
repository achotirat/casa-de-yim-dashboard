import { parseFile, extractDataAsOf } from '../parser';
import type {
  Snapshot, YearlyReport, ChannelReport, CountryReport, ArrivalsReport, MonthlyReport,
} from '../types';

export interface BuildResult {
  snapshot: Snapshot;
  errors: string[];
}

export function buildSnapshot(htmls: string[]): BuildResult {
  const snapshot: Snapshot = { uploadedAt: new Date().toISOString(), dataAsOf: null };
  const errors: string[] = [];

  for (const html of htmls) {
    const { type, result } = parseFile(html);
    if (!result.ok) {
      errors.push(result.reason);
      continue;
    }
    if (!snapshot.dataAsOf) {
      const d = extractDataAsOf(html);
      if (d) snapshot.dataAsOf = d;
    }
    switch (type) {
      case 'yearly': snapshot.yearly = result.data as YearlyReport; break;
      case 'channel': snapshot.channels = result.data as ChannelReport; break;
      case 'country': snapshot.countries = result.data as CountryReport; break;
      case 'arrivals': snapshot.arrivals = result.data as ArrivalsReport; break;
      case 'monthly': {
        const rep = result.data as MonthlyReport;
        const arr = snapshot.monthly ?? [];
        const idx = arr.findIndex((m) => m.month === rep.month && m.year === rep.year);
        if (idx >= 0) arr[idx] = rep; else arr.push(rep);
        snapshot.monthly = arr.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
        break;
      }
    }
  }

  return { snapshot, errors };
}
