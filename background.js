// background.js

// Bring in auth logic (makes self.Auth available)
importScripts('auth.js');
import anyDateParser from 'any-date-parser';
// Bring in Gemini logic (must define analyzeTextWithGemini, fallbackParseEventFromText, etc.)
importScripts('services/promptAPIService.js');

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] BACKGROUND: ${message}`, data || '');
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
        const event = await parseEventDetails(request.text);
        // Convert date to RFC 5545 date format
        const startDate = parse(
        [
          event.start_time,
          event.start_date,
          event.start_year,
          event.timezone
        ].join(' ')
        );
        const endDate = parse(
          [event.end_time, event.end_date, event.end_year, event.timezone].join(' '));
          event.dates = format(startDate) + '/' + format(endDate);

        const googleCalendarUrl = createGoogleCalendarUrl(event);
        chrome.tabs.create({ url: googleCalendarUrl.toString() });
        log('Text analysis completed:', event);
  
        if (!event) {
          log('No event details found');
          sendResponse({ success: false, error: 'No event details found' });
          return;
        }
  
        // STEP 3: create event directly in Google Calendar
        const createdEvent = await createCalendarEvent(token, event);
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
        const test = await analyzeTextWithPromptAPI('Test event tomorrow at 12 PM');
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
      if (typeof analyzeTextWithPromptAPI === 'function') {
        const event = await analyzeTextWithPromptAPI(text);
        if (event) {
          log('Prompt API analysis successful:', event);
          return event;
        } else {
          log('Prompt API returned no event, falling back to regex parsing');
        }
      } else {
        log('analyzeTextWithPromptAPI is not defined, skipping AI parse');
      }
    } catch (promptAPIError) {
      log('promptAPI analysis failed:', {
        message: promptAPIError.message,
        stack: promptAPIError.stack
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

function parse(dateString) {
  const parsed = anyDateParser.attempt(dateString);
  return new Date(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute
  );
}

function format(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return [year, month, day, 'T', hours, minutes, seconds].join('');
}

function createGoogleCalendarUrl(eventDetails) {
  const googleCalendarUrl = new URL(
    'https://calendar.google.com/calendar/render?action=TEMPLATE'
  );
  const params = googleCalendarUrl.searchParams;
  if (eventDetails.title) {
    params.append('text', eventDetails.title);
  }
  if (eventDetails.dates) {
    params.append('dates', eventDetails.dates);
  }
  if (eventDetails.description) {
    params.append('details', eventDetails.description);
  }
  if (eventDetails.location) {
    params.append('location', eventDetails.location);
  }
  return googleCalendarUrl;
}

async function parseEventDetails(text) {
  const session = await LanguageModel.create({
    temperature: 0,
    topK: 1.0
  });

  let prompt = `
    The following text describes an event. Extract "title", "start_time", "start_date", "start_year", "end_time", "end_date", "end_year", "description", "timezone" and "location" of the event. Return only JSON as result.

    * If no year is provided, use the current year ${new Date().getFullYear()}.
    * If no date is provided, use the current date ${new Date().toLocaleDateString()}. 
    * If no timezone is provided, leave it empty.
    * If no end time is provided, set the end time to one hour after the start time
    * Do not convert the start time or end time

    Here is the text:

     ${text}`;

  const result = await session.prompt(prompt);
  return JSON.parse(fixCommonJSONMistakes(result), null, '  ');
}

function addCommaBetweenQuotes(str) {
  return str.replace(/"([^"]*)"\s+"([^"]*)"/g, '"$1", "$2"');
}

function extractTextBetweenCurlyBraces(str) {
  if (str[0] === '[') return str;
  const firstBraceIndex = str.indexOf('{');
  const lastBraceIndex = str.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    return null; // No curly braces found
  }

  return str.substring(firstBraceIndex, lastBraceIndex + 1);
}

function curlyToBrackets(str) {
  // Check if the input is a string
  if (typeof str !== 'string') {
    return 'Input must be a string.';
  }

  // Use a regular expression to match curly braces with quoted strings inside
  return str.replace(/\{("([^"]*)"(?:,\s*)?)*\}/g, function (match) {
    // Remove curly braces and replace with brackets
    return '[' + match.slice(1, -1) + ']';
  });
}

function fixCommonJSONMistakes(str) {
  str = str.trim();
  str = curlyToBrackets(str);
  str = extractTextBetweenCurlyBraces(str);
  str = addCommaBetweenQuotes(str);
  return str;
}