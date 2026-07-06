import type { ArrivalsReport } from '../types';

export interface HousekeepingArrival {
  resNo: string;
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
      resNo: r.resNo,
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
  resNo: string;
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
      resNo: r.resNo,
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

export function stayoverArrivalsForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string
): HousekeepingArrival[] {
  const rows = arrivals?.rows ?? [];
  return rows
    .filter((r) =>
      r.resType === 'Confirm Booking' &&
      r.arrival !== null && r.arrival < dateISO &&
      r.departure !== null && r.departure > dateISO
    )
    .map((r) => ({
      resNo: r.resNo,
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

export type VillaStatus =
  | { kind: 'vacant' }
  | { kind: 'arriving'; arrival: HousekeepingArrival }
  | { kind: 'departing'; departure: HousekeepingDeparture }
  | { kind: 'turnover'; departure: HousekeepingDeparture; arrival: HousekeepingArrival }
  | { kind: 'stayover'; arrival: HousekeepingArrival };

export interface VillaStatusRow {
  room: string;
  status: VillaStatus;
}

// Note: eZee's Arrival List export only contains rows whose *arrival* date
// falls within the exported window (today -> +2 months) — a guest who
// checked in before that window is missing from a single day's export.
// The `arrivals` passed in here is expected to already be merged across a
// lookback of prior days' snapshots (see netlify/functions/snapshots.ts)
// so that stayover/departing rows outside the export window are present.
export function villaStatusesForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string,
  villaRooms: string[] = villaRoomLabels()
): VillaStatusRow[] {
  const arrivalByRoom = new Map(arrivalsForDate(arrivals, dateISO).map((a) => [a.room, a]));
  const departureByRoom = new Map(departuresForDate(arrivals, dateISO).map((d) => [d.room, d]));
  const stayoverByRoom = new Map(stayoverArrivalsForDate(arrivals, dateISO).map((a) => [a.room, a]));

  return villaRooms.map((room) => {
    const arrival = arrivalByRoom.get(room);
    const departure = departureByRoom.get(room);
    if (departure && arrival) return { room, status: { kind: 'turnover', departure, arrival } };
    if (departure) return { room, status: { kind: 'departing', departure } };
    if (arrival) return { room, status: { kind: 'arriving', arrival } };
    const stayover = stayoverByRoom.get(room);
    if (stayover) return { room, status: { kind: 'stayover', arrival: stayover } };
    return { room, status: { kind: 'vacant' } };
  });
}
