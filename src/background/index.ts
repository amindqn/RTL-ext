type FontLink = {
  rel: string;
  href?: string;
  crossorigin?: string;
};

type TabStateMap = Record<string, boolean>;

const FONT_LINKS: FontLink[] = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Beiruti:wght@200..900&family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap",
  },
];

const INJECTED_CSS = `
  html {
    direction: rtl;
    text-align: right;
  }

  html,
  body,
  body *:not(code):not(pre):not(kbd):not(samp):not(.code):not(.hljs):not(.highlight):not(.katex):not([class*="code"]):not([class*="hljs"]):not([class*="katex" i]):not(:is(.katex *)):not(:is([class*="katex" i] *)) {
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
`;

const STYLE_ATTR = "data-rtl-ext-style";
const FONT_ATTR = "data-rtl-ext-font";

const ICON_SIZES = ["16", "24", "32"];

function getIconPaths(isOn: boolean): Record<string, string> {
  const variant = isOn ? "on" : "off";
  return ICON_SIZES.reduce<Record<string, string>>((paths, size) => {
    paths[size] = chrome.runtime.getURL(`assets/icons/${variant}-${size}.png`);
    return paths;
  }, {});
}

const storage = (chrome.storage?.session ?? chrome.storage.local) as chrome.storage.StorageArea;

async function addFontLinks(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (links: FontLink[], attr: string) => {
      const root = document.head ?? document.documentElement;
      if (!root) return;
      links.forEach((link: FontLink) => {
        const href = link.href ?? "";
        if (href && root.querySelector(`link[${attr}="${href}"]`)) {
          return;
        }
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
    args: [FONT_LINKS, FONT_ATTR],
  });
}

async function addStyleTag(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (css: string, attrName: string) => {
      const root = document.head ?? document.documentElement;
      if (!root) return;
      const selector = `style[${attrName}]`;
      let style = root.querySelector<HTMLStyleElement>(selector);
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
    args: [INJECTED_CSS, STYLE_ATTR],
  });
}

async function removeFontLinks(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attr: string) => {
      document
        .querySelectorAll(`link[${attr}]`)
        .forEach((el) => el.remove());
    },
    args: [FONT_ATTR],
  });
}

async function getMap(): Promise<TabStateMap> {
  const data = (await storage.get("rtlTabs")) as { rtlTabs?: TabStateMap };
  return data.rtlTabs ?? {};
}

async function getTabState(tabId: number): Promise<boolean> {
  const map = await getMap();
  return Boolean(map[String(tabId)]);
}

async function setTabState(tabId: number, isOn: boolean): Promise<void> {
  const map = await getMap();
  map[String(tabId)] = isOn;
  await storage.set({ rtlTabs: map });
}

async function removeTabState(tabId: number): Promise<void> {
  const map = await getMap();
  const key = String(tabId);
  if (key in map) {
    delete map[key];
    await storage.set({ rtlTabs: map });
  }
}

function setIconForTab(tabId: number, isOn: boolean): void {
  chrome.action.setIcon({ tabId, path: getIconPaths(isOn) });
  chrome.action.setTitle({ tabId, title: isOn ? "RTL: On" : "RTL: Off" });
}

async function removeStyleTag(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attrName: string) => {
      document
        .querySelectorAll(`style[${attrName}]`)
        .forEach((el) => el.remove());
    },
    args: [STYLE_ATTR],
  });
}

async function applyToTab(tabId: number, isOn: boolean): Promise<void> {
  if (!tabId) return;
  try {
    if (isOn) {
      await addFontLinks(tabId);
      await addStyleTag(tabId);
    } else {
      await removeStyleTag(tabId);
      // Remove legacy injected CSS in case older versions used insertCSS.
      try {
        await chrome.scripting.removeCSS({ target: { tabId }, css: INJECTED_CSS });
      } catch (error: unknown) {
        // Ignore if stylesheet is already gone or was never inserted via insertCSS.
      }
      await removeFontLinks(tabId);
    }
  } catch (error: unknown) {
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

chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (!tab?.id) return;
  const current = await getTabState(tab.id);
  const next = !current;
  await setTabState(tab.id, next);
  setIconForTab(tab.id, next);
  await applyToTab(tab.id, next);
});

chrome.commands?.onCommand.addListener(async (command: string) => {
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
chrome.tabs.onActivated.addListener(async ({ tabId }: chrome.tabs.TabActiveInfo) => {
  const isOn = await getTabState(tabId);
  setIconForTab(tabId, isOn);
});

// When window focus changes, update the active tab's icon
chrome.windows.onFocusChanged.addListener(async (_windowId: number) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    const isOn = await getTabState(tab.id);
    setIconForTab(tab.id, isOn);
  }
});

// After tab load/refresh, re-apply CSS if state is On
chrome.tabs.onUpdated.addListener(async (tabId: number, info: chrome.tabs.TabChangeInfo) => {
  if (info.status === "complete") {
    const isOn = await getTabState(tabId);
    setIconForTab(tabId, isOn);
    if (isOn) {
      await applyToTab(tabId, true);
    }
  }
});

// Clean up state when tab closes
chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  await removeTabState(tabId);
});
