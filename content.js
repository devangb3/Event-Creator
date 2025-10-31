// content.js

let eventCreatorContainer = null;
let isCreatingEvent = false; // hard guard against duplicates
let isEditingOpen = false;
let snackbarContainer = null;
let outsideClickHandler = null;
let colorDropdownOpen = false;
let reminderDropdownOpen = false;
let serviceEnabled = true; // tracks if extension is enabled

/* ------------------------------------------------------------------
   THEME  (popup-style)
------------------------------------------------------------------ */
const PRIMARY_BG   = "rgba(109,40,91,0.92)";  // same as popup
const PRIMARY_DARK = "#4a044e";
const CARD_SHADOW  = "0 24px 48px rgba(0,0,0,0.45)";
const CARD_RADIUS  = "2px";                   // KEEP: you wanted this
const CARD_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const CARD_MAX_WIDTH = "min(360px, 90vw)";

/* Calendar-like colors */
const COLOR_OPTIONS = [
  { value: "default",   name: "Default",   hex: "#4285f4" },
  { value: "lavender",  name: "Lavender",  hex: "#a79bff" },
  { value: "sage",      name: "Sage",      hex: "#7cb342" },
  { value: "grape",     name: "Grape",     hex: "#b36ae2" },
  { value: "flamingo",  name: "Flamingo",  hex: "#ff6d79" },
  { value: "banana",    name: "Banana",    hex: "#fbd74b" },
  { value: "tangerine", name: "Tangerine", hex: "#ff9c2e" },
  { value: "peacock",   name: "Peacock",   hex: "#2c9fff" },
  { value: "graphite",  name: "Graphite",  hex: "#6b6b6b" },
  { value: "basil",     name: "Basil",     hex: "#0f9d58" },
  { value: "tomato",    name: "Tomato",    hex: "#d50000" }
];

/* Reminder options */
const REMINDER_OPTIONS = [
  { value: "2880", label: "2 days before" },
  { value: "1440", label: "1 day before" },
  { value: "120",  label: "2 hours before" },
  { value: "60",   label: "1 hour before" },
  { value: "30",   label: "30 minutes before" },
  { value: "10",   label: "10 minutes before" }
];

// log
function log(msg, data = null) {
  const ts = new Date().toISOString();
  if (data !== null) {
    console.log(`[${ts}] CONTENT: ${msg}`, data);
  } else {
    console.log(`[${ts}] CONTENT: ${msg}`);
  }
}
console.log(">>> CONTENT.JS ATTACHED <<<", window.location.href);

function initServiceStatus() {
  // Don't throw errors if background script isn't ready yet
  // Just default to enabled and update when background responds
  if (!chrome.runtime?.id) {
    // Extension context is invalid
    serviceEnabled = true;
    return;
  }

  try {
    chrome.runtime.sendMessage({ action: "getServiceStatus" }, (resp) => {
      // Silently handle connection errors during initialization
      if (chrome.runtime.lastError) {
        // Background might not be ready yet, default to enabled
        serviceEnabled = true;
        return;
      }
      if (resp && typeof resp.enabled === 'boolean') {
        serviceEnabled = resp.enabled;
        log("Service status initialized", { serviceEnabled });
      }
    });
  } catch (err) {
    // Silently default to enabled if something goes wrong
    serviceEnabled = true;
  }
}

// Initialize service status when script loads
// Use a small delay to give background script time to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initServiceStatus);
} else {
  // DOM already loaded, check status after a brief delay
  setTimeout(initServiceStatus, 100);
}

/* ------------------------------------------------------------------
   SNACKBAR
------------------------------------------------------------------ */
function updateSnackbarPosition() {
  if (!snackbarContainer) return;

  let baseBottomPx = 16;

  if (eventCreatorContainer) {
    const style = getComputedStyle(eventCreatorContainer);
    const isVisible =
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0";
    if (isVisible) {
      const rect = eventCreatorContainer.getBoundingClientRect();
      const popupHeight = rect.height || 0;
      baseBottomPx = 16 + popupHeight + 8;
    }
  }

  snackbarContainer.style.bottom = baseBottomPx + "px";
  snackbarContainer.style.right  = "16px";
  snackbarContainer.style.left   = "auto";
}

function ensureSnackbarContainer() {
  if (!snackbarContainer) {
    snackbarContainer = document.createElement("div");
    snackbarContainer.id = "gemini-snackbar-wrapper";
    document.body.appendChild(snackbarContainer);
  }

  snackbarContainer.style.cssText = `
    position: fixed;
    z-index: 1000000;
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-end;
    gap: 8px;
    pointer-events: none;
    max-width: ${CARD_MAX_WIDTH};
    width: ${CARD_MAX_WIDTH};
    font-family: ${CARD_FONT};
    box-sizing: border-box;
  `;

  updateSnackbarPosition();
}

function showSnackbar(message, type = "info", persist = false) {
  ensureSnackbarContainer();

  const bg =
    type === "error"   ? "#b91c1c" :
    type === "success" ? "#065f46" :
    type === "pending" ? "#9ca3af" :
                          "#1f2937";

  const snack = document.createElement("div");
  snack.style.cssText = `
    width: 100%;
    max-width: 100%;
    background: ${bg};
    color: #fff;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 16px 32px rgba(0,0,0,0.5);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    pointer-events: auto;
    animation: fade-in-snack 0.2s ease-out forwards;
    box-sizing: border-box;
  `;

  snack.innerHTML = `
    <div style="flex:1; word-break:break-word; padding-right:12px;">
      ${message}
    </div>
    <button style="
      background:none;
      border:none;
      color:white;
      font-size:16px;
      line-height:1;
      cursor:pointer;
      padding:0;
      flex-shrink:0;
    ">×</button>
  `;

  const closeBtn = snack.querySelector("button");
  closeBtn.addEventListener("click", () => {
    if (snack && snack.parentNode) {
      snack.parentNode.removeChild(snack);
    }
    updateSnackbarPosition();
  });

  snackbarContainer.appendChild(snack);
  updateSnackbarPosition();

  if (!persist) {
    setTimeout(() => {
      if (snack && snack.parentNode) {
        snack.parentNode.removeChild(snack);
      }
      updateSnackbarPosition();
    }, 3000);
  }

  return snack;
}

(function ensureSnackbarKeyframes() {
  if (document.getElementById("gemini-snackbar-styles")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "gemini-snackbar-styles";
  styleEl.textContent = `
    @keyframes fade-in-snack {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);
})();

/* ------------------------------------------------------------------
   RUNTIME MESSAGE HANDLER
------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === "serviceStatus") {
    // Handle service status updates from background
    serviceEnabled = request.enabled === true;
    log("Service status updated", { serviceEnabled });

    // If service was disabled and popup is showing, close it
    if (!serviceEnabled && eventCreatorContainer) {
      destroyPopup();
    }

    sendResponse({ success: true });
  } else if (request?.action === "createEvent" && typeof request.text === "string") {
    showEventCreator(request.text);
    sendResponse({ success: true });
  } else if (request?.action === "getSelectedText") {
    const selectedText = window.getSelection().toString().trim();
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

/* ------------------------------------------------------------------
   HIGHLIGHT LISTENERS
------------------------------------------------------------------ */
document.addEventListener("mouseup", (e) => {
  window.lastMouseX = e.clientX;
  window.lastMouseY = e.clientY;

  if (eventCreatorContainer && eventCreatorContainer.contains(e.target)) {
    return;
  }

  // Check if service is enabled before showing popup
  if (!serviceEnabled) {
    return;
  }

  const selectedText = window.getSelection().toString().trim();
  if (selectedText && selectedText.length > 3) {
    showEventCreator(selectedText);
  }
});

document.addEventListener("selectionchange", () => {
  const currentText = window.getSelection().toString().trim();
  if (!currentText && eventCreatorContainer && !isCreatingEvent && !isEditingOpen) {
    destroyPopup();
  }
});

/* ------------------------------------------------------------------
   STYLE HELPERS
------------------------------------------------------------------ */
function getOuterWrapperStyle() {
  return `
    position: fixed;
    bottom: 16px;
    right: 16px;
    max-width: ${CARD_MAX_WIDTH};
    width: ${CARD_MAX_WIDTH};
    box-sizing: border-box;
    pointer-events: auto;
    font-family: ${CARD_FONT};
    z-index: 999999;
  `;
}

function getCardWrapperStyle() {
  return `
    background: ${PRIMARY_BG};
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    border-radius: ${CARD_RADIUS};
    box-shadow: ${CARD_SHADOW};
    padding: 8px;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: ${CARD_FONT};
    border: 1px solid rgba(255,255,255,0.22);
    box-sizing: border-box;
    border-radius: 16px;
  `;
}

/* inner card like popup sections */
function getInnerSectionStyle() {
  return `
    background: rgba(0,0,0,0.15);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
}

function getHeaderRowStyle() {
  return `
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: nowrap;
  `;
}

function getHeaderIconBtnStyle() {
  return `
    background:none;
    border:none;
    color:#ffffff;
    font-size:16px;
    line-height:1;
    cursor:pointer;
    padding:4px 6px;
    border-radius:6px;
    flex-shrink:0;
  `;
}

/* ✨ NEW: match glassy popup vibe */
function getWhiteCtaButtonStyle() {
  return `
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(255,255,255,0.2); /* 👈 base is now closer to hover */
    border: none;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border-radius: 12px;
    padding: 9px 12px;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 600;
    color: #ffffff;
    box-shadow: 0 10px 20px rgba(0,0,0,0.35);
    text-align: center;
    min-width: 0;
    max-width: 100%;
    transition: transform 0.12s ease-out, box-shadow 0.12s ease-out, background 0.12s ease-out;
  `;
}

function getInputStyle() {
  return `
    width: 100%;
    max-width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.4;
    box-sizing: border-box;
    color: #111827;
    background: #ffffff;
    font-family: ${CARD_FONT};
  `;
}
function getSelectButtonStyle() {
  return `
    width: 100%;
    max-width: 100%;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background:#ffffff;
    color:#111827;
    font-size:14px;
    line-height:1.4;
    cursor:pointer;
    font-family:${CARD_FONT};
    box-sizing:border-box;
  `;
}
function getDropdownMenuStyle() {
  return `
    position:absolute;
    bottom:100%;
    left:0;
    transform:translateY(-8px);
    background:#ffffff;
    color:#111827;
    border:1px solid #d1d5db;
    border-radius:12px;
    box-shadow:0 20px 40px rgba(0,0,0,0.4);
    padding:8px;
    display:flex;
    flex-direction:column;
    max-height:180px;
    overflow-y:auto;
    min-width:180px;
    z-index:1000001;
    box-sizing:border-box;
  `;
}
function getDropdownItemStyle() {
  return `
    display:flex;
    align-items:center;
    gap:8px;
    padding:8px 10px;
    border-radius:6px;
    font-size:13px;
    line-height:1.3;
    font-weight:500;
    color:#111827;
    cursor:pointer;
  `;
}
function getDropdownItemHoverStyle() {
  return "background:#f3f4f6;";
}
function getLabelStyle() {
  return `
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #ffe4f1;
    margin-bottom: 6px;
    line-height:1.3;
  `;
}
function colorDot(hex) {
  return `
    <span style="
      width:12px;
      height:12px;
      border-radius:9999px;
      background:${hex};
      display:inline-block;
      flex-shrink:0;
      border:1px solid rgba(0,0,0,0.2);
    "></span>
  `;
}
function lift(btn) {
  btn.style.boxShadow = "0 14px 26px rgba(0,0,0,0.32)";
  btn.style.transform = "translateY(-1px)";
  btn.style.background = "rgba(255,255,255,0.12)"; /* 👈 slightly lighter on hover */
}

function unlift(btn) {
  btn.style.boxShadow = "0 10px 20px rgba(0,0,0,0.25)";
  btn.style.transform = "translateY(0)";
  btn.style.background = "rgba(255,255,255,0.2)"; /* 👈 back to new base */
}

/* ------------------------------------------------------------------
   CLICK OUTSIDE
------------------------------------------------------------------ */
function attachOutsideClickToClose() {
  detachOutsideClickToClose();
  outsideClickHandler = (evt) => {
    if (!eventCreatorContainer) return;

    if (eventCreatorContainer.contains(evt.target)) return;

    const colorMenu = eventCreatorContainer.querySelector("#colorDropdownMenu");
    const reminderMenu = eventCreatorContainer.querySelector("#reminderDropdownMenu");

    const clickedInColorMenu = colorMenu && colorMenu.contains(evt.target);
    const clickedInReminderMenu = reminderMenu && reminderMenu.contains(evt.target);

    if (clickedInColorMenu || clickedInReminderMenu) return;

    destroyPopup();
  };
  document.addEventListener("mousedown", outsideClickHandler, true);
}

function detachOutsideClickToClose() {
  if (outsideClickHandler) {
    document.removeEventListener("mousedown", outsideClickHandler, true);
    outsideClickHandler = null;
  }
}

/* ------------------------------------------------------------------
   FLOATING ACTION BAR
------------------------------------------------------------------ */
function showEventCreator(selectedText) {
  isEditingOpen = false;

  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  eventCreatorContainer = document.createElement("div");
  eventCreatorContainer.id = "gemini-event-creator";
  eventCreatorContainer.style.cssText = getOuterWrapperStyle();

  eventCreatorContainer.innerHTML = `
    <div style="${getCardWrapperStyle()}">
      <div style="${getInnerSectionStyle()}">
        <div class="gemini-header" style="${getHeaderRowStyle()}">
          <div style="flex:1; min-width:0;">
            <div style="
              font-size: 13px;
              font-weight: 600;
              color: #ffffff;
              line-height:1.3;
              letter-spacing:-0.03em;
              word-break:break-word;
            ">
              Create calendar event
            </div>
            <div style="font-size:11px; color:rgba(255,255,255,0.55); margin-top:2px;">
              Quick or full edit — like in popup
            </div>
          </div>

          <button class="gemini-close-btn" style="${getHeaderIconBtnStyle()}">
            ✕
          </button>
        </div>

        <div class="gemini-action-row" style="
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          width: 100%;
          margin-top: 4px;
        ">
          <button class="gemini-quick-add-btn" style="${getWhiteCtaButtonStyle()}">
            <span style="white-space:nowrap;">Quick Create</span>
          </button>

          <button class="gemini-edit-btn" style="${getWhiteCtaButtonStyle()}">
            <span style="white-space:nowrap;">Edit & Create</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(eventCreatorContainer);

  const quickAddBtn = eventCreatorContainer.querySelector(".gemini-quick-add-btn");
  const editBtn    = eventCreatorContainer.querySelector(".gemini-edit-btn");
  const closeBtn   = eventCreatorContainer.querySelector(".gemini-close-btn");

  quickAddBtn.addEventListener("mouseenter", () => lift(quickAddBtn));
  quickAddBtn.addEventListener("mouseleave", () => unlift(quickAddBtn));
  editBtn.addEventListener("mouseenter", () => lift(editBtn));
  editBtn.addEventListener("mouseleave", () => unlift(editBtn));

  // QUICK CREATE
  quickAddBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isCreatingEvent) return;
    isCreatingEvent = true;

    const pendingSnack = showSnackbar("Creating event… please wait", "pending", true);

    destroyPopup();

    handleCreateEvent(selectedText, pendingSnack);
  });

  // EDIT & CREATE
  editBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (isCreatingEvent) return;
    isCreatingEvent = true;

    const pendingSnack = showSnackbar("Opening editor…", "pending", true);

    destroyPopup();

    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "parseTextToEvent", text: selectedText },
          (ans) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(ans);
          }
        );
      });

      if (pendingSnack && pendingSnack.parentNode) {
        pendingSnack.parentNode.removeChild(pendingSnack);
      }

      if (resp && resp.success && resp.event) {
        showEditableForm(selectedText, resp.event);
      } else {
        showEditableForm(selectedText);
      }
    } catch (err) {
      log("parseTextToEvent failed, fallback to plain form:", err);
      if (pendingSnack && pendingSnack.parentNode) {
        pendingSnack.parentNode.removeChild(pendingSnack);
      }
      showEditableForm(selectedText);
    } finally {
      isCreatingEvent = false;
    }
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    destroyPopup();
  });

  attachOutsideClickToClose();
  updateSnackbarPosition();
}

/* ------------------------------------------------------------------
   DESTROY POPUP
------------------------------------------------------------------ */
function destroyPopup() {
  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }
  isEditingOpen = false;
  detachOutsideClickToClose();
  updateSnackbarPosition();
}

/* ------------------------------------------------------------------
   EDIT FORM CARD
------------------------------------------------------------------ */
function showEditableForm(selectedText, parsedEvent = null) {
  isEditingOpen = true;

  if (eventCreatorContainer) {
    eventCreatorContainer.remove();
    eventCreatorContainer = null;
  }

  eventCreatorContainer = document.createElement("div");
  eventCreatorContainer.id = "gemini-event-creator";
  eventCreatorContainer.style.cssText = getOuterWrapperStyle();

  const colorItemsHtml = COLOR_OPTIONS.map(opt => {
    return `
      <div class="color-item"
           data-color-value="${opt.value}"
           data-color-hex="${opt.hex}"
           data-color-name="${opt.name}"
           style="${getDropdownItemStyle()}">
        ${colorDot(opt.hex)}
        <span style="flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${opt.name}</span>
      </div>
    `;
  }).join("");

  const reminderItemsHtml = REMINDER_OPTIONS.map(opt => {
    return `
      <div class="reminder-item"
           data-reminder-value="${opt.value}"
           data-reminder-label="${opt.label}"
           style="${getDropdownItemStyle()}">
        <span style="flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${opt.label}</span>
      </div>
    `;
  }).join("");

  const defaultColor = COLOR_OPTIONS[0];
  const defaultReminder = REMINDER_OPTIONS[1];

  eventCreatorContainer.innerHTML = `
    <div style="${getCardWrapperStyle()}">
      <div style="${getInnerSectionStyle()}">

        <div class="form-header" style="
          display:flex;
          flex-wrap:nowrap;
          justify-content:flex-end;
          width:100%;
        ">
          <button id="closeFormBtn" style="
            ${getHeaderIconBtnStyle()}
            font-size:16px;
            padding:4px 6px;
            line-height:1;
          ">✕</button>
        </div>

        <form id="eventForm" style="
          display:flex;
          flex-direction:column;
          gap:16px;
          width:100%;
        ">

          <div class="form-group" style="display:flex; flex-direction:column; width:100%;">
            <label style="${getLabelStyle()}">Event Title *</label>
            <input
              type="text"
              id="eventTitle"
              required
              style="${getInputStyle()}"
              placeholder="Enter event title"
            >
          </div>

          <div class="form-row" style="
            display:flex;
            flex-wrap:wrap;
            align-items:flex-start;
            gap:12px;
            width:100%;
          ">
            <div class="form-group" style="
              flex:1 1 140px;
              min-width:0;
              display:flex;
              flex-direction:column;
            ">
              <label style="${getLabelStyle()}">Start Time *</label>
              <input
                type="datetime-local"
                id="startTime"
                required
                style="${getInputStyle()}"
              >
            </div>

            <div class="form-group" style="
              flex:1 1 140px;
              min-width:0;
              display:flex;
              flex-direction:column;
            ">
              <label style="${getLabelStyle()}">End Time</label>
              <input
                type="datetime-local"
                id="endTime"
                style="${getInputStyle()}"
              >
            </div>
          </div>

          <div class="form-group" style="display:flex; flex-direction:column; width:100%;">
            <label style="${getLabelStyle()}">Description</label>
            <textarea
              id="eventDescription"
              rows="3"
              style="${getInputStyle()} resize: vertical;"
              placeholder="Enter event description"
            >${escapeHtml(selectedText)}</textarea>
          </div>

          <div class="form-group" style="display:flex; flex-direction:column; width:100%;">
            <label style="${getLabelStyle()}">Location</label>
            <input
              type="text"
              id="eventLocation"
              style="${getInputStyle()}"
              placeholder="Enter event location"
            >
          </div>

          <div class="form-line-row" style="
            display:flex;
            flex-wrap:wrap;
            align-items:flex-start;
            gap:16px;
            width:100%;
          ">
            <div class="color-col" style="
              flex:1 1 150px;
              min-width:0;
              display:flex;
              flex-direction:column;
              position:relative;
            ">
              <label style="${getLabelStyle()}">Color</label>

              <button
                type="button"
                id="colorDropdownToggle"
                style="${getSelectButtonStyle()}"
              >
                <span id="colorDropdownSelected" style="
                  flex:1;
                  min-width:0;
                  display:flex;
                  align-items:center;
                  gap:8px;
                  white-space:nowrap;
                  overflow:hidden;
                  text-overflow:ellipsis;
                  line-height:1.3;
                ">
                  ${colorDot(defaultColor.hex)}
                  <span style="font-size:14px; color:#111827; line-height:1.3;">${defaultColor.name}</span>
                </span>
                <span style="flex-shrink:0; color:#6b7280; font-size:12px; line-height:1;">▼</span>
              </button>

              <div
                id="colorDropdownMenu"
                style="${getDropdownMenuStyle()} display:none;"
              >
                ${colorItemsHtml}
              </div>

              <input type="hidden" id="eventColor" value="${defaultColor.value}">
            </div>

            <div class="reminder-col" style="
              flex:1 1 150px;
              min-width:0;
              display:flex;
              flex-direction:column;
              position:relative;
            ">
              <label style="${getLabelStyle()}">Reminder</label>

              <button
                type="button"
                id="reminderDropdownToggle"
                style="${getSelectButtonStyle()}"
              >
                <span id="reminderDropdownSelected" style="
                  flex:1;
                  min-width:0;
                  display:flex;
                  align-items:center;
                  gap:8px;
                  white-space:nowrap;
                  overflow:hidden;
                  text-overflow:ellipsis;
                  line-height:1.3;
                ">
                  <span style="font-size:14px; color:#111827; line-height:1.3;">${defaultReminder.label}</span>
                </span>
                <span style="flex-shrink:0; color:#6b7280; font-size:12px; line-height:1;">▼</span>
              </button>

              <div
                id="reminderDropdownMenu"
                style="${getDropdownMenuStyle()} display:none;"
              >
                ${reminderItemsHtml}
              </div>

              <input type="hidden" id="eventReminderMinutes" value="${defaultReminder.value}">
            </div>
          </div>

          <div class="form-actions" style="
            display:flex;
            flex-wrap:wrap;
            row-gap:8px;
            column-gap:12px;
            justify-content:flex-end;
            width:100%;
          ">
            <button
              type="button"
              id="backBtnFooter"
              style="
                ${getWhiteCtaButtonStyle()}
                flex:0 1 auto;
                font-size:13px;
                padding:8px 12px;
              "
            >
              <span>Back</span>
            </button>

            <button
              type="submit"
              id="createEventBtn"
              style="
                ${getWhiteCtaButtonStyle()}
                flex:0 1 auto;
                font-size:13px;
                padding:8px 12px;
              "
            >
              <span>Create</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(eventCreatorContainer);

  setupColorDropdown();
  setupReminderDropdown();

  const titleEl = document.getElementById("eventTitle");
  const startEl = document.getElementById("startTime");
  const endEl   = document.getElementById("endTime");
  const descEl  = document.getElementById("eventDescription");
  const locEl   = document.getElementById("eventLocation");
  const colorHiddenEl = document.getElementById("eventColor");
  const reminderHiddenEl = document.getElementById("eventReminderMinutes");

  function isoToDatetimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hour}:${min}`;
  }

  if (parsedEvent) {
    titleEl.value = parsedEvent.title || selectedText.slice(0, 50);
    if (parsedEvent.start_time) {
      startEl.value = isoToDatetimeLocal(parsedEvent.start_time);
    }
    if (parsedEvent.end_time) {
      endEl.value = isoToDatetimeLocal(parsedEvent.end_time);
    }
    if (parsedEvent.description) {
      descEl.value = parsedEvent.description;
    }
    if (parsedEvent.location) {
      locEl.value = parsedEvent.location;
    }

    if (parsedEvent.color) {
      colorHiddenEl.value = parsedEvent.color;
      const selectedSpan = eventCreatorContainer.querySelector("#colorDropdownSelected");
      const found = COLOR_OPTIONS.find((c) => c.value === parsedEvent.color);
      if (found && selectedSpan) {
        selectedSpan.innerHTML = `
          ${colorDot(found.hex)}
          <span style="font-size:14px; color:#111827; line-height:1.3;">${found.name}</span>
        `;
      }
    }

    if (typeof parsedEvent.reminder_minutes === "number") {
      reminderHiddenEl.value = String(parsedEvent.reminder_minutes);
      const selectedSpan = eventCreatorContainer.querySelector("#reminderDropdownSelected");
      const found = REMINDER_OPTIONS.find(
        (r) => Number(r.value) === Number(parsedEvent.reminder_minutes)
      );
      if (found && selectedSpan) {
        selectedSpan.innerHTML = `<span style="font-size:14px; color:#111827; line-height:1.3;">${found.label}</span>`;
      }
    }
  } else {
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

    titleEl.value = selectedText.slice(0, 50);
    startEl.value  = defaultStart.toISOString().slice(0, 16);
    endEl.value    = defaultEnd.toISOString().slice(0, 16);
  }

  const closeBtn      = document.getElementById("closeFormBtn");
  const backBtnFooter = document.getElementById("backBtnFooter");
  const form          = document.getElementById("eventForm");

  closeBtn.addEventListener("click", () => {
    destroyPopup();
  });

  backBtnFooter.addEventListener("click", () => {
    isEditingOpen = false;
    showEventCreator(selectedText);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleFormSubmission();
  });

  titleEl.focus();

  attachOutsideClickToClose();
  updateSnackbarPosition();
}

/* ------------------------------------------------------------------
   COLOR DROPDOWN LOGIC
------------------------------------------------------------------ */
function setupColorDropdown() {
  const toggleBtn   = eventCreatorContainer.querySelector("#colorDropdownToggle");
  const menuEl      = eventCreatorContainer.querySelector("#colorDropdownMenu");
  const selectedEl  = eventCreatorContainer.querySelector("#colorDropdownSelected");
  const hiddenInput = eventCreatorContainer.querySelector("#eventColor");

  if (!toggleBtn || !menuEl || !selectedEl || !hiddenInput) return;

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const isHidden = menuEl.style.display === "none";
    menuEl.style.display = isHidden ? "flex" : "none";
    colorDropdownOpen = isHidden;
    if (isHidden) {
      closeReminderDropdown();
    }
  });

  const items = menuEl.querySelectorAll(".color-item");
  items.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      item.style.cssText = getDropdownItemStyle() + getDropdownItemHoverStyle();
    });
    item.addEventListener("mouseleave", () => {
      item.style.cssText = getDropdownItemStyle();
    });

    item.addEventListener("click", () => {
      const val  = item.getAttribute("data-color-value");
      const hex  = item.getAttribute("data-color-hex");
      const name = item.getAttribute("data-color-name");

      hiddenInput.value = val;
      selectedEl.innerHTML = `
        ${colorDot(hex)}
        <span style="font-size:14px; color:#111827; line-height:1.3;">${name}</span>
      `;
      menuEl.style.display = "none";
      colorDropdownOpen = false;
    });
  });
}

function closeColorDropdown() {
  const menuEl = eventCreatorContainer?.querySelector("#colorDropdownMenu");
  if (!menuEl) return;
  menuEl.style.display = "none";
  colorDropdownOpen = false;
}

/* ------------------------------------------------------------------
   REMINDER DROPDOWN LOGIC
------------------------------------------------------------------ */
function setupReminderDropdown() {
  const toggleBtn   = eventCreatorContainer.querySelector("#reminderDropdownToggle");
  const menuEl      = eventCreatorContainer.querySelector("#reminderDropdownMenu");
  const selectedEl  = eventCreatorContainer.querySelector("#reminderDropdownSelected");
  const hiddenInput = eventCreatorContainer.querySelector("#eventReminderMinutes");

  if (!toggleBtn || !menuEl || !selectedEl || !hiddenInput) return;

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const isHidden = menuEl.style.display === "none";
    menuEl.style.display = isHidden ? "flex" : "none";
    reminderDropdownOpen = isHidden;
    if (isHidden) {
      closeColorDropdown();
    }
  });

  const items = menuEl.querySelectorAll(".reminder-item");
  items.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      item.style.cssText = getDropdownItemStyle() + getDropdownItemHoverStyle();
    });
    item.addEventListener("mouseleave", () => {
      item.style.cssText = getDropdownItemStyle();
    });

    item.addEventListener("click", () => {
      const val   = item.getAttribute("data-reminder-value");
      const label = item.getAttribute("data-reminder-label");

      hiddenInput.value = val;
      selectedEl.innerHTML = `<span style="font-size:14px; color:#111827; line-height:1.3;">${label}</span>`;

      menuEl.style.display = "none";
      reminderDropdownOpen = false;
    });
  });
}

function closeReminderDropdown() {
  const menuEl = eventCreatorContainer?.querySelector("#reminderDropdownMenu");
  if (!menuEl) return;
  menuEl.style.display = "none";
  reminderDropdownOpen = false;
}

/* ------------------------------------------------------------------
   FORM SUBMIT (EDIT FLOW)
------------------------------------------------------------------ */
async function handleFormSubmission() {
  if (isCreatingEvent) return;
  isCreatingEvent = true;

  const titleEl         = document.getElementById("eventTitle");
  const startTimeEl     = document.getElementById("startTime");
  const endTimeEl       = document.getElementById("endTime");
  const descEl          = document.getElementById("eventDescription");
  const locEl           = document.getElementById("eventLocation");
  const colorEl         = document.getElementById("eventColor");
  const reminderEl      = document.getElementById("eventReminderMinutes");
  const submitBtn       = document.getElementById("createEventBtn");

  const title           = titleEl.value.trim();
  const startTime       = startTimeEl.value;
  const endTime         = endTimeEl.value;
  const description     = descEl.value.trim();
  const location        = locEl.value.trim();
  const color           = colorEl.value;
  const reminderMinutes = parseInt(reminderEl.value, 10);

  if (!title) {
    showSnackbar("Add a title", "error");
    isCreatingEvent = false;
    return;
  }
  if (!startTime) {
    showSnackbar("Add a start time", "error");
    isCreatingEvent = false;
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.6";
    submitBtn.style.cursor = "not-allowed";
  }

  destroyPopup();

  const pendingSnack = showSnackbar("Saving event…", "pending", true);

  try {
    const eventData = {
      title: title,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      description: description || title,
      location: location || null,
      color: color || "default",
      reminder_minutes: isNaN(reminderMinutes) ? null : reminderMinutes
    };

    const response = await chrome.runtime.sendMessage({
      action: "createEventFromData",
      eventData: eventData
    });

    if (pendingSnack && pendingSnack.parentNode) {
      pendingSnack.parentNode.removeChild(pendingSnack);
    }

    if (response && response.success) {
      showSnackbar("Event saved", "success");
    } else {
      throw new Error(response?.error || "Failed to create event");
    }
  } catch (error) {
    console.log("Error creating event from form:", error);
    if (pendingSnack && pendingSnack.parentNode) {
      pendingSnack.parentNode.removeChild(pendingSnack);
    }
    showSnackbar("Couldn't save event", "error");
  } finally {
    isCreatingEvent = false;
  }
}

/* ------------------------------------------------------------------
   QUICK ADD FLOW
------------------------------------------------------------------ */
async function handleCreateEvent(text, pendingSnackEl) {
  try {
    const resp = await sendAnalyzeText(text);

    if (pendingSnackEl && pendingSnackEl.parentNode) {
      pendingSnackEl.parentNode.removeChild(pendingSnackEl);
    }

    if (resp?.success) {
      showSnackbar("Event created", "success");
    } else {
      showSnackbar("Couldn't create", "error");
    }
  } catch (err) {
    if (pendingSnackEl && pendingSnackEl.parentNode) {
      pendingSnackEl.parentNode.removeChild(pendingSnackEl);
    }
    showSnackbar("Couldn't create", "error");
  } finally {
    isCreatingEvent = false;
    isEditingOpen = false;
  }
}

/* ------------------------------------------------------------------
   BACKGROUND MESSAGE HELPER
------------------------------------------------------------------ */
function sendAnalyzeText(text) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timeout (background did not respond)"));
    }, 50000);

    try {
      chrome.runtime.sendMessage({ action: "analyzeText", text }, (resp) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error("chrome.runtime.lastError: " + chrome.runtime.lastError.message));
          return;
        }

        resolve(resp || { success: false, error: "No response" });
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/* ------------------------------------------------------------------
   HTML ESCAPER
------------------------------------------------------------------ */
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