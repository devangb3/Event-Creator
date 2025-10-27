// content.js

let eventCreatorContainer = null;

function log(msg, data = null) {
  const ts = new Date().toISOString();
  if (data !== null) {
    console.log(`[${ts}] CONTENT: ${msg}`, data);
  } else {
    console.log(`[${ts}] CONTENT: ${msg}`);
  }
}

console.log(">>> CONTENT.JS ATTACHED <<<", window.location.href);

// Message handler for popup and background script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === "createEvent" && typeof request.text === "string") {
    log("BG requested createEvent", { textPreview: request.text.slice(0, 80) });
    showEventCreator(request.text);
    sendResponse({ success: true });
  } else if (request?.action === "getSelectedText") {
    // Handle popup request for selected text
    const selectedText = window.getSelection().toString().trim();
    log("Popup requested selected text", { 
      textPreview: selectedText.slice(0, 80),
      length: selectedText.length 
    });
    sendResponse({ 
      success: true, 
      text: selectedText,
      hasSelection: selectedText.length > 0
    });
  } else {
    sendResponse({ success: false, error: "Bad request or no text" });
  }
  return true;
});

// Listen for mouseup anywhere in the page
document.addEventListener("mouseup", (e) => {
  // Store mouse position for button placement
  window.lastMouseX = e.clientX;
  window.lastMouseY = e.clientY;

  // If popup is already open AND mouseup happened inside it, do nothing
  if (eventCreatorContainer && eventCreatorContainer.contains(e.target)) {
    log("mouseup inside popup -> ignore");
    return;
  }

  const selectedText = window.getSelection().toString().trim();

  log("document mouseup", {
    textPreview: selectedText.slice(0, 80),
    len: selectedText.length,
    mouseX: e.clientX,
    mouseY: e.clientY
  });

  // Only trigger popup if real selection (>3 chars)
  if (selectedText && selectedText.length > 3) {
    showEventCreator(selectedText);
  }
});

log(">>> mouseup listener attached");

// Build + show small button near mouse pointer
function showEventCreator(selectedText) {
  log("showEventCreator called", { textPreview: selectedText.slice(0, 80) });

  // clean existing popup
  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  // Get mouse position from the last mouseup event
  const mouseX = window.lastMouseX || 0;
  const mouseY = window.lastMouseY || 0;

  eventCreatorContainer = document.createElement("div");
  eventCreatorContainer.id = "gemini-event-creator";
  eventCreatorContainer.style.cssText = `
    position: fixed;
    top: ${mouseY + 10}px;
    left: ${mouseX + 10}px;
    z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
  `;

  // Create a small floating button
  eventCreatorContainer.innerHTML = `
    <div class="event-creator-button" style="
      background: #111827;
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
    ">
      <span style="font-size: 14px;">📅</span>
      <span>Create Event</span>
    </div>
  `;

  document.body.appendChild(eventCreatorContainer);
  log("Small button injected at position:", { x: mouseX + 10, y: mouseY + 10 });

  const button = eventCreatorContainer.querySelector(".event-creator-button");

  // Add hover effect
  button.addEventListener("mouseenter", () => {
    button.style.background = "#1f2937";
    button.style.transform = "translateY(-1px)";
    button.style.boxShadow = "0 6px 16px rgba(0,0,0,0.4)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.background = "#111827";
    button.style.transform = "translateY(0)";
    button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  });

  // Handle button click
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    log("Create Event button clicked");
    handleCreateEvent(selectedText);
  });

  // Handle right-click to show editable form
  button.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    log("Right-click on Create Event button");
    showEditableForm(selectedText);
  });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (eventCreatorContainer) {
      destroyPopup();
    }
  }, 5000);
}

// close popup + clear highlight so it won't reopen immediately
function destroyPopup() {
  log("destroyPopup called");

  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  // const sel = window.getSelection();
  // if (sel && sel.removeAllRanges) {
  //   sel.removeAllRanges();
  // }

  log("Popup removed + selection cleared");
}

// Show editable form for event details
function showEditableForm(selectedText) {
  log("showEditableForm called", { textPreview: selectedText.slice(0, 80) });

  // Clean existing popup
  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  // Get mouse position
  const mouseX = window.lastMouseX || 0;
  const mouseY = window.lastMouseY || 0;

  eventCreatorContainer = document.createElement("div");
  eventCreatorContainer.id = "gemini-event-creator";
  eventCreatorContainer.style.cssText = `
    position: fixed;
    top: ${mouseY + 10}px;
    left: ${mouseX + 10}px;
    z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
  `;

  // Create editable form
  eventCreatorContainer.innerHTML = `
    <div class="event-editor-form" style="
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      padding: 20px;
      min-width: 320px;
      max-width: 400px;
      border: 1px solid rgba(0,0,0,0.1);
    ">
      <div class="form-header" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
      ">
        <h3 style="
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        ">Edit Event Details</h3>
        <button id="closeFormBtn" style="
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
        ">×</button>
      </div>

      <form id="eventForm">
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 6px;
          ">Event Title *</label>
          <input type="text" id="eventTitle" required style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
          " placeholder="Enter event title">
        </div>

        <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div class="form-group" style="flex: 1;">
            <label style="
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: #374151;
              margin-bottom: 6px;
            ">Start Time *</label>
            <input type="datetime-local" id="startTime" required style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 14px;
              box-sizing: border-box;
            ">
          </div>
          <div class="form-group" style="flex: 1;">
            <label style="
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: #374151;
              margin-bottom: 6px;
            ">End Time</label>
            <input type="datetime-local" id="endTime" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 14px;
              box-sizing: border-box;
            ">
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label style="
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 6px;
          ">Description</label>
          <textarea id="eventDescription" rows="3" style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
            font-family: inherit;
          " placeholder="Enter event description">${escapeHtml(selectedText)}</textarea>
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label style="
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 6px;
          ">Location</label>
          <input type="text" id="eventLocation" style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
          " placeholder="Enter event location">
        </div>

        <div class="form-actions" style="
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        ">
          <button type="button" id="cancelBtn" style="
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          ">Cancel</button>
          <button type="submit" id="createEventBtn" style="
            padding: 8px 16px;
            border: none;
            background: #111827;
            color: white;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 500;
          ">Create Event</button>
        </div>
      </form>

      <div id="formStatus" style="
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        display: none;
      "></div>
    </div>
  `;

  document.body.appendChild(eventCreatorContainer);
  log("Editable form injected");

  // Set default values
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
  defaultStart.setHours(9, 0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000); // 1 hour later

  document.getElementById('eventTitle').value = selectedText.slice(0, 50);
  document.getElementById('startTime').value = defaultStart.toISOString().slice(0, 16);
  document.getElementById('endTime').value = defaultEnd.toISOString().slice(0, 16);

  // Add event listeners
  const closeBtn = document.getElementById('closeFormBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const form = document.getElementById('eventForm');
  const statusDiv = document.getElementById('formStatus');

  // Close form
  closeBtn.addEventListener('click', () => destroyPopup());
  cancelBtn.addEventListener('click', () => destroyPopup());

  // Handle form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmission();
  });

  // Auto-focus on title field
  document.getElementById('eventTitle').focus();
}

// Handle form submission
async function handleFormSubmission() {
  const title = document.getElementById('eventTitle').value.trim();
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const description = document.getElementById('eventDescription').value.trim();
  const location = document.getElementById('eventLocation').value.trim();
  const statusDiv = document.getElementById('formStatus');
  const submitBtn = document.getElementById('createEventBtn');

  if (!title) {
    showFormStatus('Please enter an event title', 'error');
    return;
  }

  if (!startTime) {
    showFormStatus('Please enter a start time', 'error');
    return;
  }

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';
  showFormStatus('Creating event...', 'info');

  try {
    // Create event object from form data
    const eventData = {
      title: title,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      description: description || title,
      location: location || null
    };

    // Send to background script for calendar creation
    const response = await chrome.runtime.sendMessage({
      action: 'createEventFromData',
      eventData: eventData
    });

    if (response && response.success) {
      showFormStatus(`Event "${response.eventTitle}" created successfully!`, 'success');
      setTimeout(() => {
        destroyPopup();
      }, 2000);
    } else {
      throw new Error(response?.error || 'Failed to create event');
    }

  } catch (error) {
    log('Error creating event from form:', error);
    showFormStatus('Error creating event: ' + error.message, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Event';
  }
}

// Show form status message
function showFormStatus(message, type) {
  const statusDiv = document.getElementById('formStatus');
  statusDiv.textContent = message;
  statusDiv.className = `form-status ${type}`;
  statusDiv.style.display = 'block';
  
  if (type === 'success') {
    statusDiv.style.background = '#ecfdf5';
    statusDiv.style.color = '#065f46';
    statusDiv.style.border = '1px solid #10b98133';
  } else if (type === 'error') {
    statusDiv.style.background = '#fef2f2';
    statusDiv.style.color = '#991b1b';
    statusDiv.style.border = '1px solid #fca5a533';
  } else {
    statusDiv.style.background = '#eff6ff';
    statusDiv.style.color = '#1e40af';
    statusDiv.style.border = '1px solid #3b82f633';
  }
}

// ask background.js to parse the event and build calendar link
async function handleCreateEvent(text) {
  const button = eventCreatorContainer?.querySelector(".event-creator-button");
  
  if (!button) {
    log("ERROR: event creator button missing?");
    return;
  }

  // Update button to show loading state
  button.innerHTML = `
    <span style="font-size: 14px;">⏳</span>
    <span>Creating...</span>
  `;
  button.style.background = "#6b7280";
  button.style.cursor = "not-allowed";

  try {
    const resp = await sendAnalyzeText(text);

    if (resp?.success) {
      // Show success state
      button.innerHTML = `
        <span style="font-size: 14px;">✅</span>
        <span>Created!</span>
      `;
      button.style.background = "#10b981";
      
      // Auto-hide after 2 seconds
      setTimeout(() => {
        destroyPopup();
      }, 2000);
    } else {
      throw new Error(resp?.error || "Failed to create event");
    }
  } catch (err) {
    // Show error state
    button.innerHTML = `
      <span style="font-size: 14px;">❌</span>
      <span>Error</span>
    `;
    button.style.background = "#ef4444";
    
    // Reset after 3 seconds
    setTimeout(() => {
      button.innerHTML = `
        <span style="font-size: 14px;">📅</span>
        <span>Create Event</span>
      `;
      button.style.background = "#111827";
      button.style.cursor = "pointer";
    }, 3000);
  }
}

// background messaging helper
function sendAnalyzeText(text) {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] CONTENT DEBUG: sendAnalyzeText called with text:`, text?.slice(0, 80));

    let timeoutFired = false;

    const timeout = setTimeout(() => {
      timeoutFired = true;
      const ts2 = new Date().toISOString();
      console.log(`[${ts2}] CONTENT DEBUG: sendAnalyzeText TIMEOUT after 10s (background maybe dead)`);
      reject(new Error("Request timeout (background did not respond)"));
    }, 10000);

    try {
      chrome.runtime.sendMessage(
        { action: "analyzeText", text },
        (resp) => {
          clearTimeout(timeout);

          const ts3 = new Date().toISOString();
          console.log(`[${ts3}] CONTENT DEBUG: sendAnalyzeText callback fired`, {
            resp,
            lastError: chrome.runtime.lastError
              ? chrome.runtime.lastError.message
              : null,
            timeoutFired
          });

          if (timeoutFired) {
            // we already rejected, just ignore late callback
            return;
          }

          if (chrome.runtime.lastError) {
            reject(new Error("chrome.runtime.lastError: " + chrome.runtime.lastError.message));
            return;
          }

          resolve(resp || { success: false, error: "No response" });
        }
      );
    } catch (err) {
      clearTimeout(timeout);
      const ts4 = new Date().toISOString();
      console.log(`[${ts4}] CONTENT DEBUG: sendAnalyzeText threw synchronously`, err);
      reject(err);
    }
  });
}

// escape user-provided HTML
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m])
  );
}