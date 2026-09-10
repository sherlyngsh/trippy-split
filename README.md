# 🌴 Trippy Split

A holiday expense tracker for a group of travellers. Sign in, keep a list of trips,
and inside each one log what everyone spent, split each bill however you like, and see
at a glance who owes who — with **SGD as the base currency**, so foreign spending
always shows both the original amount and the Singapore-dollar equivalent.

## Running it

No build step, no dependencies, no server:

```
start index.html         # Windows
open index.html          # macOS
```

Everything is saved in the browser's `localStorage`. On the sign-in screen, **"have a
look around with a demo account"** creates `demo` / `demo1234` and drops a filled-in
Tokyo trip into it.

If your browser blocks the Web Crypto API (needed to hash passwords), the app says so
and asks you to serve the folder instead — `npx serve .` or `python -m http.server 8000`,
then open the address it prints.

## The three screens

**1. Sign in / create account** — username (3–20 chars) and password (8+ chars), with
"keep me signed in" choosing between a session that dies with the tab and one that
survives a restart. Usernames are case-insensitive and unique per browser.

**2. Your trips** — one card per trip showing its icon, dates, traveller and expense
counts, total spend in SGD, and where *you* stand on it (*You owe S$120.30* /
*You're owed …* / *all square*). Create a trip with a name, an icon, optional dates and
an optional comma-separated list of travellers; delete one with a confirmation that
tells you how many expenses go with it. A trip left behind by the pre-accounts version
of the app is adopted automatically by the first account created.

**3. One trip** — the expense tracker itself.

## Inside a trip

**Travellers** — add everyone; each gets an emoji avatar. Pick "I am …" in the header
and the app speaks to you directly: *"You owe S$248.90 — pay S$248.90 to 🦊 Wei Ming."*

**Expenses** — title, one of six categories (🏨 hotel, 🚕 transport, 🎟️ entrance,
🍜 food, 🛍️ shopping, ✨ other), amount, currency, date, who paid, and who it's shared
between. Editable, deletable, filterable by person and category.

**Currency** — 37 currencies. Anything that isn't SGD shows the foreign amount, the
converted SGD amount, and the rate used. The rate is **stored on each expense**, so
editing the rate table later never silently rewrites your history. Rates live behind
**💱 FX rates**, are per-trip, and are yours to correct — they ship as rough defaults,
not live data.

**Splitting** — three modes:

| Mode | Use it when |
|---|---|
| **Equally** | the default — split evenly between everyone ticked |
| **By shares** | someone ate twice as much, or two people shared a room (1 share vs 2) |
| **Exact** | you know each person's exact amount; the app refuses to save until the parts add up to the total |

**Who owes who** — a card per traveller showing what they paid, their fair share, and
their net position, labelled *owes* / *gets back* / *settled* (never colour alone). Below
that, the **fewest possible transfers** that square everyone up. Hit **Mark paid** to
record a real-world payment; it stays in a log you can undo.

**Where the money went** — category breakdown, each bar direct-labelled with name,
share of spend and SGD amount.

**⋯ More** — copy a plain-text summary for the group chat, export/import this trip as
JSON, clear its expenses, or delete it.

## About the login — please read

This is a **browser-only app with no backend**, and that puts a hard ceiling on what
"login" can mean here:

- Passwords are salted with 16 random bytes and stretched through **PBKDF2-SHA256,
  150,000 iterations**; only the derived hash is stored. Your password is never written
  down in the clear.
- But the accounts, the hashes and every trip all live in `localStorage`, which anyone
  using this browser can open devtools and read or edit. **It is a sign-in gate for a
  shared laptop, not authentication.** Real auth needs a server that holds the hashes
  somewhere the client cannot reach.
- **Don't reuse a password that matters.**

Trips are also per-browser, so two people on two laptops keep two separate copies —
use Export/Import to sync, or nominate one bookkeeper.

## Files

| File | |
|---|---|
| `index.html` | markup for all three screens |
| `styles.css` | the sunny-postcard theme, light + dark |
| `auth.js` | accounts: PBKDF2 hashing, sign up / in / out, sessions |
| `store.js` | per-account persistence (one localStorage bucket per user) |
| `app.js` | views, trips, and the expense tracker: currencies, splitting, balances, settlement, rendering |

## How the money maths works

All arithmetic happens in **integer SGD cents**, so a split always adds back up to the
exact total — no drifting half-cents. `168,000 JPY @ 0.0088` becomes `147840` cents; a
three-way split of `S$10.00` is `334 / 333 / 333`, with leftover cents handed to the
largest fractional remainders rather than dropped.

Settlement uses a greedy creditor/debtor match, which needs at most *n − 1* transfers
for *n* people.

Trips are re-validated every time they come out of storage or an import: unknown
currencies fall back to SGD, orphaned expenses and settlements are dropped, and the
rate table is topped up with defaults.

## Notes

- Exchange rates are hand-entered defaults (roughly 2026 levels), not a live feed. Check
  them against your bank before settling real money.
- A trip's name can be edited from the header inside the trip; its dates and icon are
  set when you create it.
- Removing a traveller re-splits the expenses they merely shared in, and deletes the
  expenses they paid for. The app warns you first.
