const CSS = `
  html { direction: rtl; text-align: right; }
  code, pre, kbd, samp, .code, .hljs, .highlight,
  *[class*="code"], *[class*="hljs"] {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: isolate;
  }
`;

// Storage: نگهداری وضعیت برای هر tabId به صورت موقت
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
  const path = isOn
    ? { "16": "on-16.png", "24": "on-24.png", "32": "on-32.png" }
    : { "16": "off-16.png", "24": "off-24.png", "32": "off-32.png" };
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
    // صفحات محدود یا نبود دسترسی activeTab
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // آغاز با نقشهٔ خالی
  await storage.set({ rtlTabs: {} });
});

chrome.runtime.onStartup.addListener(async () => {
  // آیکن تب فعال را با وضعیت قبلی همگام می‌کنیم
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

// با تغییر تب فعال، آیکن همان تب همگام شود
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const isOn = await getTabState(tabId);
  setIconForTab(tabId, isOn);
});

// با تغییر فوکوس پنجره فعال، آیکن تب فعال را به‌روز کن
chrome.windows.onFocusChanged.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    const isOn = await getTabState(tab.id);
    setIconForTab(tab.id, isOn);
  }
});

// پس از بارگذاری/رفرش تب، اگر وضعیت روشن بود تلاش می‌کنیم CSS را دوباره اعمال کنیم
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === "complete") {
    const isOn = await getTabState(tabId);
    setIconForTab(tabId, isOn);
    if (isOn) {
      await applyToTab(tabId, true);
    }
  }
});

// پاکسازی وضعیت هنگام بستن تب
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabState(tabId);
});
