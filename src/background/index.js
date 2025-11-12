const FONT_LINKS = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Beiruti:wght@200..900&family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap",
  },
];

const CSS = `
  html {
    direction: rtl;
    text-align: right;
  }

  html,
  body,
  body *:not(code):not(pre):not(mat-icon):not(kbd):not(samp):not(.code):not(.hljs):not(.highlight):not(.katex):not([class*="code"]):not([class*="hljs"]):not([class*="katex" i]):not(:is(.katex *)):not(:is([class*="katex" i] *)) {
    font-family: "IBM Plex Sans Arabic", "IBM Plex Sans", sans-serif !important;
  }

  code, pre, kbd, samp, .code, .hljs, .highlight,
  *[class*="code"], *[class*="hljs"] {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: isolate;
    font-family: "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace !important;
  }

  .katex,
  *[class*="katex" i],
  .katex *,
  *[class*="katex" i] * {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: isolate;
  }

  rich-textarea > div {
    direction: rtl !important;
    text-align: right !important;
    unicode-bidi: isolate;
  }
`;

const STYLE_ATTR = "data-rtl-ext-style";

const ICON_SIZES = ["16", "24", "32"];

function getIconPaths(isOn) {
  const variant = isOn ? "on" : "off";
  return ICON_SIZES.reduce((paths, size) => {
    paths[size] = chrome.runtime.getURL(`assets/icons/${variant}-${size}.png`);
    return paths;
  }, {});
}

const storage = chrome.storage?.session ?? chrome.storage.local;

async function addFontLinks(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (links) => {
      const root = document.head || document.documentElement;
      if (!root) return;
      const attr = "data-rtl-ext-font";
      links.forEach((link) => {
        const href = link.href ?? "";
        if (href && root.querySelector(`link[${attr}="${href}"]`)) return;
        const el = document.createElement("link");
        el.rel = link.rel;
        if (href) el.href = href;
        if (link.crossorigin !== undefined) {
          el.setAttribute("crossorigin", link.crossorigin);
        }
        el.setAttribute(attr, href || link.rel);
        root.appendChild(el);
      });
    },
    args: [FONT_LINKS],
  });
}

async function addStyleTag(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (css, attrName) => {
      const root = document.head || document.documentElement;
      if (!root) return;
      const selector = `style[${attrName}]`;
      let style = root.querySelector(selector);
      if (!style) {
        style = document.createElement("style");
        style.type = "text/css";
        style.setAttribute(attrName, "true");
        root.appendChild(style);
      }
      if (style.textContent !== css) {
        style.textContent = css;
      }
    },
    args: [CSS, STYLE_ATTR],
  });
}

async function removeFontLinks(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      document
        .querySelectorAll('link[data-rtl-ext-font]')
        .forEach((el) => el.remove());
    },
  });
}

async function getMap() {
  const data = await storage.get("rtlTabs");
  return data.rtlTabs || {};
}

async function getTabState(tabId) {
  const map = await getMap();
  return Boolean(map[tabId]);
}

async function setTabState(tabId, isOn) {
  const map = await getMap();
  map[tabId] = isOn;
  await storage.set({ rtlTabs: map });
}

async function removeTabState(tabId) {
  const map = await getMap();
  if (tabId in map) {
    delete map[tabId];
    await storage.set({ rtlTabs: map });
  }
}

function setIconForTab(tabId, isOn) {
  chrome.action.setIcon({ tabId, path: getIconPaths(isOn) });
  chrome.action.setTitle({ tabId, title: isOn ? "RTL: On" : "RTL: Off" });
}

async function removeStyleTag(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attrName) => {
      document
        .querySelectorAll(`style[${attrName}]`)
        .forEach((el) => el.remove());
    },
    args: [STYLE_ATTR],
  });
}

async function applyToTab(tabId, isOn) {
  if (!tabId) return;
  try {
    if (isOn) {
      await addFontLinks(tabId);
      await addStyleTag(tabId);
    } else {
      await removeStyleTag(tabId);
      // Remove legacy injected CSS in case older versions used insertCSS.
      try {
        await chrome.scripting.removeCSS({ target: { tabId }, css: CSS });
      } catch (err) {
        // Ignore if stylesheet is already gone or was never inserted via insertCSS.
      }
      await removeFontLinks(tabId);
    }
  } catch (err) {
    // Restricted pages (chrome://, Web Store, etc.) or missing activeTab grant
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Start with an empty per-tab state map
  await storage.set({ rtlTabs: {} });
});

chrome.runtime.onStartup.addListener(async () => {
  // Sync active tab's icon with stored state
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    const isOn = await getTabState(tab.id);
    setIconForTab(tab.id, isOn);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  const current = await getTabState(tab.id);
  const next = !current;
  await setTabState(tab.id, next);
  setIconForTab(tab.id, next);
  await applyToTab(tab.id, next);
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "toggle-rtl") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const current = await getTabState(tab.id);
  const next = !current;
  await setTabState(tab.id, next);
  setIconForTab(tab.id, next);
  await applyToTab(tab.id, next);
});

// When active tab changes, sync its icon
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const isOn = await getTabState(tabId);
  setIconForTab(tabId, isOn);
});

// When window focus changes, update the active tab's icon
chrome.windows.onFocusChanged.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    const isOn = await getTabState(tab.id);
    setIconForTab(tab.id, isOn);
  }
});

// After tab load/refresh, re-apply CSS if state is On
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === "complete") {
    const isOn = await getTabState(tabId);
    setIconForTab(tabId, isOn);
    if (isOn) {
      await applyToTab(tabId, true);
    }
  }
});

// Clean up state when tab closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabState(tabId);
});
