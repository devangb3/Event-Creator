// Content script to inject the event creator UI into webpages
let eventCreatorContainer = null;

// Debug logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] CONTENT: ${message}`, data || '');
}

log('Content script starting to load');

log('Current URL:', window.location.href);
log('Document ready state:', document.readyState);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request !== 'object') {
    log('ERROR: Invalid request object received');
    return false;
  }

  if (!sender || typeof sender !== 'object') {
    log('ERROR: Invalid sender object received');
    return false;
  }

  log('Received message from background:', {
    action: request.action,
    textLength: request.text?.length,
    senderUrl: sender.tab?.url
  });

  if (request.action === 'createEvent') {
    log('Creating event UI for text:', request.text?.substring(0, 100));

    if (typeof request.text === 'string') {
      showEventCreator(request.text);
      sendResponse({ success: true });
    } else {
      log('Invalid text received for event creation');
      sendResponse({ success: false, error: 'Invalid text selection' });
    }
  }

  return true; // Keep message channel open
});

// Log when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    log('DOM content loaded');
  });
} else {
  log('DOM already loaded');
}

// Log when everything is ready
window.addEventListener('load', () => {
  log('Page fully loaded');
});

// Test if content script is working
setTimeout(() => {
  log('Content script is active and ready to receive messages');
  log('Chrome runtime available:', !!chrome.runtime);
  log('Chrome tabs available:', !!chrome.tabs);
}, 1000);

// Function to show the event creator UI
function showEventCreator(selectedText) {
  log('showEventCreator called with text length:', selectedText?.length);

  // Remove existing UI if present
  if (eventCreatorContainer) {
    log('Removing existing UI container');
    eventCreatorContainer.remove();
  }

  log('Creating new UI container');

  // Create container for the UI
  eventCreatorContainer = document.createElement('div');
  eventCreatorContainer.id = 'gemini-event-creator';
  eventCreatorContainer.innerHTML = `
    <div class="event-creator-overlay">
      <div class="event-creator-modal" role="dialog" aria-modal="true" aria-labelledby="eventCreatorTitle">
        <div class="event-creator-header">
          <h3 id="eventCreatorTitle">Event Creator</h3>
          <button class="close-button" id="closeEventCreatorBtn" type="button" aria-label="Close event creator">×</button>
        </div>
        <div class="event-creator-body">
          <div class="selected-text-preview">
            <p><strong>Selected text:</strong></p>
            <p class="selected-text">${escapeHtml(selectedText)}</p>
          </div>
          <button class="create-event-btn" id="createEventBtn">
            Create Event
          </button>
          <div class="status-message" id="statusMessage"></div>
          <div class="success-content" id="successContent" style="display: none;">
            <p class="success-text">✓ Event Created!</p>
            <a class="calendar-link" id="calendarLink" target="_blank">
              Add to Google Calendar
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  log('UI HTML created, adding to page');

  // Add to page
  document.body.appendChild(eventCreatorContainer);
  log('UI added to document.body');

  // Add event listeners
  const createBtn = document.getElementById('createEventBtn');
  const closeBtn = document.getElementById('closeEventCreatorBtn');
  const overlay = eventCreatorContainer.querySelector('.event-creator-overlay');
  const modal = eventCreatorContainer.querySelector('.event-creator-modal');

  if (createBtn) {
    log('Create button found, adding event listener');
    createBtn.addEventListener('click', async () => {
      log('Create button clicked');
      await handleCreateEvent(selectedText);
    });
  } else {
    log('ERROR: Create button not found!');
  }

  if (closeBtn) {
    log('Close button found, adding event listener');
    closeBtn.addEventListener('click', () => {
      log('Close button clicked, removing UI');
      eventCreatorContainer.remove();
    });
  } else {
    log('ERROR: Close button not found!');
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        log('Overlay clicked, removing UI');
        eventCreatorContainer.remove();
      }
    });
  } else {
    log('ERROR: Overlay element not found!');
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  log('UI setup complete');
}


// Function to handle event creation
async function handleCreateEvent(text) {
  log('handleCreateEvent called with text length:', text?.length);

  const btn = document.getElementById('createEventBtn');
  const statusDiv = document.getElementById('statusMessage');
  const successDiv = document.getElementById('successContent');
  const calendarLink = document.getElementById('calendarLink');

  if (!btn) {
    log('ERROR: Create button not found');
    return;
  }

  log('Found all required elements, showing loading state');

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Creating...';
  statusDiv.innerHTML = '';

  try {
    log('Sending analyzeText message to background script');

    // Send message to background script to analyze text
    const response = await new Promise((resolve, reject) => {
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout - background script did not respond'));
      }, 10000); // 10 second timeout

      chrome.runtime.sendMessage({
        action: 'analyzeText',
        text: text
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          log('ERROR in chrome.runtime.sendMessage:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          log('Received response from background:', response);
          // Ensure response is not null/undefined
          resolve(response || { success: false, error: 'No response from background script' });
        }
      });
    });

    if (response && typeof response === 'object' && response.success) {
      log('Analysis successful, showing success state');

      // Show success
      btn.style.display = 'none';
      successDiv.style.display = 'block';
      calendarLink.href = response.calendarUrl || '#';
      log('Calendar URL set:', response.calendarUrl);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (eventCreatorContainer && eventCreatorContainer.parentNode) {
          log('Auto-removing UI after timeout');
          eventCreatorContainer.remove();
        }
      }, 20000);
    } else {
      const errorMsg = (response && typeof response === 'object' && response.error) 
        ? response.error 
        : 'Failed to create event - no valid response';
      log('Analysis failed:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    log('ERROR in handleCreateEvent:', error);
    statusDiv.innerHTML = '<p class="error-text">Error creating event. Please try again.</p>';
    btn.disabled = false;
    btn.innerHTML = 'Create Event';
  }
}

// Utility function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
