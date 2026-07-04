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

export interface HousekeepingDeparture {
  room: string;
  guest: string;
  departureDate: string; // ISO
  sameDayTurnover: boolean; // a new confirmed guest arrives in the same room on this date
}

export function departuresForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string
): HousekeepingDeparture[] {
  const rows = arrivals?.rows ?? [];
  const confirmed = rows.filter((r) => r.resType === 'Confirm Booking');
  const arrivingRoomsToday = new Set(
    confirmed.filter((r) => r.arrival === dateISO).map((r) => r.room)
  );
  return confirmed
    .filter((r) => r.departure === dateISO)
    .map((r) => ({
      room: r.room,
      guest: r.guest,
      departureDate: r.departure as string,
      sameDayTurnover: arrivingRoomsToday.has(r.room),
    }))
    .sort((a, b) => a.room.localeCompare(b.room));
}

// Casa de Yim currently has 4 villas (A1-A4), matching villaCount()'s
// default in metrics/capacity.ts — revisit both when villa count grows
// (see CONTEXT.md "Villa"). eZee's `room` field format is "A{n} - Villa A{n}".
export function villaRoomLabels(count = 4): string[] {
  return Array.from({ length: count }, (_, i) => `A${i + 1} - Villa A${i + 1}`);
}

export type VillaStatus =
  | { kind: 'vacant' }
  | { kind: 'arriving'; arrival: HousekeepingArrival }
  | { kind: 'departing'; departure: HousekeepingDeparture }
  | { kind: 'turnover'; departure: HousekeepingDeparture; arrival: HousekeepingArrival };

export interface VillaStatusRow {
  room: string;
  status: VillaStatus;
}

// Note: eZee's Arrival List export only contains rows whose *arrival* date
// falls within the exported window (today -> +2 months) — a guest who
// checked in before that window and is just staying through today never
// appears in this data. A villa with no matching arrival/departure row is
// reported "vacant" here, but may in fact have a staying guest; the UI
// must not claim the villa is empty, only that no check-in/out action is
// needed today. True "stayover" detection needs a different eZee report.
export function villaStatusesForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string,
  villaRooms: string[] = villaRoomLabels()
): VillaStatusRow[] {
  const arrivalByRoom = new Map(arrivalsForDate(arrivals, dateISO).map((a) => [a.room, a]));
  const departureByRoom = new Map(departuresForDate(arrivals, dateISO).map((d) => [d.room, d]));

  return villaRooms.map((room) => {
    const arrival = arrivalByRoom.get(room);
    const departure = departureByRoom.get(room);
    if (departure && arrival) return { room, status: { kind: 'turnover', departure, arrival } };
    if (departure) return { room, status: { kind: 'departing', departure } };
    if (arrival) return { room, status: { kind: 'arriving', arrival } };
    return { room, status: { kind: 'vacant' } };
  });
}
