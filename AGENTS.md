# CryptoBot development

## Scope and current phase

Read [REQUIREMENTS.md](REQUIREMENTS.md), [PLAN.md](PLAN.md) and [docs/backlog.md](docs/backlog.md) before substantive changes. Record actual work in [docs/execution-log.md](docs/execution-log.md), with requirement/task IDs and evidence. The user has approved development and deployment to `aistat.app/bot`, with multiple users and separate accounts/wallets in the first release. Continue implementation and the authorized deployment without asking for the same approval again. Deployment is IN_PROGRESS until verified on the host; code and passing local tests are not deployment evidence. User has confirmed Robinhood Chain + Pons (chain ID 4663, gas ETH) and USD budgets. The 214 imported addresses are an unverified watchlist, not user-owned execution wallets. They remain private under ignored `data/wallet-intake/`; do not publish addresses or labels.

The user asked Astra (`gpt-6-astra`) to lead all development and delegate independent work to its subagents. The primary coordinator handles communication and read-only review. Preserve that allocation unless the user changes it. Use small independent tasks; never give two agents ownership of the same file concurrently.

## Skills

Project skills live in `.agents/skills/`. Use `cryptobot-director` for delivery decisions, `cryptobot-wallet-research` for strategy evidence, and `cryptobot-execution-safety` for order/risk/signing changes. The two vendored OpenAI security skills keep their original triggers. Read [docs/skills-inventory.md](docs/skills-inventory.md) before installing or updating skills; pinned provenance is in `skills.lock.json`.

## Operational invariants

- Development/deployment approval does not authorize live trading, funding or a signing mandate. Current scope is Robinhood Chain + Pons V1/V2 only. Robinhood Crypto EU is a different product and its US-only API limitation is not a blocker for this chain. No Solana/Pump expansion.
- LLMs and token/social metadata cannot authorize or sign trades. Only deterministic validated policies reach the isolated executor.
- The user now requests AI improvement and a website task backlog. This supersedes the original specification's blanket ban on automatic strategy changes: allow future automatic promotion inside an owner-approved search envelope only after independent causal OOS/stress/paper gates. This does not activate any worker or grant live permission now. Never let the optimizer modify its own evaluator, hard caps or signing authority.
- Distinguish existing site login, wallet ownership proof and trading delegation. Connect/SIWE is not spend authority; keep account ownership checks server-side. Logout/disconnect is not on-chain revoke and does not authorize liquidation.
- Root `aistat_session` is opaque: resolve it server-side through the fixed root `/api/session`, using authoritative `user_id`, never its shared `username` or browser-supplied owner. Keep all account data isolated. The first implementation supports EOA ownership proof only; contract wallets fail closed. See [host inventory](docs/host-inventory.md).
- Separate market optimizer from development agent. Development tasks require server-authorized scope, isolated workspaces, bounded leases/budgets, trusted checks and PR/staging. Low-risk autodeploy requires an enabled policy; auth/wallet/signature/risk/CI/secrets/permissions and unknown-impact changes require separate review. Never give repository-controlled builds evaluator credentials or live keys.
- Never commit local credentials, private wallet datasets, OAuth setup files, logs or generated artifacts. Stage explicit paths and review the staged diff. Do not print secret contents for troubleshooting.
- Keep facts, design proposals and measured results distinguishable. Unknown fields are unknown, never passing security or edge checks.
- Financial quantities use decimal/base units with explicit currency and timestamp. A $10 position is not a $10 risk budget.
- Deployment to `aistat.app/bot` is authorized; preserve root login, `/crypto` and other applications. DNS/OAuth changes, connecting funds and enabling live remain outside this approval. Monthly AI/data spending limits are pending: no unbounded paid worker or recurring purchase is implied.

## Verification

Verify skill frontmatter, license/provenance, relative links, requirement/backlog traceability, staged paths, and `git diff --check`. Run relevant native Node tests for auth/account isolation/ownership proof and verify deployment separately. Research/execution tests must target causal time boundaries, wallet P&L integrity, cost accounting, replay resistance, order idempotency, reconciliation and risk invariants. CI must have no trading keys. DONE needs observed evidence; a commit is not a deployment and a backtest is not live readiness.
