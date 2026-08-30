# A for Amitabh · Inder Dass Auditorium — VIP Ticketing

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Supabase. A direct port of
the Streamlit build — same seat matrix, same flow, same look.

```bash
npm install
cp .env.example .env.local     # set ADMIN_PASSWORD and your UPI id
# put your payment QR at public/upi_qr.png
npm run dev                    # http://localhost:3000
```

Runs with **zero database setup** — a JSON store lives in `.data/`. Add the two
Supabase variables to `.env.local` to switch to Postgres; nothing else changes.
Run `supabase/schema.sql` once on the Supabase side.

## Pages

| Route | Streamlit equivalent |
|---|---|
| `/` | BOOK TICKET tab — 3-step wizard |
| `/tickets` | DOWNLOAD TICKET tab |
| `/admin` | ADMIN tab — VERIFY / PRICING / GATE / ROSTER / DANGER |

## What was ported exactly

**`ROW_LAYOUTS`** lives in `src/lib/venue.ts`, copied cell for cell including
every `"AISLE"` marker — rows K and P keep their **double** aisle, row Q keeps
both of its aisles. Verified against the Python:

| | Python | Port |
|---|---|---|
| Total seats | 327 | **327** |
| Pre-blocked | 170 | **170** |
| Sellable | 157 | **157** |
| Per-row | A–J 20, K 14, L–O 18, P 14, Q 27 | **identical** |

**Booking logic** in `src/lib/store.ts` mirrors `reserve_multiple_seats()`:
all-or-nothing, UTR uniqueness, read-after-write verify, four attempts. Verified
by running it: duplicate UTR refused, taken seat refused, blocked seat refused,
and a basket containing one gone seat writes **nothing at all**. `set_status()`,
`check_in()` and `seat_from_payload()` keep their exact message strings, so
`ADMIT — Ramesh Kumar · C11` and `ALREADY CHECKED IN at …` read the same.

**`ONE_PASS_PER_PHONE = False`** — one number can hold any number of seats, and
`/tickets` renders a pass for every one of them.

**The white stadium box** is CSS, not widget hacking. `white-space:nowrap` on
each row strip plus `display:inline-block` on every seat is what keeps a 27-seat
row on one line and scrolling sideways. Seats are exact squares: 32px desktop,
26px mobile, with the Streamlit colours unchanged — green available, gold
gradient selected, `#E8E8E8` grey booked. Aisles are transparent 20px/12px
spacers.

## Seat map — measured off the PDF, not eyeballed

Block counts were read from the PDF text layer, not guessed:

| Block | Count | Meaning |
|---|---|---|
| `{11..20}` + `{1..10}` | 10 + 10 | rows A–J, 20 seats each |
| `{8..14}` | 2 | rows K and P, left blocks |
| `{12..18}` | 4 | rows L–O, left blocks |
| `{10..11}` + `{8..9}` | 4 + 4 | rows L–O, centre blocks (4 seats) |
| `{1..27}` | 1 | row Q — **one continuous row, no aisles** |

Rendered centred on the hall axis (1 char = 1 seat pitch):

```
  A |   ##########.##########   |  20
  D |   XXXXXXXXXX.##########   |  20   X = D11-D20 reserved for LTG
  K |    #######......#######   |  14
  L |    #######.####.#######   |  18
  P |    #######......#######   |  14
  Q |###########################|  27
```

**Gaps are measured in seat-pitch units, not pixels.** That is what makes the
blocks stack in register:

| Row | Layout | Units |
|---|---|---|
| A–J | `[20..11] <1> [10..1]` | 21 |
| K, P | `[14..8] <6> [7..1]` | 20 |
| L–O | `[18..12] <1> [11..8] <1> [7..1]` | 20 |
| Q | `[27..1]` | 27 |

The **6-unit void on K and P** is exactly `gap + 4 centre seats + gap`. Sizing
it as two plain aisles — the obvious shortcut, and what the previous build did —
pulls the rear side blocks inward and the whole rear section falls out of
alignment. With 6 units, **K8 sits directly above L12 and K7 above L7**, proven
numerically: both land at −4 and +3 units from the hall axis.

**Row Q has no aisles.** The PDF prints it as one unbroken run of 27. The
earlier `27..20 | 19..10 | 9..1` split was invented; it is gone.

Pitch is `seat + gutter`, gaps are `N × pitch`, so the grid survives every
breakpoint with no magic pixel values. The scroller is `overflow-x:auto` +
`white-space:nowrap` with a computed `min-width` (**1017px desktop, 789px
mobile**), so on a 390px phone it pans smoothly and never stacks vertically.
Row letters are `position:sticky; left:0`.

Booked seats render as a `<span>`, not a disabled `<button>` — unclickable and
skipped by keyboard navigation, so nobody tabs through dead seats.

## Booking failed with "High demand right now"

That message was a lie. `persist()` ignored the Supabase error object, so a
rejected write — wrong key, an RLS policy, a missing table — changed nothing,
the read-back never matched, the retry loop ran out, and buyers were told a
race had been lost. A database permission problem was being reported as demand.

Every Supabase call now checks its `error` and throws with the real reason;
`/api/book` catches and returns it. The exhausted-retry message no longer
blames demand and says plainly that nothing was charged.

If you see this again, the message will now name the actual cause. The usual
one is using the **anon** key instead of the **service-role** key in
`SUPABASE_SERVICE_ROLE_KEY` — RLS then silently blocks every write.

## Geometry re-measured off the blueprint

The rows were re-derived by measuring the plan, not by eye. Seat boxes are 50px
and the pitch is 60px, so gaps are stated in pitch units:

| Row | Layout | Units |
|---|---|---|
| A–J | `[20..11] <3.3> [10..1]` | 23.3 |
| K, P | `[14..8] <14.2> [7..1]` | 28.2 |
| L–O | `[18..12] <2.3> [11 10] <5.6> [9 8] <2.3> [7..1]` | 28.2 |
| Q | `[27..1]` continuous | 27.0 |

Three corrections this makes:

1. **The rear is WIDER than the front** — 28.2 units against 23.3. The previous
   model had it narrower, which is the main reason the hall looked wrong.
2. **The centre block on L–O is two pairs, not four seats in a run.** The
   stairwell sits between 10 and 9 — exactly why the PDF prints `11 10` and
   `9 8` as separate items.
3. **K and P's void is 14.2 units**, precisely `aisle + 2 + stairwell + 2 +
   aisle`, so their side blocks land in register with L–O's. Verified: K8 and
   L12 both sit 8.1 units left of the hall axis; K7 and L7 both sit 7.1 right.

## Prices where the tier changes

A price band is printed in the map wherever the tier changes — before A, C and
H — instead of only in a legend at the top. By the time you have scrolled to
row P, a legend eight rows above is no help.

## Two smaller fixes

* **"Already booked" is now green**, not gold, so downloading an existing pass
  reads as a different job from buying a new one.
* **A missing `public/upi_qr.png`** used to render as a broken-image glyph in a
  large empty card, which looks like the payment step itself is broken. It now
  falls back to a labelled panel pointing at the UPI ID.

## Loading is not sold out

The booking button used to read **SOLD OUT** and sit disabled on a fresh load.
The backend was fine — verified returning 317 available seats — but `page.tsx`
computed `open` from a `statuses` map that is empty until the first fetch
resolves, so "no data yet" and "no seats left" produced the same answer.

The button now distinguishes four states:

| loaded | error | open | Button |
|---|---|---|---|
| no | — | — | `LOADING SEATS…` disabled |
| yes | yes | — | `UNAVAILABLE` disabled, with a RETRY and the reason |
| yes | no | 0 | `SOLD OUT` disabled |
| yes | no | >0 | `START BOOKING` **enabled** |

`/api/seats` also returns a readable message instead of a bare 500, so a
missing Supabase schema now says so rather than silently looking sold out.

## Seat categories card

Removed from step 1. The tier prices moved into the seat-map legend as compact
chips — a buyer still has to know what a row costs before tapping it, and the
map is where that decision happens. Delete the first `.legend` block in
`SeatMap.tsx` if you want them gone entirely.

## Shared chrome

`Header` and `Stepper` live in `src/components/Chrome.tsx` and are imported by
all three pages. They used to be duplicated in `page.tsx`, which is exactly how
the header drifted out of sync with the theme during the last rewrite — the
booking page was updated, the tickets and admin pages were not, and they
silently rendered unstyled because `.glass` no longer existed.

If you rename a themed class, grep for it across `src/` before shipping. The
CSS and the JSX have no compile-time link, so a stale class name fails silently.

## Capacity changed in this revision

The house block is now **D11–D20 only** — the one instruction printed on the
blueprint ("NOTE: D11 TO D20 RESERVED FOR LTG").

| | Before | Now |
|---|---|---|
| Blocked | 170 | **10** |
| Sellable | 157 | **317** |

The previous build also blocked A6–14, G1–14, H1–10 and the entire rear
K–Q (127 seats). Those are all on sale again. If any of them were deliberate,
add them back to `PRE_BLOCKED_RANGES` in `src/lib/venue.ts` — one line each.

## Three things you should know

**1. Rows K–Q are entirely blocked.** `PRE_BLOCKED_RANGES` covers K1–14, L1–18,
M1–18, N1–18, O1–18, P1–14 and Q1–27 — all 127 rear seats — plus A6–14, D11–20,
G1–14 and H1–10. That is 170 of 327, so **the whole rear half of the map renders
dead grey**. If you meant to sell the rear section, trim those ranges in
`venue.ts`.

**2. Your Python has a crash.** `render_download_tab()` uses `LIME_TEXT` in an
f-string, but that name is never defined — the palette block defines
`GOLD_STOPS`, `GOLD`, `GOLD_SOFT`, `OBSIDIAN`, `NEON` and `AMBER` only. Any
pending booking shown in the Download tab raises `NameError`. Fixed here.

**3. Several CSS classes were referenced but never defined,** so those blocks
rendered as unstyled text in Streamlit: `.notice` (the pending-verification
box), `.trk-rail` / `.trk-fill` (the tracker bar rendered invisible), `.num`,
and the `shimmer` keyframe. `splash_overlay()` also emits `.vip-veil` markup
with no matching CSS, and `@keyframes vipRise` is referenced but missing. This
port completes those classes in the same palette — no new design, just the
styling your markup was already asking for. The splash is dropped rather than
shipped broken.

## One behaviour deliberately not carried over

The Streamlit build sent **whole sheet rows to the browser** to draw the map,
which put every buyer's name and phone number in front of anyone who opened
devtools. `/api/seats` now returns status only. Everything else about the flow
is unchanged.

## Also worth knowing

* **No seat hold.** Your Python has none, so this port has none: a buyer pays
  while the seat is still openly available, and only finds out it was taken when
  they submit. Adding a hold with a TTL is a contained change if you want it.
* **Admin auth** is now an httpOnly signed cookie (8 hours) instead of the
  password travelling on every request.
* **Ticket rendering** moved into the browser. Google ships Inter and Playfair
  as *variable* fonts, and server renderers silently load the Regular instance —
  which is why programmatic passes look limp. Rendering client-side reuses the
  self-hosted `next/font` faces, and the download fires from a real user tap, so
  iOS Safari no longer suppresses it.
