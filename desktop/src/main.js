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

let mainWindow;
let shutdownRequested = false;
let stackStartedByLauncher = false;
let existingContainersStartedByLauncher = false;
let existingContainerNamesStartedByLauncher = [];
let stackStartPromise = null;
let launcherReadyState = { ready: false, url: APP_URL };
let launcherStatusState = { message: "Подготовка...", detail: "Проверяю окружение" };
let nextWindowId = 1;
let nextTabId = 1;
const appWindows = new Map();
let draggedTab = null;
let currentTheme = "dark";

function themeBackground(theme = currentTheme) {
  return theme === "light" ? "#ffffff" : "#08090a";
}

function runtimeDir() {
  return path.join(app.getPath("userData"), "runtime");
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
  appWindow.window.webContents.send("tabs:state", {
    windowId: appWindow.id,
    activeTabId: appWindow.activeTabId,
    activeTheme: activeTab?.theme || currentTheme,
    tabs: appWindow.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      theme: tab.theme || currentTheme
    }))
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
  return `(function(){var theme=${JSON.stringify(theme)};try{window.localStorage.setItem("segmentica-theme",theme);}catch(e){}var apply=function(target){if(!target)return;target.classList.toggle("dark",theme==="dark");target.classList.toggle("light",theme==="light");target.dataset.theme=theme;target.style.colorScheme=theme;};apply(document.documentElement);apply(document.body);}())`;
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

async function activateBrowserTab(appWindow, tabId) {
  if (!appWindow || appWindow.window.isDestroyed()) {
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
  await applyThemeToTabPage(nextTab, currentTheme);
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
    execFile(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 20, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lastLine = stdout.trim().split(/\r?\n/).slice(-1)[0];
      if (lastLine) {
        sendStatus(options.statusMessage || "Выполняю команду...", lastLine);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const lastLine = stderr.trim().split(/\r?\n/).slice(-1)[0];
      if (lastLine) {
        sendStatus(options.statusMessage || "Выполняю команду...", lastLine);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
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

function dockerComposeArgs(args) {
  return ["compose", "-f", path.join(runtimeDir(), "docker-compose.yml"), "--env-file", path.join(runtimeDir(), ".env"), ...args];
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
  return hasCommand("docker", ["image", "inspect", image]);
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

  sendStatus("Скачиваю Docker images...", missing.join(", "));
  await run("docker", dockerComposeArgs(["pull"]), { statusMessage: "Скачиваю Docker images..." });
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
  await run("docker", dockerComposeArgs([
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
      await exec("docker", dockerComposeArgs(["exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", "Segmentica"]));
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
      const response = await fetch(APP_URL, { method: "GET" });
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

async function isAppAvailable() {
  try {
    const response = await fetch(APP_URL, { method: "GET" });
    return response.status < 500;
  } catch (error) {
    return false;
  }
}

async function getExistingSegmenticaContainers() {
  try {
    const { stdout } = await exec("docker", ["ps", "-a", "--format", "{{.Names}}"]);
    return stdout
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter((name) => name.startsWith("segmentica-"));
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

  sendStatus("Запускаю существующие контейнеры Segmentica...", containersToStart.join(", "));
  await run("docker", ["start", ...containersToStart], { statusMessage: "Запускаю существующие контейнеры..." });
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

  sendStatus("Проверяю Docker...", "");
  await assertDockerAvailable();
  await ensureRuntimeFiles();

  sendStatus("Запускаю контейнеры Segmentica...", "");
  let usedExistingContainers = false;
  try {
    usedExistingContainers = await startExistingSegmenticaContainersIfPossible();
    if (!usedExistingContainers) {
      await ensureImages();
      await run("docker", dockerComposeArgs(["up", "-d", "--remove-orphans"]), { statusMessage: "Запускаю контейнеры..." });
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
    detail: `${error.message}\n\nЕсли Docker Desktop не установлен, установите его и запустите приложение снова.`,
    buttons: ["Скачать Docker Desktop", "Закрыть"],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    shell.openExternal(DOCKER_DESKTOP_URL);
  }
}

function startStackOnce() {
  if (!stackStartPromise) {
    stackStartPromise = startStack().catch(async (error) => {
      stackStartPromise = null;
      await showStartupError(error);
    });
  }

  return stackStartPromise;
}

function stopStackInBackground() {
  if (shutdownRequested || !stackStartedByLauncher) {
    return;
  }
  shutdownRequested = true;

  try {
    const args = existingContainersStartedByLauncher
      ? ["stop", ...existingContainerNamesStartedByLauncher]
      : dockerComposeArgs(["down", "--remove-orphans"]);
    const child = spawn("docker", args, {
      detached: true,
      stdio: "ignore"
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
    { role: "fileMenu", label: "Файл" },
    { role: "editMenu", label: "Правка" },
    { role: "viewMenu", label: "Вид" },
    { role: "windowMenu", label: "Окно" },
    { role: "help", label: "Справка", submenu: [] }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("launcher:open-docker-download", async () => {
  await shell.openExternal(DOCKER_DESKTOP_URL);
});

ipcMain.handle("launcher:open-runtime-folder", async () => {
  await shell.openPath(runtimeDir());
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
  await startStackOnce();
  sendTabsState(appWindow);
  return {
    ready: launcherReadyState,
    status: launcherStatusState,
    theme: currentTheme,
    windowId: appWindow?.id ?? null,
    hasTabs: Boolean(appWindow?.tabs.length),
    showStartup: appWindow?.showStartup !== false
  };
});

ipcMain.handle("launcher:close-app", (event) => {
  const appWindow = getAppWindowFromEvent(event);
  if (appWindow && !appWindow.window.isDestroyed()) {
    appWindow.window.close();
  }
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

ipcMain.handle("tabs:reload-active", (event) => {
  const appWindow = getAppWindowFromEvent(event);
  const activeTab = findBrowserTab(appWindow?.activeTabId);
  if (activeTab && !activeTab.view.webContents.isDestroyed()) {
    activeTab.view.webContents.reload();
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
