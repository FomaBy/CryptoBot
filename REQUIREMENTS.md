# Требования CryptoBot

Обновлено 8 октября 2026. Первый multiuser web-инкремент опубликован на `aistat.app/bot`: отдельные аккаунты, EOA ownership proof, private tasks и presets. Локальные тесты/UI QA и public production smoke пройдены; авторизованный production E2E ещё не подтверждён. Реестр отличает реализованные части от полной приёмки. Торговый исполнитель, paper trading и фоновые AI-workers ещё не запущены.

Источники: **U1** — выбор пользователем Robinhood Chain + Pons и USD-бюджетов; **U2** — переданный список кошельков; **U3** — вход на сайт, подключение кошелька и торговля под своим аккаунтом; **U4** — защита от скам-токенов/фиктивно успешных кошельков, AI-улучшение алгоритмов и backlog сайта; **U5** — обязательная документация требований и исполнения; **U6** — разрешение разработки/deployment и multiuser в первом релизе; **S1** — человеческое ТЗ v1.1; **D** — предлагаемое инженерное решение. Более поздние U3–U6 имеют приоритет над ограничениями S1. Метка `DONE` относится только к явно указанному артефакту; `PLANNED` — выполнение предстоит; `PARTIAL` — часть результата уже проверена.

## Область и документы

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-001 | Только Robinhood Chain 4663, Pons V1/V2; gas ETH. U1, S1. PLANNED | Registry и executor отклоняют другой chain, неизвестные фабрики/маршруты; fixtures покрывают V1, V2 curve, migration и готовый V4 pool. |
| R-002 | Независимые USD-пресеты 150/10, 1000/50, 5000/250. U1. PARTIAL — выбор сохраняется по аккаунту; отчёта экономики пока нет | Отчёт для каждого капитала/входа содержит trading net и economic net с расходами сервиса; ETH/quote/USD учитываются раздельно. Вход — notional, риск и gas reserve определены отдельно; невыгодный размер получает no-go. |
| R-003 | Вести требования, исполнение и backlog. U5. PARTIAL | Для каждого изменения есть R-ID, task ID, основание, статус и evidence. Различимы требование, proposal, принятая версия, реализованный код и deployed результат; DONE без доказательства запрещён. Документы и базовый account-scoped audit задач/кошельков/settings созданы; полная runtime evidence chain предстоит. |
| R-004 | Приватный исходный cohort кошельков. U2. DONE только intake | 214 синтаксически валидных уникальных адресов приняты локально; source copy, SHA-256, read time, manifest и отчёт исключены из Git. Пять пустых labels допустимы. Все 214 — watchlist кандидатов с UNVERIFIED activity/Pons/profitability, не доказанные лидеры и не кошельки под управлением пользователя. UI отделяет watched wallets от linked execution/funding wallets; import не доказывает контроль или право подписи. |

## Сайт, аккаунт и кошелёк

Первый релиз подтверждён как multiuser: каждый пользователь входит через существующий aistat login и имеет отдельные задачи, настройки и связанные кошельки. `account_id` выводится сервером из авторитетного `user_id` root-сессии; shared `username` не является идентификатором или ролью. Инвентаризация выполнена в [host inventory](docs/host-inventory.md). Локальные тесты проверяют изоляцию SQLite/API; production-проверка входа и двух пользователей ещё предстоит. Регистрацией управляет существующий root login; торговое делегирование и обслуживание средств не активированы.

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-005 | Вход и серверная изоляция аккаунтов. U3, U6, D. PARTIAL — backend и локальные тесты | Существующие auth/session интегрированы; все API, jobs, caches, exports, websocket subscriptions и signer requests проверяют владельца. Account A не читает/меняет B даже через подмену ID. Внешние задачи используют server-derived account context, не переданный клиентом owner. Privileged actions требуют повторной проверки сессии. |
| R-006 | Подключение и доказательство контроля кошелька. U3, U6, D. PARTIAL — EOA backend и локальные тесты | Сервер выдаёт одноразовый challenge с nonce, ожидаемыми domain/URI, chain 4663, временем жизни и привязкой к account/session. Подпись проверяется; nonce потребляется атомарно один раз. Replay, другой origin/chain/account, expiry и параллельное повторение отвергаются. EOA и smart-contract wallet проверяются соответствующим механизмом; unsupported wallet не считается подтверждённым. |
| R-007 | Отдельное ограниченное полномочие для торговли. U3, U4, D. PLANNED | Connect/SIWE не дают права расходовать средства. Без делегирования обычный внешний кошелёк подписывает каждую сделку вручную. Для автономии пользователь отдельно выбирает подтверждённые session permissions либо изолированный кошелёк бота с ограниченным балансом и signer policy. Проверены chain/contracts/selectors/recipient/amount/allowance/gas caps, срок, отзыв и account binding. Поддержка session keys на Chain/Pons ещё не заявляется. Никаких seed phrase в UI/LLM. |
| R-008 | Понятные pause/disconnect/revoke и позиции. U3, S1, D. PARTIAL — unlink без on-chain полномочий; trading lifecycle впереди | UI различает disconnect браузера, unlink аккаунта, pause новых входов и отзыв торгового мандата. Pause/revoke прекращают новые подписи и отменяют queued intents после recheck; pending broadcast reconciliation продолжается. Browser disconnect сам по себе не объявляется on-chain revoke. Любые уже открытые позиции отображаются; ликвидация не запускается без ранее разрешённой политики/действия пользователя. |

SIWE определяет аутентификацию; торговая авторизация — отдельный слой приложения. Typed-data подпись не даёт встроенной защиты от повторного исполнения: nonce, deadlines и consumption должны проверяться в целевом протоколе/сервисе. Это проектные требования, не подтверждение поддержки конкретного кошелька. [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361), [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Подлинность кошелькового результата и безопасность входа

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-009 | Проверяемый registry контрактов и переходов. S1, U4, D. PLANNED | Pinned source/ABI/runtime bytecode и зависимости проверены на numbered block/hash; proxy/admin/hook/fee policy видимы. CURVE → MIGRATING → POOL_READY различаются; неизвестный deployment/изменение запрещают новые входы. |
| R-010 | Причинные, полные и восстанавливаемые данные. S1, U4. PLANNED | Raw events имеют source/block/tx/log, first-seen и canonical status. Gap/reorg/dedup/restart fixtures восстанавливают агрегаты и сверяют уже отправленные tx независимо; изменение истории не стирает свидетельство решения. Coverage и missing values видны. |
| R-011 | Отсеивать «нарисованный» wallet P&L. U4, D. PLANNED | Ledger отличает buy/sell от issuer allocation, airdrop, transfer/bridge, creator-tax/LP income, изменения курса ETH и внешнего funding; неизвестный cost basis остаётся неизвестным. Vendor P&L, реконструированный wallet P&L и результат нашей копии различимы. Realized P&L показан отдельно от unrealized mark и **исполняемой стоимости ликвидации**. Непродаваемые/rugged токены получают консервативную unrealized/stress оценку вплоть до нуля/full loss, но без выдуманного sell fill или realized P&L; не удаляются из выборки. Высокие X/ROI и labels сами по себе не допускают кошелёк. |
| R-012 | Проверять манипуляции, независимость и копируемость. U4, D. PLANNED | Point-in-time признаки проверяют circular funding/self trades, связанные кластеры, создателя, bundling, повторный объём и concentration. Продажи собственным/связанным адресам не считаются независимым внешним спросом. Сохраняются evidence/confidence/unknown, а не обвинение по одной связи или отсутствию истории. Задержанная копия не использует атомарные/инсайдерские fills лидера. Тестовый fake winner с неликвидным token mark не проходит, а неизвестная себестоимость не превращается в прибыль. |
| R-013 | Экономически исполнимая покупка и продажа. U4, S1. PLANNED | Для нашего адреса, размера и состояния проверяются обе стороны маршрута, доступный quote reserve/depth, fees/taxes/impact, approvals и gas. TVL/FDV/запертая LP не заменяют sell depth. Права upgrade/pause/blacklist/mint/transfer и V4 hooks учитываются по конкретному контракту. Simulation success не является гарантией: повторная проверка перед подписью, stress exit и loss сценарии обязательны; unknown запрещает новый вход. |
| R-014 | OOS edge и полный учёт риска/исполнения. U1, U4, S1. PLANNED | Cohort/параметры фиксируются до следующего окна; replay учитывает time availability, неудачные tx и выходы. Отдельные presеты проходят cost/latency/exit stress; deterministic risk caps, reservations, nonce state, reconciliation и kill switch проверены отказами. Drawdown использует cash-flow-adjusted equity; списания и неудачные сделки не исчезают при смене стратегии. |

Исследование маркирует unknown, fail и pass раздельно; неизвестное критичное поле не даёт разрешения на вход. Итоговый score не называется вероятностью безопасности и не заменяет evidence gates. Ни одна проверка не обещает полного исключения scam/rug.

## AI-улучшение стратегий

Новый запрос U4 **заменяет** запрет S1 на любое автоматическое применение предложений. Нужна ограниченная автономия: владелец один раз утверждает область допустимых изменений и правила проверки; прошедшие их версии могут продвигаться автоматически. Это требование будущей функции, не уже работающая автоматизация и не разрешение live на текущем этапе.

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-015 | AI ищет улучшения wallet analysis, признаков, входов и выходов. U4, D. PLANNED | Optimizer создаёт preregistered гипотезу с механизмом, data/feature version, search space и budget до теста. В разрешённой области могут меняться параметры и композиции проверенных deterministic strategy operators. Произвольный исполняемый код проходит отдельный development pipeline; текст модели не исполняется как стратегия. Runtime модель/провайдер выбираются после eval и учёта стоимости, не наследуются из имени разработчика Astra. |
| R-016 | Автоматическое продвижение только через независимые gates. U4, D. PLANNED | `PROPOSED → REGISTERED → OFFLINE_PASS → FUTURE_OOS_PASS → PAPER_PASS → CANARY → ACTIVE` с immutable evidence. До CANARY нужен разрешённый live mandate; paper-only режим заканчивается PAPER_ACTIVE. Gate проверяет улучшение против champion/baselines с заранее зафиксированной неопределённостью, economic net и риск по каждому preset. Все trials и использованные holdouts учитываются; подсмотренный holdout не переиспользуется как untouched. Insufficient data — ждать, не pass. Optimizer не может менять gate/caps или проверять себя собственной оценкой. |
| R-017 | Остановка и возврат проверенной версии. U4, S1, D. PLANNED | Пользователь может остановить обучение/продвижение/входы раздельно. Drift, превышение ошибки исполнения и hard limits вызывают паузу либо rollback на ранее допущенный artifact в рамках policy. Если он несовместим с текущим registry/состоянием — pause. Ledger, открытые позиции, loss counters, HWM и audit сохраняются; новые правила не переписывают прошлые убытки и не меняют exit policy открытых позиций молча. |

Search envelope фиксирует разрешённые признаки/операторы, диапазоны, цели, ограничения tail risk, allowed datasets, период оценки, trial/cost/time budget и полномочия promotion. Social-filter из ТЗ можно менять автоматически **только если он включён в утверждённый search space**. Автоматическое включение новых wallets проходит те же evidence gates и freeze до будущего окна; recent leaderboard не создаёт OOS. Всегда запрещено автоматически увеличивать hard risk caps, подключать другой chain/неразрешённый protocol contract, переводить средства на произвольный адрес или получать ключи. Новые Pons tokens/routes допустимы через утверждённую factory/schema/registry admission policy; это не право менять саму policy. Изменение envelope/hard controls требует отдельного разрешения владельца, не решения AI.

## Backlog сайта и AI-разработка

Это второй AI-контур: он меняет код/сайт по задачам, а первый исследует торговые стратегии. Их credentials, очереди и разрешения разделены.

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-018 | Backlog в кабинете. U4, U5, U6. PARTIAL — приватные задачи/статусы; worker и полный task contract впереди | Авторизованный владелец создаёт задачу с целью, R-ID, scope, priority, dependencies, acceptance, разрешёнными действиями и risk class; видит owner, status, evidence и причины блокировки. Автор задачи не может получить больший доступ текстом. Предложения других аккаунтов не становятся разрешением менять общий production. |
| R-019 | AI берёт и доводит задачи в ограниченном workspace. U4, D. PLANNED | Серверная claim lease + fencing token и idempotency исключают параллельную публикацию одной задачи. Agent работает в отдельной git-ветке/worktree, с разрешёнными путями/инструментами, лимитами времени/расходов и без live keys/приватного cohort. Timeout/crash возвращает контролируемое состояние; очередь не создаёт бесконечных retries. Issue → commit → tests → PR/staging связаны и видны. |
| R-020 | Проверка и публикация изменений сайта по policy. U4, U6, D. PARTIAL — текущий deployment разрешён и IN_PROGRESS; autodeploy-controller впереди | Низкорисковые изменения могут автоматически пройти tests/review/staging и deploy **после утверждения такой deployment-policy**. До её включения — PR/staging-only. Auth, wallet/signature/approval UI, tenant boundaries, signer, risk/gates, permissions, CI/build/deploy controls, secrets, migrations и неизвестное воздействие уходят в review/quarantine. Независимые file/capability/behavior gates оценивают diff, а не заявленный AI risk label. Evaluator, baseline и enforcement CI загружаются из защищённой trusted версии; agent не меняет их и не сертифицирует себя. Post-deploy checks и rollback не меняют trading ledger/мандаты. |
| R-021 | Недоверенный текст не выдаёт полномочий. U4, D. PLANNED | Token/social/labels, HTML, vendor responses, task attachments и AI proposals обрабатываются как данные. Prompt injection fixture не меняет scope, signer policy, secrets access или deployment permission. Полномочия поступают от server-side authenticated policy, а не из тела задания или модели. |
| R-022 | Сквозной аудит и обязательная документация. U5, D. PARTIAL — базовый account audit и журнал; полная цепочка впереди | Для каждого AI-изменения доступны task/R-ID, actor/account, source/commit, model+prompt version, dataset snapshot, trial/eval, decision, deploy и strategy version. Доступ учитывает account isolation; публичные PR содержат только очищенные evidence. Backlog DONE требует выполнения acceptance, обновления требований/журнала и доказательства фактического результата. |

## Наблюдаемая реализация первого релиза

`server/auth.js` проверяет существующую root-сессию через фиксированный HTTPS endpoint; `server/store.js` хранит данные по аккаунтам в SQLite. `server/wallets.js` формирует SIWE challenge для chain 4663 и проверяет EOA-подпись; contract wallets отклоняются. `server/app.js` реализует session/overview, приватные задачи, settings, wallet proof/unlink и audit; `server/index.js` запускает приложение без signer. Клиент не назначает owner и не переводит задачу в DONE. Приватный cohort не импортируется в пользовательские execution wallets.

В `test/*.test.js` прошли 12 тестов, включая A/B isolation, CSRF/origin, подмену полей, EOA wrong-signature/account/session, expiry/replay, два параллельных verify, отказ для contract wallet, отзыв root-сессии и SQLite close/reopen. Внешние сервисы замокированы. Это не production E2E и не доказательство торговой безопасности. В ответах API paper/live отключены; research/analysis не начаты, AI worker не подключён, прибыль не выдумывается. Связь с событиями E-006–E-008: [журнал](docs/execution-log.md).

## Общая аналитика

Дополнение U7: пользователь подтвердил связь с AI-Crypto-Statistics: статистика остаётся `/crypto`, бот `/bot`, обе страницы используют один анализ токенов.

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-023 | Единый источник анализа ACS для двух страниц. U7. DONE — текущая published projection, E-017 | Анализ строится только существующим ACS engine; общий API проецирует опубликованные значения, не вызывает LLM/providers/watch и не пересчитывает score. Обе страницы показывают одинаковые snapshot ID, token identity, analysis ID/version, source revision и observation timestamps. Ссылка на точный сохранённый снимок возвращает его либо явный 410; не подменяется latest. |
| R-024 | Разделить общий анализ и приватные полномочия. U7, R-005,021. DONE — integration boundary, E-017; R-005 остаётся PARTIAL | Canonical endpoint всегда использует фиксированный публичный allowlist, независимо от ACS owner cookie/loopback/настройки private names. Wallet identities/feed, account tasks, secrets и private source отсутствуют. Bot proxy проверяет root session, не пересылает cookies и отклоняет неизвестные поля/цепочки/формат. В интерфейсе бота только reported Pons на 4663; label не доказывает registry/sellability. Аналитика не разрешает торговлю. |

## Исторический прогон

Дополнение U8: пользователь запросил прогон за последние две недели «как будто торговал бы» и выбрал правила текущей статистики ACS.

| ID | Требование, источник, статус | Критерий приёмки |
|---|---|---|
| R-025 | Исторический прогон текущего ACS-профиля. U8. IN_PROGRESS | Из кабинета запускается и сохраняется аккаунтный отчёт с USD presets 150/10, 1000/50, 5000/250, точным UTC окном последних 14 дней, frozen source profile и исполненной model version. При неполном покрытии полный результат не выдумывается: доступный период выбирается пользователем явно. Сценарий по сохранённым наблюдениям отделён от доказанной исполнимости и точного воспроизведения всех live gates. Отчёт показывает coverage, gaps/caps, costs, ledger, cash, partial exits, conservative write-down, equity/drawdown, no-trade baseline и unknowns. Causal tests запрещают будущие признаки/мгновенные выходы; account tests проверяют доступ, CSRF, idempotency и restart/limits. Live/paper/AI не включаются. |

## Открытые решения

1. Месячный операционный бюджет AI/данных/RPC ещё не утверждён; создание сайта не разрешает неограниченные платные workers. Multiuser уже выбран и больше не является открытым решением.
2. Способ автономной подписи: проверенные delegated/session permissions или отдельный ограниченно финансируемый кошелёк бота; конкретный custody/ключевой lifecycle утверждается после проверки поддержки. Одного Connect Wallet недостаточно.
3. Численные risk caps, search envelope, admission thresholds и классы autodeploy выбираются по измерениям и утверждаются до активации. Список кандидатов, желание AI-улучшений и доступ к сайту не заменяют такого мандата.

Порядок реализации: [backlog](docs/backlog.md). Фактически выполненное: [журнал исполнения](docs/execution-log.md). Общая архитектура: [план](PLAN.md).
