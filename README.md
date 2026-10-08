# CryptoBot

Разработка кабинета и исследовательского криптобота, который проверяет, можно ли воспроизвести торговые паттерны публичных кошельков после задержек и всех расходов.

**Первый multiuser web-инкремент опубликован на aistat.app/bot. Реальные средства и торговые полномочия не подключены.** Отсутствие подтверждённого преимущества — допустимый итог исследования.

Репозиторий: [FomaBy/CryptoBot](https://github.com/FomaBy/CryptoBot). Интерфейс: [aistat.app/bot](https://aistat.app/bot); публикация и проверки зафиксированы в журнале.

Исходные ограничения: **Robinhood Chain + Pons (chain ID 4663, gas ETH)**, бюджеты **USD 150 / 1 000 / 5 000**, желаемые входы **USD 10 / 50 / 250**. Список кошельков получен и проверен локально; исходник и нормализованный manifest сохранены в исключённом из Git `data/wallet-intake/`. Активность в сети и прибыльность ещё не проверены.

Первый релиз предназначен для нескольких пользователей с отдельными аккаунтами и кошельками. Реализованы серверная проверка существующей aistat-сессии, SQLite isolation, SIWE-доказательство контроля EOA без права расходовать средства, приватные задачи и USD-пресеты. Контрактные кошельки пока отклоняются. 16 локальных Node-тестов и browser QA прошли; авторизованный production E2E требует текущей пользовательской сессии.

Реальный chain intake, проверка Pons registry и wallet P&L, paper trading, market optimizer, development worker и signer ещё не запущены. API явно показывает это состояние, без вымышленных сделок или доходности. Автоулучшения должны проходить независимые проверки внутри разрешённых границ. LIVE требует отдельного решения и gates; месячный бюджет AI/данных ещё не утверждён.

Текущий web release: `web-4fbf9a6f4761cd91`. [Запуск и deployment](ops/README.md); [первичное наблюдение сети и фабрик](docs/research/chain-snapshot.md) не заменяет проверку контрактов и ликвидности.

Материалы: [требования и приёмка](REQUIREMENTS.md), [план](PLAN.md), [backlog](docs/backlog.md), [журнал исполнения](docs/execution-log.md), [host/auth inventory](docs/host-inventory.md), [разбор ТЗ](docs/research/spec-review.md), [методика проверки edge](docs/research/wallet-edge-validation.md), [skills](docs/skills-inventory.md). Пять project-local skills установлены в `.agents/skills`; их происхождение и хэши фиксирует `skills.lock.json`. Проверки: `python3 scripts/verify_workspace.py`, `npm test` на Node 24. Локальные credentials исключены из Git; signing keys не попадают в браузер или LLM.
