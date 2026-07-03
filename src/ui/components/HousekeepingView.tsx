import { useState } from 'react';
import type { ArrivalsReport } from '../../types';
import { arrivalsForDate, type HousekeepingArrival } from '../../metrics/housekeeping';
import SectionCard, { SectionHead } from './SectionCard';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Use local calendar date (not toISOString, which converts to UTC and can
  // shift the date backward in timezones ahead of UTC, e.g. Asia/Bangkok).
  return new Intl.DateTimeFormat('en-CA').format(d);
}

function guestCountLabel(a: HousekeepingArrival): string {
  const parts: string[] = [];
  if (a.adults != null) parts.push(`${a.adults} ผู้ใหญ่`);
  if (a.children) parts.push(`${a.children} เด็ก`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function formatShortDate(dateISO: string | null): string {
  if (!dateISO) return '-';
  const [y, m, d] = dateISO.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function nightsLabel(nights: number | null): string {
  return nights != null ? `${nights} คืน` : '-';
}

function copyText(label: string, rows: HousekeepingArrival[]): string {
  if (rows.length === 0) return `${label} — ไม่มีแขกเข้าพัก`;
  return rows
    .map((r) => {
      const lines = [
        `🏡 ${r.room}`,
        `แขก: ${r.guest} (${guestCountLabel(r)})`,
        `เช็คอิน: ${formatShortDate(r.arrivalDate)} · เช็คเอาท์: ${formatShortDate(r.departureDate)} · ${nightsLabel(r.nights)}`,
      ];
      if (r.notes) lines.push(`หมายเหตุ: ${r.notes}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
        {value}
      </span>
    </div>
  );
}

function DaySection({ label, rows }: { label: string; rows: HousekeepingArrival[] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(copyText(label, rows));
      setCopyState('copied');
    } catch (_e) {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }

  const copyLabel = copyState === 'copied' ? 'คัดลอกแล้ว!' : copyState === 'failed' ? 'คัดลอกไม่สำเร็จ' : 'คัดลอกข้อความ';

  return (
    <SectionCard>
      <SectionHead
        title={label}
        right={
          <button
            onClick={onCopy}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
              padding: '8px 16px', fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {copyLabel}
          </button>
        }
      />
      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif" }}>
          ไม่มีแขกเข้าพัก{label}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--card-2)', borderRadius: 14 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>{r.room}</div>
              <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>
                แขก: {r.guest}
              </div>
              <div className="cdy-hk-stat-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12,
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
              }}>
                <Stat label="เช็คอิน" value={formatShortDate(r.arrivalDate)} />
                <Stat label="เช็คเอาท์" value={formatShortDate(r.departureDate)} />
                <Stat label="จำนวนคืน" value={nightsLabel(r.nights)} />
                <Stat label="จำนวนแขก" value={guestCountLabel(r)} />
              </div>
              {r.notes && (
                <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                  หมายเหตุ: {r.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default function HousekeepingView({
  arrivals, onLogout,
}: { arrivals: ArrivalsReport | undefined; onLogout?: () => void }) {
  const today = isoDate(0);
  const tomorrow = isoDate(1);
  const todayRows = arrivalsForDate(arrivals, today);
  const tomorrowRows = arrivalsForDate(arrivals, tomorrow);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {onLogout && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: '1px solid var(--line)', borderRadius: 10,
              padding: '6px 14px', fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700,
              color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      )}
      <DaySection label="วันนี้" rows={todayRows} />
      <DaySection label="พรุ่งนี้" rows={tomorrowRows} />
    </div>
  );
}
