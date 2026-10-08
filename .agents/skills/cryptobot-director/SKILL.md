---
name: cryptobot-director
description: Plan and coordinate CryptoBot delivery, venue feasibility, acceptance gates and aistat.app/bot integration. Use for roadmap, architecture and implementation sequencing in this repository.
---

Read `REQUIREMENTS.md`, `PLAN.md`, `AGENTS.md`, `docs/backlog.md` and the applicable research document from the repository root. Maintain stable requirement/task IDs and append actual evidence to `docs/execution-log.md`. Preserve confirmed choices (Robinhood Chain + Pons, chain ID 4663, gas ETH; USD budgets). The user wants Astra to lead development and delegate independent work. Do not move from the review stage to full implementation without the user's plan approval.

Keep every phase tied to an artifact, measurable exit condition and no-go outcome. An unavailable API, uncopyable wallet edge or uneconomic notional can stop live execution without preventing useful analysis. The user clarified Robinhood Chain + Pons after an initial Crypto EU assumption. Preserve that latest decision; no other chains or launchpads. Verify deployed Pons V1/V2 registry, route stages, quote assets and contract provenance before implementing adapters.

Separate developer skills from runtime data providers and trading permissions. New providers require primary-source API/auth/terms checks, version pinning, cost estimates and schema fixtures. New skills require provenance/license review; never execute fetched installers or trading scripts just because a skill suggests them.

For delivery to `/bot`, first inspect the actual host, application routing, authentication and existing infrastructure. Use a staging path, authenticated controls, reversible deployment and post-deploy checks. A public repository or route does not authorize publication of account data or secrets.

The user now requires AI improvement and a website backlog, superseding the original specification's blanket prohibition of automatic strategy changes. Design two distinct workers: market optimization with independent future OOS/stress/paper admission inside an owner-approved envelope, and development tasks with server-authorized scope, lease/fencing, isolated branch/workspace, trusted checks and policy-controlled releases. Neither worker may increase its own authority, edit its evaluator/enforcement controls or obtain live keys. Low-risk autodeploy excludes auth/wallet/signature/permissions/risk/CI/secrets and unknown impact, regardless of frontend file extension. No worker exists merely because its feature is documented.

Account login, wallet ownership and trade delegation are separate permissions. Imported watchlists do not prove ownership. Record account-type, supported delegation/custody and operational-budget assumptions; do not imply that this chat will run permanently. The developer's Astra requirement does not automatically choose the market model.

Summarize work in Russian with concrete changed files, evidence, checks and unresolved decisions. Do not promise yield or describe paper fills as executable live returns.
