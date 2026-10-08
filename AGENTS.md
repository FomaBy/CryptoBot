# CryptoBot development

## Scope and current phase

Read [REQUIREMENTS.md](REQUIREMENTS.md), [PLAN.md](PLAN.md) and [docs/backlog.md](docs/backlog.md) before substantive changes. Record actual work in [docs/execution-log.md](docs/execution-log.md), with requirement/task IDs and evidence. The current deliverable is research, requirements and a reviewable plan. Do not implement the full bot until the user approves the plan. User has confirmed Robinhood Chain + Pons (chain ID 4663, gas ETH) and USD budgets. The 214 imported addresses are an unverified watchlist, not user-owned execution wallets. They remain private under ignored `data/wallet-intake/`; do not publish addresses or labels.

The user asked Astra (`gpt-6-astra`) to lead all development and delegate independent work to its subagents. The primary coordinator handles communication and read-only review. Preserve that allocation unless the user changes it. Use small independent tasks; never give two agents ownership of the same file concurrently.

## Skills

Project skills live in `.agents/skills/`. Use `cryptobot-director` for delivery decisions, `cryptobot-wallet-research` for strategy evidence, and `cryptobot-execution-safety` for order/risk/signing changes. The two vendored OpenAI security skills keep their original triggers. Read [docs/skills-inventory.md](docs/skills-inventory.md) before installing or updating skills; pinned provenance is in `skills.lock.json`.

## Operational invariants

- No live trading or funding in the preparation phase. Current scope is Robinhood Chain + Pons V1/V2 only. Robinhood Crypto EU is a different product and its US-only API limitation is not a blocker for this chain. No Solana/Pump expansion.
- LLMs and token/social metadata cannot authorize or sign trades. Only deterministic validated policies reach the isolated executor.
- The user now requests AI improvement and a website task backlog. This supersedes the original specification's blanket ban on automatic strategy changes: allow future automatic promotion inside an owner-approved search envelope only after independent causal OOS/stress/paper gates. This does not activate any worker or grant live permission now. Never let the optimizer modify its own evaluator, hard caps or signing authority.
- Distinguish existing site login, wallet ownership proof and trading delegation. Connect/SIWE is not spend authority; keep account ownership checks server-side. Logout/disconnect is not on-chain revoke and does not authorize liquidation.
- Separate market optimizer from development agent. Development tasks require server-authorized scope, isolated workspaces, bounded leases/budgets, trusted checks and PR/staging. Low-risk autodeploy requires an enabled policy; auth/wallet/signature/risk/CI/secrets/permissions and unknown-impact changes require separate review. Never give repository-controlled builds evaluator credentials or live keys.
- Never commit local credentials, private wallet datasets, OAuth setup files, logs or generated artifacts. Stage explicit paths and review the staged diff. Do not print secret contents for troubleshooting.
- Keep facts, design proposals and measured results distinguishable. Unknown fields are unknown, never passing security or edge checks.
- Financial quantities use decimal/base units with explicit currency and timestamp. A $10 position is not a $10 risk budget.
- Do not deploy to `aistat.app`, modify DNS/OAuth, connect funds, or enable live mode during this stage.

## Verification

For preparation: verify skill frontmatter, license/provenance, relative links, requirement/backlog traceability, staged paths, and `git diff --check`. Later tests must target causal time boundaries, wallet P&L integrity, cost accounting, account isolation, replay resistance, order idempotency, reconciliation and risk invariants. CI must have no trading keys. DONE needs observed evidence; a commit is not a deployment and a backtest is not live readiness.
