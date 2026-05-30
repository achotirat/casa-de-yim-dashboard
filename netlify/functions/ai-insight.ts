import type { Config } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthed } from './_auth';

const SYSTEM = `คุณเป็นที่ปรึกษา revenue management ของโรงแรมพูลวิลล่าเล็ก ๆ ในกระบี่ (Casa de Yim).
หน้าที่: อ่านตัวเลขสรุป (occupancy, ADR, RevPAR, pace, สัดส่วนช่องทาง, ตลาดตามสัญชาติ) แล้วให้คำแนะนำการปรับราคา/โปรโมชั่นเป็นภาษาไทย กระชับ เป็นข้อ ๆ.
หลักการ: จัดลำดับความเร่งด่วน, อ้างอิงตัวเลขจริง, เสนอไอเดียโปรที่อิงตลาดหลัก, เตือน seasonality.
ข้อจำกัด: เป็นคำแนะนำประกอบการตัดสินใจเท่านั้น ห้ามสั่งปรับราคาเอง และอย่ากุตัวเลขที่ไม่ได้ให้มา.`;

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  if (!isAuthed(req, secret)) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response('Missing ANTHROPIC_API_KEY', { status: 500 });

  const body = (await req.json()) as { context: string };
  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      { role: 'user', content: `นี่คือสรุปตัวเลขล่าสุด:\n\n${body.context}\n\nช่วยให้คำแนะนำการปรับราคา/โปรโมชั่นเป็นข้อ ๆ` },
    ],
  });

  const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n');
  return Response.json({ ok: true, text });
}

export const config: Config = { path: '/api/ai-insight' };
