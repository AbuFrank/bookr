# Local vs. UTC date bugs in Node apps

A recurring bug class in any app that lets a user pick a **calendar date**
(as opposed to a precise moment in time) and later needs to read that date
back somewhere else — a different server, a different user's browser, a
serverless function, a different day of the year with different DST rules.
The symptoms are usually one of:

- The date displays a day off (usually only for some users, sometimes only
  near month/DST boundaries).
- The date displays as `NaN`/`Invalid Date`.
- It works perfectly in local dev and breaks only in production, or only
  for users outside the developer's own timezone.

## Root cause

A JS `Date` object is not a calendar date — it's a single instant in time
(milliseconds since the Unix epoch), stored internally with no timezone
attached. Timezone only enters the picture at the two edges: when you
*construct* a `Date` from human-readable components, and when you *read*
one back out with a getter. Both of those operations are silently
local-timezone-dependent unless you say otherwise:

```js
new Date(2026, 0, 1)     // "local midnight, Jan 1" — in whatever TZ this runs in
someDate.getDate()       // day-of-month — in whatever TZ this runs in
someDate.getMonth()
someDate.getFullYear()
```

The bug appears the moment construction and reading happen in **different**
processes that don't share a timezone: a date picker running in a user's
browser (their local TZ) constructs the `Date`, it crosses a network/DB
boundary as an instant, and a server or a different user's browser later
reads it back with local getters in *its own* TZ. Local midnight in one zone
is not local midnight in another, so the calendar day you get back can be
the previous or next day depending on the offset and direction.

A second, related failure shows up at serialization boundaries. `Date`
objects and date-library "Timestamp" types often look similar but serialize
differently over JSON:

```js
JSON.stringify(new Date())        // '"2026-07-29T18:23:45.123Z"'  (ISO string)
JSON.stringify(firestoreTimestamp) // '{"seconds":...,"nanoseconds":...}' (custom toJSON)
```

Code that expects one shape (e.g. destructuring `{ seconds }`) and receives
the other (a plain ISO string) doesn't get a wrong date — it gets
`undefined` fields and produces `NaN`/`Invalid Date`. This typically shows
up for records that haven't round-tripped through your database yet (still
holding the shape produced by the client) alongside older records that have
(now holding the shape produced by the database SDK) — so the bug looks
inconsistent and hard to reproduce, because it depends on the object's
*history*, not its current value.

## Why it survives testing

- A single developer, testing alone, has the same local TZ on client and
  server (or an offset small enough to not cross a day boundary) — no
  bug ever appears.
- CI usually runs in UTC, so if your test dates happen to be constructed
  and read in the same process, the bug is invisible there too — the two
  sides are both "UTC" and therefore consistent, even though the
  underlying code is still timezone-fragile.
- It only becomes visible with real cross-timezone usage: a user in one
  zone, a server (or a teammate) in another, which is exactly the
  situation that's easy to not test until it happens live.

## The fix

First, decide what you actually have: a **calendar date** (a day, with no
inherent time-of-day or timezone — a birthday, a due date, a transaction
date) or an **instant** (a specific moment — "when this record was
created," a timestamp for ordering). They need different handling.

### For calendar dates

Don't let timezone enter the picture at all.

1. **Anchor at write time.** When you read a calendar date out of a picker
   (which typically hands you a `Date` at local midnight), immediately
   convert it to a timezone-independent representation before it leaves
   the component that captured it:

   ```js
   // Capture the calendar day using local getters (correct here — this IS
   // the timezone the user meant), then re-encode it as UTC midnight so it
   // survives being read anywhere else.
   const toUTCDateOnly = (date) =>
     new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
   ```

   Or, often simpler and more explicit: don't use a `Date` object at all —
   store/transmit `"2026-01-01"` as a plain string and treat it as an
   opaque value until you need to render it.

2. **Always read with UTC getters**, everywhere the date is displayed or
   formatted — client and server alike:

   ```js
   date.getUTCFullYear();
   date.getUTCMonth();
   date.getUTCDate();
   ```

   Never `getDate()`/`getMonth()`/`getFullYear()` for a value that's meant
   to represent a calendar day, since those are local-timezone-dependent by
   definition. Grep for these as a code smell whenever a bug report mentions
   dates being "a day off."

3. **Prefer a library that makes this the default** instead of hand-rolling
   it: `date-fns` has `formatInTimeZone` (via `date-fns-tz`); `Luxon`'s
   `DateTime` distinguishes local vs UTC explicitly in its API; the
   upcoming `Temporal` API has a dedicated `PlainDate` type for exactly
   this "calendar date, no timezone" case, separate from `Instant`.

### For instants (timestamps)

`Date`/epoch millis are the right representation — don't fight that. But
still be deliberate about the read side: if you need to *display* an
instant as a calendar date/time to a user, convert it to *that user's*
timezone explicitly, not the reading process's timezone:

```js
new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' }).format(date);
// or, with date-fns-tz:
formatInTimeZone(date, 'America/New_York', 'MM/dd/yyyy');
```

Never rely on `getMonth()`/`getDate()`/`toLocaleDateString()` with no
explicit `timeZone` for this — their output silently depends on the OS/
process timezone of wherever the code happens to execute (a developer's
laptop, a serverless region, a Docker container), not the user's.

### At serialization boundaries

Whenever a date-like value crosses a network/JSON boundary (client → API,
service → service), don't assume its shape is preserved. Normalize
defensively on the receiving side rather than trusting a single expected
shape:

```js
function toDate(value) {
  if (value instanceof Date) return value;
  if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000); // Timestamp-shaped
  return new Date(value); // ISO string, epoch millis, etc.
}
```

This also matters for values that haven't round-tripped through your
database's SDK yet — e.g. a freshly created record still sitting in local/
client state, serialized as a plain `Date`'s ISO string, versus the same
record after a reload, now shaped like the DB's native timestamp type.
Handle both, or normalize to one shape as early as possible (ideally right
where the record is created, before it ever gets used).

## Testing for it

The cheapest way to catch this class of bug in CI, before it reaches a
real user in a different timezone: run the test suite (and ideally the
dev server occasionally) with `TZ` explicitly set to something *not* UTC
and *not* your own local zone:

```bash
TZ=Pacific/Kiritimati npm test   # UTC+14, exposes "reads ahead" bugs
TZ=Etc/GMT+12 npm test           # UTC-12, exposes "reads behind" bugs
```

If any date-related test starts failing under a different `TZ`, that test
(or the code it covers) is timezone-fragile and needs one of the fixes
above. Picking offsets at the extremes (rather than something close to your
own zone) makes day-boundary bugs reliably reproducible instead of
depending on what time of day the test happens to run.

## Checklist

- [ ] Is this value a calendar date or an instant? Pick the matching
      representation, don't blur the two.
- [ ] Does anything call `getDate()`/`getMonth()`/`getFullYear()` (or
      `toLocaleDateString()` without an explicit `timeZone`) on a value
      that's meant to represent a specific calendar day for someone in a
      specific timezone?
- [ ] Does construction and reading of the same date ever happen in two
      different processes (client + server, two services, two users)?
      If so, is the value anchored to something timezone-independent in
      between?
- [ ] Does a date value cross a JSON boundary anywhere its shape might
      differ depending on whether it came from a fresh client object or a
      round-tripped database record?
- [ ] Do tests run (at least sometimes) under a non-UTC `TZ`?
