import type { ArrivalsReport } from '../types';

export interface HousekeepingArrival {
  room: string;
  guest: string;
  adults: number | null;
  children: number | null;
  arrivalDate: string;         // ISO
  departureDate: string | null; // ISO
  nights: number | null;
  notes: string;       // raw, unredacted — see docs/adr/0001-housekeeper-notes-passthrough-raw.md
}

function nightsBetween(arrivalISO: string, departureISO: string | null): number | null {
  if (!departureISO) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((new Date(departureISO).getTime() - new Date(arrivalISO).getTime()) / msPerDay);
  return diff > 0 ? diff : null;
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
      departureDate: r.departure,
      nights: nightsBetween(r.arrival as string, r.departure),
      notes: r.notes,
    }))
    .sort((a, b) => a.room.localeCompare(b.room));
}
