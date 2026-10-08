---
name: cryptobot-director
description: Plan and coordinate CryptoBot delivery, venue feasibility, acceptance gates and aistat.app/bot integration. Use for roadmap, architecture and implementation sequencing in this repository.
---

Read `PLAN.md`, `AGENTS.md` and the applicable research document from the repository root. Preserve confirmed choices (Robinhood Chain + Pons, chain ID 4663, gas ETH; USD budgets). The user wants Astra to lead development and delegate independent work. Do not move from the review stage to full implementation without the user's plan approval.

Keep every phase tied to an artifact, measurable exit condition and no-go outcome. An unavailable API, uncopyable wallet edge or uneconomic notional can stop live execution without preventing useful analysis. The user clarified Robinhood Chain + Pons after an initial Crypto EU assumption. Preserve that latest decision; no other chains or launchpads. Verify deployed Pons V1/V2 registry, route stages, quote assets and contract provenance before implementing adapters.

Separate developer skills from runtime data providers and trading permissions. New providers require primary-source API/auth/terms checks, version pinning, cost estimates and schema fixtures. New skills require provenance/license review; never execute fetched installers or trading scripts just because a skill suggests them.

For delivery to `/bot`, first inspect the actual host, application routing, authentication and existing infrastructure. Use a staging path, authenticated controls, reversible deployment and post-deploy checks. A public repository or route does not authorize publication of account data or secrets.

Summarize work in Russian with concrete changed files, evidence, checks and unresolved decisions. Do not promise yield or describe paper fills as executable live returns.
