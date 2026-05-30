import { useState } from 'react';
import { buildSnapshot } from './buildSnapshot';
import { saveSnapshot, listSnapshotKeys } from '../lib/api';
import type { Snapshot } from '../types';

export default function UploadPage({ onSaved }: { onSaved: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const htmls = await Promise.all(Array.from(files).map((f) => f.text()));
    const { snapshot: s, errors: e } = buildSnapshot(htmls);
    setSnapshot(s);
    setErrors(e);
  }

  async function save() {
    if (!snapshot?.dataAsOf) {
      setErrors((e) => [...e, 'ไม่พบวันที่ของข้อมูล (Printed on …) — ตรวจไฟล์อีกครั้ง']);
      return;
    }
    const key = `snapshot/${snapshot.dataAsOf}`;
    const existing = await listSnapshotKeys();
    if (existing.includes(key) && !confirm(`มี snapshot วันที่ ${snapshot.dataAsOf} อยู่แล้ว — เขียนทับ?`)) return;
    setBusy(true);
    await saveSnapshot(key, snapshot);
    setBusy(false);
    onSaved();
  }

  const present = (label: string, ok: boolean) => (
    <li className={ok ? 'text-green-700' : 'text-slate-400'}>{ok ? '✓' : '—'} {label}</li>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="font-semibold mb-2">อัปโหลดรายงาน eZee (ลากได้หลายไฟล์)</h2>
        <input type="file" multiple accept=".html,.htm" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}

      {snapshot && (
        <div className="bg-white rounded-xl p-6 shadow space-y-3">
          <p className="text-sm text-slate-600">วันที่ข้อมูล: <b>{snapshot.dataAsOf ?? '—'}</b></p>
          <ul className="text-sm space-y-1">
            {present('Yearly Statistics', !!snapshot.yearly)}
            {present('Contribution Analysis (ช่องทาง)', !!snapshot.channels)}
            {present('Country Wise (สัญชาติ)', !!snapshot.countries)}
            {present('Arrival List (จองล่วงหน้า)', !!snapshot.arrivals)}
          </ul>
          <button onClick={save} disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-50">
            {busy ? 'กำลังบันทึก…' : 'บันทึก snapshot'}
          </button>
        </div>
      )}
    </div>
  );
}
