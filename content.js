// Content script to inject the event creator UI into webpages
let eventCreatorContainer = null;
let isLoading = false;

// Debug logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] CONTENT: ${message}`, data || '');
}

// Log when content script starts loading
log('Content script starting to load');

// Check if we're in the right context
log('Current URL:', window.location.href);
log('Document ready state:', document.readyState);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Received message from background:', {
    action: request.action,
    textLength: request.text?.length,
    senderUrl: sender.tab?.url
  });

  if (request.action === 'createEvent') {
    log('Creating event UI for text:', request.text?.substring(0, 100));
    showEventCreator(request.text);
    sendResponse({ success: true }); // Acknowledge receipt
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
      <div class="event-creator-modal">
        <div class="event-creator-header">
          <h3>Event Creator</h3>
          <button class="close-button" onclick="document.getElementById('gemini-event-creator').remove()">×</button>
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
  if (createBtn) {
    log('Create button found, adding event listener');
    createBtn.addEventListener('click', async () => {
      log('Create button clicked');
      await handleCreateEvent(selectedText);
    });
  } else {
    log('ERROR: Create button not found!');
  }

  // Close on outside click
  eventCreatorContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('event-creator-overlay')) {
      log('Overlay clicked, removing UI');
      eventCreatorContainer.remove();
    }
  });

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
      chrome.runtime.sendMessage({
        action: 'analyzeText',
        text: text
      }, (response) => {
        if (chrome.runtime.lastError) {
          log('ERROR in chrome.runtime.sendMessage:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          log('Received response from background:', response);
          resolve(response);
        }
      });
    });

    if (response && response.success) {
      log('Analysis successful, showing success state');

      // Show success
      btn.style.display = 'none';
      successDiv.style.display = 'block';
      calendarLink.href = response.calendarUrl;
      log('Calendar URL set:', response.calendarUrl);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (eventCreatorContainer && eventCreatorContainer.parentNode) {
          log('Auto-removing UI after timeout');
          eventCreatorContainer.remove();
        }
      }, 10000);
    } else {
      log('Analysis failed:', response?.error);
      throw new Error(response?.error || 'Failed to create event');
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
