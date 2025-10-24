// Creates a context menu item for selected text.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gemini-create-event',
    title: 'Create Calendar Event with Gemini',
    contexts: ['selection'],
  });
});

// Listens for clicks on the context menu item.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'gemini-create-event' && info.selectionText) {
    // Store the selected text.
    chrome.storage.local.set({ selectedText: info.selectionText }, () => {
      // Open the extension in a new popup window.
      chrome.windows.create({
        url: 'index.html',
        type: 'popup',
        width: 550,
        height: 750
      });
    });
  }
});
