export function parseNum(s: string | null | undefined): number | null {
  if (s == null) return null;
  const cleaned = s.replace(/,/g, '').replace(/\s+/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePax(s: string | null | undefined): { adults: number | null; children: number | null } {
  if (!s) return { adults: null, children: null };
  const m = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { adults: Number(m[1]), children: Number(m[2]) };
  return { adults: parseNum(s), children: null };
}
