const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const dockerButton = document.getElementById("docker");
const folderButton = document.getElementById("folder");
const startRuntimeButton = document.getElementById("startRuntime");
const stopRuntimeButton = document.getElementById("stopRuntime");
const refreshRuntimeButton = document.getElementById("refreshRuntime");
const quitRuntimeButton = document.getElementById("quitRuntime");
const runtimeFromAppButton = document.getElementById("runtimeFromApp");
const stopFromAppButton = document.getElementById("stopFromApp");
const startupShell = document.getElementById("startupShell");
const appShell = document.getElementById("appShell");
const tabsEl = document.getElementById("tabs");
const viewHost = document.getElementById("viewHost");
const newTabButton = document.getElementById("newTab");
const startupLogo = document.getElementById("startupLogo");
const runtimeSubtitle = document.getElementById("runtimeSubtitle");
const runtimeIndicator = document.getElementById("runtimeIndicator");
const runtimeModeEl = document.getElementById("runtimeMode");
const limaStateEl = document.getElementById("limaState");
const containerCountEl = document.getElementById("containerCount");
const imageCountEl = document.getElementById("imageCount");
const volumeCountEl = document.getElementById("volumeCount");
const containersBody = document.getElementById("containersBody");
const imagesBody = document.getElementById("imagesBody");
const volumesBody = document.getElementById("volumesBody");
const networksBody = document.getElementById("networksBody");
const containersHint = document.getElementById("containersHint");
const imagesHint = document.getElementById("imagesHint");
const volumesHint = document.getElementById("volumesHint");
const networksHint = document.getElementById("networksHint");
const runtimeUpdated = document.getElementById("runtimeUpdated");
const runtimeLog = document.getElementById("runtimeLog");
const RUNTIME_TAB_ID = "runtime-dashboard";

let tabs = [];
let activeTabId = null;
let windowId = null;
let defaultAppUrl = "http://localhost:3000";
let tabCreated = false;
let draggedTabId = null;
let lastDragPoint = { clientX: 0, clientY: 0, screenX: 0, screenY: 0 };
let runtimeRefreshTimer = null;
let runtimeRefreshPromise = null;
let runtimeBusy = false;

function placeRuntimeShellAtRoot() {
  startupShell.classList.remove("embedded-runtime");
  if (startupShell.parentElement !== document.body) {
    document.body.insertBefore(startupShell, appShell);
  }
}

function placeRuntimeShellInApp() {
  startupShell.classList.add("embedded-runtime");
  if (startupShell.parentElement !== viewHost) {
    viewHost.append(startupShell);
  }
}

function applyStatus(status) {
  statusEl.textContent = status?.message || "Подготовка...";
  detailEl.textContent = status?.detail || "";
}

function setShellReady() {
  document.body.classList.add("app-ready");
  startupShell.hidden = true;
  appShell.hidden = false;
  stopRuntimePolling();
  updateViewBounds();
}

function setRuntimeShellVisible() {
  placeRuntimeShellAtRoot();
  document.body.classList.remove("app-ready");
  startupShell.hidden = false;
  appShell.hidden = true;
  tabCreated = false;
  startRuntimePolling();
}

function setRuntimeTabVisible() {
  document.body.classList.add("app-ready");
  appShell.hidden = false;
  placeRuntimeShellInApp();
  startupShell.hidden = false;
  tabCreated = true;
  startRuntimePolling();
  updateViewBounds();
}

function updateViewBounds() {
  if (appShell.hidden) {
    return;
  }

  const rect = viewHost.getBoundingClientRect();
  window.segmenticaLauncher.updateTabBounds({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  });
}

function applyChromeTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.themeTransitionDisabled = "true";
  document.body.dataset.themeTransitionDisabled = "true";
  document.documentElement.dataset.theme = nextTheme;
  document.body.dataset.theme = nextTheme;
  window.clearTimeout(window.__segmenticaThemeTransitionUnlock);
  window.__segmenticaThemeTransitionUnlock = window.setTimeout(() => {
    delete document.documentElement.dataset.themeTransitionDisabled;
    delete document.body.dataset.themeTransitionDisabled;
  }, 180);
}

function clearTabDropMarkers() {
  tabsEl.querySelectorAll(".tab.drop-before, .tab.drop-after").forEach((node) => {
    node.classList.remove("drop-before", "drop-after");
  });
}

function rememberDragPoint(event) {
  lastDragPoint = {
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY
  };
}

function getDropIndex(event, tabIndex) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX > rect.left + rect.width / 2 ? tabIndex + 1 : tabIndex;
}

function hasTabDrag(event) {
  const types = Array.from(event.dataTransfer?.types || []);
  return Boolean(draggedTabId) || types.includes("application/x-segmentica-tab") || types.includes("text/plain");
}

function getDraggedTabId(event) {
  if (draggedTabId) {
    return draggedTabId;
  }

  const rawValue = event.dataTransfer?.getData("application/x-segmentica-tab")
    || event.dataTransfer?.getData("text/plain");
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function moveDraggedTab(tabId, targetIndex) {
  if (!tabId) {
    return;
  }

  const maxIndex = Math.max(tabs.length, 0);
  window.segmenticaLauncher.moveTab(tabId, Math.max(0, Math.min(targetIndex, maxIndex)));
}

function detachDraggedTabIfNeeded(event) {
  if (!draggedTabId) {
    return;
  }

  const chromeRect = document.querySelector(".browser-chrome").getBoundingClientRect();
  const point = {
    clientX: event.clientX || lastDragPoint.clientX,
    clientY: event.clientY || lastDragPoint.clientY,
    screenX: event.screenX || lastDragPoint.screenX,
    screenY: event.screenY || lastDragPoint.screenY
  };
  const leftWindow = point.clientX < 0 || point.clientX > window.innerWidth;
  const leftTabStrip = point.clientY < chromeRect.top - 28 || point.clientY > chromeRect.bottom + 80;

  window.segmenticaLauncher.finishTabDrag(
    draggedTabId,
    {
      x: point.screenX,
      y: point.screenY
    },
    leftWindow || leftTabStrip
  );
}

function renderTabs() {
  tabsEl.replaceChildren();

  tabs.forEach((tab, index) => {
    const isRuntimeTab = tab.id === RUNTIME_TAB_ID || tab.type === "runtime";
    const tabButton = document.createElement("div");
    tabButton.className = `tab${tab.id === activeTabId ? " active" : ""}`;
    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute("aria-selected", tab.id === activeTabId ? "true" : "false");
    tabButton.setAttribute("draggable", isRuntimeTab ? "false" : "true");
    tabButton.tabIndex = 0;
    tabButton.title = tab.title;

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "Segmentica";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "tab-close";
    close.title = "Закрыть вкладку";
    close.setAttribute("draggable", "false");
    close.setAttribute("aria-label", "Закрыть вкладку");
    close.textContent = "×";

    if (isRuntimeTab) {
      close.hidden = true;
    } else {
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        window.segmenticaLauncher.closeTab(tab.id);
      });
    }

    tabButton.addEventListener("click", () => {
      window.segmenticaLauncher.activateTab(tab.id);
    });

    tabButton.addEventListener("dragstart", (event) => {
      if (isRuntimeTab) {
        event.preventDefault();
        return;
      }
      draggedTabId = tab.id;
      rememberDragPoint(event);
      tabButton.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-segmentica-tab", String(tab.id));
      event.dataTransfer.setData("text/plain", String(tab.id));
      window.segmenticaLauncher.beginTabDrag(tab.id);
    });

    tabButton.addEventListener("dragover", (event) => {
      if (!hasTabDrag(event)) {
        return;
      }
      event.preventDefault();
      rememberDragPoint(event);
      clearTabDropMarkers();
      tabButton.classList.add(getDropIndex(event, index) > index ? "drop-after" : "drop-before");
      event.dataTransfer.dropEffect = "move";
    });

    tabButton.addEventListener("drop", (event) => {
      const tabId = getDraggedTabId(event);
      if (!tabId) {
        return;
      }
      event.preventDefault();
      rememberDragPoint(event);
      moveDraggedTab(tabId, getDropIndex(event, index));
      clearTabDropMarkers();
    });

    tabButton.addEventListener("dragend", (event) => {
      rememberDragPoint(event);
      detachDraggedTabIfNeeded(event);
      draggedTabId = null;
      clearTabDropMarkers();
      tabButton.classList.remove("dragging");
    });

    tabButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.segmenticaLauncher.activateTab(tab.id);
      }
    });

    tabButton.append(title, close);
    tabsEl.append(tabButton);
  });
}

function openAppShell(url, shouldCreateTab = true) {
  defaultAppUrl = url || defaultAppUrl;
  setShellReady();

  if (shouldCreateTab && !tabCreated) {
    tabCreated = true;
    window.segmenticaLauncher.createTab(defaultAppUrl);
  }
}

function asText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function isContainerUp(container) {
  return String(container?.Status || "").toLowerCase().startsWith("up");
}

function translateContainerStatus(status) {
  const text = asText(status);
  const lower = text.toLowerCase();
  if (lower.startsWith("up")) {
    return text.replace(/^up/i, "Запущен");
  }
  if (lower.startsWith("exited")) {
    return text.replace(/^exited/i, "Остановлен");
  }
  if (lower.startsWith("created")) {
    return text.replace(/^created/i, "Создан");
  }
  if (lower.startsWith("paused")) {
    return text.replace(/^paused/i, "Пауза");
  }
  if (lower.startsWith("restarting")) {
    return text.replace(/^restarting/i, "Перезапуск");
  }
  return text;
}

function translateLimaStatus(status) {
  const text = asText(status, "Неизвестно");
  const lower = text.toLowerCase();
  if (lower === "running") return "Запущена";
  if (lower === "stopped") return "Остановлена";
  if (lower === "missing") return "Не создана";
  if (lower === "unknown") return "Неизвестно";
  if (lower === "n/a") return "Не используется";
  return text;
}

function setButtonBusy(isBusy) {
  runtimeBusy = isBusy;
  startRuntimeButton.disabled = isBusy;
  stopRuntimeButton.disabled = isBusy;
  refreshRuntimeButton.disabled = isBusy;
  quitRuntimeButton.disabled = isBusy;
  runtimeFromAppButton.disabled = isBusy;
  stopFromAppButton.disabled = isBusy;
}

function makeCell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = asText(text);
  td.title = asText(text, "");
  if (className) {
    td.className = className;
  }
  return td;
}

function renderEmptyRow(body, colspan, text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.className = "empty-cell";
  cell.textContent = text;
  row.append(cell);
  body.append(row);
}

function renderContainers(containers = []) {
  containersBody.replaceChildren();
  if (containers.length === 0) {
    renderEmptyRow(containersBody, 5, "Контейнеров пока нет");
    return;
  }

  containers.forEach((container) => {
    const row = document.createElement("tr");
    const name = makeCell(container.Names || container.Name);
    const status = makeCell(translateContainerStatus(container.Status), isContainerUp(container) ? "state-up" : "state-down");
    row.append(
      name,
      makeCell(container.Image),
      status,
      makeCell(container.Ports),
      makeCell(container.Command)
    );
    containersBody.append(row);
  });
}

function renderImages(images = []) {
  imagesBody.replaceChildren();
  if (images.length === 0) {
    renderEmptyRow(imagesBody, 4, "Образов пока нет");
    return;
  }

  images.forEach((image) => {
    const row = document.createElement("tr");
    row.append(
      makeCell(image.Repository || image.Name),
      makeCell(image.Tag),
      makeCell(image.Size || image.BlobSize),
      makeCell(image.Platform)
    );
    imagesBody.append(row);
  });
}

function renderVolumes(volumes = []) {
  volumesBody.replaceChildren();
  if (volumes.length === 0) {
    renderEmptyRow(volumesBody, 3, "Томов пока нет");
    return;
  }

  volumes.forEach((volume) => {
    const row = document.createElement("tr");
    row.append(
      makeCell(volume.Name),
      makeCell(volume.Size),
      makeCell(volume.Mountpoint)
    );
    volumesBody.append(row);
  });
}

function renderNetworks(networks = []) {
  networksBody.replaceChildren();
  if (networks.length === 0) {
    renderEmptyRow(networksBody, 3, "Сетей пока нет");
    return;
  }

  networks.forEach((network) => {
    const row = document.createElement("tr");
    row.append(
      makeCell(network.Name),
      makeCell(network.ID),
      makeCell(network.Labels)
    );
    networksBody.append(row);
  });
}

function renderRuntimeState(state = {}) {
  const containers = Array.isArray(state.containers) ? state.containers : [];
  const images = Array.isArray(state.images) ? state.images : [];
  const volumes = Array.isArray(state.volumes) ? state.volumes : [];
  const networks = Array.isArray(state.networks) ? state.networks : [];
  const runningCount = containers.filter(isContainerUp).length;
  const allSegmenticaUp = containers.length > 0
    && containers.filter((container) => String(container.Names || "").startsWith("segmentica-")).every(isContainerUp);
  const limaState = translateLimaStatus(state.lima?.status || (state.mode === "embedded-lima" ? "Unknown" : "n/a"));

  runtimeSubtitle.textContent = state.label || "Локальное окружение";
  runtimeModeEl.textContent = state.label || state.mode || "-";
  limaStateEl.textContent = `${limaState}${state.lima?.ssh ? ` · ${state.lima.ssh}` : ""}`;
  containerCountEl.textContent = `${runningCount}/${containers.length}`;
  imageCountEl.textContent = String(images.length);
  volumeCountEl.textContent = String(volumes.length);
  containersHint.textContent = `${runningCount} запущено`;
  imagesHint.textContent = `${images.length} всего`;
  volumesHint.textContent = `${volumes.length} всего`;
  networksHint.textContent = `${networks.length} всего`;
  runtimeUpdated.textContent = state.control?.lastUpdatedAt
    ? new Date(state.control.lastUpdatedAt).toLocaleTimeString()
    : "-";
  runtimeIndicator.className = `runtime-dot${allSegmenticaUp ? " up" : runningCount > 0 ? " partial" : ""}`;
  stopRuntimeButton.disabled = runtimeBusy || runningCount === 0;
  startRuntimeButton.textContent = allSegmenticaUp || state.appAvailable ? "Открыть приложение" : "Запустить";

  renderContainers(containers);
  renderImages(images);
  renderVolumes(volumes);
  renderNetworks(networks);
  runtimeLog.textContent = stripAnsi(state.logs)
    || [
      state.error ? `Ошибка: ${state.error}` : "",
      state.appAvailable ? "Сайт отвечает на localhost:3000" : "Сайт пока не отвечает",
      state.lima ? `Виртуальная машина: ${limaState} ${state.lima.ssh || ""}`.trim() : ""
    ].filter(Boolean).join("\n");
}

async function refreshRuntimeState() {
  if (runtimeRefreshPromise) {
    return runtimeRefreshPromise;
  }

  runtimeRefreshPromise = (async () => {
  try {
    const state = await window.segmenticaLauncher.getRuntimeState();
    renderRuntimeState(state);
    return state;
  } catch (error) {
    runtimeLog.textContent = "Не удалось обновить состояние окружения.";
    return null;
  } finally {
    runtimeRefreshPromise = null;
  }
  })();

  return runtimeRefreshPromise;
}

function startRuntimePolling() {
  stopRuntimePolling();
  void refreshRuntimeState();
  runtimeRefreshTimer = window.setInterval(() => {
    if (!startupShell.hidden) {
      void refreshRuntimeState();
    }
  }, 2000);
}

function stopRuntimePolling() {
  if (runtimeRefreshTimer) {
    window.clearInterval(runtimeRefreshTimer);
    runtimeRefreshTimer = null;
  }
}

window.segmenticaLauncher.onStatus(({ message, detail }) => {
  applyStatus({ message, detail });
  if (!startupShell.hidden) {
    void refreshRuntimeState();
  }
});

window.segmenticaLauncher.onReady(({ url }) => {
  openAppShell(url, tabs.length === 0);
});

window.segmenticaLauncher.onStopped(() => {
  setRuntimeShellVisible();
  void refreshRuntimeState();
});

window.segmenticaLauncher.onTabsChanged((state) => {
  tabs = Array.isArray(state?.tabs) ? state.tabs : [];
  activeTabId = state?.activeTabId ?? null;
  windowId = state?.windowId ?? windowId;
  tabCreated = tabs.length > 0 || tabCreated;
  applyChromeTheme(state?.activeTheme);
  renderTabs();
  if (activeTabId === RUNTIME_TAB_ID) {
    setRuntimeTabVisible();
    void refreshRuntimeState();
  } else if (!appShell.hidden) {
    startupShell.hidden = true;
    stopRuntimePolling();
    updateViewBounds();
  }
});

window.segmenticaLauncher.onThemeChanged((theme) => {
  applyChromeTheme(theme);
});

window.segmenticaLauncher.rendererReady().then((state) => {
  applyStatus(state?.status);
  windowId = state?.windowId ?? windowId;
  if (state?.runtime?.helpLabel) {
    dockerButton.textContent = state.runtime.helpLabel;
  }
  applyChromeTheme(state?.theme);
  renderRuntimeState(state?.runtimeState);
  if (state?.ready?.ready) {
    openAppShell(state.ready.url, !state?.hasTabs);
  } else {
    setRuntimeShellVisible();
  }
}).catch(() => {
  applyStatus({
    message: "Ошибка запуска",
    detail: "Не удалось связаться с основным процессом Electron."
  });
});

window.segmenticaLauncher.getAppIcon().then((iconDataUrl) => {
  if (iconDataUrl) {
    startupLogo.src = iconDataUrl;
  }
}).catch(() => {});

const resizeObserver = new ResizeObserver(() => updateViewBounds());
resizeObserver.observe(viewHost);
window.addEventListener("resize", updateViewBounds);
document.addEventListener("dragover", rememberDragPoint);

tabsEl.addEventListener("dragover", (event) => {
  if (!hasTabDrag(event)) {
    return;
  }
  event.preventDefault();
  rememberDragPoint(event);
  event.dataTransfer.dropEffect = "move";
});

tabsEl.addEventListener("drop", (event) => {
  const tabId = getDraggedTabId(event);
  if (!tabId || event.target.closest(".tab")) {
    return;
  }
  event.preventDefault();
  rememberDragPoint(event);
  moveDraggedTab(tabId, tabs.length);
  clearTabDropMarkers();
});

startRuntimeButton.addEventListener("click", async () => {
  setButtonBusy(true);
  applyStatus({ message: "Запускаю контейнеры...", detail: "Поднимаю все сервисы Segmentica" });
  try {
    const state = await window.segmenticaLauncher.startRuntime();
    renderRuntimeState(state);
  } finally {
    setButtonBusy(false);
  }
});

stopRuntimeButton.addEventListener("click", async () => {
  setButtonBusy(true);
  applyStatus({ message: "Останавливаю контейнеры...", detail: "Возвращаюсь к панели окружения" });
  try {
    const state = await window.segmenticaLauncher.stopRuntime();
    renderRuntimeState(state);
  } finally {
    setButtonBusy(false);
  }
});

runtimeFromAppButton.addEventListener("click", async () => {
  setButtonBusy(true);
  try {
    const state = await window.segmenticaLauncher.showRuntimeDashboard();
    setRuntimeTabVisible();
    renderRuntimeState(state);
  } finally {
    setButtonBusy(false);
  }
});

quitRuntimeButton.addEventListener("click", async () => {
  setButtonBusy(true);
  applyStatus({ message: "Закрываю Segmentica...", detail: "Останавливаю контейнеры перед выходом" });
  try {
    await window.segmenticaLauncher.quitRuntime();
  } finally {
    setButtonBusy(false);
  }
});

refreshRuntimeButton.addEventListener("click", () => {
  void refreshRuntimeState();
});

stopFromAppButton.addEventListener("click", async () => {
  setButtonBusy(true);
  try {
    await window.segmenticaLauncher.stopRuntime();
    setRuntimeShellVisible();
  } finally {
    setButtonBusy(false);
  }
});

dockerButton.addEventListener("click", () => {
  window.segmenticaLauncher.openDockerDownload();
});

folderButton.addEventListener("click", () => {
  window.segmenticaLauncher.openRuntimeFolder();
});

newTabButton.addEventListener("click", () => {
  window.segmenticaLauncher.createTab(defaultAppUrl);
});
