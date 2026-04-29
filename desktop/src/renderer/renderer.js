const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const dockerButton = document.getElementById("docker");
const folderButton = document.getElementById("folder");
const startupShell = document.getElementById("startupShell");
const appShell = document.getElementById("appShell");
const tabsEl = document.getElementById("tabs");
const viewHost = document.getElementById("viewHost");
const newTabButton = document.getElementById("newTab");
const refreshButton = document.getElementById("refreshApp");
const closeAppButton = document.getElementById("closeApp");
const startupLogo = document.getElementById("startupLogo");

let tabs = [];
let activeTabId = null;
let windowId = null;
let defaultAppUrl = "http://localhost:3000";
let tabCreated = false;
let draggedTabId = null;
let lastDragPoint = { clientX: 0, clientY: 0, screenX: 0, screenY: 0 };

function applyStatus(status) {
  statusEl.textContent = status?.message || "Подготовка...";
  detailEl.textContent = status?.detail || "";
}

function setShellReady() {
  document.body.classList.add("app-ready");
  startupShell.hidden = true;
  appShell.hidden = false;
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
    const tabButton = document.createElement("div");
    tabButton.className = `tab${tab.id === activeTabId ? " active" : ""}`;
    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute("aria-selected", tab.id === activeTabId ? "true" : "false");
    tabButton.setAttribute("draggable", "true");
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

    close.addEventListener("click", (event) => {
      event.stopPropagation();
      window.segmenticaLauncher.closeTab(tab.id);
    });

    tabButton.addEventListener("click", () => {
      window.segmenticaLauncher.activateTab(tab.id);
    });

    tabButton.addEventListener("dragstart", (event) => {
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

window.segmenticaLauncher.onStatus(({ message, detail }) => {
  applyStatus({ message, detail });
});

window.segmenticaLauncher.onReady(({ url }) => {
  openAppShell(url, tabs.length === 0);
});

window.segmenticaLauncher.onTabsChanged((state) => {
  tabs = Array.isArray(state?.tabs) ? state.tabs : [];
  activeTabId = state?.activeTabId ?? null;
  windowId = state?.windowId ?? windowId;
  tabCreated = tabs.length > 0 || tabCreated;
  applyChromeTheme(state?.activeTheme);
  renderTabs();
});

window.segmenticaLauncher.onThemeChanged((theme) => {
  applyChromeTheme(theme);
});

window.segmenticaLauncher.rendererReady().then((state) => {
  applyStatus(state?.status);
  windowId = state?.windowId ?? windowId;
  applyChromeTheme(state?.theme);
  if (state?.ready?.ready) {
    openAppShell(state.ready.url, !state?.hasTabs);
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

dockerButton.addEventListener("click", () => {
  window.segmenticaLauncher.openDockerDownload();
});

folderButton.addEventListener("click", () => {
  window.segmenticaLauncher.openRuntimeFolder();
});

newTabButton.addEventListener("click", () => {
  window.segmenticaLauncher.createTab(defaultAppUrl);
});

refreshButton.addEventListener("click", () => {
  window.segmenticaLauncher.reloadActiveTab();
});

closeAppButton.addEventListener("click", () => {
  window.segmenticaLauncher.closeApp();
});
