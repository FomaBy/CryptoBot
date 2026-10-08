"use strict";

(() => {
  const API = "/bot/api";
  const CHAIN_ID = 4663;
  const CHAIN_HEX = "0x1237";
  const TABS = { overview: "Обзор", wallets: "Кошельки", backlog: "Задачи", research: "Исследование" };
  const state = { session: null, overview: null, wallets: null, tasks: null, preset: null, selectedPreset: null, loading: false, providers: [], walletAttempt: 0, proof: null, providerListeners: null, walletBusy: false, taskBusy: false, unlinkId: null, analysis: null, analysisStarted: false, analysisLoading: false, analysisRequest: 0 };
  const $ = (id) => document.getElementById(id);
  const text = (value, fallback = "") => typeof value === "string" ? value : fallback;
  const can = (key) => state.session?.authenticated === true && !!state.session.csrfToken && state.session.capabilities?.[key] === true;
  const shortAddress = (address) => address.length > 15 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
  let toastTimer;

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  }

  function notice(id, message, error = false) {
    const target = $(id);
    target.textContent = message;
    target.classList.toggle("error", error);
    target.hidden = !message;
  }

  function toast(message, error = false) {
    clearTimeout(toastTimer);
    notice("toast", message, error);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 6500);
  }

  function date(value, withTime = false) {
    if (!value) return "Дата не указана";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Дата не указана";
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(parsed);
  }

  function errorMessage(error) {
    const code = error?.code ?? error?.data?.originalError?.code;
    if (Number(code) === 4001 || code === "ACTION_REJECTED") return "Вы отклонили запрос в кошельке. Можно попробовать снова.";
    if (Number(code) === -32002) return "В кошельке уже открыт запрос. Завершите или отмените его в расширении.";
    if (error?.name === "AbortError") return "Сервер не ответил вовремя. Обновите данные перед повторным действием.";
    if (error instanceof TypeError) return "Не удалось связаться с сервером. Проверьте соединение и обновите данные.";
    return text(error?.message, "Не удалось выполнить действие. Попробуйте ещё раз.").slice(0, 350);
  }

  async function api(path, options = {}) {
    const method = options.method || "GET";
    const mutation = method !== "GET";
    const headers = { Accept: "application/json" };
    if (mutation) {
      if (!state.session?.authenticated || !state.session.csrfToken) throw new Error("Сессия не подтверждена. Войдите в кабинет заново.");
      headers["X-CSRF-Token"] = state.session.csrfToken;
    }
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    let body;
    try {
      response = await fetch(`${API}${path}`, { method, credentials: "same-origin", cache: "no-store", redirect: "error", headers, signal: controller.signal, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) body = await response.json();
    } finally { clearTimeout(timeout); }
    if (response.status === 401) {
      showLoggedOut();
      throw new Error("Сессия завершилась. Войдите в Aistat заново.");
    }
    if (!response.ok) {
      const error = new Error(text(body?.message, text(body?.error, `Запрос не выполнен (HTTP ${response.status}).`)));
      error.status = response.status;
      throw error;
    }
    if (body === undefined && response.status !== 204) throw new Error("Сервер вернул неподдерживаемый ответ. Обновите страницу позже.");
    return body || {};
  }

  function showLoggedOut() {
    state.session = null;
    state.wallets = null;
    state.tasks = null;
    state.overview = null;
    state.analysis = null;
    state.analysisStarted = false;
    state.analysisRequest += 1;
    state.analysisLoading = false;
    $("analysis-list").replaceChildren();
    $("analysis-provenance").replaceChildren();
    cancelProof();
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
    $("dashboard").hidden = true;
    $("session-gate").hidden = false;
    $("gate-title").textContent = "Ваше рабочее пространство";
    $("gate-copy").textContent = "Войдите через Aistat, чтобы связать кошелёк с аккаунтом и управлять личными задачами.";
    $("login-link").hidden = false;
    const returnPath = `/bot/${location.search}${location.hash}`;
    $("login-link").href = `/login?next=${encodeURIComponent(returnPath)}`;
    $("retry-session").hidden = true;
    $("account-name").textContent = "Вы не вошли";
    $("account-description").textContent = "Вход через Aistat";
    $("account-avatar").textContent = "·";
    $("wallet-nav-count").textContent = "—";
    $("task-nav-count").textContent = "—";
    $("wallet-list").replaceChildren();
    $("task-list").replaceChildren();
    syncControls();
  }

  async function loadSession() {
    $("retry-session").disabled = true;
    try {
      const session = await api("/session");
      if (session.authenticated !== true || !session.user) { showLoggedOut(); return; }
      state.session = session;
      const name = text(session.user.name, "Мой аккаунт");
      $("account-name").textContent = name;
      $("account-avatar").textContent = name.trim().slice(0, 1).toUpperCase() || "A";
      $("account-description").textContent = "Личный кабинет";
      $("session-gate").hidden = true;
      $("dashboard").hidden = false;
      syncControls();
      await refresh();
      if (location.hash === "#research") loadAnalyses();
    } catch (error) {
      if (!$("login-link").hidden) return;
      $("gate-title").textContent = "Кабинет пока недоступен";
      $("gate-copy").textContent = errorMessage(error);
      $("retry-session").hidden = false;
      $("account-name").textContent = "Нет соединения";
    } finally { $("retry-session").disabled = false; }
  }

  function syncControls() {
    document.querySelectorAll("[data-connect]").forEach((button) => { button.disabled = !can("walletLinking"); });
    $("new-task-button").disabled = !can("taskCreation");
    $("save-preset").disabled = !can("settings") || state.selectedPreset === null || state.selectedPreset === state.preset || state.loading;
    $("preset-options").disabled = !can("settings");
  }

  async function refresh() {
    if (!state.session?.authenticated || state.loading) return;
    state.loading = true;
    $("refresh-button").disabled = true;
    notice("page-message", "");
    const session = state.session;
    const result = await Promise.allSettled([api("/overview"), api("/wallets"), api("/tasks")]);
    if (state.session !== session) { state.loading = false; $("refresh-button").disabled = false; return; }
    const errors = [];
    if (result[0].status === "fulfilled") {
      state.overview = result[0].value;
      renderOverview();
    } else {
      errors.push("статус системы");
      ["research-state", "paper-state", "live-state", "network-state"].forEach((id) => { $(id).textContent = "Нет данных"; });
      $("mode-badge").textContent = "Недоступен";
    }
    if (result[1].status === "fulfilled" && Array.isArray(result[1].value.wallets)) state.wallets = result[1].value.wallets;
    else { state.wallets = null; errors.push("кошельки"); }
    if (result[2].status === "fulfilled" && Array.isArray(result[2].value.tasks)) state.tasks = result[2].value.tasks;
    else { state.tasks = null; errors.push("задачи"); }
    renderWallets();
    renderTasks();
    state.loading = false;
    $("refresh-button").disabled = false;
    syncControls();
    if (errors.length) notice("page-message", `Не удалось обновить: ${errors.join(", ")}. Данные не заменены демонстрационными. Попробуйте обновить кабинет.`, true);
    $("updated-at").textContent = `${errors.length ? "Частичное обновление" : "Обновлено"} · ${date(new Date().toISOString(), true)}`;
  }

  function renderOverview() {
    const overview = state.overview;
    $("mode-badge").textContent = text(overview.mode).toLowerCase() === "research" ? "Исследование" : "Статус сервера";
    const researchStates = { not_started: "Не начато", collecting: "Сбор данных", in_progress: "В процессе", insufficient_data: "Недостаточно данных", blocked: "Приостановлено" };
    $("research-state").textContent = researchStates[overview.researchStatus] || "Не подтверждено";
    $("paper-state").textContent = overview.paperEnabled === false ? "Не запущен" : overview.paperEnabled === true ? "Активен по данным сервера" : "Неизвестно";
    $("live-state").textContent = overview.liveEnabled === false ? "Отключена" : overview.liveEnabled === true ? "Активна по данным сервера" : "Неизвестно";
    $("worker-state").textContent = "Не подключён";
    if (overview.liveEnabled === false && overview.paperEnabled === false) $("trade-metric").textContent = "0";
    else $("trade-metric").textContent = "—";
    $("trade-note").textContent = overview.liveEnabled === false && overview.paperEnabled === false ? "Исполнитель не активирован" : "История сделок не подключена";
    const preset = Number(overview.preset ?? overview.settings?.preset);
    if ([150, 1000, 5000].includes(preset)) {
      state.preset = preset;
      state.selectedPreset = preset;
      document.querySelectorAll('input[name="preset"]').forEach((input) => { input.checked = Number(input.value) === preset; });
      $("preset-status").textContent = "Сохранён в вашем аккаунте";
    } else $("preset-status").textContent = "Выберите и сохраните пресет";
    const network = overview.network;
    if (network?.status === "connected" && Number(network.chainId) === CHAIN_ID) {
      $("network-state").textContent = network.blockNumber !== undefined ? `Блок ${String(network.blockNumber)}` : "Соединение подтверждено";
      $("network-state").title = `Проверено ${date(network.observedAt, true)}. Подключение RPC не подтверждает контракты Pons.`;
    } else {
      $("network-state").textContent = network?.status === "unavailable" ? "Временно недоступен" : "Не проверен";
      $("network-state").title = "RPC не подтверждает ликвидность или безопасность токенов.";
    }
  }

  function emptyState(target, title, description, symbol, action) {
    const wrapper = node("div", "empty-state");
    const glyph = node("div", "empty-symbol", symbol);
    glyph.setAttribute("aria-hidden", "true");
    wrapper.append(glyph, node("h3", "", title), node("p", "", description));
    if (action) {
      const button = node("button", "button secondary", action.label);
      button.type = "button";
      button.disabled = !can(action.capability);
      button.addEventListener("click", action.run);
      wrapper.append(button);
    }
    target.replaceChildren(wrapper);
  }

  function renderWallets() {
    const list = $("wallet-list");
    const count = state.wallets === null ? "—" : state.wallets.length;
    ["wallet-count", "wallet-nav-count", "wallet-metric"].forEach((id) => { $(id).textContent = String(count); });
    if (state.wallets === null) { emptyState(list, "Кошельки не загружены", "Обновите кабинет, чтобы получить адреса вашего аккаунта.", "↻"); return; }
    if (!state.wallets.length) { emptyState(list, "Ваш первый кошелёк", "Подключите установленное расширение и подтвердите адрес. Подпись не даёт права расходовать средства.", "⌁", { label: "Подключить кошелёк", capability: "walletLinking", run: openWalletDialog }); return; }
    list.replaceChildren();
    for (const wallet of state.wallets) {
      const address = text(wallet.address);
      const row = node("article", "wallet-row");
      const details = node("div", "wallet-details");
      details.append(node("h3", "wallet-title", text(wallet.provider, "Браузерный кошелёк")), node("p", "wallet-address", address), node("p", "wallet-meta", `Chain ${Number(wallet.chainId) || "не указан"} · ${wallet.verifiedAt ? `Подтверждён ${date(wallet.verifiedAt, true)}` : "Подтверждение не указано"}`));
      const actions = node("div", "wallet-actions");
      const copy = node("button", "button secondary small", "Копировать");
      copy.type = "button";
      copy.setAttribute("aria-label", `Копировать адрес ${shortAddress(address)}`);
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(address); toast("Адрес скопирован"); } catch { toast("Копирование недоступно. Выделите адрес вручную.", true); } });
      const unlink = node("button", "button secondary small", "Отвязать");
      unlink.type = "button";
      unlink.disabled = !can("walletLinking");
      unlink.setAttribute("aria-label", `Отвязать адрес ${shortAddress(address)}`);
      unlink.addEventListener("click", () => {
        state.unlinkId = wallet.id;
        $("unlink-address").textContent = address;
        notice("unlink-message", "");
        $("unlink-dialog").showModal();
      });
      actions.append(copy, unlink);
      row.append(node("div", "wallet-symbol", "W"), details, actions);
      list.append(row);
    }
  }

  function renderTasks() {
    const target = $("task-list");
    if (state.tasks === null) {
      ["task-count", "task-nav-count", "task-metric"].forEach((id) => { $(id).textContent = "—"; });
      emptyState(target, "Задачи не загружены", "Обновите кабинет, чтобы получить ваш backlog.", "↻");
      return;
    }
    const active = state.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
    $("task-count").textContent = String(state.tasks.length);
    $("task-nav-count").textContent = String(active.length);
    $("task-metric").textContent = String(active.length);
    const filter = $("task-filter").value;
    const tasks = filter === "all" ? state.tasks : filter === "active" ? active : state.tasks.filter((task) => task.status === filter);
    if (!tasks.length) {
      emptyState(target, state.tasks.length ? "Здесь пока нет задач" : "Начните с одной задачи", state.tasks.length ? "В выбранной категории нет задач. Попробуйте другой фильтр." : "Что нужно исследовать или улучшить? Добавьте цель и критерий готовности — задача сохранится в вашем аккаунте.", "＋", { label: "Создать задачу", capability: "taskCreation", run: openTaskDialog });
      return;
    }
    const statusLabels = { planned: "Запланировано", in_progress: "В работе", done: "Выполнено", cancelled: "Отменено", blocked: "Заблокировано", quarantined: "Требует проверки" };
    target.replaceChildren();
    for (const task of tasks) {
      const card = node("article", "task-card");
      const top = node("div", "task-card-top");
      const tags = node("div", "task-tags");
      const priority = ["p0", "p1", "p2"].includes(task.priority) ? task.priority.toUpperCase() : "Приоритет не указан";
      tags.append(node("span", `pill ${task.priority === "p0" ? "warning-pill" : "neutral"}`, priority), node("span", "pill neutral", statusLabels[task.status] || "Статус не распознан"));
      top.append(tags, node("span", "task-date", date(task.createdAt)));
      card.append(top, node("h3", "", text(task.title, "Без названия")));
      if (task.description) card.append(node("p", "task-description", task.description));
      if (task.acceptance) {
        const acceptance = node("div", "task-acceptance");
        acceptance.append(node("strong", "", "Критерий готовности"), document.createTextNode(text(task.acceptance)));
        card.append(acceptance);
      }
      const footer = node("div", "task-footer");
      footer.append(node("span", "", task.status === "planned" ? "Ожидает разрешённого исполнителя" : task.status === "cancelled" ? "Не будет передана исполнителю" : "Статус получен с сервера"));
      if (["planned", "cancelled"].includes(task.status)) {
        const status = task.status === "planned" ? "cancelled" : "planned";
        const button = node("button", "button secondary small", status === "cancelled" ? "Отменить задачу" : "Вернуть в backlog");
        button.type = "button";
        button.disabled = !can("taskCreation");
        button.addEventListener("click", async () => {
          button.disabled = true;
          try { await api(`/tasks/${encodeURIComponent(task.id)}`, { method: "PATCH", body: { status } }); await refresh(); toast(status === "cancelled" ? "Задача отменена" : "Задача возвращена в backlog"); }
          catch (error) { toast(errorMessage(error), true); button.disabled = !can("taskCreation"); }
        });
        footer.append(button);
      }
      card.append(footer);
      target.append(card);
    }
  }

  function openTaskDialog() {
    if (!can("taskCreation") || state.taskBusy) return;
    $("task-form").reset();
    ["task-title", "task-description", "task-acceptance"].forEach((id) => $(id).setCustomValidity(""));
    notice("task-form-message", "");
    $("task-dialog").showModal();
    $("task-title").focus();
  }

  function addProvider(provider, info, legacy = false) {
    if (!provider || typeof provider.request !== "function") return;
    const existing = state.providers.find((entry) => entry.provider === provider);
    if (existing) {
      if (existing.legacy && !legacy) { existing.name = text(info?.name, "Кошелёк").slice(0, 80); existing.rdns = text(info?.rdns).slice(0, 100); existing.legacy = false; }
      return;
    }
    if (state.providers.length >= 20) return;
    state.providers.push({ provider, name: text(info?.name, "Браузерный кошелёк").slice(0, 80), rdns: text(info?.rdns).slice(0, 100), legacy });
    if ($("wallet-dialog").open && !state.proof && !state.walletBusy) renderProviders();
  }

  window.addEventListener("eip6963:announceProvider", (event) => {
    try { addProvider(event.detail?.provider, event.detail?.info); } catch { /* An invalid extension announcement is not a provider. */ }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  function discoverProviders() {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (window.ethereum) {
      const candidates = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
      for (const provider of candidates.slice(0, 20)) {
        addProvider(provider, { name: "Браузерный кошелёк", rdns: "Legacy provider" }, true);
      }
    }
    renderProviders();
  }

  function renderProviders() {
    const target = $("provider-list");
    target.replaceChildren();
    if (!state.providers.length) {
      const box = node("div", "empty-state");
      box.append(node("h3", "", "Расширения не найдены"), node("p", "", "Откройте кабинет в браузере с установленным Ethereum-кошельком. На телефоне можно использовать встроенный браузер совместимого кошелька. QR-подключение пока не поддерживается."));
      const retry = node("button", "button secondary small", "Проверить ещё раз");
      retry.type = "button";
      retry.addEventListener("click", discoverProviders);
      box.append(retry);
      target.append(box);
      return;
    }
    for (const entry of state.providers) {
      const button = node("button", "provider-button");
      button.type = "button";
      button.disabled = state.walletBusy;
      const name = node("span", "provider-name", entry.name);
      name.append(node("span", "provider-origin", entry.rdns || "Установленное расширение"));
      button.append(node("span", "provider-initial", entry.name.slice(0, 1).toUpperCase()), name, node("span", "provider-arrow", "↗"));
      button.addEventListener("click", () => beginWalletProof(entry));
      target.append(button);
    }
  }

  function detachProviderListeners() {
    const listeners = state.providerListeners;
    if (listeners && typeof listeners.provider.removeListener === "function") {
      for (const event of ["accountsChanged", "chainChanged", "disconnect"]) listeners.provider.removeListener(event, listeners.changed);
    }
    state.providerListeners = null;
  }

  function cancelProof() {
    state.walletAttempt += 1;
    state.proof = null;
    state.walletBusy = false;
    detachProviderListeners();
    $("signature-review").hidden = true;
    $("sign-button").disabled = false;
    $("siwe-message").textContent = "";
    $("signature-address").textContent = "";
  }

  function openWalletDialog() {
    if (!can("walletLinking")) return;
    cancelProof();
    notice("wallet-message", "");
    $("provider-list").hidden = false;
    $("wallet-dialog").showModal();
    discoverProviders();
  }

  async function ensureChain(provider) {
    let chain = await provider.request({ method: "eth_chainId" });
    if (Number(chain) !== CHAIN_ID) {
      try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] }); }
      catch (error) {
        if (Number(error?.code ?? error?.data?.originalError?.code) !== 4902) throw error;
        await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN_HEX, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"] }] });
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
      }
      chain = await provider.request({ method: "eth_chainId" });
    }
    if (Number(chain) !== CHAIN_ID) throw new Error("Выберите Robinhood Chain (4663) в кошельке и повторите подключение.");
  }

  function validateChallenge(challenge, address) {
    if (typeof challenge?.id !== "string" || typeof challenge?.message !== "string" || challenge.message.length > 12000) throw new Error("Некорректный ответ сервера подтверждения. Сообщение не будет подписано.");
    const message = challenge.message;
    const lines = message.split("\n");
    const field = (name) => lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2);
    const expires = Date.parse(field("Expiration Time"));
    const issued = Date.parse(field("Issued At"));
    if (lines[0] !== `${location.host} wants you to sign in with your Ethereum account:` || lines[1]?.toLowerCase() !== address.toLowerCase() || field("URI") !== `${location.origin}/bot/` || field("Chain ID") !== String(CHAIN_ID) || field("Version") !== "1" || !/^[a-zA-Z0-9]{8,}$/.test(field("Nonce") || "") || !Number.isFinite(expires) || expires <= Date.now() || !Number.isFinite(issued) || issued > Date.now() + 60000) {
      throw new Error("Домен, адрес, сеть или срок сообщения не совпадают с этим кабинетом. Подпись отменена.");
    }
  }

  async function assertWallet(provider, address) {
    const [accounts, chain] = await Promise.all([provider.request({ method: "eth_accounts" }), provider.request({ method: "eth_chainId" })]);
    if (!Array.isArray(accounts) || accounts[0]?.toLowerCase() !== address.toLowerCase() || Number(chain) !== CHAIN_ID) throw new Error("Адрес или сеть изменились. Начните подтверждение заново.");
  }

  async function beginWalletProof(entry) {
    if (state.walletBusy || !can("walletLinking")) return;
    cancelProof();
    const attempt = state.walletAttempt;
    state.walletBusy = true;
    renderProviders();
    notice("wallet-message", "Откройте расширение кошелька и подтвердите подключение. При необходимости будет предложена сеть Robinhood Chain.");
    try {
      const accounts = await entry.provider.request({ method: "eth_requestAccounts" });
      if (attempt !== state.walletAttempt) return;
      const address = Array.isArray(accounts) ? accounts[0] : null;
      if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Кошелёк не предоставил корректный Ethereum-адрес.");
      await ensureChain(entry.provider);
      if (attempt !== state.walletAttempt) return;
      await assertWallet(entry.provider, address);
      const changed = () => {
        cancelProof();
        if ($("wallet-dialog").open) {
          $("provider-list").hidden = false;
          renderProviders();
          notice("wallet-message", "Адрес, сеть или соединение изменились. Начните подтверждение заново.", true);
        }
      };
      if (typeof entry.provider.on === "function") {
        for (const event of ["accountsChanged", "chainChanged", "disconnect"]) entry.provider.on(event, changed);
        state.providerListeners = { provider: entry.provider, changed };
      }
      const challenge = await api("/wallets/challenge", { method: "POST", body: { address, provider: entry.name } });
      if (attempt !== state.walletAttempt) return;
      validateChallenge(challenge, address);
      state.proof = { entry, address, challenge, attempt };
      $("signature-address").textContent = address;
      $("siwe-message").textContent = challenge.message;
      $("provider-list").hidden = true;
      $("signature-review").hidden = false;
      notice("wallet-message", "Адрес подключён в браузере. Чтобы привязать его к аккаунту, проверьте и подпишите сообщение ниже.");
      $("sign-button").focus();
    } catch (error) {
      if (attempt === state.walletAttempt) { notice("wallet-message", errorMessage(error), true); detachProviderListeners(); }
    } finally {
      if (attempt === state.walletAttempt) { state.walletBusy = false; renderProviders(); }
    }
  }

  async function signProof() {
    const proof = state.proof;
    if (!proof || state.walletBusy || !can("walletLinking")) return;
    state.walletBusy = true;
    $("sign-button").disabled = true;
    notice("wallet-message", "Проверьте сообщение в кошельке. Подпись подтверждает владение адресом и не разрешает расходы.");
    try {
      validateChallenge(proof.challenge, proof.address);
      await assertWallet(proof.entry.provider, proof.address);
      if (proof.attempt !== state.walletAttempt) return;
      const bytes = new TextEncoder().encode(proof.challenge.message);
      const hex = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const signature = await proof.entry.provider.request({ method: "personal_sign", params: [hex, proof.address] });
      if (proof.attempt !== state.walletAttempt) return;
      if (typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature) || signature.length > 16386) throw new Error("Кошелёк вернул некорректную подпись.");
      await assertWallet(proof.entry.provider, proof.address);
      if (proof.attempt !== state.walletAttempt) return;
      await api("/wallets/verify", { method: "POST", body: { challengeId: proof.challenge.id, signature } });
      if (proof.attempt !== state.walletAttempt) return;
      $("wallet-dialog").close();
      await refresh();
      location.hash = "wallets";
      toast("Владение адресом подтверждено. Торговля не активирована.");
    } catch (error) {
      if (proof.attempt === state.walletAttempt) notice("wallet-message", `${errorMessage(error)} Если подпись уже отправлена, обновите список кошельков перед повторным подтверждением.`, true);
    } finally {
      if (proof.attempt === state.walletAttempt) { state.walletBusy = false; $("sign-button").disabled = false; }
    }
  }

  function selectTab() {
    const requested = location.hash.slice(1);
    const tab = Object.hasOwn(TABS, requested) ? requested : "overview";
    document.querySelectorAll("[data-tab]").forEach((link) => {
      const active = link.dataset.tab === tab;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    Object.keys(TABS).forEach((key) => { $(`panel-${key}`).hidden = key !== tab; });
    $("breadcrumb-title").textContent = TABS[tab];
    document.title = `${TABS[tab]} · CryptoBot`;
    if (tab === "research" && state.session?.authenticated && !state.analysisStarted) loadAnalyses();
  }

  const HASH_RE = /^[a-f0-9]{64}$/;
  const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

  function analysisQuery() {
    const params = new URLSearchParams(location.search);
    return { snapshot: params.get("analysis"), token: params.get("token") };
  }

  function analysisLink(snapshot, address) {
    const url = new URL("/crypto/analysis.html", location.origin);
    url.searchParams.set("snapshot", snapshot);
    if (address) url.searchParams.set("token", address);
    return url.pathname + url.search;
  }

  function sourceFact(list, label, value) {
    list.append(node("dt", "", label), node("dd", "", value === null || value === undefined || value === "" ? "Не указано" : String(value)));
  }

  function analysisNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "Не указан";
  }

  function analysisUsd(value) {
    if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) return "Неизвестно";
    return `$${value}`;
  }

  function renderAnalyses() {
    const data = state.analysis;
    const query = analysisQuery();
    const provenance = $("analysis-provenance");
    const list = $("analysis-list");
    list.replaceChildren();
    provenance.replaceChildren();
    const details = node("details", "analysis-details");
    details.append(node("summary", "", `Снимок ${data.snapshotId.slice(0, 12)}… · ${data.asOf ? date(data.asOf, true) : "Время данных неизвестно"}`));
    const facts = node("dl", "analysis-facts");
    sourceFact(facts, "Snapshot ID", data.snapshotId);
    sourceFact(facts, "Данные на (asOf)", data.asOf);
    sourceFact(facts, "Ответ источника (servedAt)", data.servedAt);
    sourceFact(facts, "Источник", data.source?.id);
    sourceFact(facts, "Ревизия источника", data.source?.revision);
    sourceFact(facts, "Схема", data.schemaVersion);
    details.append(facts);
    provenance.append(details);
    $("analysis-common-link").href = analysisLink(data.snapshotId, query.token && ADDRESS_RE.test(query.token) ? query.token.toLowerCase() : null);
    const included = data.items.filter((item) => item.botScope === "pons_reported");
    const excluded = data.items.length - included.length;
    const coverage = data.coverage || {};
    $("analysis-coverage").textContent = `Pons по данным ACS: ${included.length}. Исключено из кабинета: ${excluded} с неподтверждённым происхождением. В снимке ${data.items.length}; опубликовано источником ${Number.isInteger(coverage.published) ? coverage.published : "неизвестно"}, лимит ${Number.isInteger(coverage.limit) ? coverage.limit : "не указан"}. Проверка реестра и доступности продажи отдельно не выполнена.`;
    const selected = query.token?.toLowerCase();
    if (selected && !included.some((item) => item.address === selected)) {
      const exists = data.items.some((item) => item.address === selected);
      notice("analysis-message", exists ? "Выбранный токен присутствует в снимке, но его происхождение не подтверждено как Pons. Он исключён из текущей области CryptoBot." : "Выбранного токена нет в этом снимке. Снимок не заменён свежим автоматически.");
    }
    if (!included.length) {
      emptyState(list, "В снимке нет токенов Pons", "Другие происхождения не входят в текущую область CryptoBot. Это не результат проверки безопасности или отсутствия рисков.", "—");
      return;
    }
    for (const item of included) {
      const card = node("article", "analysis-token");
      card.id = `analysis-token-${item.address}`;
      card.tabIndex = -1;
      if (item.address === selected) card.classList.add("analysis-selected");
      const head = node("div", "analysis-token-heading");
      const title = node("div", "");
      title.append(node("h3", "", item.symbol || item.name || "Токен без имени"), node("p", "analysis-token-name", item.name || "Название не указано"));
      head.append(title, node("span", "pill neutral", "Pons · источник ACS"));
      const contract = node("p", "analysis-contract", item.address);
      const metrics = node("dl", "analysis-metrics");
      sourceFact(metrics, "Оценка ACS", analysisNumber(item.assessment?.score));
      sourceFact(metrics, "Уровень ACS", item.assessment?.tier);
      sourceFact(metrics, "Оценка входа ACS", analysisNumber(item.assessment?.entryScore));
      sourceFact(metrics, "Вердикт входа ACS", item.assessment?.entryVerdict);
      sourceFact(metrics, "Цена USD", analysisUsd(item.market?.priceUsd));
      sourceFact(metrics, "Quote liquidity USD", analysisUsd(item.market?.quoteLiquidityUsd));
      const gate = node("p", "analysis-gate", "Допуск CryptoBot: не проверен. Registry и исполнимая продажа неизвестны. Торговля не разрешена этим анализом.");
      const evidence = node("details", "analysis-details");
      evidence.append(node("summary", "", "Идентификаторы, источник и неизвестные данные"));
      const meta = node("dl", "analysis-facts");
      sourceFact(meta, "Analysis ID", item.analysisId);
      sourceFact(meta, "Версия анализа", item.version);
      sourceFact(meta, "Token ID", item.tokenId);
      sourceFact(meta, "Chain ID", item.chainId);
      sourceFact(meta, "Происхождение ACS", item.launchpad);
      sourceFact(meta, "Стадия ACS", item.stage);
      sourceFact(meta, "Данные токена на", item.asOf);
      sourceFact(meta, "Market timestamp", item.timestamps?.market);
      sourceFact(meta, "Score timestamp", item.timestamps?.score);
      sourceFact(meta, "Entry timestamp", item.timestamps?.entry);
      sourceFact(meta, "Версия модели входа ACS", item.assessment?.entryVersion);
      sourceFact(meta, "Вердикт решения ACS", item.assessment?.decisionVerdict);
      sourceFact(meta, "Коды оснований ACS", item.assessment?.reasonCodes?.join(", ") || "Не указаны");
      sourceFact(meta, "Коды рисков ACS", item.assessment?.riskCodes?.join(", ") || "Не указаны — это не отсутствие риска");
      sourceFact(meta, "Неизвестные поля ACS", item.unknowns?.join(", ") || "Источник не перечислил; безопасность не доказана");
      evidence.append(meta);
      const link = node("a", "text-button", "Открыть этот снимок в /crypto ↗");
      link.href = analysisLink(data.snapshotId, item.address);
      card.append(head, contract, metrics, gate, evidence, link);
      list.append(card);
    }
    if (selected) document.getElementById(`analysis-token-${selected}`)?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  async function loadAnalyses(latest = false) {
    if (!state.session?.authenticated || state.analysisLoading) return;
    state.analysisStarted = true;
    state.analysisLoading = true;
    const request = ++state.analysisRequest;
    const query = analysisQuery();
    const requested = latest ? null : query.snapshot;
    $("analysis-latest").disabled = true;
    $("analysis-retry").disabled = true;
    $("analysis-retry").hidden = true;
    notice("analysis-message", requested ? "Загружаем указанный снимок ACS…" : "Загружаем опубликованный снимок ACS…");
    state.analysis = null;
    $("analysis-list").replaceChildren();
    $("analysis-provenance").replaceChildren();
    $("analysis-coverage").textContent = "Ответ источника ещё не получен.";
    $("analysis-common-link").href = "/crypto/analysis.html";
    try {
      if ((requested && !HASH_RE.test(requested)) || (query.token && !ADDRESS_RE.test(query.token))) throw new Error("Некорректный идентификатор снимка или адрес токена в ссылке.");
      const data = await api(`/analyses${requested ? `?snapshot=${encodeURIComponent(requested)}` : ""}`);
      if (request !== state.analysisRequest) return;
      if (data.schemaVersion !== "acs.analysis.v1" || data.chainId !== CHAIN_ID || !HASH_RE.test(data.snapshotId || "") || !Array.isArray(data.items) || data.executionAuthorized !== false || (requested && data.snapshotId !== requested)) throw new Error("Схема, сеть или снимок источника не совпадают с запросом. Данные не показаны.");
      for (const item of data.items) {
        if (item.chainId !== CHAIN_ID || !ADDRESS_RE.test(item.address || "") || !HASH_RE.test(item.analysisId || "") || !HASH_RE.test(item.version || "") || item.executionAuthorized !== false) throw new Error("Источник вернул неподдерживаемый анализ токена.");
      }
      state.analysis = data;
      const url = new URL(location.href);
      url.searchParams.set("analysis", data.snapshotId);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      notice("analysis-message", "");
      renderAnalyses();
    } catch (error) {
      if (request !== state.analysisRequest) return;
      const message = error.status === 410 ? `Снимок ${requested || "из ссылки"} больше не доступен. Новый анализ не подставлен вместо него. Чтобы перейти к другим данным, нажмите «Загрузить свежий снимок».` : errorMessage(error);
      notice("analysis-message", message, true);
      $("analysis-coverage").textContent = "Общий анализ не загружен. Оценки и результаты не подменяются демонстрационными.";
      $("analysis-retry").hidden = false;
    } finally {
      if (request === state.analysisRequest) {
        state.analysisLoading = false;
        $("analysis-latest").disabled = false;
        $("analysis-retry").disabled = false;
      }
    }
  }

  window.addEventListener("hashchange", selectTab);
  selectTab();
  $("refresh-button").addEventListener("click", refresh);
  $("retry-session").addEventListener("click", loadSession);
  $("analysis-latest").addEventListener("click", () => loadAnalyses(true));
  $("analysis-retry").addEventListener("click", () => loadAnalyses(false));
  document.querySelectorAll("[data-connect]").forEach((button) => button.addEventListener("click", openWalletDialog));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
  $("wallet-dialog").addEventListener("close", cancelProof);
  $("sign-button").addEventListener("click", signProof);
  $("new-task-button").addEventListener("click", openTaskDialog);
  $("task-filter").addEventListener("change", renderTasks);
  $("task-dialog").addEventListener("cancel", (event) => { if (state.taskBusy) event.preventDefault(); });
  ["task-title", "task-description", "task-acceptance"].forEach((id) => $(id).addEventListener("input", () => $(id).setCustomValidity("")));
  $("task-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.taskBusy || !can("taskCreation")) return;
    const body = { title: $("task-title").value.trim(), description: $("task-description").value.trim(), acceptance: $("task-acceptance").value.trim(), priority: $("task-priority").value };
    for (const field of ["title", "description", "acceptance"]) {
      if (!body[field]) { $(`task-${field}`).setCustomValidity("Введите текст, а не только пробелы."); $(`task-${field}`).reportValidity(); return; }
    }
    state.taskBusy = true;
    $("task-submit").disabled = true;
    $("task-dialog").querySelectorAll("[data-close]").forEach((button) => { button.disabled = true; });
    notice("task-form-message", "Сохраняем задачу…");
    try {
      await api("/tasks", { method: "POST", body });
      $("task-dialog").close();
      $("task-filter").value = "active";
      await refresh();
      toast("Задача сохранена. AI-исполнитель не запущен.");
    } catch (error) { notice("task-form-message", `${errorMessage(error)} При потере ответа обновите список перед повторным созданием.`, true); }
    finally {
      state.taskBusy = false;
      $("task-submit").disabled = false;
      $("task-dialog").querySelectorAll("[data-close]").forEach((button) => { button.disabled = false; });
    }
  });

  $("confirm-unlink").addEventListener("click", async () => {
    if (!state.unlinkId || !can("walletLinking")) return;
    const id = state.unlinkId;
    $("confirm-unlink").disabled = true;
    try {
      await api(`/wallets/${encodeURIComponent(id)}`, { method: "DELETE" });
      $("unlink-dialog").close();
      state.unlinkId = null;
      await refresh();
      toast("Связь адреса с аккаунтом удалена. On-chain разрешения не изменены.");
    } catch (error) { notice("unlink-message", errorMessage(error), true); }
    finally { $("confirm-unlink").disabled = false; }
  });

  document.querySelectorAll('input[name="preset"]').forEach((input) => input.addEventListener("change", () => {
    state.selectedPreset = Number(input.value);
    $("preset-status").textContent = state.selectedPreset === state.preset ? "Сохранён в вашем аккаунте" : "Изменение ещё не сохранено";
    syncControls();
  }));
  $("save-preset").addEventListener("click", async () => {
    if (!can("settings") || ![150, 1000, 5000].includes(state.selectedPreset)) return;
    const preset = state.selectedPreset;
    $("save-preset").disabled = true;
    $("preset-options").disabled = true;
    try {
      await api("/settings", { method: "PUT", body: { preset } });
      state.preset = preset;
      $("preset-status").textContent = "Сохранён в вашем аккаунте";
      toast("Пресет исследования сохранён");
    } catch (error) { $("preset-status").textContent = "Сохранение не подтверждено"; toast(errorMessage(error), true); }
    finally { syncControls(); }
  });

  syncControls();
  loadSession();
})();
