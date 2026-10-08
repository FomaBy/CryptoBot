# Журнал исполнения CryptoBot

Журнал дополняется новыми записями; исправления указывают предыдущее событие, а не стирают его. Здесь только очищенные факты: без адресов cohort, labels, credentials, исходного DOCX и приватных payload. При появлении runtime immutable machine audit станет первичным evidence, а этот журнал останется обзором этапов.

## E-001 — 8 октября 2026 — подготовка репозитория

Фактически: проверены локальная папка и пустой публичный `FomaBy/CryptoBot`; создан baseline README/.gitignore (`c1751c6`). Три имевшихся credential-файла исключены из Git; их содержимое для подготовки не читалось. Research/skills внесены отдельной веткой `codex/research-plan`, commit `72c129e`, [draft PR #1](https://github.com/FomaBy/CryptoBot/pull/1).

Evidence: пять skills прошли bundled `quick_validate`; локальная проверка 21 hash и ссылок семи документов прошла; [push CI](https://github.com/FomaBy/CryptoBot/actions/runs/37739439478) и [PR CI](https://github.com/FomaBy/CryptoBot/actions/runs/37739439621) успешны. Вендорные Apache-2.0 skills закреплены commit+хэшами. Это проверка подготовки, не проверка работоспособности бота. Связь: B-001, R-003.

## E-002 — 8 октября 2026 — уточнение продукта и разбор ТЗ

Фактически: после первоначального Crypto EU пользователь уточнил **Robinhood Chain + Pons**. Прочитан предоставленный Word-текст без изменения и публикации DOCX; [разбор](research/spec-review.md) включён в PR. Актуальные бюджеты 150/1000/5000 USD заменили старые параметры ТЗ. Прямой read-only public RPC запрос координатором подтвердил chain ID 4663 и непустой runtime code двух фабрик по `latest`; block snapshot/source-bytecode match и аудит безопасности не выполнены.

Граница evidence: [официальная сеть](https://docs.robinhood.com/chain/connecting/) и [Pons repository](https://github.com/ponsdotdev/pons-labs) подтверждают направление; не доказаны deployed contract equivalence, ликвидность, прибыльность или live readiness. Связь: R-001,009; B-005 остаётся PLANNED.

## E-003 — 8 октября 2026 — приватный wallet intake

Фактически: принят JSON-array из GMGN import format; 214/214 записей синтаксически корректны, 214 case-insensitive unique addresses, 0 дубликатов адресов, 5 пустых labels. Одно внешнее whitespace-отличие нормализовано в отдельном поле; исходный label сохранён. Точная source copy, SHA-256/read time, normalized manifest и validation report находятся в ignored `data/wallet-intake/`; source mode 0400, производные файлы 0600, каталоги 0700. Независимая read-only проверка координатором совпала по hash/counts/permissions/ignore.

Публично изменены только статусы в AGENTS/PLAN/README (`a16e057`). Ни одного адреса/названия/source файла в Git не добавлено. Сетевых/GMGN запросов и торговых действий для intake не было. Network field отсутствует; 4663 назначен контекстом, activity/Pons/profitability UNVERIFIED. Связь: B-002/R-004 DONE только локальный intake.

## E-004 — 8 октября 2026 — требования к кабинету и AI

Новый вход пользователя: login и торговля под своим аккаунтом с подключением кошелька; защита от scam, пустой ликвидности и искусственного wallet P&L; AI-улучшение алгоритмов и backlog, из которого AI выполняет изменения сайта; обязательная документация требований и исполнения.

Фактически подготовлены [REQUIREMENTS.md](../REQUIREMENTS.md) с устойчивыми R-ID/acceptance/status, [backlog](backlog.md) с задачами/зависимостями/evidence и этот журнал. PLAN/README/AGENTS и custom skills обновлены под bounded automatic promotion и отдельный development worker. Использованы [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361), [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html); auth/security и fraud/autonomy рассмотрены независимыми дочерними агентами. Это design review, не threat-model аудит реализованного приложения.

Новая политика заменяет требование ручного подтверждения каждого AI-изменения из старого ТЗ: внутри заранее утверждённого envelope продвижение будет автоматическим при независимом OOS/stress/paper pass. Самостоятельное повышение hard limits и получение ключей AI запрещены. Конкретный envelope, signing/deployment мандаты и numerical gates пока не активированы. Связь: B-003, R-003,005–022; B-003 ждёт проверки evidence и пользовательского ревью.

## Состояние на момент E-004 до разрешения реализации

Приложение `/bot`, runtime auth/wallet proof, signer, contracts registry verification, wallet profitability analysis, chain event ingestion, paper/live trading, optimizer и development backlog worker **не реализованы**. Нет фонового расписания, автоматических экспериментов или deployment. Реальные средства не подключены, DNS/production не менялись. Эта запись не утверждает успешность проверок нового commit до их фактического завершения; результат будет добавлен отдельным событием.

## E-005 — 8 октября 2026 — локальная проверка требований и skills

Фактически: проверка подготовки прошла для пяти skills, 21 файлового хэша и десяти документов, включая корневой REQUIREMENTS.md. Все пять skills прошли `quick_validate`; 22 R-ID и 20 B-ID уникальны, явные ссылки backlog разрешаются. `git diff --check` прошёл. Custom skills имеют revision 2 в lock; upstream packages не менялись. Результаты относятся к структуре/целостности документов, не к будущим runtime acceptance. CI текущего commit следует смотреть в [PR #1](https://github.com/FomaBy/CryptoBot/pull/1); до результата запуска его успех здесь не утверждается.


## E-006 — 8 октября 2026 — разработка и deployment разрешены

Пользователь явно одобрил реализацию и публикацию на `aistat.app/bot`, подтвердил multiuser с отдельными аккаунтами/кошельками. Это заменяет прежнюю planning-only/owner-only неопределённость из E-004. AGENTS/PLAN/REQUIREMENTS/README/backlog и три custom skills обновлены; live funding/trading/signing mandate не разрешены. Месячный операционный бюджет AI/данных ещё не выбран. Связь: B-003, R-003,005,020.

Разрешение текущей разработки и deployment не активирует безусловный autodeploy worker: будущий контур R-019/020 сохраняет server policy, независимые checks и отдельные права. Текущий deployment IN_PROGRESS; его успешность здесь не утверждается.

## E-007 — 8 октября 2026 — host и root auth inventory

Read-only cPanel Fileman и публичные HTTP-проверки подтвердили Python CGI root, отдельное Node 24 приложение `/crypto` и необходимость собственного prefix route для `/bot`. Remote auth code разрешает opaque `aistat_session` через SHA-256 lookup с expiry; fixed `/api/session` возвращает авторитетный `user_id` и per-session CSRF, а shared `username` не является ролью. Локальные root auth исходники отличаются от deployment; использован remote snapshot. Без cookie `/api/session` вернул 401 JSON/no-store, `/bot` — 303 на login.

Evidence и snapshot hash: [host inventory](host-inventory.md). Секрет cPanel использован внутри процесса без вывода; env/DB/private-user contents не читались. Host inventory завершена, но B-004 остаётся PARTIAL: интеграция, production authenticated E2E и rollback ещё проверяются. Связь: R-005,020,021; B-004,010.

## E-008 — 8 октября 2026 — первый multiuser backend и локальные проверки

Созданы `server/auth.js`, `store.js`, `wallets.js`, `app.js`, `index.js`: fixed-URL root-session introspection, SQLite account isolation, EOA SIWE proof без spend authority, private tasks с planned/cancelled, USD presets и account audit. Contract wallets пока отклоняются. Нельзя прислать owner/status для повышения прав или пометить задачу DONE. Приватный watchlist не превращается в execution wallets. Research/paper/AI явно не запущены; средств/сделок/signer нет.

Evidence: 12 native Node tests в `test/app.test.js`, `test/auth.test.js`, `test/wallets.test.js` прошли на Node 24 командой `node --test test/*.test.js`. Проверены A/B isolation задач/кошельков/settings/audit, unauth denial, CSRF/origin, owner/status injection, реальные локальные EOA-подписи, wrong account/session/signature, expiry/replay, параллельный verify (один 200 и один 409), contract rejection, fixed auth URL/cookie-only forwarding, revoke/error handling и SQLite close/reopen. Внешние API mocked, ключи одноразовые локальные без средств. `git diff --check -- test` прошёл.

R-005/R-006/R-018 отмечены PARTIAL, B-010/B-016 — PARTIAL. Это код и локальные проверки, не production E2E, завершённый backlog worker или торговая безопасность. B-013/B-018 и deployment IN_PROGRESS. Успешный deployment будет записан только после проверки координатором; historical запись перед E-005 об отсутствии приложения заменена текущим состоянием, но сохранена как свидетельство прошлого этапа.

## E-009 — 8 октября 2026 — согласованность документов после начала разработки

AGENTS/PLAN/REQUIREMENTS/README/backlog и три custom skills приведены к U6: разработка/deployment разрешены, multiuser выбран, live mandate и месячный AI/data budget остаются отдельными. Custom skills подняты до revision 3 с SHA-256 фактических файлов; два upstream пакета не менялись. Полнота roadmap сохранена, частично выполненные acceptance не заменены на DONE.

Evidence: `python3 scripts/verify_workspace.py` прошёл для 5 skills, 21 хэша и 11 документов; `quick_validate.py` прошёл для всех трёх изменённых skills. Проверены уникальность 22 R-ID и 20 B-ID, явные ссылки backlog и `git diff --check` по изменённым файлам. Это проверка документации/происхождения, не deployment. Связь: R-003,022; B-003,004,010,016,018.

## E-010 — 8 октября 2026 — browser QA и расширенные проверки

16/16 native Node tests прошли: к E-008 добавлены атомарный wallet cap при заранее созданных challenges, RPC chain/block evidence и coalescing, отказ по неправильной сети и streaming size cap. JSON null сервиса авторизации возвращает typed 503. CI устанавливает pinned lock без lifecycle scripts; credentials ему не выдаются.

Независимый координатор проверил local fixture в браузере: private task create/reload/cancel/filter/restore, буквальный вывод HTML без исполнения, сохранение USD preset 1000, no-extension UX. Исправлена мобильная навигация 390×844; повторная проверка показала видимые работающие ссылки. Дочерний агент в отдельном in-memory окружении проверил EIP-6963 → SIWE preview → локальную test EOA подпись → verify → unlink, anonymous gate и отсутствие JS ошибок. Это тестовый provider, не подтверждение совместимости всех брендов кошельков. Связь: R-005,006,018,022; B-010,013,016.

## E-011 — 8 октября 2026 — первая публикация web-инкремента

В 10:20:13 UTC опубликован release `web-02214c9a0634c4a1` в отдельном Node 24.21 приложении `/bot`. Health вернул HTTP 200 с точным release, `liveEnabled=false`, `paperEnabled=false`; cron deployment job завершился rc=0. Web source/lock соответствует commit `71c935d`; bundle SHA-256 `07ad39719b0df36d45e4aaded0b3445b2318758b5f23b0daa35f8072dfc7a841`. [GitHub CI для этого commit](https://github.com/FomaBy/CryptoBot/actions/runs/37762737086) завершился success, включая 16 тестов.

Первый smoke в 10:15 UTC получил 404: cPanel создал public mount directory с mode 0700 из private umask. Автоматический rollback восстановил исходный root routing; `/bot` снова возвращал прежний root login redirect. Доступ public mount исправлен на 0755/0644, private state сохранён 0700/0600. Следующий smoke прошёл. Bootstrap script исправлен; исходная root-конфигурация сохранена вне public directory. Root auth/source, `/crypto`, DNS и OAuth не менялись. В пакете только явные web/runtime/dependency пути; private watchlist/credentials/preview исключены.

Независимый координатор и разработчик подтвердили production: `/bot/` и JS/CSS 200, health с точным release, session без cookie `authenticated=false`, protected API 401, root `/login` 200 и `/api/session` 401, `/crypto/` 200, `/botany` остаётся root route. Browser production показал login gate и корректную ссылку на существующий login/Google.

Координатор отдельно отправил синтаксически валидную случайную несуществующую session cookie: `/bot/api/session` вернул `authenticated=false`, не 503. Это подтверждает production server-to-server доступ к root auth и отказ неизвестной сессии; положительную пользовательскую сессию не заменяет. Cookie не выводился.

Одна попытка root login с ранее предоставленным password-файлом вернула 401; password/username/cookie не выводились, повторных попыток и password reset не было. Поэтому успешная **авторизованная production** сессия ещё не подтверждена; требуется вход пользователя действующим способом. Изоляция двух synthetic accounts и подписи проверены локально, не выдаются за два реальных Google-аккаунта. Реальные кошельки, средства, trade signing, paper, optimizer и AI worker не включались. Связь: R-005,020,021,022; B-004,010,013,018 — частичная поставка, полный roadmap сохранён.

## E-012 — 8 октября 2026 — pinned chain snapshot

Read-only RPC подтвердил chain 4663, numbered block 83237066 и одинаковый hash при повторном запросе. Runtime code двух фабрик прочитан на этом номере; SHA-256/Keccak и source commit зафиксированы в [chain snapshot](research/chain-snapshot.md). Это partial B-005/R-009 и начальный evidence для B-006/R-010: source-bytecode equivalence, finality, event ingestion и анализ кошельков не выполнены. 214 private watchlist адресов не запрашивались и не публиковались.

## E-013 — 8 октября 2026 — исправление tablet-layout и текущий release

Production QA обнаружил подпись бренда, выступающую за компактную sidebar на ширине около 700px. CSS исправлен; browser проверки 700×900, 390×844 и 1440×1050 подтвердили доступную навигацию, отсутствие горизонтального переполнения и JS ошибок. Изменён только layout CSS.

В 10:25:35 UTC точечный update завершился rc=0. Текущий release **`web-4fbf9a6f4761cd91`**, health HTTP 200/live=false; SHA-256 реально отданного CSS совпал с локальным `da01afcd76097da37c240f2e084f8d8d81233e430e26ca657fb8337caf5aa223`. Перед обновлением проверены предыдущая версия и hash CSS, сохранены CSS/RELEASE; на ошибке предусмотрено их восстановление и restart. Root route/auth и DB не менялись. Связь: R-020,022; B-013,018. Full authenticated production acceptance и runtime worker остаются незавершёнными.

## E-014 — 8 октября 2026 — одобрена общая аналитика ACS

Пользователь попросил связать CryptoBot с AI-Crypto-Statistics и подтвердил две страницы: `/crypto` для статистики и `/bot` для бота, с общими анализами. Добавлены R-023/024 и B-021/022, [контракт общей аналитики](shared-analysis.md). При инвентаризации ACS оказался private GitHub repository; его код/datasets не копируются в public CryptoBot.

Public live `/crypto/api/state` подтвердил `private:false`, опубликованные token views нескольких launchpads; `/api/chains` на этом deployment не включён. ACS owner cookie отличается от root user session. Исследование исходников выявило request-time entry calculation в detail и side effect у `watch`: новый canonical endpoint использует только уже опубликованные `engine.state().tokens`. Wallet identities/feed, owner context и free-text risk explanations не входят в allowlist.

Для ACS создан отдельный worktree/branch `codex/shared-analysis` на исходном `e6f1ca3`; исходный checkout не изменялся. Позже координатор обнаружил в нём чужие активные изменения — они оставлены нетронутыми. Deployed engine/API сравнивались по содержимому, отличавшийся index — по diff. Deployment будет применять только согласованные файлы с remote hash preconditions, а не заменять всю директорию приложения. Связь: R-023/024, B-021/022; integration deployment ещё не подтверждён этой записью.

## E-015 — 8 октября 2026 — общая аналитика реализована и проверена локально

ACS producer, bot authenticated consumer, shared snapshot view, reciprocal navigation и canonical metadata в существующем token drawer реализованы. В памяти сохраняются content-deduplicated снимки с пределами 120/16 MiB/10 min и точным 410 при отсутствии версии. Consumer проверяет строгую схему, chain/token identities, отсутствие неожиданных/private полей, false execution flags и запрошенный snapshot; cookies не пересылает. Writer/trading/AI settings не менялись.

Evidence: CryptoBot **20/20** Node tests; ACS combined targeted producer/API/localization/UI suite **109/109**. Независимая cross-repo synthetic producer→consumer проверка сохранила ID/values, score 0, HIDDEN, dex и decimal precision. Browser QA координатора: обе страницы показывают одинаковые snapshot/analysis IDs и values, exact links туда/обратно, non-Pons исключён из bot cards, 410 не подменяется latest, явное обновление восстанавливает данные. ACS EN/RU сохраняет selector и загруженные данные; основной radar drawer показывает canonical score/IDs. Дочерний browser QA охватил 1440/700/390, inert HTML metadata, loading/empty/unavailable, snapshot-return после login и cache/race drawer. Обе проверки whitespace пройдены.

Полный исторический ACS test suite **не зелёный**: координатор воспроизвёл в исходном checkout существующие failures в boot gate/path expectations, ui-names и upside tests. Внесённые integration UI regressions (stylesheet expectation и локализация) исправлены; соответствующие scoped suites прошли. Это не утверждение полного regression pass. Production positive root login по-прежнему не проверен; fixture identity существует только в ignored localhost QA и не попадает в пакет. Связь: R-023/024, B-021/022; deployment этого инкремента ещё ожидает проверки.
