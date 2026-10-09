# Общий анализ `/crypto` и `/bot`

Связь: R-023/024, B-021/022. ACS — единственный producer; CryptoBot не копирует его engine, research datasets или LLM-промпты. Репозиторий ACS приватный, CryptoBot публичный. В публичном репозитории находятся только самостоятельно написанные consumer, контракт и synthetic fixtures.

## Источник и доступ

`GET /crypto/api/analysis/v1?chainId=4663` — строго публичная проекция уже опубликованных `engine.state().tokens`. Она не вызывает `engine.token()` с request-time entry расчётом, `watch`, новые API providers или LLM. Root multiuser login и ACS owner cookie — разные механизмы. Новый endpoint не расширяется до private response ни от cookie, ни от loopback, ни от `publicWalletNames`.

`GET /bot/api/analyses[?snapshot=<hash>]` требует текущую root-сессию. Server-to-server URL фиксирован; cookies, owner keys и браузерные identity headers не пересылаются. Timeout, streaming body limit 2 MiB, strict field allowlist, chain ID, duplicate-token, schema, source и execution=false проверяются. Неизвестный формат даёт 502; недоступность источника — 503. Кэш/совместные запросы ограничивают чтения; платных фоновых jobs нет.

## Идентичность и время

Schema: `acs.analysis.v1`. Token identity — `eip155:4663/erc20:<lowercase contract>`. `analysisId` и `version` — content hash выбранных исходных полей с schema и source revision; `snapshotId` — hash списка и покрытия. IDs не являются доказательством правдивости/полноты данных. Значения score/entry показываются как оценки ACS, без переоценки в боте. `source.revision` отражает deployment marker ACS; отсутствующий marker остаётся null.

`timestamps.market/score/entry` содержат только доступные явные section timestamps. Flattened published views обычно не имеют market/score timestamps: они остаются null, а unknowns это объясняют. `asOf` — самое раннее известное section observation, не полнота свежести всех полей; при отсутствии времён null. `servedAt` — время ответа, никогда не время обновления анализа.

ACS хранит не более 120 снимков, 16 MiB сериализованных данных и 10 минут возраста; ёмкость может вытеснить снимок раньше. Одинаковый content hash не создаёт новую версию. Current reads coalesce/cache 5 секунд. `snapshot=<hash>` возвращает тот же content либо **410**, без автоматической замены новым анализом. Оба интерфейса позволяют явно запросить latest отдельно. Restart также может удалить memory snapshots.

## Что передаётся

Envelope: schema/source/chain/snapshot/observation/served times, coverage и items. Item: token identity, symbol/name, reported launchpad/stage, USD decimal strings, исходные числовые scores и enum verdict/tier/codes, observation times, unknowns, botScope. Arbitrary free-text reasons, wallet feed/addresses/names, smart-wallet/insider lists, creator, transaction identifiers и private account data не включаются.

Coverage относится только к опубликованным token views, максимум 250; это не все токены сети и не исторический dataset. USD strings сохраняют ограниченную точность исходных Number и не используются как торговые суммы. `pons`, `pons_v1`, `pons_v2` дают `pons_reported`; произвольные `dex`/другие origin не доказывают Pons и не становятся карточками bot universe. Обе стороны всегда возвращают `executionAuthorized:false`, `registry_unverified`, `sellability_unverified`. Score 50, высокий score или успешная загрузка не являются risk gate.

## Интерфейсы и эксплуатация

`/crypto` остаётся radar; его token drawer получает метаданные общего снимка. `/crypto/analysis.html` — permalink-view внутри статистики для точного сравнения, не новый producer. Research view `/bot` читает тот же контракт через свой authenticated proxy. Ссылки содержат snapshot ID и публичный token contract; приватные wallet/account данные в URL не добавляются.

Deployment обоих приложений выполняется точечными файлами с проверкой исходных remote hashes, приватным backup и rollback; существующие данные, workers, root auth, DNS и настройки источников не заменяются. Нужны проверки endpoint/privacy, producer-consumer compatibility, UI IDs/values/expired states и production release. Наличие общей аналитики не завершает собственный wallet research, paper engine или signer CryptoBot.
