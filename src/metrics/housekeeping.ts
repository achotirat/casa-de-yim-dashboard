import type { ArrivalsReport } from '../types';

export interface HousekeepingArrival {
  room: string;
  guest: string;
  adults: number | null;
  children: number | null;
  arrivalDate: string; // ISO
  notes: string;       // raw, unredacted — see docs/adr/0001-housekeeper-notes-passthrough-raw.md
}

export function arrivalsForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string
): HousekeepingArrival[] {
  const rows = arrivals?.rows ?? [];
  return rows
    .filter((r) => r.arrival === dateISO && r.resType === 'Confirm Booking')
    .map((r) => ({
      room: r.room,
      guest: r.guest,
      adults: r.pax,
      children: r.children,
      arrivalDate: r.arrival as string,
      notes: r.notes,
    }))
    .sort((a, b) => a.room.localeCompare(b.room));
}
