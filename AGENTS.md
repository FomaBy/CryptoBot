# CryptoBot development

## Scope and current phase

Read [PLAN.md](PLAN.md) before substantive changes. The current deliverable is research, skills and a reviewable plan. Do not implement the full bot until the user approves the plan. User has confirmed Robinhood Chain + Pons (chain ID 4663, gas ETH) and USD budgets; source wallet addresses are pending and do not block planning.

The user asked Astra (`gpt-6-astra`) to lead all development and delegate independent work to its subagents. The primary coordinator handles communication and read-only review. Preserve that allocation unless the user changes it. Use small independent tasks; never give two agents ownership of the same file concurrently.

## Skills

Project skills live in `.agents/skills/`. Use `cryptobot-director` for delivery decisions, `cryptobot-wallet-research` for strategy evidence, and `cryptobot-execution-safety` for order/risk/signing changes. The two vendored OpenAI security skills keep their original triggers. Read [docs/skills-inventory.md](docs/skills-inventory.md) before installing or updating skills; pinned provenance is in `skills.lock.json`.

## Operational invariants

- No live trading or funding in the preparation phase. Current scope is Robinhood Chain + Pons V1/V2 only. Robinhood Crypto EU is a different product and its US-only API limitation is not a blocker for this chain. No Solana/Pump expansion.
- LLMs and token/social metadata cannot authorize or sign trades. Only deterministic validated policies reach the isolated executor.
- Never commit local credentials, private wallet datasets, OAuth setup files, logs or generated artifacts. Stage explicit paths and review the staged diff. Do not print secret contents for troubleshooting.
- Keep facts, design proposals and measured results distinguishable. Unknown fields are unknown, never passing security or edge checks.
- Financial quantities use decimal/base units with explicit currency and timestamp. A $10 position is not a $10 risk budget.
- Do not deploy to `aistat.app`, modify DNS/OAuth, connect funds, or enable live mode during this stage.

## Verification

For preparation: verify skill frontmatter, license/provenance, relative links, staged paths, and `git diff --check`. Later tests must target causal time boundaries, cost accounting, order idempotency, reconciliation and risk invariants, not mirror implementation. CI must have no trading keys. Record limitations rather than claiming unrun tests.
