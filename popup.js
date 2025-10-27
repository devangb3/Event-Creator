// popup.js - Extension popup functionality

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] POPUP: ${message}`, data || '');
}

// DOM elements
let createFromSelectionBtn;
let createFromClipboardBtn;
let statusDiv;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  log('Popup initialized');
  
  createFromSelectionBtn = document.getElementById('createFromSelection');
  createFromClipboardBtn = document.getElementById('createFromClipboard');
  statusDiv = document.getElementById('status');
  
  // Add event listeners
  createFromSelectionBtn.addEventListener('click', handleCreateFromSelection);
  createFromClipboardBtn.addEventListener('click', handleCreateFromClipboard);
  
  // Check if we can access the current tab
  checkTabAccess();
});

// Check if we can access the current tab and show appropriate status
async function checkTabAccess() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      log('Current tab:', { url: tab.url, id: tab.id });
      showStatus('Ready to create events', 'info');
    }
  } catch (error) {
    log('Error checking tab access:', error);
    showStatus('Cannot access current tab', 'error');
  }
}

// Handle "Create from Selected Text" button click
async function handleCreateFromSelection() {
  log('Create from selection clicked');
  
  try {
    setButtonLoading(createFromSelectionBtn, true);
    showStatus('Getting selected text...', 'info');
    
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Send message to content script to get selected text
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getSelectedText' 
    });
    
    if (response && response.success && response.text) {
      const selectedText = response.text.trim();
      log('Selected text received:', { length: selectedText.length });
      
      if (selectedText.length < 3) {
        showStatus('Please select at least 3 characters of text', 'error');
        return;
      }
      
      // Send the text to background script for processing
      await processEventCreation(selectedText);
      
    } else {
      showStatus('No text selected. Please select some text on the page first.', 'error');
    }
    
  } catch (error) {
    log('Error in handleCreateFromSelection:', error);
    showStatus('Error: ' + error.message, 'error');
  } finally {
    setButtonLoading(createFromSelectionBtn, false);
  }
}

// Handle "Create from Clipboard" button click
async function handleCreateFromClipboard() {
  log('Create from clipboard clicked');
  
  try {
    setButtonLoading(createFromClipboardBtn, true);
    showStatus('Reading clipboard...', 'info');
    
    // Read from clipboard
    const clipboardText = await navigator.clipboard.readText();
    
    if (!clipboardText || clipboardText.trim().length < 3) {
      showStatus('Clipboard is empty or too short. Please copy some text first.', 'error');
      return;
    }
    
    log('Clipboard text received:', { length: clipboardText.length });
    
    // Send the text to background script for processing
    await processEventCreation(clipboardText.trim());
    
  } catch (error) {
    log('Error in handleCreateFromClipboard:', error);
    if (error.name === 'NotAllowedError') {
      showStatus('Clipboard access denied. Please allow clipboard permissions.', 'error');
    } else {
      showStatus('Error: ' + error.message, 'error');
    }
  } finally {
    setButtonLoading(createFromClipboardBtn, false);
  }
}

// Process event creation by sending to background script
async function processEventCreation(text) {
  try {
    showStatus('Creating event...', 'info');
    
    // Send message to background script
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeText',
      text: text
    });
    
    if (response && response.success) {
      showStatus(`Event "${response.eventTitle}" created successfully!`, 'success');
      
      // Close popup after successful creation
      setTimeout(() => {
        window.close();
      }, 2000);
      
    } else {
      throw new Error(response?.error || 'Failed to create event');
    }
    
  } catch (error) {
    log('Error in processEventCreation:', error);
    showStatus('Error creating event: ' + error.message, 'error');
  }
}

// Set button loading state
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Processing...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// Show status message
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
  
  // Auto-hide info messages after 3 seconds
  if (type === 'info') {
    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 3000);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStatus') {
    showStatus(request.message, request.type || 'info');
  }
  return true;
});
