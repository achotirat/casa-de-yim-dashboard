import type { YearlyReport } from '../../types';
import type { WeeklyKpi } from '../../metrics/weekly';
import { monthByIndex, pctDelta } from '../../metrics/kpi';

function fmt(n: number | null, suffix = ''): string {
  return n == null ? '–' : `${n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 })}${suffix}`;
}

function DeltaBlock({ label, value }: { label: string; value: number | null }) {
  const color = value == null
    ? 'var(--muted)'
    : value > 0 ? 'var(--primary)'
    : value < 0 ? 'var(--accent-2)'
    : 'var(--muted)';
  const arrow = value == null ? '' : value > 0 ? '▲ ' : value < 0 ? '▼ ' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.6px', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, fontWeight: 800, color }}>
        {value == null ? '—' : `${arrow}${Math.abs(value).toFixed(1)}%`}
      </span>
    </div>
  );
}

function KpiCard({ label, thaiPill, value, prefix, suffix, glyph, mom, yoy }: {
  label: string; thaiPill: string; value: number | null;
  prefix?: string; suffix?: string; glyph: string;
  mom: number | null; yoy: number | null;
}) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 22,
      padding: '22px 24px 20px',
      border: '1px solid var(--line)',
      boxShadow: '0 10px 24px -18px rgba(11,42,38,.3)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.6px' }}>
          {label}
        </span>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'var(--card-2)', padding: '4px 9px', borderRadius: 999 }}>
          {thaiPill}
        </span>
      </div>
      <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 50, lineHeight: 1, letterSpacing: '-1.5px', color: 'var(--ink)' }}>
        {prefix && <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--muted)', marginRight: 3, verticalAlign: 6 }}>{prefix}</span>}
        {fmt(value)}
        {suffix && <small style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)', marginLeft: 2 }}>{suffix}</small>}
      </div>
      <div style={{ display: 'flex', gap: 14, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
        <DeltaBlock label="MoM" value={mom} />
        <DeltaBlock label="YoY" value={yoy} />
      </div>
      <span style={{
        position: 'absolute', right: 14, bottom: 8,
        fontFamily: "'Cormorant Garamond', serif", fontSize: 100,
        fontWeight: 600, fontStyle: 'italic', lineHeight: 1,
        color: 'rgba(36,29,24,.05)', pointerEvents: 'none', userSelect: 'none',
      }}>{glyph}</span>
    </div>
  );
}

export default function KpiCards({
  yearly, yearlyPrev, monthIndex, occOverride, weeklyOverride,
}: {
  yearly?: YearlyReport;
  yearlyPrev?: YearlyReport;
  monthIndex: number;
  occOverride?: number | null;
  weeklyOverride?: WeeklyKpi | null;
}) {
  const cur = monthByIndex(yearly, monthIndex);
  const prevMonth = monthByIndex(yearly, monthIndex === 1 ? 12 : monthIndex - 1);
  const prevYear = monthByIndex(yearlyPrev, monthIndex);

  const occ    = weeklyOverride?.occPct ?? occOverride ?? cur?.occPct ?? null;
  const adr    = weeklyOverride?.adr    ?? cur?.adr    ?? null;
  const revPar = weeklyOverride?.revPar ?? cur?.revPar ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <KpiCard label="Occupancy" thaiPill="ห้องพักที่ขายได้"  value={occ}    suffix="%" glyph="Occ"
        mom={pctDelta(occ,    prevMonth?.occPct ?? null)} yoy={pctDelta(occ,    prevYear?.occPct ?? null)} />
      <KpiCard label="ADR"       thaiPill="ราคาเฉลี่ย/คืน"   value={adr}    prefix="฿" glyph="ADR"
        mom={pctDelta(adr,    prevMonth?.adr    ?? null)} yoy={pctDelta(adr,    prevYear?.adr    ?? null)} />
      <KpiCard label="RevPAR"    thaiPill="รายได้/ห้องว่าง"  value={revPar} prefix="฿" glyph="RevPAR"
        mom={pctDelta(revPar, prevMonth?.revPar ?? null)} yoy={pctDelta(revPar, prevYear?.revPar ?? null)} />
    </div>
  );
}
