---
name: buy-access
description: "Buy Taifoon API access by topping up a key: GET /v1/access for the products and prices (GRID first, USDC beside), GET /v1/access/quote?usdc=1..20 for the USDC transfer on Base and the message to sign, POST /v1/access/topup { tx, signature } to credit the key, then GET /v1/access/key and /v1/access/usage for the balance, permissions, budgets and what was used. Also: scopes, daily and monthly caps and allowed origins per key through POST /v1/tenant/keys. Use when an agent or its owner needs more than the free allowance of RPC, proofs, decoded events or the coordination API, wants to cap what a key may spend, or must read what a key used. Do NOT use to buy grades (use grade-with-jev: its own credits), to pay one call without a key (use x402-pay-and-get-paid), or to buy or sell GRID (not offered)."
license: TSUL
compatibility: "bash, curl, jq; a wallet that can send USDC on Base and sign a message (personal_sign) for the top-up itself; Taifoon coordination API v1 at https://coord.taifoon.dev/v1"
metadata:
  title: "Buy API access"
  category: "Buy"
  summary: "Read the price list, top up a key in USDC on Base, set its caps, read its usage."
  use_when: "You need more than the free allowance, or want a key capped and scoped."
  not_when: "You are buying grades, paying a single call with x402, or looking for GRID."
  first_call: "GET /v1/access"
  success: "a quote for the key, its standing and its usage read back"
  verified: "2026-10-04"
---

# Buy API access: top up a key

## What this is

API access is metered per call in GRID (1 GRID = 0.01 USDC of service).

- **A free key** (`POST /v1/register`) keeps its free allowance every day.
- **A key with a balance** runs at ten times the rate. Each call past the free allowance is debited at the list price:

| Product | Per call | Per 1,000 |
|---|---|---|
| RPC request | 0.1 GRID | 100 GRID (1.00 USDC) |
| Proof | 0.2 GRID | 200 GRID (2.00 USDC) |
| Decoded read | 0.05 GRID | 50 GRID (0.50 USDC) |
| Scanning read | 0.1 GRID | 100 GRID (1.00 USDC) |
| Write | 0.05 GRID | 50 GRID (0.50 USDC) |

Read the live numbers from `GET /v1/access`; never copy them from here.

**There is no subscription.** You send USDC on Base from your own wallet to the payee, sign one message with that wallet, and the
key is credited: 100 GRID per 1 USDC, from 1 to 20 USDC per transaction.

## Before you start

- A key: `POST /v1/register` (no body) answers `api_key` once.
- For the top-up itself: a wallet (an EOA) holding USDC and a little ETH on Base. The commands below never sign or send.

```sh
export TAIFOON=https://coord.taifoon.dev/v1
tf() { curl -sS -m 60 -H "X-Taifoon-Client: taifoon-skill-buy-access" -H "content-type: application/json" ${TAIFOON_API_KEY:+-H "X-API-Key: $TAIFOON_API_KEY"} "$@"; }
```

## Pitfalls

1. Sending an amount that was not quoted. Only an exact whole number of USDC from 1 to 20, sent by the wallet that signs, to
   the payee in the quote, counts. 1.5 USDC is refused and nothing is credited.
2. Signing with another wallet. The message names your key, and only the wallet that sent the transfer may sign it.
3. Sending the transfer from a contract wallet. The top-up reads the transaction's sender; send it from an EOA.
4. Topping up a key, then rolling it. The balance stays with the key it was credited to. Spend it, or keep the key.
5. Retrying a top-up and fearing a double credit. A transaction credits once. The same key sending it again gets
   `already: true`. Another key gets 409.
6. Reading a 402 as an outage. `code: budget` means the key's own cap (`reason: cap_day | cap_month`) or its balance
   (`reason: balance`). `next_step` and `top_up` say what lifts it.

## Steps

### 1. The products and prices

```sh
tf "$TAIFOON/access" | jq -e '.schema == "taifoon.access.v1" and (.products | length) == 6 and ([.products[].price.per_1000_grid] | all(. > 0)) and (.checkout.payee | test("^0x[0-9a-fA-F]{40}$"))' >/dev/null
```

### 2. Your key's standing

```sh
if [ -n "${TAIFOON_API_KEY:-}" ]; then
  tf "$TAIFOON/access/key" | jq -e '.ok and (.tier == "free" or .tier == "paid") and (.permissions.scopes | length) > 0 and has("balance")' >/dev/null
fi
```

### 3. The quote for 1 USDC

```sh
Q=$(tf "$TAIFOON/access/quote?usdc=1")
echo "$Q" | jq -e '.ok and .pay.chainId == 8453 and .pay.amount == "1.000000" and .credits.grid == 100 and (.pay.call.data | startswith("0xa9059cbb"))' >/dev/null
```

With a key, `sign.message` is the exact text to sign. Without one it is null, and the steps say to get a key first.

### 4. Pay and sign (your wallet, not this script)

1. Send `pay.call` (`to`, `data`, `value: 0x0`) on Base from your wallet.
2. Take the transaction hash.
3. Sign `sign.message` with the hash filled in, using personal_sign from the same wallet.

```text
cast send <pay.call.to> <pay.call.data> --rpc-url https://mainnet.base.org --private-key …   # or any wallet
cast wallet sign "<sign.message with the tx hash>"                                          # the same wallet
```

### 5. Credit the key

```sh
if [ -n "${TX:-}" ] && [ -n "${SIG:-}" ]; then
  tf -X POST "$TAIFOON/access/topup" -d "{\"tx\":\"$TX\",\"signature\":\"$SIG\"}" | jq -e '.ok and (.balance.grid > 0)' >/dev/null
fi
```

| Answer | Means |
|---|---|
| `credited { grid, usdc }` and `balance` | the key is credited |
| 402 `not_paid` | the amount is not a whole 1 to 20 USDC from the sender to the payee |
| 403 `signature` | the answer carries the message and the signer it expects |
| 404 `no_receipt` | wait a few seconds and send it again |

### 6. Cap and scope a key

One more key, labelled, for a bot that may only read chains and prove, spending at most 50 GRID a day:

```text
POST /v1/tenant/keys { "action": "create", "label": "indexer", "scopes": ["rpc", "proofs"], "cap_day_grid": 50, "cap_month_grid": 1000 }
POST /v1/tenant/keys { "action": "update", "prefix": "tfr_free_…", "origins": ["https://app.example.com"] }   # null clears a field
```

| A key… | Gets |
|---|---|
| without the family's scope | 403 `scope` |
| called from elsewhere | 403 `origin` |
| over its cap | 402 `budget` |

## Verify it works

```sh
if [ -n "${TAIFOON_API_KEY:-}" ]; then
  tf "$TAIFOON/access/usage?window=7d" | jq -e '.ok and (.families | has("rpc") and has("proofs") and has("events")) and (.total.calls >= 0)' >/dev/null
fi
echo "buy-access: price list, quote and standing read"
```

## What it costs

The top-up is the USDC you send plus Base gas. 1 USDC credits 100 GRID, spent per call only past the free allowance. Reading
the quote, the standing and the usage costs nothing.

## Next

- Spend it on chain reads: `rent-rpc`. On proofs: `prove-anything`.
- Give the key to an agent: `wrap-in-an-agent`.
