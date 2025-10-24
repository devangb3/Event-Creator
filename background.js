function safeSendMessage(tabId, message) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        log('Tab message ignored (likely no content script):', {
          tabId,
          error: chrome.runtime.lastError.message
        });
      }
    });
  } catch (error) {
    log('Unexpected error sending tab message:', { tabId, error: error.message });
  }
}

// Create extension icon click handler when available
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    log('Extension icon clicked');
    if (!tab?.id) {
      log('No active tab to send API key prompt');
      return;
    }

    safeSendMessage(tab.id, { action: 'showGeminiSetup' });
  });
} else {
  log('chrome.action API not available; users must use context menu');
}
// Import Gemini service
importScripts('services/geminiService.js');

// Debug logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] BACKGROUND: ${message}`, data || '');
}

// Log when background script starts
log('Background script starting');
log('Chrome runtime available:', {
  onInstalled: !!chrome.runtime.onInstalled,
  onMessage: !!chrome.runtime.onMessage,
  contextMenus: !!chrome.contextMenus
});

// Initialize Gemini service with API key from storage
chrome.storage.sync.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    log('Loading API key from storage');
    setApiKey(result.geminiApiKey);
  } else {
    log('No API key found in storage - Gemini features will use fallback parsing');
  }
});

// Creates a context menu item for selected text.
chrome.runtime.onInstalled.addListener(() => {
  log('Extension installed, creating context menu');
  chrome.contextMenus.create({
    id: 'gemini-create-event',
    title: 'Create Event from Text',
    contexts: ['selection'],
  }, () => {
    if (chrome.runtime.lastError) {
      log('Error creating context menu:', chrome.runtime.lastError);
    } else {
      log('Context menu created successfully');
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Received message from content script:', { action: request?.action, sender: sender?.tab?.id });

  if (!request || typeof request !== 'object') {
    log('Invalid request received:', request);
    sendResponse({ success: false, error: 'Invalid request object' });
    return true;
  }

  if (request.action === 'analyzeText') {
    log('Processing analyzeText request:', { textLength: request.text?.length });

    analyzeTextForEvent(request.text)
      .then(result => {
        log('Text analysis completed:', result);
        if (result) {
          const calendarUrl = generateCalendarLink(result);
          log('Generated calendar URL:', calendarUrl);
          sendResponse({ success: true, calendarUrl });
        } else {
          log('No event details found');
          sendResponse({ success: false, error: 'No event details found' });
        }
      })
      .catch(error => {
        log('Error in text analysis:', error);
      sendResponse({ success: false, error: error.message || 'Unknown error analyzing text' });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'setApiKey') {
    log('Setting API key');
    const apiKey = typeof request.apiKey === 'string' ? request.apiKey.trim() : '';

    if (!apiKey) {
      sendResponse({ success: false, error: 'API key is required' });
      return true;
    }

    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      setApiKey(apiKey);
      log('API key saved and set');
      sendResponse({ success: true });

      // Notify current tab that API key is set
      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: 'apiKeyStatus', hasApiKey: true });
      }

      // Notify other tabs as well
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id !== sender?.tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'apiKeyStatus', hasApiKey: true });
          }
        });
      });
    });
    return true;
  }

  if (request.action === 'testApiKey') {
    log('Testing API key validity');
    const apiKey = typeof request.apiKey === 'string' ? request.apiKey.trim() : '';

    if (!apiKey) {
      sendResponse({ success: false, error: 'API key is required' });
      return true;
    }

    try {
      setApiKey(apiKey);

      // Minimal prompt to test key validity
      analyzeTextWithGemini('Test event tomorrow at 12 PM').then(result => {
        if (result) {
          log('API key test succeeded');
          sendResponse({ success: true });

      safeSendMessage(sender?.tab?.id, { action: 'apiKeyStatus', hasApiKey: true });

      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id !== sender?.tab?.id) {
            safeSendMessage(tab.id, { action: 'apiKeyStatus', hasApiKey: true });
          }
        });
      });
          safeSendMessage(sender?.tab?.id, { action: 'apiKeyStatus', hasApiKey: true });

          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id !== sender?.tab?.id) {
                safeSendMessage(tab.id, { action: 'apiKeyStatus', hasApiKey: true });
              }
            });
          });
        } else {
          log('API key test returned no result');
          sendResponse({ success: false, error: 'API key test returned no event' });
        }
      }).catch(error => {
        log('API key test failed:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    } catch (error) {
      log('Error testing API key:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === 'getApiKeyStatus') {
    const status = getApiKeyStatus();
    log('API key status:', status);
    sendResponse({ success: true, status });
    return true;
  }
});

// Listens for clicks on the context menu item.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  log('Context menu clicked:', {
    menuItemId: info.menuItemId,
    selectionText: info.selectionText?.substring(0, 100),
    tabId: tab?.id,
    tabUrl: tab?.url
  });

  if (info.menuItemId === 'gemini-create-event' && info.selectionText) {
    if (!tab || !tab.id) {
      log('ERROR: No valid tab found');
      return;
    }

    log('Sending message to content script on tab:', tab.id);

    // Send message to content script to show the UI
    chrome.tabs.sendMessage(tab.id, {
      action: 'createEvent',
      text: info.selectionText
    }, (response) => {
      if (chrome.runtime.lastError) {
        log('ERROR sending message to content script:', chrome.runtime.lastError);
      } else {
        log('Message sent successfully to content script');
      }
    });
  } else {
    log('Context menu click ignored - missing selection or wrong menu item');
  }
});

// Event analysis function using Gemini AI
async function analyzeTextForEvent(text) {
  try {
    if (!text || !text.trim()) {
      throw new Error('No text provided for analysis');
    }

    log('Starting text analysis for event creation');

    // Try Gemini AI first
    try {
      const event = await analyzeTextWithGemini(text);
      if (event) {
        log('Gemini analysis successful:', event);
        return event;
      } else {
        log('Gemini returned no event, falling back to regex parsing');
      }
    } catch (geminiError) {
      log('Gemini analysis failed:', {
        message: geminiError.message,
        stack: geminiError.stack
      });
    }

    // Fallback to simple parsing if Gemini fails
    const event = fallbackParseEventFromText(text);
    if (event) {
      log('Fallback parsing successful:', event);
    } else {
      log('Fallback parsing also failed to extract event details');
    }
    return event;
  } catch (error) {
    log('Error analyzing text:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Legacy function - now handled by fallbackParseEventFromText
// Kept for backward compatibility
function parseEventFromText(text) {
  return fallbackParseEventFromText(text);
}

// Generate Google Calendar link
function generateCalendarLink(event) {
  const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();

  params.append('text', event.title);

  if (event.start_time) {
    const formatDateForGoogle = (isoString) => isoString.replace(/[-:]/g, '').split('.')[0] + 'Z';
    const start = formatDateForGoogle(event.start_time);
    const end = event.end_time ? formatDateForGoogle(event.end_time) : formatDateForGoogle(event.start_time);
    params.append('dates', `${start}/${end}`);
  }

  if (event.description) {
    params.append('details', event.description);
  }

  if (event.location) {
    params.append('location', event.location);
  }

  return `${baseUrl}&${params.toString()}`;
}
