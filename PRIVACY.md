# Privacy Policy for Gemini Event Creator

**Last Updated:** October 30, 2025

## Overview

Gemini Event Creator is a Chrome Extension that helps you quickly create Google Calendar events from text you select on any webpage. This privacy policy explains what data the extension collects, how it's used, and your rights regarding your data.

## What This Extension Does

Gemini Event Creator allows you to:
- Select text on any webpage
- Extract calendar event details from the selected text using AI
- Create Google Calendar events with the extracted information
- Toggle the extension on/off via the popup interface

## Data Collection and Usage

### 1. User-Selected Text

**What We Collect:**
- Text that you manually select on webpages when using the extension

**How It's Used:**
- The selected text is processed locally (on your device when possible) or sent to Google's Prompt API to extract event details (title, date, time, location, description)
- This text is used only for the immediate purpose of creating a calendar event
- The text is NOT stored, logged, or transmitted to any third-party services except as described below

**Data Retention:**
- Selected text is processed in memory only and is not persistently stored by the extension

### 2. Google Calendar Integration

**What We Access:**
- Your Google Calendar account (with your explicit permission via OAuth)
- Permission to create and modify calendar events only

**How It's Used:**
- Event information extracted from your selected text is sent to Google Calendar API to create events in your calendar
- We only access the `calendar.events` scope, which allows creating and modifying calendar events

**What's Sent to Google:**
- Event title
- Event start and end date/time
- Event description
- Event location
- Event color preference
- Reminder settings
- Attendees (if specified)

**Data Retention:**
- Event data is stored in your Google Calendar account according to Google's privacy policy
- We do not store a separate copy of your calendar events

### 3. Authentication Data

**What We Collect:**
- Google OAuth access tokens (managed by Chrome's secure identity API)
- A flag indicating whether you've completed the initial authentication ("onboarded")

**How It's Stored:**
- OAuth tokens are securely stored by Chrome's built-in identity API
- We do NOT store, log, or have access to your actual tokens
- The "onboarded" flag is stored in Chrome's sync storage

**Data Security:**
- Tokens are automatically redacted in any debug logs
- Tokens are never exposed in the extension's user interface

### 4. Extension Preferences

**What We Collect:**
- A single boolean value indicating whether the extension is enabled or disabled

**How It's Stored:**
- Stored locally in Chrome's storage API (`chrome.storage.local`)
- Can be synced across your Chrome browsers via `chrome.storage.sync`

**Data Retention:**
- Retained until you uninstall the extension or manually clear extension data

### 5. AI Processing (Google Prompt API)

**What We Use:**
- Google's Prompt API (Gemini Nano) when available in your Chrome browser (version 138+)

**How It Works:**
- When available, text processing happens **locally on your device** using Chrome's built-in AI
- No text is sent to external servers for AI processing when using the on-device model
- If the Prompt API is unavailable, the extension uses simple date/time parsing logic locally

**Fallback Processing:**
- If AI is unavailable, the extension uses a regex-based parser that runs entirely locally

## Data We Do NOT Collect

- Browsing history
- Personal information beyond what you explicitly select and authorize
- Cookies or tracking identifiers
- IP addresses
- Device identifiers
- Information from other tabs or websites you visit
- Analytics or telemetry data
- Email addresses or identity information (except through OAuth flow)

## Third-Party Services

### Google APIs

This extension uses the following Google services:

1. **Google Calendar API**
   - Purpose: Create calendar events
   - Data Shared: Event details you choose to create
   - Privacy Policy: https://policies.google.com/privacy

2. **Google Identity API**
   - Purpose: Authenticate your Google account
   - Data Shared: OAuth tokens for calendar access
   - Privacy Policy: https://policies.google.com/privacy

3. **Google Prompt API (Gemini Nano)**
   - Purpose: Extract event details from text (when available)
   - Data Processing: Local on-device processing
   - Privacy Policy: https://policies.google.com/privacy

### No Other Third Parties

- This extension does NOT use analytics services
- This extension does NOT use advertising networks
- This extension does NOT share data with any third parties except Google (as described above)

## Permissions Explanation

The extension requests the following Chrome permissions:

| Permission | Why We Need It |
|-----------|---------------|
| `storage` | Store your preference for enabling/disabling the extension |
| `activeTab` | Access the text you select on the current webpage |
| `scripting` | Inject UI elements to display event creation options |
| `identity` | Authenticate with your Google account for calendar access |
| `tabs` | Open new tabs to preview created events (optional) |
| `<all_urls>` | Allow the extension to work on any website you choose to use it on |

## User Control and Rights

### You Have Full Control:

1. **Toggle the Extension:** Use the popup to turn the extension on or off at any time
2. **Review Before Creating:** Use "Edit & Create" mode to review and modify event details before creation
3. **Revoke Access:** Remove Google Calendar permissions at any time via your Google Account settings
4. **Uninstall:** Uninstalling the extension removes all local data and stops all data processing

### Your Data Rights:

- **Access:** Your calendar events are accessible via Google Calendar
- **Deletion:** Delete any events created by this extension directly in Google Calendar
- **Portability:** Export your Google Calendar data using Google Takeout
- **No Extension Data:** The extension stores no personal data beyond the on/off toggle state

## Data Security

### Security Measures:

- **OAuth 2.0:** Industry-standard authentication protocol
- **Content Security Policy:** Prevents execution of malicious code
- **Manifest V3:** Uses Chrome's latest security standards
- **Token Security:** OAuth tokens managed by Chrome's secure storage
- **No External Requests:** Only communicates with Google's official APIs
- **Local Processing:** AI processing happens on-device when possible

### Limitations:

While we implement strong security measures, no system is 100% secure. The extension's security also depends on:
- Your Google account security
- Your device security
- Chrome browser security updates

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect information from children. If you believe a child has used this extension, please contact us.

## Changes to This Policy

We may update this privacy policy to reflect changes in:
- Extension functionality
- Legal requirements
- Privacy best practices

**Notification of Changes:**
- Policy updates will be reflected in the "Last Updated" date
- Significant changes will be communicated via the Chrome Web Store listing

## Compliance

### Chrome Web Store Requirements

This extension complies with:
- Chrome Web Store Developer Program Policies
- Chrome Extension Manifest V3 requirements
- Google API Services User Data Policy

### Data Usage Compliance

We commit to the following principles from Google's API Services User Data Policy:

- **Limited Use:** Only access user data necessary for providing the extension's functionality
- **Transparency:** Clearly disclose data collection and usage
- **No Sale:** Never sell user data to third parties
- **Secure Transmission:** Use encryption for data transmission (HTTPS)

## Open Source

This extension is open source under the MIT License. You can:
- Review the source code
- Verify data handling practices
- Contribute improvements
- Fork and modify for personal use

Repository: https://github.com/devangb3/Event-Creator

## Contact Us

If you have questions, concerns, or requests regarding this privacy policy or your data:

- **GitHub Issues:** [Your GitHub repository URL]/issues
- **Email:** [Your contact email]

For Google account or calendar data concerns, please contact Google directly:
- Google Privacy Help: https://support.google.com/privacy

## TL;DR

**In Plain English:**

This extension:
- Only processes text YOU select
- Creates calendar events YOU request
- Stores only your on/off preference
- Does NOT track you
- Does NOT collect personal information beyond calendar events
- Does NOT share data with anyone except Google Calendar (with your permission)
- Processes AI requests locally on your device when possible

Your privacy is important to us. We built this extension to be useful while collecting the absolute minimum data necessary to function.
