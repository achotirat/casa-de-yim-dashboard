import { useState } from 'react';
import type { ArrivalsReport } from '../../types';
import { arrivalsForDate, type HousekeepingArrival } from '../../metrics/housekeeping';
import SectionCard, { SectionHead } from './SectionCard';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function guestCountLabel(a: HousekeepingArrival): string {
  const parts: string[] = [];
  if (a.adults != null) parts.push(`${a.adults} ผู้ใหญ่`);
  if (a.children) parts.push(`${a.children} เด็ก`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function copyText(label: string, rows: HousekeepingArrival[]): string {
  if (rows.length === 0) return `${label} — ไม่มีแขกเข้าพัก`;
  return rows
    .map((r) => {
      const lines = [`🏡 ${r.room}`, `แขก: ${r.guest} (${guestCountLabel(r)})`];
      if (r.notes) lines.push(`หมายเหตุ: ${r.notes}`);
      return lines.join('\n');
    })
    .join('\n\n');
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
          ไม่มีแขกเข้าพัก{label === 'วันนี้' ? 'วันนี้' : 'พรุ่งนี้'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--card-2)', borderRadius: 14 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>{r.room}</div>
              <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>
                แขก: {r.guest} ({guestCountLabel(r)})
              </div>
              {r.notes && (
                <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
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
