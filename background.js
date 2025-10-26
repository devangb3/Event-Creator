// background.js

// Bring in auth logic (makes self.Auth available)
importScripts('auth.js');

// Bring in Gemini logic (must define analyzeTextWithGemini, fallbackParseEventFromText, etc.)
importScripts('services/geminiService.js');

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] BACKGROUND: ${message}`, data || '');
}

function safeSendMessage(tabId, message) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        // Content script might not be attached on all pages; that's fine
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

// --- Startup diagnostics ---
log('Background script starting');
log('Chrome runtime available:', {
  onInstalled: !!chrome.runtime.onInstalled,
  onMessage: !!chrome.runtime.onMessage,
  contextMenus: !!chrome.contextMenus
});

// On install
chrome.runtime.onInstalled.addListener(() => {
  log('Extension installed - highlight detection active');
});

// MAIN MESSAGE HANDLER
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Received message from content script:', { action: request?.action, sender: sender?.tab?.id });

  if (!request || typeof request !== 'object') {
    log('Invalid request received:', request);
    sendResponse({ success: false, error: 'Invalid request object' });
    return true;
  }

  // ========== AUTH + ANALYZE + CALENDAR LINK ==========
  if (request.action === 'analyzeText') {
    log('Processing analyzeText request:', { textLength: request.text?.length });
  
    (async () => {
      try {
        // STEP 1: get token (this now logs internally too)
        const token = await self.Auth.ensureAuthedAndGetToken();
        log('Google auth OK, token present?', !!token);
  
        if (!token) {
          // This should basically never hit now because ensureAuthedAndGetToken throws,
          // but we guard anyway.
          log('Auth returned NO token - aborting');
          sendResponse({
            success: false,
            error: 'No auth token (user may have closed the sign-in popup)'
          });
          return;
        }
  
        // STEP 2: analyze text → event details
        const result = await analyzeTextForEvent(request.text);
        log('Text analysis completed:', result);
  
        if (!result) {
          log('No event details found');
          sendResponse({ success: false, error: 'No event details found' });
          return;
        }
  
        // STEP 3: build calendar URL
        const calendarUrl = generateCalendarLink(result);
        log('Generated calendar URL:', calendarUrl);
  
        // STEP 4: open calendar in a new tab
        chrome.tabs.create({ url: calendarUrl });
  
        // STEP 5: reply success to content.js
        sendResponse({ success: true, calendarUrl });
      } catch (err) {
        log('Error in analyzeText flow:', {
          message: err.message,
          stack: err.stack
        });
        sendResponse({
          success: false,
          error: err.message || 'Authentication or analysis failed'
        });
      }
    })();
  
    return true;
  }

  // ==== API KEY / GEMINI LOGIC (unchanged except wording) ====

  if (request.action === 'setApiKey') {
    log('API key management via UI is disabled - using environment/build-time key instead');
    sendResponse({
      success: false,
      error: 'API key is bundled at build time. Manual setting is disabled.'
    });
    return true;
  }

  if (request.action === 'testApiKey') {
    log('Testing Gemini parsing using current key');
    (async () => {
      try {
        const test = await analyzeTextWithGemini('Test event tomorrow at 12 PM');
        if (test) {
          log('API key test succeeded');
          sendResponse({ success: true });
        } else {
          log('API key test returned no result');
          sendResponse({ success: false, error: 'API key test returned no event' });
        }
      } catch (error) {
        log('API key test failed:', error.message);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'getApiKeyStatus') {
    const status = getApiKeyStatus?.();
    log('API key status:', status);
    sendResponse({ success: true, status });
    return true;
  }

  return false;
});

// ---- Helper functions ----

// Analyze selected text -> event { title, start_time, end_time, description, location }
async function analyzeTextForEvent(text) {
  try {
    if (!text || !text.trim()) {
      throw new Error('No text provided for analysis');
    }

    log('Starting text analysis for event creation');

    // 1. Try Gemini AI first
    try {
      if (typeof analyzeTextWithGemini === 'function') {
        const event = await analyzeTextWithGemini(text);
        if (event) {
          log('Gemini analysis successful:', event);
          return event;
        } else {
          log('Gemini returned no event, falling back to regex parsing');
        }
      } else {
        log('analyzeTextWithGemini is not defined, skipping AI parse');
      }
    } catch (geminiError) {
      log('Gemini analysis failed:', {
        message: geminiError.message,
        stack: geminiError.stack
      });
    }

    // 2. Fallback to simple parsing if Gemini fails
    if (typeof fallbackParseEventFromText === 'function') {
      const event = fallbackParseEventFromText(text);
      if (event) {
        log('Fallback parsing successful:', event);
        return event;
      }
      log('Fallback parsing found no event details either');
    } else {
      log('fallbackParseEventFromText is not defined');
    }

    return null;
  } catch (error) {
    log('Error in analyzeTextForEvent:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Build the Google Calendar link to pre-fill event data
function generateCalendarLink(event) {
  const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();

  if (event.title) {
    params.append('text', event.title);
  }

  if (event.start_time) {
    // Google Calendar expects dates in YYYYMMDDTHHMMSSZ format
    const formatDateForGoogle = (isoString) =>
      isoString.replace(/[-:]/g, '').split('.')[0] + 'Z';

    const start = formatDateForGoogle(event.start_time);
    const end = event.end_time
      ? formatDateForGoogle(event.end_time)
      : formatDateForGoogle(event.start_time);

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