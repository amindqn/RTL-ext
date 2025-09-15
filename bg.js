const CSS = `
  html { direction: rtl; text-align: right; }
  code, pre, kbd, samp, .code, .hljs, .highlight,
  *[class*="code"], *[class*="hljs"] {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: isolate;
  }
`;

function setIcon(isOn) {
  const path = isOn
    ? { "16": "on-16.png", "24": "on-24.png", "32": "on-32.png" }
    : { "16": "off-16.png", "24": "off-24.png", "32": "off-32.png" };
  chrome.action.setIcon({ path });
  chrome.action.setTitle({ title: isOn ? "RTL: On" : "RTL: Off" });
}

async function getState() {
  const data = await chrome.storage.local.get("rtlOn");
  return Boolean(data.rtlOn);
}

async function setState(isOn) {
  await chrome.storage.local.set({ rtlOn: isOn });
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

  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await setState(false);
  setIcon(false);
});

chrome.runtime.onStartup.addListener(async () => {
  const isOn = await getState();
  setIcon(isOn);
});

chrome.action.onClicked.addListener(async (tab) => {
  const current = await getState();
  const next = !current;
  await setState(next);
  setIcon(next);
  await applyToTab(tab?.id, next);
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "toggle-rtl") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const current = await getState();
  const next = !current;
  await setState(next);
  setIcon(next);
  await applyToTab(tab?.id, next);
});
