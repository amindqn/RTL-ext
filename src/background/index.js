const CSS = `
  html { direction: rtl; text-align: right; }
  code, pre, kbd, samp, .code, .hljs, .highlight,
  *[class*="code"], *[class*="hljs"] {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: isolate;
  }
`;

const ICON_PATHS = {
  on: {
    "16": "assets/icons/on-16.png",
    "24": "assets/icons/on-24.png",
    "32": "assets/icons/on-32.png",
  },
  off: {
    "16": "assets/icons/off-16.png",
    "24": "assets/icons/off-24.png",
    "32": "assets/icons/off-32.png",
  },
};

const storage = chrome.storage?.session ?? chrome.storage.local;

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
  const path = isOn ? ICON_PATHS.on : ICON_PATHS.off;
  chrome.action.setIcon({ tabId, path });
  chrome.action.setTitle({ tabId, title: isOn ? "RTL: On" : "RTL: Off" });
}

async function applyToTab(tabId, isOn) {
  if (!tabId) return;
  try {
    if (isOn) {
      await chrome.scripting.insertCSS({ target: { tabId }, css: CSS });
    } else {
      await chrome.scripting.removeCSS({ target: { tabId }, css: CSS });
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
