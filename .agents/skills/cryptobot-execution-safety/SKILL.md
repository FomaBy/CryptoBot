---
name: cryptobot-execution-safety
description: Design or verify CryptoBot deterministic risk checks, order state, signing isolation and operational recovery. Use for execution adapters, credentials, live-mode controls, reconciliation and kill switches.
---

Read `PLAN.md`, `docs/research/spec-review.md`, official Robinhood Chain documentation and pinned Pons source before changing execution behavior. Current scope is chain ID 4663/Pons V1/V2, gas ETH. This skill supplies engineering constraints; it does not authorize real trades. Preparation is paper/read-only. Later unattended trading requires an explicitly approved bounded policy, not per-trade LLM judgment.

Enforce these invariants at the executor boundary:

- Only a typed order intent from a versioned approved strategy reaches risk checks. Validate chain/asset, venue/account, side, integer/decimal quantity, quote age, price bound, available funds, open-order reservations, exposure, loss limits, mode and policy version. Recheck immediately before signing.
- Keep signing/API trade keys in an isolated service or secret store. Web UI, analytics, logs, prompt context and CI never receive them. Prefer least privilege without transfers/withdrawals where the provider supports it. Unsupported scope controls are a material feasibility constraint.
- Persist intent and client idempotency identifier before submit. Maintain a durable order state machine and fill ledger. An ambiguous timeout is an unknown outcome: reconcile by client ID/order ID or transaction signature before any new submission. Never equate cancel request with cancellation or RPC acceptance with finality.
- Serialize reservations per account, deduplicate events, and fence stale workers. Recompute balances, holdings, fees and open orders against the venue after reconnect/restart and periodically. Any unresolved mismatch blocks new entries.
- Fail closed for stale feeds, changed permissions, unknown schemas, clock drift, breached limits or missing exit liquidity. Independently support pause-new-entries, cancel-open-orders and controlled-liquidation; liquidation can fail or worsen losses and must obey the approved policy.
- Verify DEX transaction programs, account changes, token amounts, fee caps and recipient against the approved intent before signing; a remote quote is not a trusted transaction. For broker orders validate signed API request fields instead.

Use failure tests for lost acknowledgements, duplicate delivery, partial fills, stale quotes, reorgs/expiry where applicable, insufficient fees and restarts during submission. Audit who changed policy/mode and why each order was allowed or rejected. Never automatically relax a limit after a rejection.

For Pons, require a verified registry of deployments, runtime bytecode, ABI/source commit, proxy implementation where relevant, and route-specific fees/quote assets. Graduation and pool creation are distinct states; block entries until the intended route is actually executable. Keep a single nonce owner, explicit pending/replaced/reverted/unknown states and ETH reserved for exits and failed transactions. Preserve raw reorged events but invalidate/rebuild their derived state. Validate chain ID, spender/allowance, contract selector, calldata, value, recipient and fee caps at signing. A successful sell simulation is evidence for a specific state, never a guarantee against later restrictions.
