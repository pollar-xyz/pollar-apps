# QR Menu Orders

A digital menu with ordering and payment for restaurants, pensiones and food
stalls, running on [Pollar](https://docs.pollar.xyz/) over Stellar testnet.

The owner loads their menu and gets a QR for each table. The diner scans it,
orders from their own phone and pays in USDC straight into the owner's Pollar
account. The order appears on the owner's board **already paid**, and moves
through preparing and delivered. Every order carries a transaction hash anyone
can check in the explorer.

Built on the pollar-apps template: Next.js 16 (App Router), React 19,
TypeScript 5, Tailwind 4, `@pollar/core` and `@pollar/react` ^0.11.

## Run it from a fresh clone

```bash
pnpm install
cp .env.example .env      # paste your pub_testnet_… key
pnpm dev
```

That's the whole setup. **The only required variable is the Pollar publishable
key.** The database is a local SQLite file created and migrated on the first
request; no `db:push`, no docker, no service to sign up for.

### Testing from a phone

To scan a real QR with a real phone you need the app on your LAN, not
`localhost`. Two things make that work:

- `next.config.ts` sets `allowedDevOrigins` for private IP ranges. Without it
  Next blocks its own dev assets and the HMR socket cross-origin, and the page
  loads but never becomes interactive (403s on `/_next/static`).
- The LAN origin (e.g. `http://192.168.1.20:3000`) has to be added under
  **Build → Domains** in the Pollar dashboard, or the SDK is refused by CORS.

Neither applies to a deploy, where there is a single real origin.

In the Pollar dashboard you also need, once per app:

- **Build → Domains**: add `http://localhost:3000` (and your deploy URL later)
- **Treasury → Tokens & Trustlines**: enable **USDC**
- **Treasury → Account Funding**: fund the app wallet, and set **Starting XLM
  balance** to 1 or 2 — see [Diners need a little XLM](#diners-need-a-little-xlm)

## The two sides

### Owner — `/admin`

| Screen | What it does |
|---|---|
| `/admin` | Create the restaurant (or restore access), and today's numbers |
| `/admin/menu` | Categories and dishes: name, price, optional description and photo, and the availability switch |
| `/admin/tables` | One QR per table or counter, with a printable sign |
| `/admin/board` | Paid orders arriving live; move them to preparing and delivered |
| `/admin/summary` | Orders and money taken today |
| `/admin/history` | Every paid order with its transaction hash |

Creating a restaurant requires a Pollar login: that account is where the money
lands. The dish switch is the "se acabó" toggle — one tap and the dish
disappears from the live menu. Photos are optional and taken as a URL: there
is no upload service to run, and the diner's menu renders whatever the owner
pasted.

### Diner — `/m/<code>`

Scanning a table's QR opens that spot's live menu, with the diner's own
balance shown before they pick anything — deciding what to order and finding
out you can't afford it should not be the same moment. Pick items, see the
total, pay with one confirmation. Sold-out dishes never render, and the app
never asks anyone to type a `G…` address.

**After paying, the order reports back.** A three-step timeline — *Pedido
recibido · En preparación · Entregado* — polls every 6 seconds, so when the
owner advances the order on the board, the diner's phone follows on its own.
Paying and then getting silence is the anxiety the paper version doesn't have:
there, you watch the waiter walk away with the ticket. The tracking survives
closing the tab (remembered per table in the browser) and clears itself once
the food is delivered.

**If the diner is short**, the app says how much is missing and offers to open
their receive QR, so whoever is sitting across the table can send them the
difference. While they're short the balance is re-checked every 8 seconds, so
the pay button enables itself the moment the money lands. The SDK's
`openRampModal()` is deliberately not used here: it is a full fiat on-ramp
with KYC and a bank transfer — the right answer to "how does money enter the
system", the wrong one to "this person needs $5 right now at this table", and
network-gated besides.

Amounts read as `$` with a coin mark rather than a token ticker, and orders
carry a human number ("Pedido #7") separate from the 16-digit reference that
matches the payment on-chain.

## Environment variables

| Variable | Required | What for |
|---|---|---|
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | **yes** | The Pollar SDK (`pub_testnet_…`) |
| `DATABASE_URL` | no | Defaults to `file:./data/qr-menu.db`. Set to a libSQL/Turso URL for a deploy |
| `DATABASE_AUTH_TOKEN` | no | Turso auth token, when `DATABASE_URL` is remote |

Things that could have been env vars and deliberately aren't: the USDC issuer
and Horizon URL are constants in `lib/stellar.ts` (public, not configuration),
and the QR's base URL is derived from the incoming request, so a QR printed
from the deploy encodes the deploy and one printed locally encodes localhost.

## Database

Drizzle ORM over libSQL. Seven tables in `db/schema.ts`: `restaurant`,
`menu_category`, `menu_item`, `dining_table`, `orders`, `order_item`,
`sync_state`.

```bash
pnpm db:generate   # after editing db/schema.ts
pnpm db:migrate    # apply migrations (needed only for a remote database)
pnpm db:studio     # browse the data
```

Locally, `dbReady()` applies pending migrations on the first request, so the
app is self-setting-up. Against a remote database it doesn't: several
serverless instances migrating at once is a race, so a deploy runs
`pnpm db:migrate` instead.

Two schema decisions worth knowing:

- **Money is stored as decimal strings** and all arithmetic goes through
  integer cents (`lib/money.ts`). Floats cannot hold cents exactly, and an
  order total off by a fraction of a cent fails verification against the ledger.
- **Order lines snapshot the dish's name and price**, and orders snapshot the
  owner's address. Yesterday's order must keep saying what the diner actually
  paid, whatever the menu says today.

## Table QRs

Each table gets a globally unique 6-character code from an alphabet with no
`0/O` or `1/I/L`, so it survives being read aloud. The QR encodes
`<origin>/m/<code>` and is rendered as inline SVG on the server — no client
library, and it prints as vector at any size. `/admin/tables/<id>/print` is a
print-only sheet with the restaurant name, the table label and the QR; the
print stylesheet hides the app chrome.

## How payments are detected

**There are no webhooks in the Pollar SDK** — the docs list them as upcoming.
Detection is the app's job, in three layers:

1. **The hash from `runTx`.** The diner pays inside the app, so the client
   receives the transaction hash immediately and posts it to
   `POST /api/orders/<id>/confirm`.
2. **Verification against Horizon.** The claim alone is worth nothing: a client
   can send any hash, including a real one copied from the explorer. The server
   asks the Stellar ledger and requires all five to hold before the order is
   paid — the transaction succeeded, the destination is this order's owner
   account, the amount equals the total (compared as integers), the asset is
   the expected USDC, and the memo is this order's reference.
3. **Reconciliation.** If the diner closes the tab between signing and
   reporting, the money is on the ledger but the order is still pending. The
   board polls `/accounts/<owner>/payments?join=transactions` every 8 seconds
   with a stored cursor, matches by memo, re-checks the amount, and settles
   what it finds.

The order reference travels as a **Stellar MEMO_ID** (a uint64), not a text
memo — text memos cap at 28 bytes, too small for a UUID.

The SDK's own `fetchTxHistory` is not used for detection. Its records expose no
structured amount, counterparty or memo (only a human-readable `summary` like
"Sent 10.00 USDC") and it is scoped to the authenticated session, so it can't
match an order.

### Limits of this approach

- **Not instant.** A Stellar ledger closes every ~5 seconds. The verifier
  retries a 404 six times, 1.5s apart, before giving up.
- **Polling costs requests.** Public Horizon is rate-limited per IP. The board
  polls only while it is open, and only for what is newer than its cursor.
- **Reconciliation is per restaurant, driven by an open board.** If nobody has
  the board open, stranded orders settle the next time someone opens it. A
  production deployment would move this to a cron job.
- **One payment can only ever settle one order**, enforced by a UNIQUE index on
  `tx_hash` rather than by application code.
- **Abandoned orders expire.** An order that is still unpaid 30 minutes after
  it was created is marked `expired` on the next reconciliation pass, so a
  diner who closes the menu without paying doesn't leave a pending row holding
  a memo reference forever. Settlement runs first, so an order that really was
  paid is never expired by mistake.

## Authorization, and why it works this way

A Pollar session cannot be verified server-side: the SDK exposes no verifiable
session token, so a `user.address` arriving in a request body proves nothing —
anyone could send someone else's address and edit their menu.

So the app issues its own credential. Creating a restaurant returns an **admin
key**, shown exactly once and stored only as a SHA-256 hash, kept afterwards in
an httpOnly cookie. Losing it means losing write access; "I have a key" on
`/admin` restores it on another device. The Pollar address stays what it should
be — the account that receives the money — and never doubles as a credential.

Every owner route is scoped by restaurant as well as by id, so an id from
another restaurant returns 404, not 403.

## Diners need a little XLM

A wallet holding USDC but no XLM can't pay: Stellar charges the fee in XLM
(100 stroops, 0.00001 XLM per payment). The template's "Fee: covered by the
app" copy refers to the sponsored account reserve, not transaction fees.

Set **Starting XLM balance** to 1 or 2 in the dashboard so every new wallet is
born able to pay. One XLM covers roughly 100,000 orders. Leave it at 0 and a
diner logging in for the first time at the table fails on their first order.

## Known issues

- **Google login returns 500 on testnet.** `sdk.api.pollar.xyz/v2/auth/google`
  replies `INTERNAL_SERVER_ERROR` even with `providers.google: true` in the app
  config and a valid key. It's server-side at Pollar; nothing reaches this app.
  Use **email OTP**, which works.
- Order splitting between diners is out of scope: one order, one payer.

## The spike

The ordering loop was validated end to end on testnet before the app was
built — including the open question of whether Pollar propagates the memo to
the ledger (it does). The transaction hash, the five checks and what we learned
are in [`docs/spike.md`](docs/spike.md). `/spike` is the page that produced it,
kept as reproducible evidence.

## Deploying

Step by step, including what to set and what breaks when you don't:
[`docs/deploy.md`](docs/deploy.md). The short version is a Turso database, one
`pnpm db:migrate`, three environment variables, and the production domain
registered in the Pollar dashboard.

## Beyond the bounty

[`docs/mainnet-and-bob.md`](docs/mainnet-and-bob.md) works through what
charging in bolivianos would take, and what mainnet would require. Short
version: `runTx` already supports `path_payment_strict_send`, so "the diner
spends USDC, the owner receives BOB" is one atomic transaction — but it needs
a BOB issuer and DEX liquidity, neither of which an app can supply.
