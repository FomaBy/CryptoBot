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

## E-016 — 8 октября 2026 — byte-exact preflight

Hash preflight остановил packaging до загрузки/записи: cPanel `get_file_content` по умолчанию менял расположение HTML charset markup в возвращаемом тексте. HTTP bytes обоих deployed index совпали с reviewed Git bases; это уточняет наблюдение HTML diff в E-014 — actual deployed drift не обнаружен. [Fileman API](https://api.docs.cpanel.net/specifications/cpanel.openapi/manage-files/fileman-get_file_content) переведён на `update_html_document_encoding=0` и явный UTF-8; повторное чтение совпало побайтово с HTTP/Git. Исключение HTML из baseline не используется. Все целевые remote файлы сравниваются с reviewed commits перед упаковкой и повторно проверяются job перед записью.

## E-017 — 8 октября 2026 — общая аналитика опубликована

В **11:45:46 UTC** dual-app job завершился rc=0. Текущий CryptoBot release **`web-fc22ac418a66d12a`**, исходники инкремента `83d03f1`; ACS integration revision **`0529d30`**, [private PR #2](https://github.com/FomaBy/AI-Crypto-Statistics/pull/2). Публичный [CryptoBot PR #1](https://github.com/FomaBy/CryptoBot/pull/1) содержит только consumer/UI/контракт. Bundle SHA-256 `b373f7fcff08a9bdad3dd28b59509a55d6ebb8c489835a62157708a7d5a91468`. Перед записью все existing target files совпали с reviewed Git bases; исключения не потребовались. Backup и rollback подготовлены; интеграционный smoke прошёл без rollback.

Независимые production проверки: schema `acs.analysis.v1`, source revision 0529d30, bot health с точным release и live/paper=false; direct real consumer → canonical → exact snapshot сохранил идентичные items/IDs. После обычного warmup ACS в 11:46 UTC координатор наблюдал **119 published rows, 112 Pons-reported**; это меняющееся наблюдение, не фиксированный universe или допуск. Разработчик отдельно получил 61/55 на более раннем снимке. Нулевой первый ответ warmup не выдавался за завершённый анализ сети.

HTTP SHA-256 всех девяти изменённых browser assets (bot HTML/JS/CSS, ACS index/drawer/i18n/analysis HTML/JS/CSS) совпали с worktree bytes. Bot analysis без сессии — 401; другой chain — 400; отсутствующий valid snapshot — 410. Root login/session и старые страницы сохранены. CI для bot implementation `83d03f1` завершился success; локальные 20/109 checks и browser evidence описаны в E-015. Private dataset matches в tracked CryptoBot файлах — 0 по независимой проверке координатора.

R-023/024 и B-021/022 завершены для текущей общей published projection. Positive production root-login всё ещё требует действующей пользовательской сессии; это сохранённое ограничение R-005, не обход авторизации. Полный historical ACS suite не объявлен зелёным. Общая оценка, высокий score и Pons label не создают live mandate; подписант, реальные средства и AI workers CryptoBot не подключались.

Production browser QA координатора в 11:46:59 UTC: shared view загрузил 125 records, из них 118 Pons-reported, с revision 0529d30; RU переключение и exact snapshot/token link прошли. Bot login gate сохранил analysis/token и возврат в research через root login. Это наблюдение текущего снимка; действующие credentials не вводились.

## E-018 — 9 октября 2026 — запрос исторического прогона и фактический архив

Пользователь запросил прогон последних двух недель и явно выбрал правила текущей статистики ACS. Добавлены R-025/B-023. Историческая модель использует тот же ACS архив; private engine/source не переносится в public CryptoBot. Read-only host inventory завершился в 16:55:46 UTC: `strategy-history.db` содержит 2 096 933 observations, timestamps 1791270333632–1791564895179 (примерно 3,4 суток), а не две недели. Radar snapshots/score_log имеют ещё более короткий горизонт; отдельный прежний radar-copy отсутствует. Это временное наблюдение меняющегося архива, не обещание полноты всех сетевых событий. Адреса, labels и raw records не выводились.

Текущий публикуемый ACS профиль — `ENTRY65_DEX`, с выходом C. Архив хранит recorded entry rating и наблюдения, но не полную историю migration timing/knife/devDump/всех hard gates. Поэтому точное исполнение всей live-стратегии не доказуемо по этому источнику; сценарная модель должна явно перечислять невоспроизводимые условия, отдельно фиксировать hash исходного профиля и реально исполненного алгоритма, сохранить insufficient evidence и не выдавать модельные продажи за on-chain fills. Полный 14d и вручную выбранный available window различаются явно.

Host preflight: deployed ACS marker 0529d30 и `server/core/api.js` побайтово совпадают с reviewed integration base; bot release всё ещё web-fc22ac418a66d12a. Исходный отдельный ACS checkout продвинулся и не меняется этой работой. Новые источники, платные провайдеры и trading authority не подключались.

## E-019 — 9 октября 2026 — реализация и проверка исторического расчёта

R-025/B-023: реализованы отдельный read-only ACS worker/report endpoint, строгий public consumer, account-scoped SQLite runs с idempotency/lease/лимитами и интерфейс покрытия/запусков/результатов. USD ledger использует BigInt 10⁻⁸, резерв двух выходных gas, задержанные входы/выходы и повторную проверку recorded guards. Partial exit fractions относятся к исходной позиции; каждое списание gas реально отражается в учёте. Неизвестный остаток не создаёт sell transaction. Неполное окно 14d блокирует численный сценарий и на сервере; available требует явного выбора.

Read-only benchmark предварительной версии на host в 17:05:33 UTC: архив 2 101 864 rows / 14 732 tokens; исторический predicate нашёл 6 кандидатов, прочитаны все 3 967 их наблюдений, caps не достигнуты; длительность 4,83 секунды. Это проверка осуществимости полного доступного отбора, не итоговая оценка доходности: после benchmark исправлялись денежное округление, газ и guards, поэтому промежуточный PnL не используется.

Итоговые локальные проверки: public CryptoBot 25/25, private ACS 44/44 targeted tests. Включены causality/delayed exit, partial/gas/conservation, неизвестные guards, look-ahead boundary, неполное окно, worker timeout/exit semaphore и реальная последовательность coverage→strict→scenario при одном cutoff. Public tests проверяют account isolation, CSRF, idempotency conflict, capacity, истечение lease и null-result insufficient reports. Синтетический producer→consumer проверен для всех mode/window combinations; private source не включён в public fixtures.

Browser integration QA с настоящими producer/consumer/API и синтетической isolated SQLite: явный выбор available, сохранённый strict и scenario, одна позиция с двумя partial sales, reload exact run, отдельные computation/evidence статусы, расходы и unknown economic PnL. Ширины 1440/700/390, inert metadata и отсутствие JS ошибок подтверждены; координатор независимо прошёл основной flow. Это fixture, не положительная production root-сессия. Production rollout и окончательный historical result будут записаны отдельно.

Первый deployment job в 17:15:50 UTC остановился до записи файлов приложения: host Python sqlite3 не поддерживает `Connection.backup`. Код/DB приложения не изменены. Backup переведён на `node:sqlite.backup` проверенного Node 24 runtime; локальный read-only backup и чтение восстановленной копии подтвердили работоспособность. Повторный job по-прежнему требует все hash preconditions перед изменением.

## E-020 — 9 октября 2026 — исторический прогон опубликован и выполнен на реальном архиве

Повторный job завершился **17:20:45 UTC, rc=0**. Release **`web-bedf7d90e52adac2`**, bot source `c393098`, private ACS `9204180`. Все reviewed file/dependency hashes и прежние markers совпали; выполнен согласованный SQLite online backup через Node 24. Отдельный локальный тест подтвердил включение committed, но ещё не checkpointed WAL-записи в backup. Additive таблица результатов не меняет существующие аккаунты; rollback пользовательской DB не выполнялся. Bundle SHA-256 `00dea26d2ef97ef85a2272422142897c2cd986e7ece039e45c4bdb730dc8f227`.

Координатор независимо подтвердил production release/health, live=false/paper=false, SHA-256 трёх реально отданных browser assets, 401 у backtest API без сессии, сохранение root и `/crypto`, корректный login gate в браузере. Положительный production root-login всё ещё не подтверждён; авторизованное сохранение/чтение/изоляция проверялись через локальный actual API fixture, а не объявляются выполненными под реальным Google-аккаунтом.

Фактический production producer → строгий consumer прошёл шесть комбинаций: coverage, strict14d, scenario14d и available scenario для 150/1000/5000. Requested UTC: **2026-09-25 17:21:00 — 2026-10-09 17:21:00**; доступный архив начинается **2026-10-06 07:05:33.632**. На этом frozen cutoff: 2 112 916 записей / 14 780 токенов; 6 исторически подходящих кандидатов / 3 992 их наблюдения, `truncated=false`. Это весь найденный исторический cohort без выборки по будущему результату. Dataset hash: `abee8f6b9c4d6e27732d59cb17a2c44b8a9f3d51f6a915104bbda44005906d15`. Strict14d и scenario14d вернули недостаточность данных с `result:null`; короткий период не подменил две недели.

Явный available scenario завершился для каждого preset. Ниже **модельные** результаты короткого архива при объявленных cost/impact assumptions и отсутствующих live gates, не доходность полного 14-дневного периода и не реальные сделки:

| USD банк / вход | Модельный trading net PnL, USD | Конечный cash, USD | Max drawdown, USD |
|---|---:|---:|---:|
| 150 / 10 | -0.25487784 | 149.74512216 | 5.38307349 |
| 1000 / 50 | -1.38493988 | 998.61506012 | 26.8188826 |
| 5000 / 250 | -23.33498702 | 4976.66501298 | 137.31269964 |

В каждом прогоне 2 закрытые модельные позиции, 4 отказа повторной entry-проверки, без final unpriced inventory. Проверены точные равенства в единицах 10⁻⁸ USD: cash−initial = net PnL = realized + write-down. No-trade trading PnL=0; economic net остаётся неизвестен. Computation complete и insufficient execution evidence показаны раздельно. Эти наблюдения не доказывают edge и не запускают promotion. Sanitized aggregates и полные разрешённые ответы сохранены только в ignored artifacts; private watchlist не использовался. Localhost fixture остановлен.

R-025/B-023 завершены для текущей функции исследования и сохранённых отчётов; полный B-009/OOS, paper/live и AI workers остаются отдельной невыполненной работой. CI code `c393098` прошёл; финальная документация добавляет это observed evidence.

Независимый audit координатора через Python Decimal дополнительно подтвердил для всех presets: сумму trade realized и costs против report totals, сумму partial proceeds против trade proceeds и closed proceeds−entryCost против realized PnL. У всех трижды проверенных сценариев 2 trades, без truncation, профиль ENTRY65_DEX и `fullWindow=false`.

## E-021 — 2026-10-09: preregistration оптимизации (R-026, B-024)

Пользователь запросил улучшение прибыльности. До новых фактических прогонов зафиксированы [envelope](research/optimization-envelope-v1.json) и [методология](research/optimization-study.md): 48 оценок на прежнем cutoff 17:21 UTC, вся история exploratory. Проведён read-only разбор исходных расходов и задержек; параметры тарифа не изменены. Реальные trials ещё не запускались; baseline/evaluator review и deployment остаются впереди. Полные B-009/R-015 не объявляются выполненными.

Независимый review параметризованного evaluator завершён до actual trials: causal checks, 48-grid, costs/caps/stress, dataset freeze и golden OLD9204180 на трёх бюджетах приняты. Evaluator SHA-256 `74994218cc539d214afc7316a70a93156f84c26d4b608a3f942de3cc895fc738`; private implementation `f7a9c20`. Включён только зарегистрированный offline study endpoint. Account API/UI и строгий публичный consumer реализованы; deployment/фактические результаты пока не заявляются.

Локальные проверки текущего кода: 30/30 public bot tests, 48 targeted private tests до transport race fix и 26 повторных history/optimization tests после него. Исправление shared persistence promise сохраняет единый reportId/selectionAt для concurrent callers и disk winner; evaluator hash не изменился. UI synthetic QA 1440/700/390 пройден. Положительный production root login по-прежнему не проверен.

## E-022 — 2026-10-09: deployment ограниченного исследования (R-026, B-024)

Bot code `d29427d` и private ACS `931d0b8` проверены: 31/31 public tests, независимые 26/26 history/optimization tests, browser start/save/reload/filter48/details и responsive QA. Consumer дополнительно закрепляет exact evaluator/exit rules и независимо проверяет rank через рациональные BigInt значения. Schema fixture остаётся синтетическим.

Первый job `cryptobot-optimization-20261009180357` прошёл hash preconditions и backup, но smoke через 3 секунды увидел новый bot release и предыдущую ACS revision. В 18:05:34 UTC job завершился rc1 и восстановил прежние app files. Actual optimization trials не запускались. Ops-only исправление `abc849e` заменило фиксированное ожидание на bounded 90-секундную проверку **точных** source revision и bot release, сохранив rollback при несовпадении. Retry `cryptobot-optimization-20261009180645` поставлен в существующую очередь; факт его успешности фиксируется ниже после наблюдения.

Retry успешно завершился rc0 **18:10:42 UTC**: release `web-ad69db38683459e3`, bot `abc849e`, ACS `931d0b8`, bundle SHA-256 `3ac4856071ec26cf240646837291e7f123b1cd1888ef56893d581404286e7690`. Exact source revision/release подтверждены после graceful restart. Existing auth и другие приложения сохранены; live/paper false.

Первый actual fixed study завершился в 18:11:31.931 UTC, получение и strict consumer validation заняли около 5.2 секунды. Сохранены все 48 trials без failed/truncation. Dataset точно совпал с preregistration; исходные champion monetary/count поля по трём бюджетам совпали с предыдущими actual reports. Report ID `ddbb7538243b014027f6873acca6199969ade8f15587be1e5538e660fc6b4e2b`; evaluator остался `74994218cc539d214afc7316a70a93156f84c26d4b608a3f942de3cc895fc738`. Все результаты — [в исследовании](research/optimization-study.md).

75/FIXED/5 дал base net +7.94844332/+39.08562243/+174.52891919 USD, но на одной позиции; stress и увеличенная задержка дали 0 входов. 65/FIXED/5 дал base +2.55734417/+12.22937127/+37.09235447, но stress −5.50345421/−27.54871838/−143.83192223. Результат предопределённого gate: no_trade_preferred/no_promotion, selectedCandidateId=null. Не меняли envelope/evaluator/затраты после просмотра; новые trials не запускали. Fixed infra/data costs неизвестны; economic net null. Все исходные данные exploratory, future OOS и paper ещё не начаты.

B-024/R-026 DONE только для текущего finite research/API/UI. Полный edge, autonomous AI, future paper и live не выполнены. Public suite 31/31, private targeted и независимые history/optimization проверки успешны; полный ACS suite не объявляется зелёным из-за ранее известных unrelated failures. Production positive root login не проверен: browser fixture тестировал настоящее API/SQLite с synthetic identity. Privacy scan 73 tracked files против 214 private watchlist addresses: 0 совпадений.

Независимый итоговый audit координатора: Python Decimal проверил все 48 cash/realized/write-down/cost bridge/baseline deltas; отдельный rank расчёт совпал с четырьмя eligible candidates и null selection. Проверены exact champion money/count/skipped против прежних отчётов и producer→consumer roundtrip. Production health показал target release; SHA-256 трёх served assets совпал с reviewed bytes; optimization API без сессии 401, root session 401, root и `/crypto` 200, браузер сохранил login return `/bot/#research`. Это negative/auth-gate evidence, не положительный production login.

Actual production report дополнительно проверен через local account fixture UI: старт/сохранение, no-trade heading, все 48 complete, нулевые и отрицательные stress outcomes, точное восстановление run после reload. Это actual report с локальной synthetic identity, не production authentication bypass. Owned localhost preview остановлен после QA.

## E-023 — 2026-10-09: повтор causal replay всего сохранённого архива (R-027, B-025)

До новых actual calculations зарегистрирован [manifest](research/full-history-replay-v1.json): cutoff 18:16 UTC, champion 65/C/5 и ранее рассмотренный challenger 75/FIXED/5, три бюджета/base+stress. Это 12 full runs и 12 old-prefix validations, без нового перебора. Вся прежняя история просмотрена; прирост до 18:16 также раньше указанной границы будущего OOS 19:26:31.931 и не называется untouched test. Предусмотрен metadata gate global MIN/counts и abort при caps или prefix mismatch; evaluator/приложения не меняются.

Методика и все численные итоги — [full-history replay](research/full-history-replay.md). Private test commit `3d85e2b` добавил 7 synthetic causality tests; 19 tests вместе с optimization прошли, независимые 7/7 также пройдены. Reviewed one-shot runner `acbf357`, SHA-256 `687d70817d21bc58dd7788f1247f30c2423ee44ce05c61fc07615b485d21cc03`, включает global-window/count/cap/old-prefix guards до PnL, event-prefix comparisons с нетерминальными списаниями, точный cash/realized/write-down/cost ledger. Внешний timeout100s/kill5s и Node heap256MiB; runtime/evaluator не менялись.

Job `cryptobot-full-replay-20261009182132`: start 18:25:38Z, rc0 end 18:25:46Z. Все retained observations до 18:16: 2 146 533 строки/14 978 токенов; историческая отметка Pons —668 309/3 757; entry cohort —6/4 073. Earliest06Oct07:05:33.632Z, olderThanReaderWindow0, capsfalse. 12 full+12 prefix завершены, old dataset hashABE точно совпал, прошлые events неизменны. +33 617 новых наблюдений/+198 общих токенов/+81 cohort observation после 17:21 не добавили сделок; все incremental net=0. Champion/base и historical challenger/base сохранили прежние результаты; stress challenger0 сделок. Ни OOS, ни promotion не заявлены.

Report `1df3a9194573e8ba7ea761395e9175f9006349b0bffeb4fa12f40b2134ce8b9b`, dataset `4e4e070dd298d949fd407a5a7085018630c40bd4515be88d2670f070dc2c64fe`. Полные отчёт и job output сохранены только в ignored artifacts с mode0600. Никакие прежние результаты, cohort, credentials или application files не перезаписаны. R-027/B-025 завершены для этого запроса; source timestamp/coverage/fees/depth/live-guards limitations остаются.

Независимый итоговый audit: report content hash совпал; mode0600 подтверждён; Python Decimal перепроверил все 24 cash/realized/write-down/cost ledgers и sale proceeds. Проверены signal<entry, entry<sale, exitDecision<exit; независимо извлечённые 12 prefix event sets совпали. Все старые prefix metrics совпали с предыдущим 48-trial report. Production health остался `web-ad69db38683459e3`, live/paper false. Новый deployment не выполнялся и не требовался.
