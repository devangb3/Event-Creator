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

// OPTIONAL: background trigger support
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === "createEvent" && typeof request.text === "string") {
    log("BG requested createEvent", { textPreview: request.text.slice(0, 80) });
    showEventCreator(request.text);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: "Bad request or no text" });
  }
  return true;
});

// Listen for mouseup anywhere in the page
document.addEventListener("mouseup", (e) => {
  // If popup is already open AND mouseup happened inside it, do nothing
  if (eventCreatorContainer && eventCreatorContainer.contains(e.target)) {
    log("mouseup inside popup -> ignore");
    return;
  }

  const selectedText = window.getSelection().toString().trim();

  log("document mouseup", {
    textPreview: selectedText.slice(0, 80),
    len: selectedText.length,
  });

  // Only trigger popup if real selection (>3 chars)
  if (selectedText && selectedText.length > 3) {
    showEventCreator(selectedText);
  }
});

log(">>> mouseup listener attached");

// Build + show popup
function showEventCreator(selectedText) {
  log("showEventCreator called", { textPreview: selectedText.slice(0, 80) });

  // clean existing popup
  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  eventCreatorContainer = document.createElement("div");
  eventCreatorContainer.id = "gemini-event-creator";

  // --- STYLE PALETTE ---
  // Overlay: same dim background
  // Card: subtle off-white / light gray body
  // Header: slightly darker strip
  // Button: neutral/dark button instead of bright blue
  // Text box: soft gray background
  //
  // The goal is "tooling panel" vibe instead of "Google popup".
  //
  eventCreatorContainer.innerHTML = `
    <div class="event-creator-overlay" style="
      position:fixed;
      inset:0;
      z-index:999999;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(0,0,0,0.35);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div class="event-creator-modal" role="dialog" aria-modal="true" style="
        background:#f8f9fa;
        max-width:360px;
        width:90%;
        border-radius:10px;
        box-shadow:0 20px 48px rgba(0,0,0,0.35);
        position:relative;
        z-index:1000001;
        border:1px solid rgba(0,0,0,0.08);
        color:#1a1a1a;
      ">
        <div class="event-creator-header" style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:12px 16px;
          background:#eceff1;
          border-bottom:1px solid rgba(0,0,0,0.07);
          border-top-left-radius:10px;
          border-top-right-radius:10px;
        ">
          <h3 style="
            margin:0;
            font-size:14px;
            font-weight:600;
            color:#1f2937;
            letter-spacing:-0.02em;
          ">Create Event</h3>

          <button class="close-button" id="closeEventCreatorBtn" style="
            border:none;
            background:none;
            font-size:16px;
            line-height:16px;
            cursor:pointer;
            padding:4px 8px;
            font-weight:600;
            color:#4b5563;
          ">×</button>
        </div>

        <div class="event-creator-body" style="
          padding:16px;
          max-height:60vh;
          overflow:auto;
          font-size:13px;
          line-height:1.4;
          color:#1f2937;
        ">

          <div class="selected-text-preview" style="margin-bottom:14px;">
            <p style="
              margin:0 0 6px 0;
              font-weight:600;
              color:#111827;
              font-size:12px;
              letter-spacing:-0.02em;
            ">Selected text</p>

            <p class="selected-text" style="
              margin:0;
              background:#ffffff;
              border:1px solid rgba(0,0,0,0.1);
              border-radius:6px;
              padding:8px;
              font-size:12px;
              line-height:1.4;
              color:#374151;
              white-space:pre-wrap;
              box-shadow:0 1px 2px rgba(0,0,0,0.05);
            ">${escapeHtml(selectedText)}</p>
          </div>

          <button class="create-event-btn" id="createEventBtn" style="
            display:inline-block;
            background:#111827;
            color:#fff;
            border:none;
            border-radius:6px;
            padding:8px 12px;
            font-size:12px;
            font-weight:500;
            cursor:pointer;
            line-height:1.2;
            box-shadow:0 2px 4px rgba(0,0,0,0.2);
          ">
            Create Event
          </button>

          <div class="status-message" id="statusMessage" style="
            margin-top:10px;
            font-size:12px;
            color:#dc2626;
            font-weight:500;
          "></div>

          <div class="success-content" id="successContent" style="
            display:none;
            margin-top:14px;
            background:#ecfdf5;
            border:1px solid #10b98133;
            border-radius:6px;
            padding:10px;
            box-shadow:0 1px 2px rgba(0,0,0,0.05);
          ">
            <p class="success-text" style="
              margin:0 0 6px 0;
              color:#065f46;
              font-weight:600;
              font-size:12px;
              line-height:1.4;
            ">
              ✓ Event Created
            </p>
            <a class="calendar-link" id="calendarLink" target="_blank" style="
              display:inline-block;
              font-size:12px;
              line-height:1.2;
              color:#065f46;
              font-weight:500;
              text-decoration:underline;
              word-break:break-word;
            ">
              Add to Google Calendar
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(eventCreatorContainer);
  log("Popup injected");

  const overlayEl = eventCreatorContainer.querySelector(".event-creator-overlay");
  const modalEl   = eventCreatorContainer.querySelector(".event-creator-modal");
  const closeBtn  = document.getElementById("closeEventCreatorBtn");
  const createBtn = document.getElementById("createEventBtn");

  if (!closeBtn) log("closeBtn NOT FOUND");
  if (!overlayEl) log("overlayEl NOT FOUND");
  if (!modalEl) log("modalEl NOT FOUND");

  // stop events in modal from bubbling to document
  ["mousedown","mouseup","click"].forEach(ev => {
    modalEl.addEventListener(ev, e => {
      e.stopPropagation();
    });
  });

  // close button: close immediately on mousedown
  closeBtn.addEventListener("mousedown", (e) => {
    log("closeBtn mousedown");
    e.stopPropagation();
    e.preventDefault();
    destroyPopup();
  });

  // fallback on click
  closeBtn.addEventListener("click", (e) => {
    log("closeBtn click fallback");
    e.stopPropagation();
    e.preventDefault();
    destroyPopup();
  });

  // clicking outside (overlay) closes popup
  ["mousedown","mouseup","click"].forEach(ev => {
    overlayEl.addEventListener(ev, (e) => {
      if (e.target === overlayEl) {
        log(`overlay ${ev} -> close`);
        e.stopPropagation();
        e.preventDefault();
        destroyPopup();
      }
    });
  });

  // Create Event button
  createBtn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    log("createEventBtn mousedown");
    handleCreateEvent(selectedText);
  });
}

// close popup + clear highlight so it won't reopen immediately
function destroyPopup() {
  log("destroyPopup called");

  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  const sel = window.getSelection();
  if (sel && sel.removeAllRanges) {
    sel.removeAllRanges();
  }

  log("Popup removed + selection cleared");
}

// ask background.js to parse the event and build calendar link
async function handleCreateEvent(text) {
  const btn = document.getElementById("createEventBtn");
  const statusDiv = document.getElementById("statusMessage");
  const successDiv = document.getElementById("successContent");
  const calendarLink = document.getElementById("calendarLink");

  if (!btn) {
    log("ERROR: createEventBtn missing?");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating...";
  statusDiv.textContent = "";

  try {
    const resp = await sendAnalyzeText(text);

    if (resp?.success) {
      btn.style.display = "none";
      successDiv.style.display = "block";
      calendarLink.href = resp.calendarUrl || "#";

      setTimeout(() => {
        destroyPopup();
      }, 20000);
    } else {
      throw new Error(resp?.error || "Failed to create event");
    }
  } catch (err) {
    statusDiv.textContent = "Error creating event. Please try again.";
    btn.disabled = false;
    btn.textContent = "Create Event";
  }
}

// background messaging helper
function sendAnalyzeText(text) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timeout"));
    }, 10000);

    chrome.runtime.sendMessage(
      { action: "analyzeText", text },
      (resp) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(resp || { success: false, error: "No response" });
      }
    );
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