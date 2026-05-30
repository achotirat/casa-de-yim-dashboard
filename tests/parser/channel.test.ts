import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseChannel } from '../../src/parser/channel';

const html = readFileSync('tests/fixtures/channel.html', 'utf-8');

describe('parseChannel', () => {
  it('parses period and scope', () => {
    const r = parseChannel(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.periodFrom).toBe('2026-05-01');
    expect(r.data.periodTo).toBe('2026-05-31');
    expect(r.data.scope).toBe('month');
  });

  it('parses Airbnb and Booking rows', () => {
    const r = parseChannel(html);
    if (!r.ok) throw new Error(r.reason);
    const airbnb = r.data.rows.find((x) => x.source === 'Airbnb')!;
    expect(airbnb.roomSold).toBe(27);
    expect(airbnb.occPct).toBe(21.77);
    expect(airbnb.pax).toBe(166);
    expect(airbnb.revenue).toBe(201661.2);
    expect(airbnb.revPct).toBe(57.62);
    expect(airbnb.adr).toBe(6980.31);
    const booking = r.data.rows.find((x) => x.source === 'Booking.com')!;
    expect(booking.roomSold).toBe(19);
    expect(booking.paxChild).toBe(9);
  });

  it('parses grand total', () => {
    const r = parseChannel(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.total.roomSold).toBe(46);
    expect(r.data.total.adr).toBe(7110.78);
  });
});
