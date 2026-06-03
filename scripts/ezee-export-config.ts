/** Date range helpers and 8-report configuration for eZee auto-export */

/** Format Date as dd/mm/yyyy (eZee date input format) */
export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Last day of given month (month is 1-based) */
function lastDay(year: number, month: number): Date {
  return new Date(year, month, 0); // day=0 → last day of previous month
}

/** Add months to a date (handles year rollover) */
function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  return result;
}

export interface ReportDateConfig {
  id: string;
  description: string;
  type: 'yearly' | 'channel-ytd' | 'channel-monthly' | 'country-ytd' | 'country-monthly' | 'arrivals' | 'monthly-current' | 'monthly-prev';
  year?: number;           // for Yearly Statistics
  dateFrom?: string;       // dd/mm/yyyy
  dateTo?: string;         // dd/mm/yyyy
  orderBy?: string;        // for reports that need Order By
}

export function buildReportConfig(today: Date): ReportDateConfig[] {
  const y = today.getFullYear();
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevY = prevMonthDate.getFullYear();
  const prevM = prevMonthDate.getMonth() + 1; // 1-based

  return [
    {
      id: 'yearly-current',
      description: 'Yearly Statistics (ปีปัจจุบัน)',
      type: 'yearly',
      year: y,
    },
    {
      id: 'channel-ytd',
      description: `Contribution Analysis YTD (01/01/${y} → วันนี้)`,
      type: 'channel-ytd',
      dateFrom: `01/01/${y}`,
      dateTo: fmtDate(today),
      orderBy: 'Business Source',
    },
    {
      id: 'channel-monthly',
      description: `Contribution Analysis เดือนก่อน`,
      type: 'channel-monthly',
      dateFrom: fmtDate(new Date(prevY, prevM - 1, 1)),
      dateTo: fmtDate(lastDay(prevY, prevM)),
      orderBy: 'Business Source',
    },
    {
      id: 'country-ytd',
      description: `Country Wise YTD (01/01/${y} → วันนี้)`,
      type: 'country-ytd',
      dateFrom: `01/01/${y}`,
      dateTo: fmtDate(today),
      orderBy: 'Arrival date',
    },
    {
      id: 'country-monthly',
      description: `Country Wise เดือนก่อน`,
      type: 'country-monthly',
      dateFrom: fmtDate(new Date(prevY, prevM - 1, 1)),
      dateTo: fmtDate(lastDay(prevY, prevM)),
      orderBy: 'Arrival date',
    },
    {
      id: 'arrivals',
      description: `Arrival List (วันนี้ → +2 เดือน)`,
      type: 'arrivals',
      dateFrom: fmtDate(today),
      dateTo: fmtDate(addMonths(today, 2)),
      orderBy: 'Room',
    },
    {
      id: 'monthly-current',
      description: `Monthly Statistics เดือนนี้`,
      type: 'monthly-current',
      dateFrom: `01/${String(today.getMonth() + 1).padStart(2, '0')}/${y}`,
      dateTo: fmtDate(today),
    },
    {
      id: 'monthly-prev',
      description: `Monthly Statistics เดือนก่อน`,
      type: 'monthly-prev',
      dateFrom: fmtDate(new Date(prevY, prevM - 1, 1)),
      dateTo: fmtDate(lastDay(prevY, prevM)),
    },
  ];
}
