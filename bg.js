// ------------- bg.js -------------
let isOn = false;

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ rtlOn: false });
    // آیکون اولیه
    chrome.action.setIcon({
        path: {
            "16": "off.png",

        }
    });
});

chrome.action.onClicked.addListener(async (tab) => {
    const data = await chrome.storage.local.get('rtlOn');
    isOn = !data.rtlOn;
    await chrome.storage.local.set({ rtlOn: isOn });

    const css = `
    html { direction: rtl; text-align: right; }
    code, pre, .code, .hljs, .highlight,
    *[class*="code"], *[class*="hljs"] {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: isolate;
    }`;

    if (isOn) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, css });
    } else {
        await chrome.scripting.removeCSS({ target: { tabId: tab.id }, css });
    }

    // تعویض آیکون اصلی نوارابزار
    const path = isOn
        ? { "16": "on.png" }
        : { "16": "off.png" };
    chrome.action.setIcon({ path });
});