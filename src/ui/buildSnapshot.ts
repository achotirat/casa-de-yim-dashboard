import { parseFile, extractDataAsOf } from '../parser';
import type {
  Snapshot, YearlyReport, ChannelReport, CountryReport, ArrivalsReport,
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
    }
  }

  return { snapshot, errors };
}
