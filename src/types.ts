export type ReportType = 'yearly' | 'channel' | 'country' | 'arrivals' | 'monthly' | 'unknown';

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export interface MonthRow {
  month: string;        // "January" | "Grand Total"
  monthIndex: number;   // 1-12, 0 for grand total
  availableRooms: number | null;
  nightSold: number | null;
  occPct: number | null;
  adr: number | null;
  revPar: number | null;
  pax: number | null;
  roomCharges: number | null;
}

export interface YearlyReport {
  year: number;
  months: MonthRow[];
  grandTotal: MonthRow;
}

export interface ChannelRow {
  source: string;
  roomSold: number | null;
  occPct: number | null;
  pax: number | null;
  paxChild: number | null;
  revenue: number | null;
  revPct: number | null;
  adr: number | null;
}

export interface ChannelReport {
  periodFrom: string | null;
  periodTo: string | null;
  scope: 'ytd' | 'month';
  rows: ChannelRow[];
  total: ChannelRow;
}

export interface CountryRow {
  country: string;
  revenue: number | null;
  reservations: number | null;
  guests: number | null;
  nights: number | null;
  avgPerNight: number | null;
}

export interface CountryReport {
  periodFrom: string | null;
  periodTo: string | null;
  scope: 'ytd' | 'month';
  rows: CountryRow[];
}

export interface ArrivalRow {
  resNo: string;
  guest: string;
  room: string;
  rate: number | null;
  arrival: string | null;   // ISO date (check-in)
  departure: string | null; // ISO date
  pax: number | null;
  children: number | null;
  resType: string;
  channel: string;          // Company column (e.g. "OTA")
  notes: string;
}

export interface ArrivalsReport {
  periodFrom: string | null;
  periodTo: string | null;
  rows: ArrivalRow[];
}

export interface DayRow {
  date: string;          // ISO "2026-05-01"
  dayOfWeek: string;     // "Fri"
  availableRooms: number | null;
  nightSold: number | null;
  occPct: number | null;
  adr: number | null;
  revPar: number | null;
  pax: number | null;
  roomCharges: number | null;
}

export interface MonthlyReport {
  month: number;   // 1-12
  year: number;
  days: DayRow[];
}

export interface Snapshot {
  uploadedAt: string;        // ISO datetime
  dataAsOf: string | null;   // ISO date from "Printed By ... on dd/mm/yyyy"
  yearly?: YearlyReport;
  channels?: ChannelReport;
  countries?: CountryReport;
  arrivals?: ArrivalsReport;
  monthly?: MonthlyReport[]; // up to 2 months, sorted oldest-first
}
