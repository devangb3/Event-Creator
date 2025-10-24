// Content script to inject the event creator UI into webpages
let eventCreatorContainer = null;
let isLoading = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createEvent') {
    showEventCreator(request.text);
  }
});

// Function to show the event creator UI
function showEventCreator(selectedText) {
  // Remove existing UI if present
  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
  }

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

  // Add to page
  document.body.appendChild(eventCreatorContainer);

  // Add event listeners
  document.getElementById('createEventBtn').addEventListener('click', async () => {
    await handleCreateEvent(selectedText);
  });

  // Close on outside click
  eventCreatorContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('event-creator-overlay')) {
      eventCreatorContainer.remove();
    }
  });
}

// Function to handle event creation
async function handleCreateEvent(text) {
  const btn = document.getElementById('createEventBtn');
  const statusDiv = document.getElementById('statusMessage');
  const successDiv = document.getElementById('successContent');
  const calendarLink = document.getElementById('calendarLink');

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Creating...';
  statusDiv.innerHTML = '';

  try {
    // Send message to background script to analyze text
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'analyzeText',
        text: text
      }, resolve);
    });

    if (response && response.success) {
      // Show success
      btn.style.display = 'none';
      successDiv.style.display = 'block';
      calendarLink.href = response.calendarUrl;

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (eventCreatorContainer && eventCreatorContainer.parentNode) {
          eventCreatorContainer.remove();
        }
      }, 10000);
    } else {
      throw new Error('Failed to create event');
    }
  } catch (error) {
    console.error('Error creating event:', error);
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
