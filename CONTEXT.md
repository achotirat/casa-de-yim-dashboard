# Casa de Yim Dashboard

Revenue and operations dashboard for Casa de Yim Pool Villa (Krabi). Ingests eZee property-management-system reports and serves two audiences with different trust levels: the owner (full revenue visibility) and housekeeping staff (operational briefing only, no revenue data).

## Language

**Role**:
A named identity level a login session holds — currently `owner` or `housekeeper`. Determines which permissions a session's token carries.
_Avoid_: user type, account type

**Permission**:
A single named capability (e.g. `read:arrivals`, `write:maintenance-ticket`) that a role either holds or doesn't. Endpoints declare which permission they require; a request is authorized if the caller's role holds it. Action-based, not resource-scoped — there is no per-housekeeper or per-villa access distinction (single shared `HOUSEKEEPING_PASSWORD` for all housekeeping staff).
_Avoid_: scope, right, access level

**Snapshot**:
A single point-in-time capture of parsed eZee report data (yearly stats, channel/country mix, arrivals, monthly stats), keyed by `dataAsOf` date. The dashboard's only data source — no live eZee connection.

**Arrival**:
A single guest booking's check-in record from eZee's Arrival List report — guest name, room, dates, pax, free-text notes. Distinct from a **Reservation**, which is the booking as it exists in eZee itself (dashboard only ever sees the Arrival List projection of it, not the full reservation).
_Avoid_: booking, reservation (when referring to dashboard data specifically)

## Relationships

- A **Snapshot** contains zero or more **Arrivals**
- A **Role** holds a set of **Permissions**
- A login session is authenticated as exactly one **Role**

**Villa**:
A single standalone bookable unit at the property. Currently 4 (A1–A4), 1:1 with eZee's `room` field — no multi-room villas or shared units. Villa count is expected to grow within ~5 months (2026-12); `metrics/capacity.ts`'s hardcoded default of 4 will need revisiting when that happens.
_Avoid_: room (except when referring to eZee's raw `room` field specifically)

## Flagged ambiguities

- Arrival **notes** field (free text from eZee) can contain payment/rate information mixed with operational details (arrival time, airport transfer, bed prefs). Decision: passed through raw/unredacted to all roles including `housekeeper` — the "no revenue data to housekeeper role" guarantee applies only to *structured* fields (rates, ADR, yearly stats, channel/country mix), not free text. See housekeeping briefing spec (2026-07-02) for full reasoning — candidate for an ADR.

## Example dialogue

> **Dev:** "Should the maintenance ticket **Permission** be scoped per villa, since housekeepers report issues per villa?"
> **Domain expert:** "No — there's only one `housekeeper` **Role** right now, shared by all staff. Which villa a ticket is about is just a field on the ticket, not an authorization boundary."
