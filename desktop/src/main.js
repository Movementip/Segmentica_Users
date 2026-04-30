const { app, BrowserWindow, BrowserView, ipcMain, shell, dialog, Menu, nativeTheme, clipboard } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

app.setName("Segmentica");
app.setAppUserModelId("ru.segmentica.desktop");

const APP_URL = "http://localhost:3000";
const RELEASE_VERSION = "2026.04.28";
const DOCKER_DESKTOP_URL = "https://www.docker.com/products/docker-desktop/";
const LIMA_INSTALL_URL = "https://lima-vm.io/docs/installation/";
const LIMA_INSTANCE_NAME = "segmentica";
const APP_ICON_PATH = fs.existsSync(path.resolve(__dirname, "..", "assets", "Segmentica.icns"))
  ? path.resolve(__dirname, "..", "assets", "Segmentica.icns")
  : path.join(process.resourcesPath || "", "Segmentica.icns");
const STARTUP_ICON_PATH = fs.existsSync(path.resolve(__dirname, "..", "..", "frontend", "utils", "Segmentica.icns", "icon_512x512@2x.png"))
  ? path.resolve(__dirname, "..", "..", "frontend", "utils", "Segmentica.icns", "icon_512x512@2x.png")
  : path.join(process.resourcesPath || "", "startup-icon.png");
const DOCK_ICON_PATH = fs.existsSync(STARTUP_ICON_PATH)
  ? STARTUP_ICON_PATH
  : APP_ICON_PATH;
const SERVICE_IMAGES = [
  "ghcr.io/movementip/segmentica-backend:2026.04.28",
  "ghcr.io/movementip/segmentica-frontend:2026.04.28",
  "ghcr.io/movementip/segmentica-libreoffice:2026.04.28",
  "ghcr.io/movementip/segmentica-symmetricds:2026.04.28",
  "postgres:17"
];
const REQUIRED_CONTAINER_NAMES = [
  "segmentica-postgres",
  "segmentica-libreoffice",
  "segmentica-symmetricds",
  "segmentica-backend",
  "segmentica-frontend"
];
const CONTAINER_START_ORDER = [
  "segmentica-tailscale",
  "segmentica-postgres",
  "segmentica-libreoffice",
  "segmentica-db-tailscale-proxy",
  "segmentica-symmetricds",
  "segmentica-backend",
  "segmentica-frontend"
];
const CONTAINER_STOP_TIMEOUT_SECONDS = 5;
const CONTAINER_STOP_COMMAND_TIMEOUT_MS = 45_000;
const CONTAINER_KILL_COMMAND_TIMEOUT_MS = 20_000;
const APP_HEALTHCHECK_TIMEOUT_MS = 1_500;
const RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS = 8_000;
const RUNTIME_LOG_COMMAND_TIMEOUT_MS = 12_000;
const RUNTIME_LOG_TAIL_PER_CONTAINER = 120;
const RUNTIME_TAB_ID = "runtime-dashboard";
const CONTAINER_RUNTIME = normalizeContainerRuntime(process.env.SEGMENTICA_CONTAINER_RUNTIME);

let mainWindow;
let shutdownRequested = false;
let stackStartedByLauncher = false;
let existingContainersStartedByLauncher = false;
let existingContainerNamesStartedByLauncher = [];
let stackStartPromise = null;
let launcherReadyState = { ready: false, url: APP_URL };
let launcherStatusState = { message: "Подготовка...", detail: "Проверяю окружение" };
let runtimeControlState = { mode: "idle", lastUpdatedAt: null };
let nextWindowId = 1;
let nextTabId = 1;
const appWindows = new Map();
let draggedTab = null;
let currentTheme = "dark";
let resolvedLimaCommand = null;

function normalizeContainerRuntime(value) {
  if (value === "embedded-lima") {
    return "embedded-lima";
  }
  if (value === "docker-desktop") {
    return "docker-desktop";
  }
  return process.platform === "darwin" ? "embedded-lima" : "docker-desktop";
}

function isEmbeddedLimaRuntime() {
  return CONTAINER_RUNTIME === "embedded-lima";
}

function containerRuntimeLabel() {
  return isEmbeddedLimaRuntime() ? "Встроенная виртуальная машина" : "Локальный Docker";
}

function themeBackground(theme = currentTheme) {
  return theme === "light" ? "#ffffff" : "#08090a";
}

function runtimeDir() {
  return path.join(app.getPath("userData"), "runtime");
}

function limaHomeDir() {
  return path.join(app.getPath("userData"), "lima");
}

function legacyLimaHomeDir() {
  return path.join(os.homedir(), ".lima");
}

function limaInstanceDir(homeDir = limaHomeDir()) {
  return path.join(homeDir, LIMA_INSTANCE_NAME);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isExecutableFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function bundledRuntimePath(...segments) {
  const packagedPath = path.join(process.resourcesPath || "", "runtime", ...segments);
  if (process.resourcesPath && fs.existsSync(packagedPath)) {
    return packagedPath;
  }
  return path.resolve(__dirname, "..", "runtime", ...segments);
}

function limaCommand() {
  if (resolvedLimaCommand) {
    return resolvedLimaCommand;
  }

  const executableName = process.platform === "win32" ? "limactl.exe" : "limactl";
  const candidates = [
    process.env.SEGMENTICA_LIMACTL_PATH,
    bundledRuntimePath("bin", executableName)
  ].filter(Boolean);

  resolvedLimaCommand = candidates.find(isExecutableFile) || executableName;
  return resolvedLimaCommand;
}

function commandEnvironment(command, env = {}) {
  const nextEnv = { ...process.env, ...env };
  if (isEmbeddedLimaRuntime() && command === limaCommand()) {
    fs.mkdirSync(limaHomeDir(), { recursive: true });
    nextEnv.LIMA_HOME = limaHomeDir();
  }
  return nextEnv;
}

function releaseZipPath() {
  const packagedPath = path.join(process.resourcesPath, "release", "segmentica-release.zip");
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }
  return path.resolve(__dirname, "..", "..", "release", "dist", "segmentica-release.zip");
}

function sendStatus(message, detail = "") {
  launcherStatusState = { message, detail };
  for (const appWindow of appWindows.values()) {
    if (!appWindow.window.isDestroyed()) {
      appWindow.window.webContents.send("launcher:status", { message, detail });
    }
  }
}

function sendReady(url = APP_URL) {
  launcherReadyState = { ready: true, url };
  for (const appWindow of appWindows.values()) {
    if (!appWindow.window.isDestroyed()) {
      appWindow.window.webContents.send("launcher:ready", { url });
    }
  }
}

function sendStopped() {
  launcherReadyState = { ready: false, url: APP_URL };
  for (const appWindow of appWindows.values()) {
    if (!appWindow.window.isDestroyed()) {
      appWindow.window.webContents.send("launcher:stopped", { url: APP_URL });
    }
  }
}

function formatTabTitle(title, url) {
  const normalized = String(title || "").trim();
  if (!normalized || normalized === url) {
    return "Segmentica";
  }
  return normalized.replace(/\s+-\s+Segmentica$/i, "");
}

function sendTabsState(appWindow) {
  if (!appWindow || appWindow.window.isDestroyed()) {
    return;
  }
  const activeTab = findBrowserTab(appWindow.activeTabId);
  const runtimeTab = appWindow.runtimeTabOpen
    ? [{ id: RUNTIME_TAB_ID, title: "Окружение", url: "segmentica://runtime", theme: currentTheme, type: "runtime" }]
    : [];
  appWindow.window.webContents.send("tabs:state", {
    windowId: appWindow.id,
    activeTabId: appWindow.activeTabId,
    activeTheme: activeTab?.theme || currentTheme,
    tabs: [...appWindow.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      theme: tab.theme || currentTheme
    })), ...runtimeTab]
  });
}

function findBrowserTab(tabId) {
  for (const appWindow of appWindows.values()) {
    const tab = appWindow.tabs.find((candidate) => candidate.id === tabId);
    if (tab) {
      return tab;
    }
  }
  return null;
}

function findTabOwner(tabId) {
  for (const appWindow of appWindows.values()) {
    if (appWindow.tabs.some((tab) => tab.id === tabId)) {
      return appWindow;
    }
  }
  return null;
}

function getAppWindowByBrowserWindow(browserWindow) {
  if (!browserWindow) {
    return null;
  }
  return appWindows.get(browserWindow.id) || null;
}

function getAppWindowFromEvent(event) {
  return getAppWindowByBrowserWindow(BrowserWindow.fromWebContents(event.sender));
}

function sanitizeViewBounds(appWindow, bounds = {}) {
  const contentBounds = appWindow?.window.getContentBounds() || { width: 1440, height: 920 };
  const x = Math.max(0, Math.round(Number(bounds.x) || 0));
  const y = Math.max(0, Math.round(Number(bounds.y) || 44));
  const width = Math.max(320, Math.round(Number(bounds.width) || contentBounds.width));
  const height = Math.max(240, Math.round(Number(bounds.height) || Math.max(contentBounds.height - y, 240)));
  return { x, y, width, height };
}

function updateActiveBrowserViewBounds(appWindow) {
  const activeTab = findBrowserTab(appWindow?.activeTabId);
  if (activeTab && !activeTab.view.webContents.isDestroyed()) {
    activeTab.view.setBounds(appWindow.viewBounds);
  }
}

function isTheme(value) {
  return value === "light" || value === "dark";
}

function applyThemeToTabChrome(tab, theme) {
  if (!tab || !isTheme(theme) || tab.view.webContents.isDestroyed()) {
    return;
  }

  tab.view.setBackgroundColor(themeBackground(theme));
}

function createThemeApplyScript(theme) {
  return `(function(){var theme=${JSON.stringify(theme)};var root=document.documentElement;var body=document.body;var lock=document.getElementById("segmentica-electron-theme-lock");if(!lock){lock=document.createElement("style");lock.id="segmentica-electron-theme-lock";lock.textContent=":root[data-theme-transition-disabled] *,:root[data-theme-transition-disabled] *::before,:root[data-theme-transition-disabled] *::after,body[data-theme-transition-disabled] *,body[data-theme-transition-disabled] *::before,body[data-theme-transition-disabled] *::after{-webkit-transition:none!important;transition:none!important;-webkit-animation:none!important;animation:none!important;animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}";document.head&&document.head.appendChild(lock)}root.dataset.themeTransitionDisabled="true";if(body){body.dataset.themeTransitionDisabled="true"}try{window.localStorage.setItem("segmentica-theme",theme)}catch(e){}var apply=function(target){if(!target)return;target.classList.toggle("dark",theme==="dark");target.classList.toggle("light",theme==="light");target.dataset.theme=theme;target.style.colorScheme=theme};apply(root);apply(body);window.dispatchEvent(new CustomEvent("segmentica-theme-external",{detail:{theme:theme}}));window.clearTimeout(window.__segmenticaElectronThemeUnlock);window.__segmenticaElectronThemeUnlock=window.setTimeout(function(){delete root.dataset.themeTransitionDisabled;if(document.body){delete document.body.dataset.themeTransitionDisabled}var node=document.getElementById("segmentica-electron-theme-lock");node&&node.remove()},180);return theme}())`;
}

function applyThemeToTabPage(tab, theme) {
  if (!tab || !isTheme(theme) || tab.view.webContents.isDestroyed()) {
    return Promise.resolve();
  }

  tab.view.webContents.send("theme:apply", theme);
  if (tab.view.webContents.isLoading()) {
    return Promise.resolve();
  }

  return tab.view.webContents.executeJavaScript(createThemeApplyScript(theme), true).catch(() => {});
}

function sendThemeState(appWindow, theme = currentTheme) {
  if (!appWindow || appWindow.window.isDestroyed() || !isTheme(theme)) {
    return;
  }

  appWindow.window.webContents.send("theme:state", theme);
}

function applyGlobalTheme(theme) {
  if (!isTheme(theme)) {
    return;
  }

  currentTheme = theme;
  nativeTheme.themeSource = theme;

  for (const appWindow of appWindows.values()) {
    appWindow.window.setBackgroundColor(themeBackground(theme));
    sendThemeState(appWindow, theme);
    for (const tab of appWindow.tabs) {
      tab.theme = theme;
      applyThemeToTabChrome(tab, theme);
      void applyThemeToTabPage(tab, theme);
    }
    sendTabsState(appWindow);
  }
}

function applyBrowserTabTheme(tab, theme) {
  if (!tab || !isTheme(theme)) {
    return;
  }

  applyGlobalTheme(theme);
}

function activateBrowserTab(appWindow, tabId) {
  if (!appWindow || appWindow.window.isDestroyed()) {
    return;
  }

  if (tabId === RUNTIME_TAB_ID) {
    openRuntimeDashboardTab(appWindow);
    return;
  }

  const nextTab = findBrowserTab(tabId);
  if (!nextTab || !appWindow.tabs.includes(nextTab) || appWindow.activeTabId === tabId) {
    return;
  }

  const currentTab = findBrowserTab(appWindow.activeTabId);
  if (currentTab) {
    appWindow.window.removeBrowserView(currentTab.view);
  }

  nextTab.theme = currentTheme;
  applyThemeToTabChrome(nextTab, currentTheme);
  void applyThemeToTabPage(nextTab, currentTheme);
  appWindow.runtimeTabOpen = false;
  appWindow.activeTabId = tabId;
  nativeTheme.themeSource = currentTheme;
  appWindow.window.addBrowserView(nextTab.view);
  nextTab.view.setBounds(appWindow.viewBounds);
  nextTab.view.setAutoResize({ width: true, height: true });
  sendTabsState(appWindow);
}

function moveBrowserTab(tabId, targetWindow, targetIndex) {
  const sourceWindow = findTabOwner(tabId);
  const tab = findBrowserTab(tabId);
  if (!sourceWindow || !targetWindow || !tab) {
    return;
  }

  const currentIndex = sourceWindow.tabs.findIndex((candidate) => candidate.id === tabId);
  const targetTabsBeforeMove = sourceWindow === targetWindow ? sourceWindow.tabs.length : targetWindow.tabs.length;
  const rawTargetIndex = Math.max(0, Math.min(Number(targetIndex) || 0, targetTabsBeforeMove));
  const insertIndex = sourceWindow === targetWindow && rawTargetIndex > currentIndex ? rawTargetIndex - 1 : rawTargetIndex;

  if (sourceWindow === targetWindow && currentIndex === insertIndex) {
    return;
  }

  const wasActive = sourceWindow.activeTabId === tabId;
  if (sourceWindow !== targetWindow) {
    sourceWindow.window.removeBrowserView(tab.view);
  }
  sourceWindow.tabs.splice(currentIndex, 1);
  targetWindow.tabs.splice(insertIndex, 0, tab);

  if (sourceWindow !== targetWindow) {
    tab.windowId = targetWindow.id;
    targetWindow.window.focus();
    void activateBrowserTab(targetWindow, tabId);
  }

  if (sourceWindow === targetWindow) {
    sendTabsState(sourceWindow);
  } else if (sourceWindow.tabs.length === 0) {
    sourceWindow.window.close();
  } else if (wasActive) {
    sourceWindow.activeTabId = null;
    void activateBrowserTab(sourceWindow, sourceWindow.tabs[Math.max(0, currentIndex - 1)].id);
  } else {
    sendTabsState(sourceWindow);
  }

  if (draggedTab?.tabId === tabId) {
    draggedTab.moved = true;
  }
}

function showLinkContextMenu(ownerAppWindow, linkUrl) {
  if (!linkUrl || !ownerAppWindow || ownerAppWindow.window.isDestroyed()) {
    return;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: "Открыть ссылку в новой вкладке",
      click: () => createBrowserTab(ownerAppWindow, linkUrl)
    },
    {
      label: "Открыть ссылку в отдельном окне",
      click: () => {
        const nextWindow = createShellWindow({ showStartup: false });
        createBrowserTab(nextWindow, linkUrl);
      }
    },
    { type: "separator" },
    {
      label: "Скопировать ссылку",
      click: () => clipboard.writeText(linkUrl)
    }
  ]);

  menu.popup({ window: ownerAppWindow.window });
}

function createShellWindow({ initialTab = null, initialBounds = null, showStartup = true } = {}) {
  const id = nextWindowId;
  nextWindowId += 1;

  const browserWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Segmentica",
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    backgroundColor: themeBackground(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (initialBounds) {
    browserWindow.setBounds(initialBounds);
  }

  const appWindow = {
    id,
    window: browserWindow,
    tabs: [],
    activeTabId: null,
    viewBounds: { x: 0, y: 44, width: 1180, height: 776 },
    runtimeTabOpen: false,
    showStartup
  };

  appWindows.set(browserWindow.id, appWindow);
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = browserWindow;
  }

  if (initialTab) {
    appWindow.tabs.push(initialTab);
    initialTab.windowId = appWindow.id;
    appWindow.activeTabId = initialTab.id;
    browserWindow.addBrowserView(initialTab.view);
    initialTab.view.setBounds(appWindow.viewBounds);
    initialTab.view.setAutoResize({ width: true, height: true });
  }

  browserWindow.loadFile(path.join(__dirname, "renderer", "index.html")).catch(showStartupError);
  browserWindow.on("resize", () => updateActiveBrowserViewBounds(appWindow));
  browserWindow.on("close", (event) => {
    if (shutdownRequested || appWindows.size > 1 || appWindow.tabs.length === 0) {
      return;
    }

    event.preventDefault();
    void stopRuntimeAndShowDashboard().catch((error) => {
      runtimeControlState = { mode: "error", lastUpdatedAt: new Date().toISOString() };
      sendStatus("Не удалось остановить контейнеры", error.message);
    });
  });
  browserWindow.on("closed", () => {
    for (const tab of appWindow.tabs) {
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close({ waitForBeforeUnload: false });
      }
    }
    appWindows.delete(browserWindow.id);
    if (mainWindow?.id === browserWindow.id) {
      mainWindow = appWindows.values().next().value?.window || null;
    }
  });

  return appWindow;
}

function detachBrowserTab(tabId, point = {}) {
  const sourceWindow = findTabOwner(tabId);
  const tab = findBrowserTab(tabId);
  if (!sourceWindow || !tab) {
    return;
  }

  const index = sourceWindow.tabs.findIndex((candidate) => candidate.id === tabId);
  sourceWindow.window.removeBrowserView(tab.view);
  sourceWindow.tabs.splice(index, 1);

  const x = Math.round(Number(point.x) || 0);
  const y = Math.round(Number(point.y) || 0);
  const initialBounds = x > 0 && y > 0
    ? { x: Math.max(0, x - 160), y: Math.max(0, y - 24), width: 1180, height: 820 }
    : null;
  const detachedWindow = createShellWindow({ initialTab: tab, initialBounds, showStartup: false });

  if (sourceWindow.tabs.length === 0) {
    sourceWindow.window.close();
    return;
  }

  if (sourceWindow.activeTabId === tabId) {
    const nextTab = sourceWindow.tabs[Math.max(0, index - 1)];
    sourceWindow.activeTabId = null;
    void activateBrowserTab(sourceWindow, nextTab.id);
  } else {
    sendTabsState(sourceWindow);
  }

  detachedWindow.window.focus();
}

function createBrowserTab(appWindow, url = APP_URL) {
  if (!appWindow || appWindow.window.isDestroyed()) {
    return null;
  }

  const id = nextTabId;
  nextTabId += 1;

  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "view-preload.js"),
      sandbox: false,
      plugins: true
    }
  });
  view.setBackgroundColor(themeBackground());

  const tab = {
    id,
    windowId: appWindow.id,
    title: "Segmentica",
    url,
    theme: currentTheme,
    view
  };

  view.webContents.on("page-title-updated", (event, title) => {
    tab.title = formatTabTitle(title, tab.url);
    sendTabsState(findTabOwner(tab.id));
  });

  view.webContents.on("did-navigate", (_event, navigatedUrl) => {
    tab.url = navigatedUrl;
    applyThemeToTabChrome(tab, currentTheme);
    void applyThemeToTabPage(tab, currentTheme);
    sendTabsState(findTabOwner(tab.id));
  });

  view.webContents.on("did-navigate-in-page", (_event, navigatedUrl) => {
    tab.url = navigatedUrl;
    sendTabsState(findTabOwner(tab.id));
  });

  view.webContents.on("did-finish-load", () => {
    applyThemeToTabChrome(tab, currentTheme);
    void applyThemeToTabPage(tab, currentTheme);
  });

  view.webContents.on("did-fail-load", (_event, errorCode) => {
    if (errorCode === -3) {
      return;
    }
    tab.title = "Ошибка загрузки";
    sendTabsState(findTabOwner(tab.id));
  });

  view.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    createBrowserTab(findTabOwner(tab.id), popupUrl);
    return { action: "deny" };
  });

  view.webContents.on("context-menu", (_event, params) => {
    showLinkContextMenu(findTabOwner(tab.id), params.linkURL);
  });

  appWindow.tabs.push(tab);
  view.webContents.loadURL(url).catch(() => {
    tab.title = "Ошибка загрузки";
    sendTabsState(appWindow);
  });
  void activateBrowserTab(appWindow, id);
  return tab;
}

function closeBrowserTab(appWindow, tabId) {
  if (!appWindow || appWindow.window.isDestroyed()) {
    return;
  }

  const index = appWindow.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) {
    return;
  }

  const [tab] = appWindow.tabs.splice(index, 1);
  appWindow.window.removeBrowserView(tab.view);
  if (!tab.view.webContents.isDestroyed()) {
    tab.view.webContents.close({ waitForBeforeUnload: false });
  }

  if (appWindow.tabs.length === 0) {
    if (appWindows.size > 1) {
      appWindow.window.close();
    } else {
      createBrowserTab(appWindow, APP_URL);
    }
    return;
  }

  if (appWindow.activeTabId === tabId) {
    const nextTab = appWindow.tabs[Math.max(0, index - 1)];
    appWindow.activeTabId = null;
    void activateBrowserTab(appWindow, nextTab.id);
  } else {
    sendTabsState(appWindow);
  }
}

function exec(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout, timeoutMs, env, ...execOptions } = options;
    const effectiveTimeoutMs = timeoutMs || timeout || 0;
    let settled = false;
    let timer = null;
    const child = execFile(command, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
      ...execOptions,
      env: commandEnvironment(command, env)
    }, (error, stdout, stderr) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    timer = effectiveTimeoutMs
      ? setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 1_000).unref?.();
        const error = new Error(`${command} ${args.join(" ")} не завершился за ${Math.round(effectiveTimeoutMs / 1000)} сек.`);
        error.stdout = "";
        error.stderr = "";
        error.timedOut = true;
        reject(error);
      }, effectiveTimeoutMs)
      : null;
  });
}

function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
      env: commandEnvironment(command, options.env)
    });
    let stdout = "";
    let stderr = "";
    let lastStatusAt = 0;
    let settled = false;
    const maxBufferedOutput = options.maxBufferedOutput || 1024 * 1024;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill("SIGTERM");
        const error = new Error(`${command} ${args.join(" ")} не завершился за ${Math.round(options.timeoutMs / 1000)} сек.`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.timedOut = true;
        reject(error);
      }, options.timeoutMs)
      : null;

    const appendOutput = (current, chunk) => {
      const next = current + chunk.toString();
      return next.length > maxBufferedOutput ? next.slice(-maxBufferedOutput) : next;
    };

    const cleanStatusLine = (value) => {
      return value
        .replace(/\u001b\[[0-9;]*m/g, "")
        .replace(/\r/g, "\n")
        .trim()
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-1)[0]
        ?.slice(0, 240);
    };

    const maybeSendStatus = (chunk) => {
      const now = Date.now();
      if (now - lastStatusAt < (options.statusThrottleMs || 750)) {
        return;
      }

      const lastLine = cleanStatusLine(chunk.toString());
      if (!lastLine) {
        return;
      }

      lastStatusAt = now;
      sendStatus(options.statusMessage || "Выполняю команду...", lastLine);
    };

    child.stdout.on("data", (chunk) => {
      stdout = appendOutput(stdout, chunk);
      maybeSendStatus(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendOutput(stderr, chunk);
      maybeSendStatus(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`${command} ${args.join(" ")} завершился с кодом ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

function parseJsonLines(stdout = "") {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

async function tryExec(command, args = [], options = {}) {
  try {
    return await exec(command, args, options);
  } catch (error) {
    return { stdout: "", stderr: error.stderr || error.message || "", error };
  }
}

async function tryRun(command, args = [], options = {}) {
  try {
    return await run(command, args, options);
  } catch (error) {
    return { stdout: error.stdout || "", stderr: error.stderr || error.message || "", error };
  }
}

function runtimeComposeFile() {
  return path.join(runtimeDir(), "docker-compose.yml");
}

function runtimeEnvFile() {
  return path.join(runtimeDir(), ".env");
}

function limaConfigPath() {
  return path.join(runtimeDir(), "segmentica-lima.yaml");
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function ensureLimaConfigFile() {
  const dir = runtimeDir();
  fs.mkdirSync(dir, { recursive: true });

  const configPath = limaConfigPath();
  const mountedRuntimeDir = runtimeDir();
  const config = [
    "# Generated by Segmentica. Do not edit while the app is running.",
    "minimumLimaVersion: 2.0.0",
    "base:",
    "  - template:_images/ubuntu",
    "  - template:_default/mounts",
    "containerd:",
    "  system: true",
    "  user: false",
    "mounts:",
    `  - location: ${yamlQuote(mountedRuntimeDir)}`,
    `    mountPoint: ${yamlQuote(mountedRuntimeDir)}`,
    "    writable: true",
    "portForwards:",
    "  - guestPort: 3000",
    "    hostPort: 3000",
    "    hostIP: 127.0.0.1",
    "  - guestPort: 3001",
    "    hostPort: 3001",
    "    hostIP: 127.0.0.1",
    "  - guestPort: 3010",
    "    hostPort: 3010",
    "    hostIP: 127.0.0.1",
    "  - guestPort: 31415",
    "    hostPort: 31415",
    "    hostIP: 127.0.0.1",
    "  - guestPort: 5439",
    "    hostPort: 5439",
    "    hostIP: 127.0.0.1",
    ""
  ].join("\n");

  fs.writeFileSync(configPath, config);
  return configPath;
}

function containerComposeCommand() {
  return isEmbeddedLimaRuntime() ? limaCommand() : "docker";
}

function limaNerdctlArgs(args) {
  return ["shell", LIMA_INSTANCE_NAME, "sudo", "nerdctl", ...args];
}

function containerComposeArgs(args) {
  if (isEmbeddedLimaRuntime()) {
    return limaNerdctlArgs(["compose", "-f", runtimeComposeFile(), "--env-file", runtimeEnvFile(), ...args]);
  }

  return ["compose", "-f", runtimeComposeFile(), "--env-file", runtimeEnvFile(), ...args];
}

function containerListCommand() {
  return isEmbeddedLimaRuntime() ? limaCommand() : "docker";
}

function containerListArgs() {
  if (isEmbeddedLimaRuntime()) {
    return limaNerdctlArgs(["ps", "-a", "--format", "{{.Names}}"]);
  }

  return ["ps", "-a", "--format", "{{.Names}}"];
}

function containerImageInspectCommand() {
  return isEmbeddedLimaRuntime() ? limaCommand() : "docker";
}

function containerImageInspectArgs(image) {
  if (isEmbeddedLimaRuntime()) {
    return limaNerdctlArgs(["image", "inspect", image]);
  }

  return ["image", "inspect", image];
}

function containerStartCommand() {
  return isEmbeddedLimaRuntime() ? limaCommand() : "docker";
}

function containerStartArgs(containerNames) {
  if (isEmbeddedLimaRuntime()) {
    return limaNerdctlArgs(["start", ...containerNames]);
  }

  return ["start", ...containerNames];
}

function containerStopCommand() {
  return isEmbeddedLimaRuntime() ? limaCommand() : "docker";
}

function containerStopArgs(containerNames) {
  if (isEmbeddedLimaRuntime()) {
    return limaNerdctlArgs(["stop", "--time", String(CONTAINER_STOP_TIMEOUT_SECONDS), ...containerNames]);
  }

  return ["stop", "--timeout", String(CONTAINER_STOP_TIMEOUT_SECONDS), ...containerNames];
}

function containerKillCommand() {
  return isEmbeddedLimaRuntime() ? limaCommand() : "docker";
}

function containerKillArgs(containerNames) {
  if (isEmbeddedLimaRuntime()) {
    return limaNerdctlArgs(["kill", ...containerNames]);
  }

  return ["kill", ...containerNames];
}

function embeddedStackScriptArgs() {
  return ["shell", LIMA_INSTANCE_NAME, "sudo", "/usr/local/sbin/segmentica-start-stack"];
}

async function hasEmbeddedStackScript() {
  return isEmbeddedLimaRuntime()
    && await hasCommand(limaCommand(), ["shell", LIMA_INSTANCE_NAME, "test", "-x", "/usr/local/sbin/segmentica-start-stack"]);
}

async function ensureEmbeddedContainerdIfPossible() {
  if (!isEmbeddedLimaRuntime()) {
    return;
  }

  if (await hasEmbeddedStackScript()) {
    await tryRun(limaCommand(), embeddedStackScriptArgs(), { statusMessage: "Проверяю окружение..." });
  }
}

async function hasCommand(command, args) {
  try {
    await exec(command, args);
    return true;
  } catch (error) {
    return false;
  }
}

async function ensureDockerDesktopStarted() {
  if (await hasCommand("docker", ["info"])) {
    return;
  }

  sendStatus("Запускаю Docker Desktop...", "Если Docker Desktop открывается впервые, дождитесь окончания его настройки.");

  if (process.platform === "darwin") {
    await exec("open", ["-ga", "Docker"]).catch(() => null);
  } else if (process.platform === "win32") {
    const dockerDesktop = path.join(process.env.ProgramFiles || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe");
    if (fs.existsSync(dockerDesktop)) {
      spawn(dockerDesktop, { detached: true, stdio: "ignore" }).unref();
    }
  }

  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await hasCommand("docker", ["info"])) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Docker Desktop установлен, но daemon не запустился.");
}

async function assertDockerAvailable() {
  const dockerExists = await hasCommand("docker", ["--version"]);
  if (!dockerExists) {
    throw new Error("Docker Desktop не найден.");
  }

  const composeExists = await hasCommand("docker", ["compose", "version"]);
  if (!composeExists) {
    throw new Error("Docker Compose не найден. Обновите Docker Desktop.");
  }

  await ensureDockerDesktopStarted();
}

async function ensureLimaAvailable() {
  if (process.platform !== "darwin") {
    throw new Error("Встроенная среда контейнеров пока поддерживается только на macOS.");
  }

  migrateLegacyLimaInstanceIfNeeded();
  const configPath = ensureLimaConfigFile();
  const limaExists = await hasCommand(limaCommand(), ["--version"]);
  if (!limaExists) {
    throw new Error("Встроенная среда контейнеров не найдена. Установите Lima: brew install lima");
  }

  const hasInstance = await hasCommand(limaCommand(), ["list", LIMA_INSTANCE_NAME]);
  if (hasInstance) {
    sendStatus("Запускаю встроенное окружение Segmentica...", `Среда: ${LIMA_INSTANCE_NAME}`);
    await run(limaCommand(), ["start", LIMA_INSTANCE_NAME], { statusMessage: "Запускаю виртуальную машину..." }).catch(() => null);
  } else {
    sendStatus("Создаю встроенное окружение Segmentica...", `Среда: ${LIMA_INSTANCE_NAME}`);
    await run(limaCommand(), [
      "start",
      "--tty=false",
      `--name=${LIMA_INSTANCE_NAME}`,
      configPath
    ], { statusMessage: "Создаю виртуальную машину..." });
  }

  await waitForEmbeddedLimaShell();
  await ensureEmbeddedContainerdIfPossible();
  try {
    await exec(limaCommand(), ["shell", LIMA_INSTANCE_NAME, "test", "-r", runtimeComposeFile()]);
    await exec(limaCommand(), ["shell", LIMA_INSTANCE_NAME, "test", "-r", runtimeEnvFile()]);
  } catch (error) {
    throw new Error(`Виртуальная машина не видит файлы окружения Segmentica. Удалите старую среду из папки данных Segmentica и запустите приложение снова.`);
  }
}

function migrateLegacyLimaInstanceIfNeeded() {
  if (!isEmbeddedLimaRuntime()) {
    return;
  }

  const targetDir = limaInstanceDir();
  const legacyDir = limaInstanceDir(legacyLimaHomeDir());
  if (fs.existsSync(targetDir) || !fs.existsSync(legacyDir)) {
    return;
  }

  fs.mkdirSync(limaHomeDir(), { recursive: true });
  sendStatus("Переношу виртуальную машину Segmentica...", "Сохраняю уже загруженные контейнеры и тома.");
  try {
    fs.renameSync(legacyDir, targetDir);
  } catch (error) {
    sendStatus("Не удалось автоматически перенести старую виртуальную машину", error.message);
  }
}

async function waitForEmbeddedLimaShell() {
  let lastError = "";
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = await tryExec(limaCommand(), limaNerdctlArgs(["version"]), {
      timeout: 5_000
    });
    if (!result.error) {
      return;
    }

    lastError = result.stderr || result.error.message || "";
    sendStatus("Жду готовность виртуальной машины...", lastError.split(/\r?\n/).filter(Boolean).slice(-1)[0] || "");
    await delay(2_000);
  }

  throw new Error(`Виртуальная машина запущена, но контейнерная среда не ответила. ${lastError}`.trim());
}

async function assertContainerRuntimeAvailable() {
  if (isEmbeddedLimaRuntime()) {
    await ensureLimaAvailable();
    return;
  }

  await assertDockerAvailable();
}

async function ensureRuntimeFiles() {
  const dir = runtimeDir();
  const marker = path.join(dir, `.release-${RELEASE_VERSION}`);
  const zipPath = releaseZipPath();

  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Не найден release-пакет: ${zipPath}`);
  }

  if (fs.existsSync(marker) && fs.existsSync(path.join(dir, "docker-compose.yml"))) {
    return;
  }

  sendStatus("Распаковываю пакет Segmentica...", dir);

  if (process.platform === "win32") {
    await exec("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -Path ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(dir)} -Force`
    ]);
  } else {
    await exec("unzip", ["-oq", zipPath, "-d", dir]);
  }

  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(path.join(dir, ".env.example"), envPath);
  }

  fs.writeFileSync(marker, new Date().toISOString());
}

async function imageExists(image) {
  return hasCommand(containerImageInspectCommand(), containerImageInspectArgs(image));
}

async function ensureImages() {
  const missing = [];
  for (const image of SERVICE_IMAGES) {
    if (!(await imageExists(image))) {
      missing.push(image);
    }
  }

  if (missing.length === 0) {
    return;
  }

  sendStatus("Скачиваю container images...", missing.join(", "));
  await run(containerComposeCommand(), containerComposeArgs(["pull"]), { statusMessage: "Скачиваю container images..." });
}

async function restoreSeedIfNeeded() {
  const dir = runtimeDir();
  const marker = path.join(dir, ".segmentica-seed-restored");
  const seed = path.join(dir, "seed", "Segmentica.dump");
  if (!fs.existsSync(seed) || fs.existsSync(marker)) {
    return;
  }

  sendStatus("Восстанавливаю заполненную базу...", "Это выполняется только при первом запуске.");
  await waitForDb();
  await run(containerComposeCommand(), containerComposeArgs([
    "exec",
    "-T",
    "db",
    "pg_restore",
    "-U",
    "postgres",
    "-d",
    "Segmentica",
    "--clean",
    "--if-exists",
    "/seed/Segmentica.dump"
  ]), { statusMessage: "Восстанавливаю базу..." });
  fs.writeFileSync(marker, new Date().toISOString());
}

async function waitForDb() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      await exec(containerComposeCommand(), containerComposeArgs(["exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", "Segmentica"]));
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error("PostgreSQL не успел запуститься.");
}

async function waitForApp() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetchWithTimeout(APP_URL, { method: "GET" }, 3_000);
      if (response.status < 500) {
        return;
      }
    } catch (error) {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Segmentica не успела запуститься.");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = APP_HEALTHCHECK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isAppAvailable() {
  try {
    const response = await fetchWithTimeout(APP_URL, { method: "GET" });
    return response.status < 500;
  } catch (error) {
    return false;
  }
}

function normalizeRuntimeRows(rows) {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const [key, value] of Object.entries(normalized)) {
      if (value == null) {
        normalized[key] = "";
      } else if (typeof value !== "string") {
        normalized[key] = String(value);
      }
    }
    return normalized;
  });
}

async function getEmbeddedLimaStatus() {
  const { stdout } = await tryExec(limaCommand(), ["list", LIMA_INSTANCE_NAME], {
    timeout: RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS
  });
  const line = stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LIMA_INSTANCE_NAME} `));

  if (!line) {
    return { exists: false, running: false, status: "Missing", ssh: "" };
  }

  const parts = line.split(/\s+/);
  return {
    exists: true,
    running: parts[1] === "Running",
    status: parts[1] || "Unknown",
    ssh: parts[2] || ""
  };
}

async function getVolumeSizes() {
  if (!isEmbeddedLimaRuntime()) {
    return new Map();
  }

  const { stdout } = await tryExec(limaCommand(), [
    "shell",
    LIMA_INSTANCE_NAME,
    "sudo",
    "sh",
    "-lc",
    "for d in /var/lib/nerdctl/1935db59/volumes/default/*/_data; do [ -d \"$d\" ] && du -sh \"$d\"; done"
  ], { timeout: RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS });
  const sizes = new Map();
  stdout.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^(\S+)\s+\/var\/lib\/nerdctl\/1935db59\/volumes\/default\/(.+)\/_data$/);
    if (match) {
      sizes.set(match[2], match[1]);
    }
  });
  return sizes;
}

async function getContainerLogs() {
  const script = [
    "set +e",
    "names=$(nerdctl ps -a --format '{{.Names}}' | grep '^segmentica-' | sort)",
    "if [ -z \"$names\" ]; then exit 0; fi",
    "tmp=$(mktemp)",
    "trap 'rm -f \"$tmp\"' EXIT",
    "for c in $names; do",
    `  nerdctl logs --tail ${RUNTIME_LOG_TAIL_PER_CONTAINER} --timestamps "$c" 2>&1 | sed "s/^\\\\([^ ]*\\\\) /\\\\1 [$c] /; t; s/^/[$c] /" >> "$tmp"`,
    "done",
    "sort \"$tmp\""
  ].join("\n");

  const dockerScript = [
    "set +e",
    "names=$(docker ps -a --format '{{.Names}}' | grep '^segmentica-' | sort)",
    "if [ -z \"$names\" ]; then exit 0; fi",
    "tmp=$(mktemp)",
    "trap 'rm -f \"$tmp\"' EXIT",
    "for c in $names; do",
    `  docker logs --tail ${RUNTIME_LOG_TAIL_PER_CONTAINER} --timestamps "$c" 2>&1 | sed "s/^\\\\([^ ]*\\\\) /\\\\1 [$c] /; t; s/^/[$c] /" >> "$tmp"`,
    "done",
    "sort \"$tmp\""
  ].join("\n");

  const result = isEmbeddedLimaRuntime()
    ? await tryExec(limaCommand(), ["shell", LIMA_INSTANCE_NAME, "sudo", "sh", "-lc", script], { timeout: RUNTIME_LOG_COMMAND_TIMEOUT_MS })
    : await tryExec("sh", ["-lc", dockerScript], { timeout: RUNTIME_LOG_COMMAND_TIMEOUT_MS });

  if (result.error) {
    return result.stderr || result.error.message || "Не удалось получить логи контейнеров.";
  }

  return result.stdout.trim();
}

async function collectRuntimeSnapshot() {
  const snapshot = {
    mode: CONTAINER_RUNTIME,
    label: containerRuntimeLabel(),
    control: { ...runtimeControlState },
    appUrl: APP_URL,
    appAvailable: await isAppAvailable(),
    lima: null,
    containers: [],
    images: [],
    volumes: [],
    networks: [],
    logs: "",
    error: ""
  };

  try {
    if (isEmbeddedLimaRuntime()) {
      snapshot.lima = await getEmbeddedLimaStatus();
      if (!snapshot.lima.running) {
        return snapshot;
      }

      const commandTimeout = { timeout: RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS };
      const [containers, images, volumes, networks, volumeSizes, logs] = await Promise.all([
        tryExec(limaCommand(), limaNerdctlArgs(["ps", "-a", "--format", "{{json .}}"]), commandTimeout),
        tryExec(limaCommand(), limaNerdctlArgs(["images", "--format", "{{json .}}"]), commandTimeout),
        tryExec(limaCommand(), limaNerdctlArgs(["volume", "ls", "--format", "{{json .}}"]), commandTimeout),
        tryExec(limaCommand(), limaNerdctlArgs(["network", "ls", "--format", "{{json .}}"]), commandTimeout),
        getVolumeSizes(),
        getContainerLogs()
      ]);
      snapshot.containers = normalizeRuntimeRows(parseJsonLines(containers.stdout));
      snapshot.images = normalizeRuntimeRows(parseJsonLines(images.stdout));
      snapshot.volumes = normalizeRuntimeRows(parseJsonLines(volumes.stdout)).map((volume) => ({
        ...volume,
        Size: volume.Size || volumeSizes.get(volume.Name) || ""
      }));
      snapshot.networks = normalizeRuntimeRows(parseJsonLines(networks.stdout));
      snapshot.logs = logs;
      snapshot.error = [containers, images, volumes, networks]
        .map((result) => result.error ? result.stderr : "")
        .filter(Boolean)
        .join("\n");
      return snapshot;
    }

    const commandTimeout = { timeout: RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS };
    const [containers, images, volumes, networks, logs] = await Promise.all([
      tryExec("docker", ["ps", "-a", "--format", "{{json .}}"], commandTimeout),
      tryExec("docker", ["images", "--format", "{{json .}}"], commandTimeout),
      tryExec("docker", ["volume", "ls", "--format", "{{json .}}"], commandTimeout),
      tryExec("docker", ["network", "ls", "--format", "{{json .}}"], commandTimeout),
      getContainerLogs()
    ]);
    snapshot.containers = normalizeRuntimeRows(parseJsonLines(containers.stdout));
    snapshot.images = normalizeRuntimeRows(parseJsonLines(images.stdout));
    snapshot.volumes = normalizeRuntimeRows(parseJsonLines(volumes.stdout));
    snapshot.networks = normalizeRuntimeRows(parseJsonLines(networks.stdout));
    snapshot.logs = logs;
    snapshot.error = [containers, images, volumes, networks]
      .map((result) => result.error ? result.stderr : "")
      .filter(Boolean)
      .join("\n");
    return snapshot;
  } catch (error) {
    snapshot.error = error.message;
    return snapshot;
  } finally {
    snapshot.control = { ...runtimeControlState, lastUpdatedAt: new Date().toISOString() };
  }
}

async function getExistingSegmenticaContainers() {
  try {
    const { stdout } = await exec(containerListCommand(), containerListArgs(), {
      timeout: RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS
    });
    return stdout
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter((name) => name.startsWith("segmentica-"));
  } catch (error) {
    return [];
  }
}

function getRuntimeContainerName(container) {
  return String(container?.Names || container?.Name || "").trim();
}

function isRuntimeContainerUp(container) {
  return String(container?.Status || "").toLowerCase().startsWith("up");
}

async function getSegmenticaContainerRows() {
  try {
    const args = isEmbeddedLimaRuntime()
      ? limaNerdctlArgs(["ps", "-a", "--format", "{{json .}}"])
      : ["ps", "-a", "--format", "{{json .}}"];
    const { stdout } = await exec(containerListCommand(), args, {
      timeout: RUNTIME_SNAPSHOT_COMMAND_TIMEOUT_MS
    });
    return normalizeRuntimeRows(parseJsonLines(stdout))
      .filter((container) => getRuntimeContainerName(container).startsWith("segmentica-"));
  } catch (error) {
    return [];
  }
}

async function startExistingSegmenticaContainersIfPossible() {
  const existingContainers = await getExistingSegmenticaContainers();
  const existingSet = new Set(existingContainers);
  const hasRequiredContainers = REQUIRED_CONTAINER_NAMES.every((name) => existingSet.has(name));

  if (!hasRequiredContainers) {
    return false;
  }

  const containersToStart = CONTAINER_START_ORDER.filter((name) => existingSet.has(name));
  if (containersToStart.length === 0) {
    return false;
  }

  if (await hasEmbeddedStackScript()) {
    sendStatus("Запускаю все сервисы Segmentica...", "/usr/local/sbin/segmentica-start-stack");
    await run(limaCommand(), embeddedStackScriptArgs(), { statusMessage: "Запускаю окружение..." });
    stackStartedByLauncher = true;
    existingContainersStartedByLauncher = true;
    existingContainerNamesStartedByLauncher = containersToStart;
    return true;
  }

  sendStatus("Запускаю существующие контейнеры Segmentica...", containersToStart.join(", "));
  await run(containerStartCommand(), containerStartArgs(containersToStart), { statusMessage: "Запускаю существующие контейнеры..." });
  stackStartedByLauncher = true;
  existingContainersStartedByLauncher = true;
  existingContainerNamesStartedByLauncher = containersToStart;
  return true;
}

async function trackExistingSegmenticaContainersIfPossible() {
  const existingContainers = await getExistingSegmenticaContainers();
  const existingSet = new Set(existingContainers);
  const hasRequiredContainers = REQUIRED_CONTAINER_NAMES.every((name) => existingSet.has(name));

  if (!hasRequiredContainers) {
    return;
  }

  stackStartedByLauncher = true;
  existingContainersStartedByLauncher = true;
  existingContainerNamesStartedByLauncher = CONTAINER_START_ORDER.filter((name) => existingSet.has(name));
}

async function startStack() {
  if (await isAppAvailable()) {
    sendStatus("Segmentica уже запущена", APP_URL);
    await trackExistingSegmenticaContainersIfPossible();
    sendReady(APP_URL);
    return;
  }

  await ensureRuntimeFiles();
  sendStatus(`Проверяю окружение: ${containerRuntimeLabel()}...`, "");
  await assertContainerRuntimeAvailable();

  sendStatus("Запускаю контейнеры Segmentica...", "");
  let usedExistingContainers = false;
  try {
    usedExistingContainers = await startExistingSegmenticaContainersIfPossible();
    if (!usedExistingContainers) {
      await ensureImages();
      await run(containerComposeCommand(), containerComposeArgs(["up", "-d", "--remove-orphans"]), { statusMessage: "Запускаю контейнеры..." });
      stackStartedByLauncher = true;
    }
  } catch (error) {
    if (await isAppAvailable()) {
      sendStatus("Segmentica уже запущена", APP_URL);
      sendReady(APP_URL);
      return;
    }

    const details = [error.message, error.stderr, error.stdout].filter(Boolean).join("\n\n");
    throw new Error(details);
  }

  if (!usedExistingContainers) {
    await restoreSeedIfNeeded();
  }

  sendStatus("Жду запуск сайта...", APP_URL);
  await waitForApp();

  sendStatus("Готово", APP_URL);
  sendReady(APP_URL);
}

async function showStartupError(error) {
  sendStatus("Не удалось запустить Segmentica", error.message);

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Segmentica",
    message: "Не удалось запустить Segmentica",
    detail: `${error.message}\n\nТекущее окружение: ${containerRuntimeLabel()}.`,
    buttons: [isEmbeddedLimaRuntime() ? "Открыть инструкцию" : "Скачать Docker Desktop", "Закрыть"],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    shell.openExternal(isEmbeddedLimaRuntime() ? LIMA_INSTALL_URL : DOCKER_DESKTOP_URL);
  }
}

function startStackOnce() {
  if (!stackStartPromise) {
    stackStartPromise = startStack().finally(() => {
      stackStartPromise = null;
    }).catch(async (error) => {
      await showStartupError(error);
      throw error;
    });
  }

  return stackStartPromise;
}

function closeAllBrowserTabs() {
  for (const appWindow of appWindows.values()) {
    if (appWindow.window.isDestroyed()) {
      continue;
    }
    for (const tab of appWindow.tabs) {
      appWindow.window.removeBrowserView(tab.view);
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close({ waitForBeforeUnload: false });
      }
    }
    appWindow.tabs = [];
    appWindow.runtimeTabOpen = false;
    appWindow.activeTabId = null;
    sendTabsState(appWindow);
  }
}

function openRuntimeDashboardTab(appWindow) {
  if (!appWindow || appWindow.window.isDestroyed()) {
    return;
  }

  const activeTab = findBrowserTab(appWindow.activeTabId);
  if (activeTab) {
    appWindow.window.removeBrowserView(activeTab.view);
  }
  appWindow.runtimeTabOpen = true;
  appWindow.activeTabId = RUNTIME_TAB_ID;
  sendStatus("Панель окружения", "Контейнеры продолжают работать.");
  sendTabsState(appWindow);
}

async function showRuntimeDashboard(appWindow) {
  openRuntimeDashboardTab(appWindow);
  return collectRuntimeSnapshot();
}

async function stopRuntimeStack() {
  const existingContainers = await getSegmenticaContainerRows();
  const runningContainers = existingContainers
    .filter(isRuntimeContainerUp)
    .map(getRuntimeContainerName)
    .filter(Boolean);
  const existingSet = new Set(runningContainers);
  const orderedContainers = [
    ...CONTAINER_START_ORDER.filter((name) => existingSet.has(name)).reverse(),
    ...runningContainers.filter((name) => !CONTAINER_START_ORDER.includes(name))
  ];

  if (orderedContainers.length === 0) {
    return;
  }

  const stopped = await tryRun(containerStopCommand(), containerStopArgs(orderedContainers), {
    statusMessage: "Останавливаю контейнеры...",
    timeoutMs: CONTAINER_STOP_COMMAND_TIMEOUT_MS
  });

  if (!stopped.error) {
    return;
  }

  const stillRunning = (await getSegmenticaContainerRows())
    .filter(isRuntimeContainerUp)
    .map(getRuntimeContainerName)
    .filter(Boolean);

  if (stillRunning.length === 0) {
    return;
  }

  sendStatus("Принудительно останавливаю контейнеры...", stillRunning.join(", "));
  await run(containerKillCommand(), containerKillArgs(stillRunning), {
    statusMessage: "Принудительно останавливаю контейнеры...",
    timeoutMs: CONTAINER_KILL_COMMAND_TIMEOUT_MS
  });
}

async function stopRuntimeAndShowDashboard() {
  runtimeControlState = { mode: "stopping", lastUpdatedAt: new Date().toISOString() };
  sendStatus("Останавливаю контейнеры Segmentica...", "После остановки откроется панель окружения.");
  closeAllBrowserTabs();
  sendStopped();
  await stopRuntimeStack();
  stackStartedByLauncher = false;
  existingContainersStartedByLauncher = false;
  existingContainerNamesStartedByLauncher = [];
  runtimeControlState = { mode: "idle", lastUpdatedAt: new Date().toISOString() };
  sendStatus("Контейнеры остановлены", "Можно снова запустить окружение из панели.");
}

async function stopRuntimeAndQuit() {
  shutdownRequested = true;
  runtimeControlState = { mode: "stopping", lastUpdatedAt: new Date().toISOString() };
  sendStatus("Завершаю Segmentica...", "Останавливаю контейнеры перед закрытием.");
  try {
    await stopRuntimeStack();
    stackStartedByLauncher = false;
    existingContainersStartedByLauncher = false;
    existingContainerNamesStartedByLauncher = [];
  } catch (error) {
    sendStatus("Не удалось штатно остановить контейнеры", "Пробую принудительную остановку перед закрытием.");
    const stillRunning = (await getSegmenticaContainerRows())
      .filter(isRuntimeContainerUp)
      .map(getRuntimeContainerName)
      .filter(Boolean);
    if (stillRunning.length > 0) {
      await tryRun(containerKillCommand(), containerKillArgs(stillRunning), {
        statusMessage: "Принудительно останавливаю контейнеры...",
        timeoutMs: CONTAINER_KILL_COMMAND_TIMEOUT_MS
      });
    }
  } finally {
    sendStatus("Закрываю Segmentica...", "Контейнеры остановлены.");
    app.quit();
  }
}

function stopStackInBackground() {
  if (shutdownRequested || !stackStartedByLauncher) {
    return;
  }
  shutdownRequested = true;

  try {
    const command = containerStopCommand();
    const names = existingContainerNamesStartedByLauncher.length > 0
      ? existingContainerNamesStartedByLauncher
      : CONTAINER_START_ORDER;
    const args = containerStopArgs([...names].reverse());
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      env: commandEnvironment(command)
    });
    child.unref();
  } catch (error) {
    // The app is closing; never block quit on Docker shutdown issues.
  }
}

function createWindow() {
  const appWindow = createShellWindow({ showStartup: true });
  appWindow.window.setSize(1440, 920);
  appWindow.window.setMinimumSize(1120, 720);
}

function installApplicationMenu() {
  const reloadActiveTab = (_menuItem, browserWindow) => {
    const appWindow = getAppWindowByBrowserWindow(browserWindow || BrowserWindow.getFocusedWindow());
    const activeTab = findBrowserTab(appWindow?.activeTabId);
    if (activeTab && !activeTab.view.webContents.isDestroyed()) {
      activeTab.view.webContents.reload();
    }
  };

  const template = [
    {
      label: "Segmentica",
      submenu: [
        { role: "about", label: "О Segmentica" },
        { type: "separator" },
        { role: "services", label: "Службы" },
        { type: "separator" },
        { role: "hide", label: "Скрыть Segmentica" },
        { role: "hideOthers", label: "Скрыть остальные" },
        { role: "unhide", label: "Показать все" },
        { type: "separator" },
        { role: "quit", label: "Выйти из Segmentica" }
      ]
    },
    {
      label: "Файл",
      submenu: [
        {
          label: "Новая вкладка",
          accelerator: "CmdOrCtrl+T",
          click: (_menuItem, browserWindow) => {
            createBrowserTab(getAppWindowByBrowserWindow(browserWindow || BrowserWindow.getFocusedWindow()), APP_URL);
          }
        },
        {
          label: "Закрыть вкладку",
          accelerator: "CmdOrCtrl+W",
          click: (_menuItem, browserWindow) => {
            const appWindow = getAppWindowByBrowserWindow(browserWindow || BrowserWindow.getFocusedWindow());
            if (appWindow?.activeTabId) {
              closeBrowserTab(appWindow, appWindow.activeTabId);
            }
          }
        }
      ]
    },
    { role: "editMenu", label: "Правка" },
    {
      label: "Вид",
      submenu: [
        {
          label: "Перезагрузить вкладку",
          accelerator: "CmdOrCtrl+R",
          click: reloadActiveTab
        },
        {
          label: "Принудительно перезагрузить вкладку",
          accelerator: "CmdOrCtrl+Shift+R",
          click: (_menuItem, browserWindow) => {
            const appWindow = getAppWindowByBrowserWindow(browserWindow || BrowserWindow.getFocusedWindow());
            const activeTab = findBrowserTab(appWindow?.activeTabId);
            if (activeTab && !activeTab.view.webContents.isDestroyed()) {
              activeTab.view.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: "separator" },
        { role: "toggleDevTools", label: "Инструменты разработчика" },
        { role: "togglefullscreen", label: "Во весь экран" }
      ]
    },
    { role: "windowMenu", label: "Окно" },
    { role: "help", label: "Справка", submenu: [] }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("launcher:open-docker-download", async () => {
  await shell.openExternal(isEmbeddedLimaRuntime() ? LIMA_INSTALL_URL : DOCKER_DESKTOP_URL);
});

ipcMain.handle("launcher:open-runtime-folder", async () => {
  await shell.openPath(app.getPath("userData"));
});

ipcMain.handle("launcher:get-ready-state", () => launcherReadyState);

ipcMain.handle("launcher:get-app-icon", () => {
  if (!fs.existsSync(STARTUP_ICON_PATH)) {
    return null;
  }
  return `data:image/png;base64,${fs.readFileSync(STARTUP_ICON_PATH).toString("base64")}`;
});

ipcMain.handle("launcher:renderer-ready", async (event) => {
  const appWindow = getAppWindowFromEvent(event);
  sendTabsState(appWindow);
  return {
    ready: launcherReadyState,
    status: launcherStatusState,
    runtimeState: await collectRuntimeSnapshot(),
    theme: currentTheme,
    runtime: {
      mode: CONTAINER_RUNTIME,
      label: containerRuntimeLabel(),
      helpLabel: "Справка"
    },
    windowId: appWindow?.id ?? null,
    hasTabs: Boolean(appWindow?.tabs.length),
    showStartup: appWindow?.showStartup !== false
  };
});

ipcMain.handle("runtime:get-state", async () => {
  return collectRuntimeSnapshot();
});

ipcMain.handle("runtime:start", async () => {
  runtimeControlState = { mode: "starting", lastUpdatedAt: new Date().toISOString() };
  sendStatus("Запускаю контейнеры Segmentica...", containerRuntimeLabel());
  try {
    await startStackOnce();
    runtimeControlState = { mode: "running", lastUpdatedAt: new Date().toISOString() };
  } catch (error) {
    runtimeControlState = { mode: "error", lastUpdatedAt: new Date().toISOString() };
  }
  return collectRuntimeSnapshot();
});

ipcMain.handle("runtime:stop", async () => {
  await stopRuntimeAndShowDashboard();
  return collectRuntimeSnapshot();
});

ipcMain.handle("runtime:show-dashboard", async (event) => {
  return showRuntimeDashboard(getAppWindowFromEvent(event));
});

ipcMain.handle("runtime:quit", async () => {
  await stopRuntimeAndQuit();
});

ipcMain.handle("tabs:create", (event, url = APP_URL) => {
  createBrowserTab(getAppWindowFromEvent(event), url);
});

ipcMain.handle("tabs:activate", (event, tabId) => {
  return activateBrowserTab(getAppWindowFromEvent(event), tabId);
});

ipcMain.handle("tabs:close", (event, tabId) => {
  closeBrowserTab(getAppWindowFromEvent(event), tabId);
});

ipcMain.handle("tabs:move", (event, tabId, targetIndex) => {
  moveBrowserTab(tabId, getAppWindowFromEvent(event), targetIndex);
});

ipcMain.handle("tabs:drag-start", (event, tabId) => {
  const appWindow = getAppWindowFromEvent(event);
  draggedTab = appWindow ? { tabId, sourceWindowId: appWindow.id, moved: false } : null;
});

ipcMain.handle("tabs:finish-drag", (_event, tabId, point, shouldDetach) => {
  if (draggedTab?.tabId === tabId && !draggedTab.moved && shouldDetach) {
    detachBrowserTab(tabId, point);
  }
  if (draggedTab?.tabId === tabId) {
    draggedTab = null;
  }
});

ipcMain.handle("tabs:update-bounds", (event, bounds) => {
  const appWindow = getAppWindowFromEvent(event);
  if (!appWindow) {
    return;
  }
  appWindow.viewBounds = sanitizeViewBounds(appWindow, bounds);
  updateActiveBrowserViewBounds(appWindow);
});

ipcMain.on("theme:changed", (event, theme) => {
  const owner = [...appWindows.values()]
    .find((appWindow) => appWindow.tabs.some((candidate) => candidate.view.webContents.id === event.sender.id));
  if (!owner) {
    return;
  }

  const tab = owner.tabs.find((candidate) => candidate.view.webContents.id === event.sender.id);
  if (!tab || owner.activeTabId !== tab.id) {
    return;
  }

  applyBrowserTabTheme(tab, theme);
});

app.whenReady().then(() => {
  if (process.platform === "darwin" && fs.existsSync(DOCK_ICON_PATH)) {
    app.dock.setIcon(DOCK_ICON_PATH);
  }
  app.setAboutPanelOptions({
    applicationName: "Segmentica",
    applicationVersion: RELEASE_VERSION,
    iconPath: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined
  });
  installApplicationMenu();
  createWindow();
});

app.on("before-quit", () => {
  stopStackInBackground();
});

app.on("window-all-closed", () => {
  app.quit();
});
