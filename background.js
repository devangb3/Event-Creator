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
  
        // STEP 3: create event directly in Google Calendar
        const createdEvent = await createCalendarEvent(token, result);
        log('Event created successfully:', createdEvent);
  
        // STEP 4: reply success to content.js with event details
        sendResponse({ 
          success: true, 
          eventId: createdEvent.id,
          eventLink: createdEvent.htmlLink,
          eventTitle: createdEvent.summary
        });
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

  // ========== CREATE EVENT FROM FORM DATA ==========
  if (request.action === 'createEventFromData') {
    log('Processing createEventFromData request:', { eventData: request.eventData });
  
    (async () => {
      try {
        // STEP 1: get token
        const token = await self.Auth.ensureAuthedAndGetToken();
        log('Google auth OK, token present?', !!token);
  
        if (!token) {
          log('Auth returned NO token - aborting');
          sendResponse({
            success: false,
            error: 'No auth token (user may have closed the sign-in popup)'
          });
          return;
        }
  
        // STEP 2: create event directly in Google Calendar
        const createdEvent = await createCalendarEvent(token, request.eventData);
        log('Event created successfully:', createdEvent);
  
        // STEP 3: reply success to content.js
        sendResponse({ 
          success: true, 
          eventId: createdEvent.id,
          eventLink: createdEvent.htmlLink,
          eventTitle: createdEvent.summary
        });
      } catch (err) {
        log('Error in createEventFromData flow:', {
          message: err.message,
          stack: err.stack
        });
        sendResponse({
          success: false,
          error: err.message || 'Authentication or event creation failed'
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

// Create event directly in Google Calendar using the Calendar API
async function createCalendarEvent(accessToken, eventData) {
  log('Creating calendar event via API:', eventData);
  
  try {
    // Format the event data for Google Calendar API
    const calendarEvent = {
      summary: eventData.title,
      description: eventData.description || eventData.title,
      start: {
        dateTime: eventData.start_time,
        timeZone: 'UTC'
      },
      end: {
        dateTime: eventData.end_time || addOneHour(eventData.start_time),
        timeZone: 'UTC'
      }
    };

    // Add location if provided
    if (eventData.location) {
      calendarEvent.location = eventData.location;
    }

    // Add attendees if provided
    if (eventData.attendees && eventData.attendees.length > 0) {
      calendarEvent.attendees = eventData.attendees.map(email => ({ email }));
    }

    // Add reminders
    calendarEvent.reminders = {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'email', minutes: 30 }
      ]
    };

    log('Formatted calendar event:', calendarEvent);

    // Make API request to create the event
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(calendarEvent)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log('Calendar API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Calendar API request failed: ${response.status} ${response.statusText}`);
    }

    const createdEvent = await response.json();
    log('Event created successfully:', {
      id: createdEvent.id,
      summary: createdEvent.summary,
      htmlLink: createdEvent.htmlLink
    });

    return createdEvent;

  } catch (error) {
    log('Error creating calendar event:', error);
    throw error;
  }
}

// Helper function to add one hour to a datetime string
function addOneHour(dateTimeString) {
  const date = new Date(dateTimeString);
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}