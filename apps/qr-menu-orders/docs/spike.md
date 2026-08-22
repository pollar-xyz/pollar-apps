# Spike: ordering loop end to end on testnet

Blocking criterion from issue #10, validated before building the app.

**Result: passed.** A two-item order was paid from one Pollar account to
another on Stellar testnet, and the app verified the payment against the
ledger without trusting the client.

## The transaction

| | |
|---|---|
| Hash | `97bda8844df9c9ea3886b2b89b26411cdb9aa2f8e21d842b9e743a6ab4b1b2c0` |
| Explorer | https://stellar.expert/explorer/testnet/tx/97bda8844df9c9ea3886b2b89b26411cdb9aa2f8e21d842b9e743a6ab4b1b2c0 |
| Ledger | 4263957 |
| When | 2026-08-21T19:59:39Z |
| Order | Silpancho (3.50) + Api con pastel (1.20) = **4.70 USDC** |
| Diner → Owner | `GCTYTCAE…DQ23V` → `GCSD2R2W…AJ3SG` |
| Order reference | MEMO_ID `1787342375775` |
| Fee | 100 stroops (0.00001 XLM), max_fee 120 |

Owner's balance after: `4.7000000 USDC`.

## What the app checked

`POST /api/spike/verify` takes only the hash, amount and order reference from
the client. The destination is **not** read from the request body — a client
does not get to say where the money was supposed to go. All five checks
passed against Horizon:

1. `successful: true` — the transaction was accepted by the network
2. destination — the payment operation's `to` is the owner's account
3. amount — `4.7000000` equals the order total, compared as 7-decimal integers
4. asset — `USDC` issued by `GBBD47IF…FLA5`, not native XLM or a lookalike
5. reference — `memo_type: "id"`, `memo: "1787342375775"`

## What we learned

**Pollar propagates the memo to the ledger.** This was the open question that
gated the whole design. `runTx(..., { memo: { type: 'id', value } })` arrives
on-chain as a real Stellar MEMO_ID, so orders can be matched by reference.

**Use MEMO_ID, not MEMO_TEXT.** A text memo is capped at 28 bytes, too small
for a UUID. MEMO_ID is a uint64, which is a natural fit for an order id and
matches exactly.

**Diners need their own XLM for the network fee.** The first attempt failed
with "Not enough XLM to cover the network fee" on a wallet holding USDC but
0 XLM. The template's "Fee: covered by the app" copy describes the sponsored
account reserve, not transaction fees. Fixed by setting a non-zero **Starting
XLM balance** in the Pollar dashboard (Treasury → Account Funding), so every
new wallet is born able to pay. At 100 stroops per payment, 1 XLM covers
~100,000 orders. Without this, a diner logging in for the first time at the
table fails on their very first order.

**Google login returns 500 on testnet.** `sdk.api.pollar.xyz/v2/auth/google`
replies `{"code":"INTERNAL_SERVER_ERROR"}` even though the app config reports
`providers.google: true` and the publishable key validates fine. Server-side
on Pollar; nothing reaches the app. Worked around with email OTP login, which
is what testers should use.

## Detecting incoming payments

There are no client-side webhooks in the SDK (the docs list them as "coming
soon"), so detection is ours to build. Three layers, in order of preference:

1. **The hash from `runTx`.** The diner pays inside the app, so the client
   gets the hash immediately and reports it. Fast, but not trustworthy alone.
2. **Verification on Horizon** (the five checks above). This is what makes an
   order "paid". Public, read-only, no key required.
3. **Reconciliation by polling.** If the diner closes the browser before the
   hash reaches the server, the order would be stranded. Polling
   `/accounts/{owner}/payments?order=desc&join=transactions` returns incoming
   payments *with their memo*, plus a `paging_token` cursor for incremental
   polling. Confirmed working:

   ```
   payment | 4.7000000 USDC | from GCTYTCAE… | memo=id:1787342375775 | cursor=18313555866554369
   ```

The SDK's own `fetchTxHistory` is not used: its records carry no structured
amount, counterparty or memo (only a human `summary` like "Sent 10.00 USDC")
and it is scoped to the authenticated session, so it cannot match orders.

### Limits

- A ledger closes every ~5s, so confirmation is not instant. The verifier
  retries a 404 six times at 1.5s intervals before giving up.
- Public Horizon is rate-limited per IP. Reconciliation should poll only
  while orders are outstanding, using the cursor, not in a permanent loop.
- Verification is idempotent by hash: the hash is unique in the database, so
  one payment can never settle two orders.

## Reproducing it

1. `pnpm install && pnpm dev` with `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` set
2. Open `/spike` and log in as the diner (email OTP)
3. The diner's wallet needs USDC (faucet.circle.com → Stellar Testnet) and a
   little XLM for the fee
4. Pick at least two items and pay

The page prints the five checks, the raw Horizon payloads and the raw
`runTx` outcome.

---

## First real order through the finished app

After the app was built, the same loop ran again end to end through the real
screens — not the spike page: the owner created a restaurant at `/admin`,
loaded a menu, generated a table QR, and a diner scanned it from a second
browser, ordered and paid.

| | |
|---|---|
| Hash | `511022fbc2e6ca0085b38895ca6306697dc009f6b17d7e3b9a85ef42095c5d5b` |
| Explorer | https://stellar.expert/explorer/testnet/tx/511022fbc2e6ca0085b38895ca6306697dc009f6b17d7e3b9a85ef42095c5d5b |
| Restaurant | Rodri Pension · Mesa 1 (`/m/E2FDK7`) |
| Order | 2 × Hamburguesa = **10.00 USDC** |
| Reference | MEMO_ID `1787349533068564` — identical to the order's `memo_id` in the database |
| Ledger | 4265386, fee 100 stroops |

The order appeared on the board already paid, without the owner touching
anything, and was moved through preparing to delivered.

## Testing from a phone

Opening the app by LAN IP instead of `localhost` broke it in a way worth
recording: the page rendered but never became interactive, with 403s on
`/_next/static/…` and a dead HMR socket. Next blocks its own dev assets
cross-origin by default; `allowedDevOrigins` in `next.config.ts` now allows
private ranges only, verified by checking that an external origin still gets a
403. The LAN origin also has to be added under **Build → Domains** in the
Pollar dashboard, or the SDK is refused by CORS.
