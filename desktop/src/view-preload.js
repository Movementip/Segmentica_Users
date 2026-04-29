const { contextBridge, ipcRenderer } = require("electron");

function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  const root = document.documentElement;
  const body = document.body;

  let styleNode = document.getElementById("segmentica-electron-theme-lock");
  if (!styleNode) {
    styleNode = document.createElement("style");
    styleNode.id = "segmentica-electron-theme-lock";
    styleNode.textContent = [
      ":root[data-theme-transition-disabled] *",
      ":root[data-theme-transition-disabled] *::before",
      ":root[data-theme-transition-disabled] *::after",
      "body[data-theme-transition-disabled] *",
      "body[data-theme-transition-disabled] *::before",
      "body[data-theme-transition-disabled] *::after{",
      "-webkit-transition:none!important;",
      "transition:none!important;",
      "-webkit-animation:none!important;",
      "animation:none!important;",
      "animation-duration:0s!important;",
      "animation-delay:0s!important;",
      "transition-duration:0s!important;",
      "transition-delay:0s!important;",
      "}"
    ].join("");
    document.head?.appendChild(styleNode);
  }

  root.dataset.themeTransitionDisabled = "true";
  if (body) {
    body.dataset.themeTransitionDisabled = "true";
  }

  try {
    window.localStorage.setItem("segmentica-theme", nextTheme);
  } catch {
    // ignore storage failures
  }

  const apply = (target) => {
    if (!target) return;
    target.classList.toggle("dark", nextTheme === "dark");
    target.classList.toggle("light", nextTheme === "light");
    target.dataset.theme = nextTheme;
    target.style.colorScheme = nextTheme;
  };

  apply(root);
  apply(body);

  window.clearTimeout(window.__segmenticaElectronThemeUnlock);
  window.__segmenticaElectronThemeUnlock = window.setTimeout(() => {
    delete root.dataset.themeTransitionDisabled;
    if (document.body) {
      delete document.body.dataset.themeTransitionDisabled;
    }
    document.getElementById("segmentica-electron-theme-lock")?.remove();
  }, 180);

  return nextTheme;
}

const themeListeners = new Set();

function emitThemeToPage(theme) {
  const nextTheme = applyTheme(theme);
  for (const listener of themeListeners) {
    listener(nextTheme);
  }
}

ipcRenderer.on("theme:apply", (_event, theme) => {
  emitThemeToPage(theme);
});

contextBridge.exposeInMainWorld("segmenticaElectronTheme", {
  setTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    ipcRenderer.send("theme:changed", nextTheme);
  },
  onThemeChanged(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    themeListeners.add(callback);
    return () => {
      themeListeners.delete(callback);
    };
  }
});
