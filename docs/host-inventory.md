# Инвентаризация aistat для интеграции CryptoBot

Проверено 8 октября 2026 года. Связь с требованиями: **R-005, R-020, R-021; B-004 и B-010**. Проведена read-only инвентаризация cPanel Fileman, существующих исходников и публичных HTTP-ответов. Изменений на сервере, deployment, чтения содержимого env/БД/пользовательских файлов и операций с кошельками не выполнялось. Секрет cPanel использован только внутри процесса для заголовка авторизации и не выводился.

Пользователь подтвердил реализацию и deployment отдельного multiuser-приложения с собственными кошельками каждого аккаунта. Этот документ описывает интеграционные факты и предложение адаптера; разрешения на live trading/signing из входа на сайт не возникает.

## Наблюдаемая топология

| Компонент | Проверенное состояние |
|---|---|
| Корневой сайт | `public_html/.htaccess` направляет запросы в `/cgi-bin/aistat.cgi/<path>`, кроме `.well-known`, `cgi-bin` и отдельного `/crypto`. |
| Root entry point | CGI `aistat.cgi`, shebang `/usr/bin/python3`; загружает private environment и импортирует `aistat.legacy_wsgi.application` из `~/aistat_app`. Runtime version Python по shebang не определяется. |
| Код root | `~/aistat_app` — ссылка на release. `passenger_wsgi.py` также существует, но проверенный root rewrite использует CGI. |
| Существующее `/crypto` | Отдельное приложение AI Crypto Statistics; не является root auth и не владеет `/bot`. Действующий Passenger config: Node 24, app root `~/acs/app`, startup `lsnode/app.js`, base URI `/crypto`. |
| Deployment инфраструктура | Related repo `AI-Crypto-Statistics/ops/aistat-host` описывает cPanel/CloudLinux Selector, LiteSpeed и cron job runner раз в 5 минут, без SSH. Сценарий deployment прочитан, но не запускался. Сам факт выполнения cron и его health в этой проверке не измерялись. |
| `/bot` до интеграции | Без cookie отвечает `303` с переходом на `/login?next=%2Fbot`; это обработка root catch-all, не доказательство установленного CryptoBot. |

Проверка удалённых исходников важна: локальная копия root `legacy_wsgi.py` и `security.py` **не совпадает** с сервером. CGI и Passenger entry point совпадают. Выводы ниже основаны на удалённом `legacy_wsgi.py`, а не на предположении о свежести локального cache.

## Действующая аутентификация

Root использует cookie **`aistat_session` с непрозрачным случайным токеном**. Это не JWT и не подписанный JSON с claims. Сервер вычисляет SHA-256 полного cookie value и читает `sessions` по `sid_hash`, проверяя `expires_at > now`. Результат содержит авторитетные `uid` и per-session `csrf`. Истёкшие/удалённые/неизвестные записи не дают доступ. Для переиспользования этой сессии CryptoBot **не нужен session-signing secret**, а самостоятельное декодирование cookie невозможно и неправильно.

В исходниках присутствуют owner/password и OAuth-пути входа. Конкретные включённые провайдеры, registration policy и реальные пользователи не выяснялись из секретной конфигурации. `_session_grants_access` допускает действующую сессию с `uid`; комментарий прямо отмечает, что изменение email allowlist не отзывает существующую сессию. CryptoBot должен иметь собственный явный статус доступа, если требуется его блокировка независимо от root login.

Cookie builder устанавливает `Path=/`, `HttpOnly`, `SameSite=Lax`; `Secure` зависит от runtime-конфигурации. Фактический cookie авторизованного пользователя и значение этой настройки не считывались. Logout в root требует POST и сверяет CSRF с серверной сессией, затем удаляет запись и очищает cookie.

## Готовая точка доверия

Существующий **`GET https://aistat.app/api/session`** после root auth возвращает JSON:

```json
{"username":"<shared display value>","user_id":123,"csrf":"<per-session token>"}
```

Значения в примере условные. Поле `username` берётся из общей настройки `ADMIN_USERNAME`, поэтому **его нельзя использовать как идентичность или признак администратора**. Для account binding использовать только проверенный `user_id`. Endpoint не предоставляет подтверждённую роль `is_admin`; обычный аутентифицированный пользователь не должен автоматически получать shared deployment/operator capabilities.

Публичный smoke без cookie показал `401 application/json` с `authentication required`, без редиректа; `Cache-Control: no-store`. `/login` дал 200, `/bot` — описанный 303. Валидная пользовательская сессия, два разных аккаунта и отзыв реальной сессии в этой проверке не использовались: успешная ветка подтверждена чтением кода, а не end-to-end тестом.

## Предлагаемый серверный адаптер

1. CryptoBot извлекает только `aistat_session` из входящего Cookie с ограничением длины и отказом при неоднозначных дубликатах. Значение не попадает в логи, URL или response body.
2. Сервер делает HTTPS GET на фиксированный allowlisted `/api/session`, передавая только этот cookie. URL не строится из браузерного Host/Origin или query. TLS-проверка включена, redirects запрещены, timeout и размер ответа ограничены.
3. Принимать только 200 JSON с положительным каноническим `user_id` и непустым `csrf`. В JavaScript небезопасные числовые ID отклонять, пока нет согласованного строкового контракта. Ошибка схемы, redirect, timeout и недоступность root запрещают защищённое действие; upstream failure отличать от обычного unauthenticated для диагностики без утечки ответа.
4. Полученный `user_id` становится server-derived `account_id` во всех SQL, jobs, exports, caches и wallet bindings. Клиентский `account_id` не выдаёт прав. Для multiuser негативные тесты A→B обязательны.
5. Изменяющие запросы `/bot/api` требуют `X-CSRF-Token`, совпадающий с `csrf` той же проверенной сессии, и корректного Origin. SameSite не заменяет эту проверку. Собственный bootstrap `/bot/api/session` может вернуть нужный UI CSRF по same-origin запросу, с `no-store` и без разрешения credentialed cross-origin чтения.
6. На старте проверять root session при каждом защищённом запросе без положительного cache, чтобы logout/revoke не оставляли окно прав. Jobs не получают cookie в payload: авторизация задания и lease отдельные; wallet challenge дополнительно привязан к текущей сессии.
7. Обычному account разрешены только его данные и пользовательские предложения задач. Право менять shared production задаётся отдельным серверным operator allowlist/policy; не выводится из username, первого вошедшего пользователя или текста задачи.

Этот способ переиспользует auth без прямого доступа нового приложения к root security DB и без копирования OAuth/session secrets. Альтернатива — отдельная ограниченная auth-introspection точка в root; она потребуется лишь если существующего контракта окажется недостаточно. В этой проверке root-код не менялся.

## Требования к маршруту и deployment

Для отдельного Node приложения `/bot` понадобится собственный app root и Passenger/lsnode startup, а в root `.htaccess` — отдельная HTTPS/пропускающая ветка для **точного префикса `^bot(/.*)?$` до CGI catch-all**. Существующие `/crypto`, `.well-known`, CGI и root должны сохранять поведение. `/botany` не должен попадать в CryptoBot. Shared deployment должен предварительно сохранить проверенную исходную конфигурацию для точного rollback.

Node 24 уже указан в работающей конфигурации соседнего приложения; создание второго selector app, доступный memory budget, storage и конкретный SQLite/native-module вариант ещё не проверялись. Нельзя предполагать, что этот shared host подходит для непрерывного sequencer intake, optimiser или signing worker: UI/API и фоновые процессы требуют отдельной проверки runtime и hosting условий. Локальная инструкция говорит об ограничениях cron/daemon, но актуальные внешние условия провайдера здесь не перепроверялись.

`/bot` находится на общем origin с root и `/crypto`. Cookie Path и отдельная папка не защищают от same-origin XSS или широкого service worker. До реальных wallet/signing возможностей нужны проверка CSP/скриптов/service-worker scope всего origin и решение о доверенной границе. Это не причина подменять уже выбранный путь сайта, а требование к его реализации.

## Доказательства и оставшаяся проверка

- cPanel Fileman `list_files`/`get_file_content` успешно прочитали только инвентарь, rewrite и указанные исходники; секретные contents и DB не читались.
- SHA-256 прочитанного удалённого `legacy_wsgi.py`: `bf4e3f0a790dfcd1156203eab11a5e03489d754dc912a4d0e348a52f4737c59f`.
- В этом snapshot: `_resolve_session_record` строки 394–416, `_read_session` 449–462, `/api/session` 1824–1834, auth gate 1974–1999, logout 2001–2020. Номера относятся к проверенному remote snapshot, не к локальной копии.
- До DONE B-010 требуются тесты валидной/истёкшей/отозванной сессии, подмены account ID и CSRF, ошибочного upstream response, двух пользователей, wallet challenge replay и logout. Deployment и live readiness этой инвентаризацией не подтверждены.

Запись для общего execution log передана координатору: **B-004 / R-005,020,021 — read-only host/auth inventory выполнена; reuse contract и route proposal подтверждены кодом; authenticated E2E и deployment остаются следующими работами**. Отдельный агент не менял общий журнал, чтобы не конфликтовать с работой координатора.
