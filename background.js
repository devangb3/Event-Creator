function safeSendMessage(tabId, message) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        // Only log as warning, not error, since this is expected when content script isn't loaded
        log('Tab message ignored (content script not loaded):', {
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

// Initialize Gemini service with API key from environment variable
try {
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    log('Loading API key from environment variable');
    setApiKey(process.env.GEMINI_API_KEY);
  } else {
    log('No API key found in environment - Gemini features will use fallback parsing');
  }
} catch (error) {
  log('Error loading API key from environment:', error.message);
}

// Extension installation handler
chrome.runtime.onInstalled.addListener(() => {
  log('Extension installed - text selection detection is now active');
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
    log('API key management via UI is disabled - using environment variable instead');
    sendResponse({ 
      success: false, 
      error: 'API key is now managed via environment variable. Please set GEMINI_API_KEY in your .env file and rebuild the extension.' 
    });
    return true;
  }

  if (request.action === 'testApiKey') {
    log('Testing API key from environment variable');
    
    try {
      // Test the current API key from environment
      analyzeTextWithGemini('Test event tomorrow at 12 PM').then(result => {
        if (result) {
          log('API key test succeeded');
          sendResponse({ success: true });
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

// Context menu functionality removed - now using automatic text selection detection

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
