import type { ChannelReport, CountryReport } from '../../types';

function bar(value: number, max: number): string {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `${pct}%`;
}

export default function MixPanels({
  channels, countries,
}: { channels?: ChannelReport; countries?: CountryReport }) {
  const chanRows = (channels?.rows ?? []).filter((r) => (r.roomSold ?? 0) > 0);
  const maxChan = Math.max(1, ...chanRows.map((r) => r.revenue ?? 0));
  const countryRows = (countries?.rows ?? [])
    .filter((r) => r.country !== '-- N/A --')
    .slice(0, 8);
  const maxCountry = Math.max(1, ...countryRows.map((r) => r.revenue ?? 0));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl p-5 shadow">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">สัดส่วนช่องทาง</h3>
        {chanRows.length === 0 ? <p className="text-slate-400 text-sm">— ไม่มีข้อมูล</p> : chanRows.map((r) => (
          <div key={r.source} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{r.source}</span>
              <span className="text-slate-500">{r.revPct?.toFixed(0) ?? '–'}% · ADR ฿{r.adr?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-slate-700 rounded" style={{ width: bar(r.revenue ?? 0, maxChan) }} /></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">ตลาดตามสัญชาติ (Top 8)</h3>
        {countryRows.length === 0 ? <p className="text-slate-400 text-sm">— ไม่มีข้อมูล</p> : countryRows.map((r) => (
          <div key={r.country} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{r.country}</span>
              <span className="text-slate-500">฿{r.revenue?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-blue-500 rounded" style={{ width: bar(r.revenue ?? 0, maxCountry) }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
