# Deployment CryptoBot

Первый web-инкремент работает на Node 24, SQLite и существующей авторизации Aistat. API не содержит торгового исполнителя, seed phrase, delegated permission или AI-worker. `server/index.js` — единственная production-точка входа; fixture identity из локального QA в release не входит.

## Локальная проверка

Установить Node 24 и выполнить `pnpm install --frozen-lockfile --ignore-scripts`, затем `node --test test/*.test.js`. `node server/index.js` запускает порт 3100. По умолчанию защищённые API проверяют реальную root-сессию через фиксированный HTTPS endpoint Aistat; локальной кнопки обхода входа нет. Для тестов `createApp` принимает отдельные зависимости, production entry их не подменяет.

## Первый deployment

`CRYPTOBOT_CPANEL_USER` задаётся локально. Токен читается из `CRYPTOBOT_CPANEL_TOKEN_FILE` либо приватного локального файла `~/.config/aistat/cpanel.token`; он не передаётся аргументом shell, в архив или в output. Транспорт запрещает redirects.

`python3 ops/deploy.py` формирует явный архив `server`, `web`, `lsnode`, package/lock и установленных зависимостей; datasets, `.env`, credentials, test/preview и docs не включаются. Release ID — SHA-256 содержимого source/lock; полный digest архива записан в ignored `artifacts/deployment.json`. Это bootstrap: существующее приложение он перезаписывать отказывается.

Пакет загружается через cPanel Fileman. Существующий cron runner выполняет одноразовую установку отдельного приложения `cryptobot/app` на URI `/bot`; очередь может ждать до пяти минут. DB находится отдельно в `cryptobot/state`, mode 0600, parent 0700; web process создаёт WAL с private umask. Процесс контролируется LiteSpeed/CloudLinux, отдельный daemon/cron AI не создаётся.

Перед активацией проверяется исходный hash root `.htaccess`; оригинал сохраняется вне public directory в `cryptobot/backups/<job>/root.htaccess`. Маршрут добавляет только точный `^bot(/.*)?$`; `/crypto`, root, `.well-known` и CGI сохраняются. Ошибка активации восстанавливает исходный root routing. Backup нельзя публиковать: конфигурация принадлежит существующему сайту. Перед обновлением действующего приложения нужна отдельная release-процедура с проверкой текущей версии, резервной копией DB и совместимости схемы; bootstrap не заменяет update.

После completed job проверить `/bot/api/health` release/live=false, static assets, unauthenticated protected API, root `/login`, `/api/session`, `/crypto` и авторизованный server-to-server identity. Само наличие queued job или HTTP 200 HTML не доказывает deployment. Секретные cookies/signatures не логировать.

## Возврат маршрута

Авторизованный оператор через тот же runner восстанавливает конкретный сохранённый `root.htaccess`, предварительно проверив, что текущая конфигурация не содержит чужих более поздних изменений. Приложение можно остановить `cloudlinux-selector stop --interpreter=nodejs --app-root=cryptobot/app`. Данные `cryptobot/state` сохраняются; возврат route не требует удаления аккаунтов/кошельков/задач. Перед live-полномочиями потребуется отдельная проверка общей same-origin поверхности root и `/crypto`.

## Интеграционный update двух приложений

`python3 ops/deploy-integration.py --acs-worktree /absolute/path/to/reviewed-worktree` требует чистых, закоммиченных worktrees. Он пакует только явно перечисленные code/UI файлы; исходники приватного ACS находятся лишь в private transport archive, не в public Git. Перед выполнением job сравнивает deployment markers и каждый remote file hash, сохраняя существующие файлы для rollback. При изменении другим процессом операция останавливается до записи.

Update не меняет root rewrite, `.env`, API keys, DB, watchlists, источники или расписания. Перезапуск обоих существующих приложений сохраняет их текущие конфигурации. При неуспешном schema/source/release smoke старые code/UI markers восстанавливаются. Данные не откатываются, поскольку schema migrations в этом update отсутствуют. После rc=0 отдельно проверяются producer/consumer, точные snapshot links, privacy и UI. Private backups и smoke responses не публикуются.
