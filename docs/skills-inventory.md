# Skills и происхождение

Подготовлено 2026-10-08. Skills — инструкции разработчику Codex, **не runtime-коннекторы и не полномочия торговать**. Они находятся в `.agents/skills/`, входят в Git и доступны обнаружению в следующем ходе сессии проекта. Установлены пять навыков; изменение глобальных настроек не требовалось.

| Skill | Назначение | Источник и статус |
|---|---|---|
| `cryptobot-director` | Scope Chain/Pons, этапы и gates, координация, интеграция `/bot` | Написан для этого проекта; тексты проекта, без заимствованных скриптов |
| `cryptobot-wallet-research` | Причинный replay, выбор cohort, costs, OOS и no-go | Написан для проекта; опирается на исследовательские ссылки, не копирует scoring GMGN |
| `cryptobot-execution-safety` | Изолированная подпись, registry, nonce/idempotency, reconciliation и risk | Написан для проекта; не даёт разрешения на live |
| `security-best-practices` | Проверка Python/TypeScript и других поддерживаемых стеков по исходным триггерам | [OpenAI skills](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/security-best-practices), Apache-2.0 |
| `security-threat-model` | Threat model по фактическому коду и окружению после определения deployment | [OpenAI skills](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/security-threat-model), Apache-2.0 |

Два upstream skill установлены штатным `skill-installer` из commit `49f948faa9258a0c61caceaf225e179651397431`, без изменения текста, вместе с LICENSE.txt. Их пакет содержит только Markdown, YAML и лицензии; executable scripts отсутствуют. Entrypoints и список ресурсов проверены; это не гарантия безошибочности инструкций. Полный threat-model workflow при подготовке не запускался. После разрешения реализации появился web-код и подтверждённое окружение; security best practices применены к auth, account isolation и подписи владения, что не заменяет отдельный полный аудит. Для собственных текстов отдельная публичная лицензия не выбрана; сторонняя Apache-лицензия не распространяется автоматически на весь проект.

`skills.lock.json` фиксирует источник, revision, лицензию и SHA-256 каждого файла пакета. Проверка `python3 scripts/verify_workspace.py` обнаруживает изменение или добавление/удаление skill файлов, битые локальные Markdown-ссылки в авторских документах и запрещённые tracked credential paths. Это ограниченная проверка подготовки, не полноценный secret scanner или security audit. Обновление skill требует новой проверки источника/лицензии, review diff и обновления lock; автоматического latest-update нет.

## Что изучено, но не установлено в проект

Локальные GMGN skills изучены как возможная исследовательская интеграция. Для `gmgn-wallet-analysis` и `gmgn-wallet-score` подтверждено побайтовое соответствие [GMGNAI/gmgn-skills](https://github.com/GMGNAI/gmgn-skills/tree/4575ef539e6a3115fa0481d41285cb79e77970bf), upstream MIT; хэши и выводы — в [исследовании edge](research/wallet-edge-validation.md). Проверка лицензии двух файлов не переносится автоматически на каждый локальный пакет.

Причины не переносить набор автоматически:

- Wallet ROI минус константный latency penalty — не replay реальных доступных fills; отсутствие market-cap поля не должно улучшать оценку.
- Факт исторической продажи не исключает динамические ограничения/whitelist/honeypot; renounced ownership не доказывает отсутствие backdoors. Высокая доля вложения не доказывает отсутствие self-trading.
- В `gmgn-market` найдены противоречащие друг другу определения `volume` и `amount`; нужны официальная версия API, schema fixture и unit checks.
- Инструкции умолчать о расхождении с vendor tag не соответствуют доказательному подходу проекта. Теги сохраняем как стороннее мнение с происхождением.
- Наличие GMGN `robinhood` chain ID не доказывает полноту Pons V1/V2 coverage, latency, доступность публичных данных без trade credentials или право хранения/переиспользования.

Возможные будущие read-only primitives: `market`, `token`, `portfolio`, `track`, после проверки coverage/схем/лицензий/тарифов. `gmgn-cli` не установлен в этой среде и не устанавливался; ключи не запрашивались, GMGN runtime не подключён. Trading/cooking/buy skills не установлены и не запущены. Приоритет текущего Chain/Pons MVP — проверяемые chain events, deployed contracts и production RPC; GMGN необязателен.

Не добавляли deployment skills для случайного хостинга: `aistat.app` уже существует, сначала нужен inventory. Не добавляли широкие skill-паки или торговые скрипты без конкретной необходимости.
