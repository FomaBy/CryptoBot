# Robinhood Chain / Pons: read-only снимок

Дата наблюдения: **2026-10-08, 10:17:00–10:17:04 UTC**. Связанные задачи: **B-005/B-006**. Это первичное наблюдение доступности RPC и кода двух фабрик, не готовый индексатор, аудит контрактов или допуск к торговле.

## Сеть и фиксированный блок

Официальная [документация подключения Robinhood Chain](https://docs.robinhood.com/chain/connecting/) указывает mainnet chain ID **4663**, газ ETH и public RPC `https://rpc.mainnet.chain.robinhood.com`. `eth_chainId` этого endpoint вернул `0x1237` (4663). Документация предупреждает о rate limits публичных endpoint; этот опыт не доказывает их пригодность для production или глубину исторических данных.

| Поле | Наблюдение |
|---|---|
| Номер latest при запросе | `83237066` / `0x4f618ca` |
| Hash блока | `0xdbdb664f6d3a8e10d431f4ab8a8b6aceceef6ff4390d9784a4184c30cb7c70f1` |
| Parent hash | `0xb33b41ca388b6064f54c7e379ef115a9ca14e587315d082b309d125a1b9851b6` |
| Timestamp блока | `2026-10-08T10:17:00.000Z` |
| Повторный запрос по номеру | Hash совпал после чтения обоих контрактов |
| Финальность / независимый второй RPC | Не проверены |

Оба `eth_getCode` выполнены с одинаковым числовым block tag `0x4f618ca`, а не с изменяющимся `latest`. Повторная проверка hash уменьшает риск несогласованного снимка, но не доказывает отсутствие реорганизации между запросами или финальность.

## Код фабрик на этом блоке

Адреса сопоставлены с [README официального репозитория на фиксированном commit](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/README.md). Хэши ниже вычислены над декодированными байтами runtime bytecode, а не строкой hex.

| Версия | Адрес | Размер runtime, байт |
|---|---|---:|
| V1 | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` | 24353 |
| V2 | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | 24177 |

**V1**

- SHA-256: `834a3a3f3c5a7ca4db3be3ca96f34c99cab44e01822aef04ea9d7104a2159507`
- Keccak-256: `0x0a62b8ed1d88d30c7b342ea8361dfaf0ac336706992cf0c8ba38b129f06391d4`

**V2**

- SHA-256: `226a042e6d68a69a6038d4fda211925b03eb5299399434b87a7877f79f6e3848`
- Keccak-256: `0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84`

**Соответствие исходникам: NOT_VERIFIED для обеих фабрик.** Наличие непустого кода и его hash не подтверждает безопасность, корректность ABI, verified build, полномочия администратора, отсутствие proxy или пригодность торгового маршрута. Компиляция и сравнение runtime с учётом metadata, immutable values и linked libraries не выполнялись.

## Закреплённые первичные исходники и ABI

GitHub `main` на момент чтения указывал на commit [`44a3db9193c365f6c25cf0d4c2efc396e6de0df5`](https://github.com/ponsdotdev/pons-labs/commit/44a3db9193c365f6c25cf0d4c2efc396e6de0df5), дата commit `2026-10-01T16:21:02Z`. Получено полное дерево этого commit без truncation; remote-код не исполнялся.

| Назначение | Путь на фиксированном commit |
|---|---|
| V1 ABI (JSON array, 60 элементов) | [abi.json](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/abi.json) |
| V1 metadata | [contract-meta.json](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/contract-meta.json) |
| V1 фабрика | [PonsLaunchFactory.sol](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/contractsV1/src/PonsLaunchFactory.sol) |
| V2 фабрика | [PonsV2LaunchFactory.sol](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/contractsV2/src/v2/PonsV2LaunchFactory.sol) |
| V2 интерфейс | [ILaunchpadV2.sol](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/contractsV2/src/v2/interfaces/ILaunchpadV2.sol) |
| V2 graduation interface | [ILaunchpadV2Graduation.sol](https://github.com/ponsdotdev/pons-labs/blob/44a3db9193c365f6c25cf0d4c2efc396e6de0df5/contractsV2/src/v2/interfaces/ILaunchpadV2Graduation.sol) |

Корневые `abi.json` и `contract-meta.json` относятся к V1 по README. Их нельзя автоматически использовать как V2 ABI. Отдельный V2 JSON ABI в проверенном дереве не найден; Solidity interfaces и исходники — основание для последующей воспроизводимой сборки, а не готовое подтверждение deployed ABI. SHA-256 и размеры семи загруженных файлов сохранены в локальном артефакте.

## Health, покрытие и границы доказательства

- Пять последовательных RPC-запросов снимка через Node fetch: HTTP 200, без JSON-RPC error; наблюдаемая длительность 170.9–294.4 мс. Это локальная выборка, не SLO или оценка p95.
- Первая попытка Python urllib с заголовками по умолчанию получила HTTP 403. Причина не установлена; успешный Node-клиент не отменяет это ограничение воспроизводимости.
- Покрытие: один блок, две фабрики; ноль прочитанных событий и кошельков. История событий, пропуски диапазонов, finality/reorg rollback, archive depth и непрерывный intake не проверены.
- Данные частного watchlist не читались и в артефакт не включены. Ключи, подписи, переводы, заявки и изменение chain state не использовались.

Локальный машиночитаемый артефакт: `artifacts/chain-snapshot.json` (ignored; не включать в commit). Он содержит endpoint, block/hash, методы и параметры RPC, время/статус каждого запроса, публичный runtime bytecode, hashes, закреплённые source paths и явные coverage flags.

Артефакт SHA-256: `121ccf869cbc303898868922c5b42b99f7f5fcc48b442839940dbd09d6c1b05f`.

**Статус B-005: частичное первичное доказательство** сети, адресов, непустого runtime и source pin. Для приёмки нужны проверка соответствия кода/ABI, зависимостей и конкретных маршрутов. **B-006: foundation observation выполнено; ingestion/replay не реализованы этим заданием.** Нельзя объявлять историческое покрытие или работающий worker на основании этого снимка.
