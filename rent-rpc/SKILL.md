---
name: rent-rpc
description: "Read any of 12 EVM chains through one chain-agnostic JSON-RPC URL per chain, POST https://coord.taifoon.dev/gw/rpc/{chainId}, with a Taifoon key: eth_blockNumber, eth_call, eth_getLogs (up to 10,000 blocks) and eth_chainId, each request sent to the chain's measured rotation of endpoints with failover. Use when an agent or a stock client (viem, ethers, curl) needs reliable reads on Base, Ethereum, Arbitrum One, Optimism, Polygon, BSC, Avalanche, Celo, Arc, Robinhood Chain or the Taifoon chains without running or choosing endpoints. Do NOT use to send transactions (writes are refused), to read a receipt (use prove-anything or a public RPC), or for a proof that something happened (use prove-anything)."
license: TSUL
compatibility: "bash, curl, jq; Taifoon coordination API v1 at https://coord.taifoon.dev; a Taifoon key (POST /v1/register) for 1,000 free requests a day"
metadata:
  title: "Rent RPC"
  category: "Tools"
  summary: "One JSON-RPC URL per chain, 12 chains, failover built in, 1,000 free requests a day per key."
  use_when: "You need chain reads on several EVM chains without picking or running endpoints."
  not_when: "You need to send a transaction, read a receipt, or prove an event."
  first_call: "POST /gw/rpc/{chainId}"
  success: "eth_blockNumber answered on two chains through the gateway, with the fee headers read"
  verified: "2026-10-04"
---

# Rent RPC through the Taifoon gateway

## What this is

`POST https://coord.taifoon.dev/gw/rpc/{chainId}` is a JSON-RPC 2.0 endpoint, the same on every chain. Point a stock client
at it instead of a public endpoint. Each request goes to the first healthy endpoint of that chain's rotation, which is
measured every 5 and 10 minutes. A 429, a 5xx or a timeout moves the request to the next endpoint, up to three, 15 s each.

| | |
|---|---|
| Methods | `eth_blockNumber`, `eth_call`, `eth_getLogs` (at most 10,000 blocks), `eth_chainId` |
| Writes | refused with a JSON-RPC error |
| Batch | up to 20 calls in one request; a batch is one request |
| Free | 1,000 requests a UTC day per key (100 without a key), `/gw/rpc` and `/gw/mcp` together |
| Past it | 0.1 GRID (0.001 USDC) a request from the key's balance (`buy-access`) |

`GET /v1/access` is the price list, and `GET /v1/rpc` is the live health of every chain.

## Before you start

- A key: `POST https://coord.taifoon.dev/v1/register` (no body) answers `api_key` once. Keep it.
- Send it as `X-API-Key`. A key limited by scopes needs the `rpc` scope.

```sh
export TAIFOON=https://coord.taifoon.dev
H=(-H "X-Taifoon-Client: taifoon-skill-rent-rpc" -H "content-type: application/json")
[ -n "${TAIFOON_API_KEY:-}" ] && H+=(-H "X-API-Key: $TAIFOON_API_KEY")
rpc() { curl -sS -m 60 -X POST "$TAIFOON/gw/rpc/$1" "${H[@]}" -d "$2"; }
```

## Pitfalls

1. Sending a transaction. `eth_sendRawTransaction` and every signing method are refused. Send writes through your own
   wallet's RPC.
2. Asking for `eth_getTransactionReceipt` or `eth_getBalance`. They are not served (JSON-RPC error -32601). Use
   `GET /v1/chain/tx` for decoded transactions, or a public RPC.
3. An open `eth_getLogs` range. `fromBlock` must lie within 10,000 blocks of `toBlock`, so page wider scans.
4. Treating a refused method as an outage. A refused call is a JSON-RPC error at HTTP 200, as nodes answer. HTTP 502
   means no endpoint of the rotation answered.
5. Reading the price from memory. `x-taifoon-fee` and `x-taifoon-allowance` on each answer say what the call cost and how
   many free requests are used today. A 402 carries `next_step` with the top-up.
6. Using a chain id the gateway does not serve. That is a 404 naming the served list, the same as `GET /v1/rpc`.

## Steps

### 1. The served chains and their health

```sh
curl -sS -m 60 "$TAIFOON/v1/rpc" "${H[@]}" | jq -e '(.chains | length) >= 10 and ([.chains[].chain] | index(8453) != null) and ([.chains[].chain] | index(1) != null)' >/dev/null
```

### 2. The same call on two chains

```sh
rpc 8453 '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | jq -e '.result | test("^0x[0-9a-f]+$")' >/dev/null
rpc 42161 '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | jq -e '.result == "0xa4b1"' >/dev/null
```

### 3. An eth_call and a small log window on Base

USDC on Base: `totalSupply()`, then the Transfer logs of one block.

```sh
rpc 8453 '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","data":"0x18160ddd"},"latest"]}' \
  | jq -e '.result | test("^0x[0-9a-f]{64}$")' >/dev/null
HEAD=$(rpc 8453 '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | jq -r .result)
B=$(printf '0x%x' $(( HEAD - 20 )))
rpc 8453 "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getLogs\",\"params\":[{\"address\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"fromBlock\":\"$B\",\"toBlock\":\"$B\"}]}" \
  | jq -e '.result | type == "array"' >/dev/null
```

### 4. A write is refused, with the reason

```sh
rpc 8453 '{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":["0x00"]}' | jq -e '.error.code == -32003' >/dev/null
```

### 5. From a client library

```text
// viem
createPublicClient({ chain: base, transport: http('https://coord.taifoon.dev/gw/rpc/8453', { fetchOptions: { headers: { 'X-API-Key': process.env.TAIFOON_API_KEY } } }) })
```

## Verify it works

What a call cost, and how much of the free allowance is used:

```sh
curl -sS -m 60 -D - -o /dev/null -X POST "$TAIFOON/gw/rpc/8453" "${H[@]}" -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
  | tr -d '\r' | grep -i '^x-taifoon-step:' >/dev/null
echo "rent-rpc: Base and Arbitrum One answered through one URL per chain"
```

## What it costs

1,000 requests a UTC day per key are free. Past that, each request is 0.1 GRID (0.001 USDC), from the key's balance.
`GET /v1/access` has the price list and the rates: 120 a minute for a free key, ten times that with a balance.

## Next

- Top up the key: `buy-access`.
- Prove what you read: `prove-anything`.
- The same reads as an MCP tool: `taifoon_rpc` (`wrap-in-an-agent`).
