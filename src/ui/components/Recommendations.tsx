import { useState } from 'react';
import type { Snapshot } from '../../types';
import { recommend } from '../../recommendations/rules';
import { buildRecoInputs } from '../buildRecoInputs';
import { aiInsight } from '../../lib/api';

const LEVEL_STYLE = {
  red: 'bg-red-50 border-red-200 text-red-800',
  orange: 'bg-amber-50 border-amber-200 text-amber-800',
  green: 'bg-green-50 border-green-200 text-green-800',
};

export default function Recommendations({
  latest, previous,
}: { latest: Snapshot; previous: Snapshot | null }) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputs = buildRecoInputs(latest, previous, undefined);
  const recos = inputs.flatMap((i) => recommend(i));

  async function askAi() {
    setBusy(true);
    const context = JSON.stringify({ recoInputs: inputs, rules: recos }, null, 2);
    try {
      setAiText(await aiInsight(context));
    } catch (_e) {
      setAiText('เรียก AI ไม่สำเร็จ — ตรวจการตั้งค่า API key');
    }
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">คำแนะนำการปรับราคา</h3>
        <button onClick={askAi} disabled={busy} className="text-sm bg-slate-800 text-white rounded px-3 py-1.5 disabled:opacity-50">
          {busy ? 'กำลังถาม AI…' : '✨ ถาม AI'}
        </button>
      </div>

      {recos.length === 0 ? (
        <p className="text-slate-400 text-sm">— ยังไม่มีสัญญาณที่ต้องดำเนินการ</p>
      ) : recos.map((r, i) => (
        <div key={i} className={`border rounded-lg p-3 text-sm ${LEVEL_STYLE[r.level]}`}>
          <div className="font-medium">{r.message}</div>
          <div className="text-xs opacity-70 mt-1">{r.evidence}</div>
        </div>
      ))}

      {aiText && (
        <div className="border-t pt-3 mt-3">
          <div className="text-xs text-slate-400 mb-1">สรุปโดย AI</div>
          <div className="text-sm whitespace-pre-wrap text-slate-700">{aiText}</div>
        </div>
      )}
    </div>
  );
}
