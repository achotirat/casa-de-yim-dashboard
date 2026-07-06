import { useEffect, useState } from 'react';
import type { ArrivalsReport } from '../../types';
import {
  arrivalsForDate, departuresForDate, villaStatusesForDate,
  type HousekeepingArrival, type HousekeepingDeparture, type VillaStatus, type VillaStatusRow,
} from '../../metrics/housekeeping';
import { getVillaStatuses, updateVillaStatus, type VillaStatusEntry } from '../../lib/api';
import SectionCard, { SectionHead } from './SectionCard';

function generatePasscode(): string {
  const digits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `00${digits}`;
}

function controllingResNo(status: VillaStatus): string | null {
  switch (status.kind) {
    case 'vacant': return null;
    case 'arriving': return status.arrival.resNo;
    case 'departing': return status.departure.resNo;
    case 'turnover': return status.arrival.resNo; // the incoming guest, per spec
    case 'stayover': return status.arrival.resNo;
  }
}

function hasPasscodeControl(kind: VillaStatus['kind']): boolean {
  return kind === 'arriving' || kind === 'turnover' || kind === 'stayover';
}

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

function villaCode(room: string): string {
  return room.split(' - ')[0] ?? room;
}

function villaStatusLine(status: VillaStatus): string {
  switch (status.kind) {
    case 'vacant':
      return 'ว่าง / ไม่มีการเข้า-ออกวันนี้';
    case 'arriving':
      return `เช็คอิน: ${status.arrival.guest}`;
    case 'departing':
      return `เช็คเอาท์: ${status.departure.guest}`;
    case 'turnover':
      return `เช็คเอาท์: ${status.departure.guest} → เช็คอิน: ${status.arrival.guest}`;
    case 'stayover':
      return `พักต่อ: ${status.arrival.guest}`;
  }
}

function villaStatusCopyLine(r: VillaStatusRow): string {
  return `${villaCode(r.room)}: ${villaStatusLine(r.status)}`;
}

function arrivalCopyLines(r: HousekeepingArrival): string {
  const lines = [
    `🏡 ${r.room}`,
    `แขก: ${r.guest} (${guestCountLabel(r)})`,
    `เช็คอิน: ${formatShortDate(r.arrivalDate)} · เช็คเอาท์: ${formatShortDate(r.departureDate)} · ${nightsLabel(r.nights)}`,
  ];
  if (r.notes) lines.push(`หมายเหตุ: ${r.notes}`);
  return lines.join('\n');
}

function departureCopyLines(r: HousekeepingDeparture): string {
  const lines = [`🏡 ${r.room}`, `แขก: ${r.guest}`];
  if (r.sameDayTurnover) lines.push('⚠️ มีแขกใหม่เข้าพักวันเดียวกัน — ทำความสะอาดด่วน');
  return lines.join('\n');
}

function dayCopyText(label: string, arrivals: HousekeepingArrival[], departures: HousekeepingDeparture[]): string {
  const sections: string[] = [];
  sections.push(
    arrivals.length > 0
      ? `เช็คอิน:\n\n${arrivals.map(arrivalCopyLines).join('\n\n')}`
      : 'เช็คอิน: ไม่มีแขกเข้าพัก'
  );
  sections.push(
    departures.length > 0
      ? `เช็คเอาท์:\n\n${departures.map(departureCopyLines).join('\n\n')}`
      : 'เช็คเอาท์: ไม่มีแขกเช็คเอาท์'
  );
  return `${label}\n\n${sections.join('\n\n---\n\n')}`;
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

function ArrivalCard({ r }: { r: HousekeepingArrival }) {
  return (
    <div style={{ padding: '12px 16px', background: 'var(--card-2)', borderRadius: 14 }}>
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
  );
}

function DepartureRow({ r }: { r: HousekeepingDeparture }) {
  return (
    <div className="cdy-hk-departure-row" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '12px 16px', borderRadius: 14,
      background: r.sameDayTurnover ? 'var(--accent-soft)' : 'var(--card-2)',
    }}>
      <div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>{r.room}</div>
        <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>
          แขก: {r.guest}
        </div>
      </div>
      {r.sameDayTurnover && (
        <span style={{
          fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, fontWeight: 700,
          color: 'var(--on-accent)', background: 'var(--gold)', padding: '6px 12px', borderRadius: 999,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          แขกใหม่เข้าวันนี้ · ทำความสะอาดด่วน
        </span>
      )}
    </div>
  );
}

function SubsectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, color: 'var(--muted)',
      textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

const VILLA_STATUS_BADGE: Record<VillaStatus['kind'], { label: string; bg: string; color: string }> = {
  vacant:    { label: 'ว่าง',      bg: 'var(--card-2)',     color: 'var(--muted)' },
  arriving:  { label: 'เช็คอิน',   bg: 'var(--primary)',    color: '#fff' },
  departing: { label: 'เช็คเอาท์', bg: 'var(--accent-2)',   color: '#fff' },
  turnover:  { label: 'เช็คเอาท์ + เช็คอิน', bg: 'var(--gold)', color: 'var(--on-accent)' },
  stayover:  { label: 'พักต่อ', bg: 'var(--card-2)', color: 'var(--ink)' },
};

const PASSCODE_RE = /^\d{6}$/;

function PasscodeControl({
  resNo, value, onUpdate,
}: { resNo: string; value: string | null; onUpdate: (resNo: string, patch: Partial<VillaStatusEntry>) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  function commit(next: string) {
    if (next === '') return;
    if (!PASSCODE_RE.test(next)) {
      setError('รหัสต้องเป็นตัวเลข 6 หลัก');
      return;
    }
    setError(null);
    onUpdate(resNo, { passcode: next });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          placeholder="รหัสประตู"
          style={{
            width: 90, fontFamily: "'Manrope', monospace", fontSize: 13, padding: '5px 8px',
            borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)',
          }}
        />
        <button
          onClick={() => {
            const code = generatePasscode();
            setDraft(code);
            setError(null);
            onUpdate(resNo, { passcode: code });
          }}
          style={{
            background: 'none', border: '1px solid var(--line)', borderRadius: 8,
            padding: '5px 10px', fontFamily: "'Manrope', sans-serif", fontSize: 11.5, fontWeight: 700,
            color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          สร้างรหัส
        </button>
      </div>
      {error && (
        <span style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 11, color: 'var(--accent-2)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

function VillaRow({
  r, villaStatusData, onUpdate,
}: {
  r: VillaStatusRow;
  villaStatusData: Record<string, VillaStatusEntry>;
  onUpdate: (resNo: string, patch: Partial<VillaStatusEntry>) => void;
}) {
  const badge = VILLA_STATUS_BADGE[r.status.kind];
  const resNo = controllingResNo(r.status);
  const entry = resNo ? villaStatusData[resNo] : undefined;
  return (
    <div className="cdy-hk-villa-row" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      padding: '12px 16px', borderRadius: 14, background: 'var(--card-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 20, color: 'var(--ink)' }}>
          {villaCode(r.room)}
        </span>
        <span style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--ink)' }}>
          {villaStatusLine(r.status)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {resNo && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, color: 'var(--ink)',
          }}>
            <input
              type="checkbox"
              checked={entry?.ready ?? false}
              onChange={() => onUpdate(resNo, { ready: !(entry?.ready ?? false) })}
            />
            พร้อมรับแขก
          </label>
        )}
        {resNo && hasPasscodeControl(r.status.kind) && (
          <PasscodeControl resNo={resNo} value={entry?.passcode ?? null} onUpdate={onUpdate} />
        )}
        <span style={{
          fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 11.5, fontWeight: 700,
          color: badge.color, background: badge.bg, padding: '5px 11px', borderRadius: 999,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {badge.label}
        </span>
      </div>
    </div>
  );
}

function VillaRosterSection({
  label, rows, villaStatusData, onUpdate,
}: {
  label: string;
  rows: VillaStatusRow[];
  villaStatusData: Record<string, VillaStatusEntry>;
  onUpdate: (resNo: string, patch: Partial<VillaStatusEntry>) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(`${label}\n\n${rows.map(villaStatusCopyLine).join('\n')}`);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r) => (
          <VillaRow key={r.room} r={r} villaStatusData={villaStatusData} onUpdate={onUpdate} />
        ))}
      </div>
    </SectionCard>
  );
}

function DaySection({
  label, arrivals, departures,
}: { label: string; arrivals: HousekeepingArrival[]; departures: HousekeepingDeparture[] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(dayCopyText(label, arrivals, departures));
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <SubsectionLabel>เช็คอิน</SubsectionLabel>
          {arrivals.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif" }}>
              ไม่มีแขกเข้าพัก{label}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {arrivals.map((r, i) => <ArrivalCard key={i} r={r} />)}
            </div>
          )}
        </div>
        <div>
          <SubsectionLabel>เช็คเอาท์</SubsectionLabel>
          {departures.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif" }}>
              ไม่มีแขกเช็คเอาท์{label}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {departures.map((r, i) => <DepartureRow key={i} r={r} />)}
            </div>
          )}
        </div>
      </div>
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
  const departuresToday = departuresForDate(arrivals, today);
  const departuresTomorrow = departuresForDate(arrivals, tomorrow);
  const villaStatusesToday = villaStatusesForDate(arrivals, today);
  const villaStatusesTomorrow = villaStatusesForDate(arrivals, tomorrow);

  const [villaStatusData, setVillaStatusData] = useState<Record<string, VillaStatusEntry>>({});

  useEffect(() => {
    const resNos = [...villaStatusesToday, ...villaStatusesTomorrow]
      .map((r) => controllingResNo(r.status))
      .filter((r): r is string => r !== null);
    const unique = Array.from(new Set(resNos));
    if (unique.length > 0) getVillaStatuses(unique).then(setVillaStatusData);
  }, [arrivals]);

  async function onUpdate(resNo: string, patch: Partial<VillaStatusEntry>) {
    setVillaStatusData((prev) => ({ ...prev, [resNo]: { ...(prev[resNo] ?? { ready: false, passcode: null }), ...patch } }));
    await updateVillaStatus(resNo, patch);
  }

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
      <VillaRosterSection label="สถานะวิลล่า — วันนี้" rows={villaStatusesToday} villaStatusData={villaStatusData} onUpdate={onUpdate} />
      <VillaRosterSection label="สถานะวิลล่า — พรุ่งนี้" rows={villaStatusesTomorrow} villaStatusData={villaStatusData} onUpdate={onUpdate} />
      <DaySection label="วันนี้" arrivals={todayRows} departures={departuresToday} />
      <DaySection label="พรุ่งนี้" arrivals={tomorrowRows} departures={departuresTomorrow} />
    </div>
  );
}
