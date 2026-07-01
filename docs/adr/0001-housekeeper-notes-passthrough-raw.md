# Housekeeper role receives arrival notes unredacted, despite occasional revenue data

Status: accepted

The `housekeeper` login role is designed to never receive structured revenue data (rates, ADR, yearly stats, channel/country mix) — enforced server-side in `/api/snapshots` by returning a stripped response shape for that role. However, the arrival `notes` field (free text scraped from eZee's Arrival List report) sometimes contains payment amounts, prepayment status, and rate-plan names mixed in with genuinely operational content (arrival times, airport transfer details, bed/room preferences, special requests).

We considered redacting notes before they reach the housekeeper role, via either a denylist (strip known financial phrases, pass the rest through) or an allowlist (only pass recognized-safe segments, drop everything else by default — the fail-closed choice for the stated security guarantee). Both were rejected: eZee's note formatting is inconsistent and evolving, so pattern-matching risks either missing new financial phrasing (denylist) or discarding genuinely useful operational content that doesn't match a known-safe pattern (allowlist) — and note text is exactly where the operationally critical details (arrival time, transfer requests, bed prep) live.

Decision: notes pass through raw and unredacted to the `housekeeper` role. The "no revenue data" guarantee for that role applies only to structured snapshot fields, not free text. This is an explicit, accepted trade-off — not an oversight.
