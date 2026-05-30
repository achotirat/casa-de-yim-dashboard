export interface RecoInput {
  monthLabel: string;
  occNow: number | null;
  leadDays: number | null;
  pacePerWeek: number | null;
  occPrevYear: number | null;
}

export interface Reco {
  level: 'red' | 'orange' | 'green';
  message: string;
  evidence: string;
}

export function recommend(input: RecoInput): Reco[] {
  const { monthLabel, occNow, leadDays, pacePerWeek, occPrevYear } = input;
  const out: Reco[] = [];
  if (occNow == null) return out;
  const ev = `occ ${occNow.toFixed(1)}%` +
    (leadDays != null ? `, เหลือ ${leadDays} วัน` : '') +
    (pacePerWeek != null ? `, pace ${pacePerWeek >= 0 ? '+' : ''}${pacePerWeek.toFixed(1)} จุด/สัปดาห์` : '') +
    (occPrevYear != null ? `, ปีก่อน ${occPrevYear.toFixed(1)}%` : '');

  if (leadDays != null && leadDays <= 14 && occNow < 40) {
    out.push({ level: 'red', message: `${monthLabel}: เหลือเวลาน้อยและ occ ต่ำมาก — ลดราคาแรง / flash deal บน OTA`, evidence: ev });
  } else if (leadDays != null && leadDays <= 30 && occNow < 50 && pacePerWeek != null && pacePerWeek < 5) {
    out.push({ level: 'orange', message: `${monthLabel}: occ ต่ำและ pace ช้า — ลดราคา 10–15% หรือออกโปรนาทีสุดท้าย`, evidence: ev });
  }

  if (occPrevYear != null && occNow < occPrevYear - 15) {
    out.push({ level: 'orange', message: `${monthLabel}: ตามหลังปีก่อนมาก (${(occPrevYear - occNow).toFixed(1)} จุด) — พิจารณาโปร/เพิ่มโฆษณา`, evidence: ev });
  }

  if (occNow >= 85 && leadDays != null && leadDays > 14) {
    out.push({ level: 'green', message: `${monthLabel}: ดีมานด์แรงและยังมีเวลา — ขึ้นราคาได้ 5–10%`, evidence: ev });
  } else if (occPrevYear != null && occNow >= occPrevYear && pacePerWeek != null && pacePerWeek >= 5) {
    out.push({ level: 'green', message: `${monthLabel}: เกาะ/นำปีก่อนและ pace ดี — คงราคา หรือทดลองขึ้นเล็กน้อย`, evidence: ev });
  }

  return out;
}
