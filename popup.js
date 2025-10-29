// popup.js

function log(msg, data = null) {
  const ts = new Date().toISOString();
  if (data !== null) {
    console.log(`[${ts}] POPUP: ${msg}`, data);
  } else {
    console.log(`[${ts}] POPUP: ${msg}`);
  }
}

let toggleEl;
let isOn = false;

document.addEventListener("DOMContentLoaded", () => {
  log("Popup initialized");

  toggleEl = document.getElementById("extToggle");

  // click listener for the switch
  toggleEl.addEventListener("click", handleToggleClick);

  // ask background for current state
  initToggleState();
});

// ask background if service is enabled
function initToggleState() {
  try {
    chrome.runtime.sendMessage({ action: "getServiceStatus" }, (resp) => {
      if (chrome.runtime.lastError) {
        log("getServiceStatus error", chrome.runtime.lastError.message);
        setToggleUI(false);
        return;
      }
      const enabled = resp && resp.enabled === true;
      setToggleUI(enabled);
    });
  } catch (err) {
    log("initToggleState exception", err);
    setToggleUI(false);
  }
}

// when user clicks the pill
function handleToggleClick() {
  const newState = !isOn;
  setToggleUI(newState); // update visuals immediately

  if (newState) {
    // user turned it ON
    chrome.runtime.sendMessage({ action: "enableService" }, (resp) => {
      if (chrome.runtime.lastError) {
        log("enableService error", chrome.runtime.lastError.message);
      } else {
        log("Service enabled", resp);
      }
    });
  } else {
    // user turned it OFF
    chrome.runtime.sendMessage({ action: "disableService" }, (resp) => {
      if (chrome.runtime.lastError) {
        log("disableService error", chrome.runtime.lastError.message);
      } else {
        log("Service disabled", resp);
      }
    });
  }
}

// just handle class swap
function setToggleUI(on) {
  isOn = on;
  if (on) {
    toggleEl.classList.add("is-on");
  } else {
    toggleEl.classList.remove("is-on");
  }
}