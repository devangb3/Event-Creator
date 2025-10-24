// Content script to inject the event creator UI into webpages
let eventCreatorContainer = null;
let geminiSetupContainer = null;
let isLoading = false;
let isGeminiSetupVisible = false;
let hasGeminiApiKey = false;
let hasShownGeminiPrompt = false;

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

    const maybeShowSetup = async () => {
      if (!hasGeminiApiKey && !hasShownGeminiPrompt) {
        hasShownGeminiPrompt = true;
        showGeminiSetupModal({ autoOpen: true });
      }
      showEventCreator(request.text);
      sendResponse({ success: true });
    };

    if (typeof request.text === 'string') {
      maybeShowSetup();
    } else {
      log('Invalid text received for event creation');
      sendResponse({ success: false, error: 'Invalid text selection' });
    }
  } else if (request.action === 'showGeminiSetup') {
    log('Creating Gemini setup UI');
    showGeminiSetupModal({ autoOpen: true });
    sendResponse({ success: true });
  } else if (request.action === 'apiKeyStatus') {
    hasGeminiApiKey = request?.hasApiKey === true;
    sendResponse({ success: true });
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

  try {
    chrome.runtime.sendMessage({ action: 'getApiKeyStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        log('Could not fetch API key status:', chrome.runtime.lastError.message);
      } else if (response?.success && response.status) {
        hasGeminiApiKey = response.status.hasApiKey === true;
        log('Gemini API key status received:', hasGeminiApiKey);
      }
    });
  } catch (error) {
    log('Error requesting API key status:', error);
  }
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

function showGeminiSetupModal(options = {}) {
  log('showGeminiSetupModal called');

  if (isGeminiSetupVisible) {
    log('Gemini setup modal already visible');
    return;
  }

  if (geminiSetupContainer) {
    geminiSetupContainer.remove();
  }

  geminiSetupContainer = document.createElement('div');
  geminiSetupContainer.id = 'gemini-setup-container';
  const shouldHighlight = options.autoOpen === true;

  geminiSetupContainer.innerHTML = `
    <div class="gemini-setup-overlay">
      <div class="gemini-setup-modal${shouldHighlight ? ' highlight' : ''}" role="dialog" aria-modal="true" aria-labelledby="geminiSetupTitle">
        <div class="gemini-setup-header">
          <h3 id="geminiSetupTitle">Enable Gemini AI</h3>
          <button class="close-button" id="closeGeminiSetupBtn" type="button" aria-label="Close Gemini setup">×</button>
        </div>
        <div class="gemini-setup-body">
          <p class="setup-description">
            Paste your Google Gemini API key below to enable AI-powered event extraction.
            This key is stored securely on your device.
          </p>
          <label class="input-label" for="geminiApiKeyInput">Gemini API Key</label>
          <input type="password" id="geminiApiKeyInput" class="gemini-input" placeholder="AIza..." autocomplete="off" />
          <div class="setup-actions">
            <button class="primary-btn" id="saveGeminiApiKeyBtn">Save API Key</button>
            <button class="secondary-btn" id="testGeminiApiKeyBtn">Test API Key</button>
          </div>
          <div class="setup-status" id="geminiSetupStatus"></div>
          <p class="setup-help">
            Don't have a key? <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Get one here</a>.
          </p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(geminiSetupContainer);
  isGeminiSetupVisible = true;

  const overlay = geminiSetupContainer.querySelector('.gemini-setup-overlay');
  const modal = geminiSetupContainer.querySelector('.gemini-setup-modal');
  const closeBtn = document.getElementById('closeGeminiSetupBtn');
  const saveBtn = document.getElementById('saveGeminiApiKeyBtn');
  const testBtn = document.getElementById('testGeminiApiKeyBtn');
  const apiKeyInput = document.getElementById('geminiApiKeyInput');
  const statusDiv = document.getElementById('geminiSetupStatus');

  const closeModal = () => {
    if (geminiSetupContainer) {
      geminiSetupContainer.remove();
      geminiSetupContainer = null;
      isGeminiSetupVisible = false;
    }
  };

  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeModal();
    });
  }

  const updateStatus = (message, type = 'info') => {
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.setAttribute('data-status-type', type);
  };

  const setButtonsDisabled = (disabled) => {
    if (saveBtn) saveBtn.disabled = disabled;
    if (testBtn) testBtn.disabled = disabled;
    if (apiKeyInput) apiKeyInput.disabled = disabled;
  };

  const handleApiKeyAction = async (action) => {
    if (!apiKeyInput) return;
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      updateStatus('Please enter your Gemini API key.', 'error');
      return;
    }

    try {
      setButtonsDisabled(true);
      updateStatus(`${action === 'save' ? 'Saving' : 'Testing'} API key...`, 'pending');

      // Send message to background to save/test the API key
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: action === 'save' ? 'setApiKey' : 'testApiKey',
          apiKey
        }, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });

      if (response?.success) {
        updateStatus(action === 'save' ? 'API key saved successfully!' : 'API key is valid!', 'success');
        if (action === 'save') {
          setTimeout(() => {
            closeModal();
          }, 1500);
        }
      } else {
        throw new Error(response?.error || `Failed to ${action} API key`);
      }
    } catch (error) {
      log(`ERROR during API key ${action}:`, error);
      updateStatus(error.message || `Failed to ${action} API key`, 'error');
    } finally {
      setButtonsDisabled(false);
    }
  };

  if (saveBtn) {
    saveBtn.addEventListener('click', () => handleApiKeyAction('save'));
  }

  if (testBtn) {
    testBtn.addEventListener('click', () => handleApiKeyAction('test'));
  }

  // Autofocus input
  setTimeout(() => {
    if (apiKeyInput) {
      apiKeyInput.focus();
    }
  }, 50);
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
