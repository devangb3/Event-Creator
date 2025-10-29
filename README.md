Gemini Event Creator - Chrome Extension

A lightweight Chrome extension that allows you to select text on any webpage and quickly create Google Calendar events using intelligent text parsing.

Features
	•	Text Selection: Right-click on any selected text to create calendar events
	•	Smart Parsing: Automatically extracts event details (date, time, location) from text
	•	Google Calendar Integration: One-click calendar event creation
	•	Inline UI: Appears as an overlay directly on the webpage (like Grammarly)
	•	Lightweight: No external dependencies, pure vanilla JavaScript

Quick Start

1. Get Gemini API Key
	1.	Go to Google AI Studio
	2.	Create a new API key
	3.	Copy the API key for configuration

2. Configure API Key

The extension will work with fallback parsing, but for AI-powered event extraction:

Using Environment Variables (Recommended)
	•	Create a .env file in the project root
	•	Add your API key: GEMINI_API_KEY=your_actual_api_key_here
	•	The API key will be built into the extension during the build process

3. Set up Google OAuth (Calendar access)

The extension needs permission to prefill Google Calendar on behalf of the signed-in user. You must create OAuth credentials for your specific extension ID.

Step 3.1: Create a Google Cloud project
	1.	Go to Google Cloud Console → “Select a project” → “New Project”.
	2.	Give it any name (e.g. gemini-event-creator) and create it.
	3.	Make sure this project is selected in the top bar.

Step 3.2: Enable the required API
	1.	In the left sidebar, go to APIs & Services → Library.
	2.	Search for Google Calendar API.
	3.	Click it, then click Enable.

Step 3.3: Configure the OAuth consent screen
	1.	Go to APIs & Services → OAuth consent screen.
	2.	Choose External.
	3.	App name can be something like “Gemini Event Creator”.
	4.	Add your email under “User support email”.
	5.	Under “Authorized domains”, add chrome-extension:// is not required here (you don’t host a web domain), you can skip domain add.
	6.	Scroll down to “Scopes”. Add this scope:
	•	https://www.googleapis.com/auth/calendar.events
(This lets us prefill calendar event data.)
	7.	In “Test users”, add the Google accounts you’ll use to test the extension.
Only these accounts will be allowed during development.

Save.

Step 3.4: Create OAuth credentials for your Chrome extension
	1.	Go to APIs & Services → Credentials.
	2.	Click Create Credentials → OAuth client ID.
	3.	For “Application type”, select Chrome extension.
	4.	It will ask for your extension ID.
	•	To get your extension ID:
	•	Go to chrome://extensions
	•	Turn on Developer mode
	•	Load your unpacked extension (either from dist/ or from source during development)
	•	Copy the Extension ID shown under the extension name.
	5.	Paste that Extension ID into Google Cloud.
	6.	Click Create.

You’ll now get a client_id that looks like:
1234567890-abcxyz123.apps.googleusercontent.com

Copy this client_id.

Step 3.5: Add OAuth info to your manifest.json

In your extension manifest.json, add:

"oauth2": {
  "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events"
  ]
},
"permissions": [
  "identity",
  "storage",
  "activeTab",
  "scripting",
  "tabs"
]

Notes:
	•	"identity" is required so the extension can call chrome.identity.getAuthToken(...).
	•	"tabs" is used to open the new Google Calendar tab after event parsing.

Your manifest must still include "background": { "service_worker": "background.js" } because this is an MV3 service worker extension, and all OAuth + parsing happens there.

After adding this:
	•	Reload the extension in chrome://extensions
	•	On first use, the extension will ask you to sign in. That login result is cached, and on future highlights we try to reuse the token silently.

4. Build the Extension

npm run build

5. Load in Chrome
	1.	Open Chrome and go to chrome://extensions/
	2.	Enable “Developer mode” (top right toggle)
	3.	Click “Load unpacked”
	4.	Select the dist folder
	5.	Extension is ready to use!

How to Use
	1.	Highlight Text: Simply highlight any text on a webpage that contains event information
	•	Example: “Meeting tomorrow at 3 PM in conference room A”
	•	Example: “Team lunch on Friday at noon”
	2.	Automatic Popup: The event creator popup will automatically appear when you highlight text
	3.	Create Event: Click “Create Event” to process the highlighted text
	4.	Add to Calendar: Click “Add to Google Calendar” to add the event to your calendar

Note: The popup will automatically disappear when you click elsewhere or deselect the text.

Building

npm run build

The built files will be in the dist/ directory.

Troubleshooting

Extension Not Loading
	•	Make sure you’re loading the dist/ folder, not the project root
	•	Check that “Developer mode” is enabled in chrome://extensions/
	•	Try refreshing the extension after rebuilding

Popup Not Appearing
	•	Make sure you’re highlighting text (not just clicking)
	•	Check the browser console for error messages
	•	Ensure the content script is loading (check console logs)
	•	Try refreshing the webpage
	•	The popup appears automatically when text is selected - no right-click needed

OAuth keeps asking every time or doesn’t work
	•	Make sure the client_id in your manifest.json matches the extension ID you actually loaded in chrome://extensions
	•	Make sure the Google account you’re testing with is added under “Test users” in the OAuth consent screen in Google Cloud
	•	If background never logs anything in the service worker console, it means the worker crashed before startup — usually caused by missing auth.js / services/geminiService.js

Permissions

The extension requests the following permissions:
	•	storage: For saving preferences (if needed in future)
	•	activeTab: To access the current tab
	•	scripting: To inject content scripts for text selection detection
	•	host_permissions: To run on all websites
	•	identity: For Google OAuth via chrome.identity
	•	tabs: To open Google Calendar with a pre-filled event

Future Enhancements
	•	Support for recurring events
	•	Event templates and quick actions
	•	Multiple calendar providers
	•	Event conflict detection
	•	Team event coordination