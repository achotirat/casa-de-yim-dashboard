import type { ChannelReport, CountryReport } from '../../types';
import SectionCard, { SectionHead } from './SectionCard';

function barPct(value: number, max: number): string {
  return max > 0 ? `${Math.round((value / max) * 100)}%` : '0%';
}

const CHAN_COLORS = ['#103A34', '#C56A45', '#1E6E62', '#5481A6'];
const CHAN_GRAD_END = ['#1E6E62', '#E2A95B', '#2E8576', '#7AAEC8'];

export default function MixPanels({
  channels, countries,
}: { channels?: ChannelReport; countries?: CountryReport }) {
  const chanRows = (channels?.rows ?? []).filter((r) => (r.roomSold ?? 0) > 0);
  const maxChan = Math.max(1, ...chanRows.map((r) => r.revenue ?? 0));

  const countryRows = (countries?.rows ?? [])
    .filter((r) => r.country !== '-- N/A --')
    .slice(0, 8);
  const maxCountry = Math.max(1, ...countryRows.map((r) => r.revenue ?? 0));
  const totalRev = countryRows.reduce((s, r) => s + (r.revenue ?? 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 16 }}>

      {/* Channels */}
      <SectionCard>
        <SectionHead title="สัดส่วน" italic=" ช่องทาง" meta={`${chanRows.length} ช่องทางหลัก`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {chanRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>— ไม่มีข้อมูล</p>
          ) : chanRows.map((r, idx) => {
            const color = CHAN_COLORS[idx % CHAN_COLORS.length];
            const gradEnd = CHAN_GRAD_END[idx % CHAN_GRAD_END.length];
            const initials = r.source.slice(0, 2).toUpperCase();
            return (
              <div key={r.source} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {initials}
                    </span>
                    <span style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.source}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Manrope', sans-serif" }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{r.revPct?.toFixed(0) ?? '–'}%</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                      ADR <b style={{ color: 'var(--ink)', fontWeight: 700 }}>฿{r.adr?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}</b>
                    </span>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: 'var(--card-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, width: barPct(r.revenue ?? 0, maxChan), background: `linear-gradient(90deg, ${color}, ${gradEnd})` }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Countries */}
      <SectionCard>
        <SectionHead
          title="ตลาดตามสัญชาติ "
          italic="(Top 8)"
          meta="เรียงตาม revenue"
          right={totalRev > 0
            ? <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                รวม <b style={{ color: 'var(--ink)', fontWeight: 700 }}>฿{totalRev.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b>
              </span>
            : undefined}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {countryRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>— ไม่มีข้อมูล</p>
          ) : countryRows.map((r) => (
            <div key={r.country} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: 12, padding: '5px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.country}</span>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--card-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: barPct(r.revenue ?? 0, maxCountry), background: 'linear-gradient(90deg, #103A34, #1E6E62)' }} />
                </div>
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: 'var(--ink)', textAlign: 'right', letterSpacing: '-.3px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>฿</span>
                {r.revenue?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}
