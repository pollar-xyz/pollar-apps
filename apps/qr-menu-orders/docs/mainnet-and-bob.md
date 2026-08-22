# Plan: mainnet, and charging in bolivianos

Forward-looking notes for taking this app past the bounty. Nothing here is
implemented; the app ships on testnet in USDC, which is what issue #10 scopes.

What follows separates what was **verified** against the SDK types and the
live API from what still has to be **asked**, because the difference decides
how much of this is a weekend and how much is a partnership.

## The BOB question splits in two

"Let the diner pay in bolivianos" sounds like one feature. It is two, and they
have almost nothing in common.

### Path A — BOB as a unit of account

The menu is priced in **Bs.**, the diner sees **Bs.**, and settlement happens
in USDC at a published rate. Nothing new exists on-chain: the app converts for
display and charges the USDC equivalent.

This is what Bolivians already experience in practice today — wallets in the
country quote in bolivianos and settle in USDC at the parallel rate — so it
matches the mental model of the person at the table, who thinks "el silpancho
son 25 bolivianos", not "son 3.50 dólares".

**Cost: low.** No new asset, no trustline, no liquidity, no counterparty.

What it needs:
- A rate source, and a decision about *which* rate (official ~6.96 Bs/USD vs
  the parallel rate people actually transact at — they diverge a lot, and
  picking the wrong one silently mis-prices every dish)
- The rate stored **on the order**, like `payToAddress` already is, so a
  receipt from last Tuesday still reconciles
- Prices kept in one canonical currency in the database, converted for
  display, never the other way around

The honest limitation: the owner still receives USDC. This does not solve
"I want bolivianos in my hand" — it solves "I want to think in bolivianos".

### Path B — BOB as an on-chain asset

A real Stellar token for the boliviano, held in wallets like USDC is.

**Verified: the SDK already has the operation this needs.** `runTx` accepts
`path_payment_strict_send`, whose params are exactly the shape required:

```ts
runTx("path_payment_strict_send", {
  destination,
  sendAsset: USDC,      // what the diner spends
  sendAmount,
  destAsset: BOB,       // what the owner receives
  destMin,              // slippage floor
  path: [],             // hops, or [] to let it route
})
```

So "the diner holds USDC but the owner wants bolivianos" is **one atomic
transaction**, not a swap followed by a payment. If it fails, nothing moves —
no half-converted money stranded in a diner's wallet.

**But the operation is the easy part.** A path payment only executes if there
is a BOB/USDC path with real liquidity on the Stellar DEX. That needs:

1. An **issuer** for BOB — someone who mints it and, more importantly, who
   redeems it for actual bolivianos. A token nobody will redeem is not money.
2. **Liquidity** in the BOB/USDC pair, deep enough that a 25 Bs. lunch doesn't
   move the price. Thin liquidity shows up as a diner paying 4.10 USDC for a
   3.50 USDC lunch.
3. **A trustline** on the owner's wallet, and on any diner who wants to hold
   BOB. The dashboard's sponsored trustlines already handle the reserve.

None of these are things an app developer can supply. They are why this path
starts with a conversation, not with code.

### Which one first

Path A, then B. Path A can ship on testnet immediately, is useful on its own,
and builds the pricing/rate plumbing that Path B also needs. Path B is gated
on someone else's answer.

## What was verified

| Claim | Status | Evidence |
|---|---|---|
| `runTx` supports path payments | **Verified** | `path_payment_strict_send` in `@pollar/core@0.11.2` types, with `sendAsset`/`destAsset`/`destMin`/`path` |
| Other operations available | **Verified** | `payment`, `change_trust`, `create_account`, `invoke_contract` |
| SDK has a swap API | **Verified** | `getSwapConfig()`, `getSwapTokens()`, `getSwapQuote()`, `swap()` on `usePollar()` |
| SDK has fiat ramps | **Verified** | `openRampModal()`, `getRampCountries()`, `createOnRamp`/`createOffRamp` |
| BOB exists in the SDK | **No** | No mention of BOB anywhere in the types; assets are per-app dashboard config |
| A public BOB stablecoin on Stellar | **Does not exist** | Horizon `/assets?asset_code=BOB` returns 26 issuers on mainnet and 1 on testnet — and none is the boliviano. The largest is held by 66 accounts and its home domain is `xlmeme.com`; the others resolve to an NFT marketplace, `stellarskull.io`, and a `federalreserve.us.com` joke. "BOB" is being used as a personal name, not a currency code. Bolivian wallets today quote in bolivianos and settle USDC |
| Which swap venues / ramp countries this app has | **Unknown** | `/v2/swap/config`, `/v2/swap/tokens` and `/v2/ramps/countries` return `SDK_AUTH_INVALID_TOKEN` for an app key alone — they are per-user endpoints. Call them from a logged-in client to find out |

That last row is the cheapest open question: one logged-in page calling
`getSwapConfig()` and `getRampCountries()` answers whether swaps and Bolivian
ramps are even switched on for this app.

> A warning that follows from the table above: the dashboard's **Add token**
> dialog searches Stellar by asset code and will happily return those meme
> tokens for a `BOB` search. Adding one would configure a restaurant to charge
> in a coin held by a few dozen accounts. Any asset added there needs its
> issuer verified against a `stellar.toml`, not just a matching ticker.

## What to ask Pollar

Ordered so the first answer can make the rest moot.

1. **Is there a boliviano asset anywhere in Pollar's world?** Note this is
   not a dashboard question: Treasury → Tokens & Trustlines already accepts
   any Stellar asset by code or issuer, so if one existed it could be added
   today. It doesn't — the 26 mainnet issuers using the `BOB` code are meme
   tokens (see the table above). So the question is whether Pollar issues one,
   partners with someone who does, or plans to.
2. **Who redeems it?** Can an owner turn BOB into bolivianos in a bank account
   or in cash, and through whom? This decides whether Path B is a product or a
   demo.
3. **Is there BOB/USDC liquidity on the Stellar DEX?** Without it,
   `path_payment_strict_send` fails or fills at a bad price. If liquidity is
   thin, a fixed-rate market maker is the alternative.
4. **Testnet BOB to develop against.** This is the concrete ask: test-issued
   BOB and a trustline on two test accounts is enough to build the whole
   switcher before any mainnet conversation.
5. **What does mainnet approval require?** The docs describe it as "a gated
   request/approval flow", with no criteria published — KYC, business
   verification, minimums, platform fees are all unstated.
6. **Do the ramps cover Bolivia?** The docs name Bridge and Etherfuse as
   providers but publish no country or currency coverage.
7. **Webhooks.** Listed as "coming soon". A timeline changes the detection
   design: this app polls Horizon precisely because they don't exist yet.

## The switcher, concretely

Assuming Path B eventually lands, the diner-facing feature is small, because
the hard parts are the asset and the liquidity, not the UI:

- The menu shows a currency toggle: **Bs. / USDC**
- Prices convert for display; the canonical price in the database never moves
- On pay, the app picks the operation by what the diner holds and what the
  owner wants:
  - same asset on both sides → `payment`, as today
  - different → `path_payment_strict_send`, with `destMin` derived from the
    quote and a slippage tolerance the diner sees before confirming
- Verification against Horizon gains one check: the operation type is
  `path_payment_strict_send`, and the **destination** amount and asset match
  the order, not the source ones. `lib/horizon.ts` today looks only at
  `type === "payment"`, so it would need to accept both shapes.

The database is mostly ready for this: `orders.total` and the `order_item`
snapshots already store what was charged, and adding `currency` and `rate`
columns beside them follows the same snapshot rule that `payToAddress` does.

## Mainnet checklist, mapped to this app

From Pollar's own mainnet checklist, with what this app specifically needs:

| Requirement | This app |
|---|---|
| Separate mainnet app in the dashboard | New app, new `pub_mainnet_…` key |
| Production domains registered | The Vercel domain, without the LAN origins used in dev |
| At least one asset enabled | USDC at minimum; BOB if Path B happens |
| Funding wallet ≥ 50 XLM, gas wallet ≥ 10 XLM | Real XLM, bought — friendbot is testnet only |
| Starting XLM balance > 0 | **Non-negotiable here.** A diner with no XLM cannot pay the fee. See the spike notes |
| No testnet keys in production | `.env` is already gitignored; the deploy carries its own |
| Error handling for unfunded wallets | Partly there (the USDC guard and the funds check); the "wallet has no XLM" case currently surfaces as a raw SDK message |
| Real payment verified in Stellar Expert | The history screen already links every order's hash |
| Observability, low-balance alerts | **Missing.** Nothing watches the funding wallet, and reconciliation only runs while a board is open. Both need a cron before real money |

## Before any of this

Two things in the current app would have to change for real money, regardless
of currency:

**Reconciliation must not depend on someone watching the board.** Today the
poller runs in the browser. If the owner closes the tab, a paid order can sit
unsettled until they open it again. On testnet that is a documented limit; on
mainnet it is someone's lunch money. It needs a scheduled job.

**The admin key is the only credential.** Losing it loses the restaurant. That
is a fair trade for a bounty, where the alternative was trusting a spoofable
address, but a real product needs recovery — which in turn needs Pollar to
expose a verifiable session, or a second factor of the app's own.
