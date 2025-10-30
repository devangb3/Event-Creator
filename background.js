// background.js
// Bring in auth logic (makes self.Auth available)
importScripts('auth.js');
// Bring in Gemini / parsing helpers (must define analyzeTextWithPromptAPI,
// fallbackParseEventFromText, LanguageModel, etc.)
importScripts('services/promptAPIService.js');

// NOTE: you're mixing ESM + importScripts above.
// If your build step inlines any-date-parser, keep this import.
// If not, you can swap this to a bundled version.
import anyDateParser from './node_modules/any-date-parser/dist/index.mjs';

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
  // make sure we store default state if it's first install
  saveServiceEnabled(serviceEnabled);
});

// On cold start
chrome.runtime.onStartup?.addListener(() => {
  log('Runtime startup');
  loadServiceEnabled();
});

/* =========================================================
   SERVICE TOGGLE (GLOBAL ON/OFF)
========================================================= */

const SERVICE_KEY = 'serviceEnabled';
let serviceEnabled = true; // default ON

function loadServiceEnabled() {
  chrome.storage.local.get(SERVICE_KEY, (res) => {
    if (chrome.runtime.lastError) {
      log('storage.get error:', chrome.runtime.lastError.message);
    }
    serviceEnabled =
      res[SERVICE_KEY] === undefined ? true : !!res[SERVICE_KEY];
    log('Loaded serviceEnabled:', { serviceEnabled });
  });
}

// call once immediately so serviceEnabled has persisted value
loadServiceEnabled();

function saveServiceEnabled(val) {
  chrome.storage.local.set({ [SERVICE_KEY]: !!val }, () => {
    if (chrome.runtime.lastError) {
      log('storage.set error:', chrome.runtime.lastError.message);
    }
  });
}

function broadcastServiceEnabled() {
  // notify all tabs' content scripts
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs || []) {
      if (tab && tab.id >= 0) {
        try {
          chrome.tabs.sendMessage(tab.id, {
            action: 'serviceStatus',
            enabled: serviceEnabled
          });
        } catch (_) {
          // ignore tabs that don't have our content script
        }
      }
    }
  });

  // also ping any open popup
  try {
    chrome.runtime.sendMessage({
      action: 'serviceStatus',
      enabled: serviceEnabled
    });
  } catch (_) {}
}

function setServiceEnabled(val) {
  serviceEnabled = !!val;
  saveServiceEnabled(serviceEnabled);
  log('serviceEnabled changed', { serviceEnabled });
  broadcastServiceEnabled();
}

/* =========================================================
   MESSAGE HANDLER
========================================================= */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Received message:', {
    action: request?.action,
    senderTabId: sender?.tab?.id
  });

  if (!request || typeof request !== 'object') {
    log('Invalid request received:', request);
    sendResponse({ success: false, error: 'Invalid request object' });
    return true;
  }

  // -------- Toggle API the popup uses --------

  if (request.action === 'getServiceStatus') {
    sendResponse({ success: true, enabled: serviceEnabled });
    return true;
  }

  if (request.action === 'enableService') {
    setServiceEnabled(true);
    sendResponse({ success: true, enabled: true });
    return true;
  }

  if (request.action === 'disableService') {
    setServiceEnabled(false);
    sendResponse({ success: true, enabled: false });
    return true;
  }

  /* =========================================================
     NEW: parseTextToEvent
     - used by content.js "Edit & Create"
     - DOES NOT create calendar event
     - just returns normalized fields so form can prefill
  ========================================================== */
  if (request.action === 'parseTextToEvent') {
    if (!serviceEnabled) {
      log('Blocked parseTextToEvent: service disabled');
      sendResponse({ success: false, error: 'SERVICE_DISABLED' });
      return true;
    }

    (async () => {
      try {
        const rawEvent = await parseEventDetails(request.text || '');
        log('parseTextToEvent rawEvent:', rawEvent);

        // normalize → ISO etc.
        const normalized = normalizeParsedEvent(rawEvent);
        log('parseTextToEvent normalized:', normalized);

        sendResponse({ success: true, event: normalized });
      } catch (err) {
        log('parseTextToEvent error:', { message: err.message, stack: err.stack });
        // Fallback: at least return title so UI can show something
        sendResponse({
          success: true,
          event: {
            title: (request.text || '').slice(0, 50),
            start_time: null,
            end_time: null,
            description: request.text || '',
            location: null,
            color: 'default',
            reminder_minutes: 1440
          },
          warning: err.message
        });
      }
    })();

    return true;
  }

  // ========== AUTH + ANALYZE + DIRECT CREATE (QUICK CREATE) ==========
  if (request.action === 'analyzeText') {
    // block if off
    if (!serviceEnabled) {
      log('Blocked analyzeText: service disabled');
      sendResponse({ success: false, error: 'SERVICE_DISABLED' });
      return true;
    }

    log('Processing analyzeText request:', { textLength: request.text?.length });

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

        // STEP 2: analyze text → event details (raw from LLM)
        const rawEvent = await parseEventDetails(request.text);
        log('Parsed rawEvent from model:', rawEvent);

        // STEP 2.1: normalize (same logic as parseTextToEvent)
        const calendarReadyEvent = normalizeParsedEvent(rawEvent);

        // If we still don't have a valid start, bail gracefully
        if (!calendarReadyEvent.start_time) {
          log('No valid start_time after normalization');
          sendResponse({
            success: false,
            error: 'Could not infer a start time from the text'
          });
          return;
        }

        log('QuickCreate calendarReadyEvent:', calendarReadyEvent);

        // STEP 3: create event directly in Google Calendar (API)
        const createdEvent = await createCalendarEvent(
          token,
          calendarReadyEvent
        );
        log('Event created successfully (quick create):', createdEvent);

        // STEP 4: reply back to content.js so it can show snackbar
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
    // block if off
    if (!serviceEnabled) {
      log('Blocked createEventFromData: service disabled');
      sendResponse({ success: false, error: 'SERVICE_DISABLED' });
      return true;
    }

    log('Processing createEventFromData request:', {
      eventData: request.eventData
    });

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

        // STEP 2: create event directly via API
        const createdEvent = await createCalendarEvent(
          token,
          request.eventData
        );
        log('Event created successfully:', createdEvent);

        // STEP 3: reply
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

  // ==== API KEY / GEMINI LOGIC ====

  if (request.action === 'setApiKey') {
    log(
      'API key management via UI is disabled - using environment/build-time key instead'
    );
    sendResponse({
      success: false,
      error:
        'API key is bundled at build time. Manual setting is disabled.'
    });
    return true;
  }

  if (request.action === 'testApiKey') {
    log('Testing Gemini parsing using current key');
    (async () => {
      try {
        const test = await analyzeTextWithPromptAPI(
          'Test event tomorrow at 12 PM'
        );
        if (test) {
          log('API key test succeeded');
          sendResponse({ success: true });
        } else {
          log('API key test returned no result');
          sendResponse({
            success: false,
            error: 'API key test returned no event'
          });
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

/* =========================================================
   HELPERS
========================================================= */

function mapUiColorToGoogleColorId(uiColor) {
  switch (uiColor) {
    case 'lavender':
      return '1';
    case 'sage':
      return '2';
    case 'grape':
      return '3';
    case 'flamingo':
      return '4';
    case 'banana':
      return '5';
    case 'tangerine':
      return '6';
    case 'peacock':
      return '7';
    case 'graphite':
      return '8';
    case 'basil':
      return '10';
    case 'tomato':
      return '11';
    case 'default':
    default:
      return undefined;
  }
}

// Create event in Google Calendar via API
async function createCalendarEvent(accessToken, eventData) {
  log('Creating calendar event via API:', eventData);

  try {
    const startDateTime = eventData.start_time;
    const endDateTime =
      eventData.end_time || addOneHourIso(eventData.start_time);

    const calendarEvent = {
      summary: eventData.title,
      description: eventData.description || eventData.title,
      start: {
        dateTime: startDateTime
      },
      end: {
        dateTime: endDateTime
      }
    };

    if (eventData.location) {
      calendarEvent.location = eventData.location;
    }

    if (eventData.attendees && eventData.attendees.length > 0) {
      calendarEvent.attendees = eventData.attendees.map((email) => ({ email }));
    }

    const colorId = mapUiColorToGoogleColorId(eventData.color);
    if (colorId) {
      calendarEvent.colorId = colorId;
    }

    // Reminders
    if (eventData.reminder_minutes && !isNaN(eventData.reminder_minutes)) {
      const mins = parseInt(eventData.reminder_minutes, 10);

      calendarEvent.reminders = {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: mins }]
      };
    } else {
      calendarEvent.reminders = {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'email', minutes: 30 }
        ]
      };
    }

    log('Formatted calendar event:', calendarEvent);

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(calendarEvent)
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log('Calendar API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(
        `Calendar API request failed: ${response.status} ${response.statusText}`
      );
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

// helper for +1hr end time if user didn't give end (ISO-safe)
function addOneHourIso(isoString) {
  const d = new Date(isoString);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

// convert "pieces" → Date using any-date-parser
function parseDatePieces(joined) {
  const parsed = anyDateParser.attempt(joined);
  return new Date(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute
  );
}

// format Date → yyyymmddThhmmss for ?dates= param
function formatForCalendar(d) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return [year, month, day, 'T', hours, minutes, seconds].join('');
}

// Build full ISO timestamp ("2025-10-29T00:00:00.000Z") from date + time strings
function buildIsoDateTime(dateStr, timeStr, year) {
  if (!dateStr || !timeStr) return null;

  const combined = `${dateStr} ${year || new Date().getFullYear()} ${timeStr}`;

  const parsed = anyDateParser.attempt(combined);
  if (!parsed || parsed.year == null || parsed.month == null || parsed.day == null) {
    return null;
  }

  const hour = parsed.hour ?? 0;
  const minute = parsed.minute ?? 0;

  const d = new Date(parsed.year, parsed.month - 1, parsed.day, hour, minute, 0, 0);
  return d.toISOString();
}

// Build Google Calendar "create event" UI link (also opens new tab)
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

/* =========================================================
   LLM PARSING
========================================================= */

async function parseEventDetails(text) {
  const session = await LanguageModel.create({
    temperature: 0,
    topK: 1.0
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentDateString = now.toLocaleDateString();

  let prompt = `
    The following text describes an event.
    Extract the following fields from the user’s message:
    - title
    - start_date (format: "30 Oct" or "30 October")
    - end_date (same format, optional)
    - start_time (keep whatever time expression user used, e.g. "6 PM", "18:00")
    - end_time (optional)
    - year (use current year if not given)
    - location
    - description
    Output a valid JSON object.

    * If no year is provided, use the current year ${currentYear}.
    * If no date is provided, use the current date ${currentDateString}.
    * If no end time is provided, leave it blank.
    * Do not invent attendees.
    * Keep field names exactly as requested.

    Text:
    ${text}
  `;

  const result = await session.prompt(prompt);
  const cleaned = fixCommonJSONMistakes(result);
  return JSON.parse(cleaned);
}

// shared JSON cleaning helpers
function addCommaBetweenQuotes(str) {
  return str.replace(/"([^"]*)"\s+"([^"]*)"/g, '"$1", "$2"');
}

function extractTextBetweenCurlyBraces(str) {
  if (str[0] === '[') return str;
  const firstBraceIndex = str.indexOf('{');
  const lastBraceIndex = str.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1) {
    return null;
  }

  return str.substring(firstBraceIndex, lastBraceIndex + 1);
}

function curlyToBrackets(str) {
  if (typeof str !== 'string') {
    return 'Input must be a string.';
  }
  return str.replace(/\{("([^"]*)"(?:,\s*)?)*\}/g, function (match) {
    return '[' + match.slice(1, -1) + ']';
  });
}

function fixCommonJSONMistakes(str) {
  str = str.trim();
  str = curlyToBrackets(str);
  str = extractTextBetweenCurlyBraces(str) || str;
  str = addCommaBetweenQuotes(str);
  return str;
}

/* =========================================================
   NORMALIZATION HELPER
   turns raw LLM output into what content.js expects
========================================================= */
function normalizeParsedEvent(rawEvent) {
  // rawEvent fields expected:
  // title, start_date, end_date, start_time, end_time, year, location, description
  const title = rawEvent?.title || 'Untitled event';
  const year = rawEvent?.year || new Date().getFullYear();

  // build ISO start
  const startIso = buildIsoDateTime(
    rawEvent?.start_date,
    rawEvent?.start_time,
    year
  );

  // build ISO end (maybe same day)
  const endIsoCandidate = buildIsoDateTime(
    rawEvent?.end_date || rawEvent?.start_date,
    rawEvent?.end_time,
    year
  );
  const endIso = endIsoCandidate || (startIso ? addOneHourIso(startIso) : null);

  return {
    title,
    start_time: startIso,
    end_time: endIso,
    description: (rawEvent?.description || title).trim(),
    location: rawEvent?.location || null,
    color: 'default',
    // sensible default for edit form
    reminder_minutes: 1440
  };
}