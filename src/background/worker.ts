declare global {
  interface Window {
    loaderTrf?: {
      bInProcess: boolean;
    };
  }
}

type ExtensionMessage = { type: string };

// Message listener
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: () => void,
  ): boolean | undefined => {
    // Reset internal site loading state so we can load the correct content
    if (message.type === "RESET_LOADER" && sender.tab?.id) {
      chrome.scripting
        .executeScript({
          target: { tabId: sender.tab.id },
          world: "MAIN",
          func: () => {
            if (window.loaderTrf) {
              window.loaderTrf.bInProcess = false;
            }
          },
        })
        .then(() => {
          sendResponse();
        });
      return true;
    }
  },
);
