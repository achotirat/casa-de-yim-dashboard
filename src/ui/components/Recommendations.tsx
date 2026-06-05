import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Snapshot } from '../../types';
import { recommend } from '../../recommendations/rules';
import { buildRecoInputs } from '../buildRecoInputs';
import { aiInsight } from '../../lib/api';

function highlightNums(text: string): ReactNode {
  return text.split(/(\d[\d,.%฿]*)/).map((part, i) =>
    /\d/.test(part)
      ? <span key={i} style={{ color: 'var(--gold)', fontWeight: 800 }}>{part}</span>
      : part
  );
}

function highlightNumsAccent(text: string): ReactNode {
  return text.split(/(\d[\d,.%฿]*)/).map((part, i) =>
    /\d/.test(part)
      ? <b key={i} style={{ fontWeight: 700, color: 'var(--accent-2)' }}>{part}</b>
      : part
  );
}

export default function Recommendations({
  latest, previous, dataAsOf,
}: { latest: Snapshot; previous: Snapshot | null; dataAsOf: string }) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputs = buildRecoInputs(latest, previous, undefined);
  const recos = inputs.flatMap((i) => recommend(i));
  const topReco = recos[0] ?? null;

  const MONTH_TH: Record<number, string> = {
    1:'มกราคม',2:'กุมภาพันธ์',3:'มีนาคม',4:'เมษายน',5:'พฤษภาคม',6:'มิถุนายน',
    7:'กรกฎาคม',8:'สิงหาคม',9:'กันยายน',10:'ตุลาคม',11:'พฤศจิกายน',12:'ธันวาคม',
  };
  const currentMonth = MONTH_TH[Number(dataAsOf.slice(5, 7))] ?? '';

  async function askAi() {
    setBusy(true);
    const context = JSON.stringify({ recoInputs: inputs, rules: recos }, null, 2);
    try { setAiText(await aiInsight(context)); }
    catch { setAiText('เรียก AI ไม่สำเร็จ — ตรวจการตั้งค่า API key'); }
    setBusy(false);
  }

  return (
    <div className="cdy-rec-grid" style={{ borderRadius: 22, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.4fr 1fr' }}>

      {/* Left: green gradient */}
      <div style={{ background: 'linear-gradient(140deg, #2E8576, #11463E)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>
          คำแนะนำการปรับราคา · {currentMonth}
        </span>

        <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 19, fontWeight: 800, lineHeight: 1.45, color: '#fff' }}>
          {topReco ? highlightNums(topReco.message) : 'ยังไม่มีสัญญาณที่ต้องดำเนินการ'}
        </div>

        {recos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {recos.slice(0, 4).map((r, i) => {
              const isWarn = r.level === 'red' || r.level === 'orange';
              return (
                <span key={i} style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, fontWeight: 600, background: isWarn ? 'rgba(226,169,91,.22)' : 'rgba(255,255,255,.14)', color: isWarn ? 'var(--gold)' : '#fff', padding: '5px 11px', borderRadius: 8 }}>
                  {r.evidence.slice(0, 45)}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={askAi} disabled={busy} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 11, padding: '9px 16px', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .7 : 1 }}>
            {busy ? 'กำลังถาม AI…' : '✨ ถาม AI'}
          </button>
        </div>
      </div>

      {/* Right: accent-soft */}
      <div style={{ background: 'var(--accent-soft)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(58,30,18,.5)' }}>
          สัญญาณที่ตรวจพบ
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
          {recos.length === 0 ? (
            <p style={{ color: 'rgba(58,30,18,.5)', fontSize: 13 }}>— ยังไม่มีสัญญาณ</p>
          ) : recos.slice(0, 3).map((r, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,.65)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 500, color: 'var(--on-accent)', display: 'flex', alignItems: 'flex-start', gap: 9, border: '1px solid rgba(58,30,18,.07)', lineHeight: 1.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.level === 'green' ? 'var(--primary)' : 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
              <span>{highlightNumsAccent(r.message)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', background: '#fff', borderRadius: 12, padding: '8px 8px 8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {aiText ? (
            <span style={{ flex: 1, fontSize: 12, color: 'var(--on-accent)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{aiText}</span>
          ) : (
            <input placeholder="พิมพ์คำถามถึง Yim AI…" style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12.5, color: 'var(--ink)', outline: 'none' }} />
          )}
          <button onClick={askAi} disabled={busy} style={{ background: 'var(--shell-1)', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 12px', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: busy ? .7 : 1 }}>
            ถาม AI
          </button>
        </div>
      </div>

    </div>
  );
}
