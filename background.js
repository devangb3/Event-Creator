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
  log('Received message from content script:', { action: request.action, sender: sender.tab?.id });

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
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
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

// Simple event analysis function
async function analyzeTextForEvent(text) {
  try {
    // For now, do simple parsing. In production, you'd call your Gemini service
    const event = parseEventFromText(text);
    return event;
  } catch (error) {
    console.error('Error analyzing text:', error);
    throw error;
  }
}

// Simple event parsing (replace with your Gemini service logic)
function parseEventFromText(text) {
  // Simple regex patterns for common event formats
  const titleMatch = text.match(/^([^\n\r]+)/);
  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
  const dateMatch = text.match(/(tomorrow|today|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);

  if (!titleMatch) return null;

  const title = titleMatch[1].trim();
  const now = new Date();

  // Simple date calculation
  let eventDate = new Date(now);
  if (dateMatch) {
    const dateStr = dateMatch[1].toLowerCase();
    if (dateStr === 'tomorrow') {
      eventDate.setDate(now.getDate() + 1);
    } else if (dateStr.includes('next')) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf(dateStr.split(' ')[1]);
      if (targetDay !== -1) {
        const currentDay = now.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        eventDate.setDate(now.getDate() + daysUntil);
      }
    }
  }

  // Simple time parsing
  let startTime = '09:00';
  if (timeMatch) {
    startTime = timeMatch[1].toUpperCase();
  }

  const startDateTime = `${eventDate.toISOString().split('T')[0]}T${startTime}:00`;

  return {
    title: title,
    start_time: startDateTime,
    description: text
  };
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
