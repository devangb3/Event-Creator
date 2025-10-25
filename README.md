# Gemini Event Creator - Chrome Extension

A lightweight Chrome extension that allows you to select text on any webpage and quickly create Google Calendar events using intelligent text parsing.

## Features

- **Text Selection**: Right-click on any selected text to create calendar events
- **Smart Parsing**: Automatically extracts event details (date, time, location) from text
- **Google Calendar Integration**: One-click calendar event creation
- **Inline UI**: Appears as an overlay directly on the webpage (like Grammarly)
- **Lightweight**: No external dependencies, pure vanilla JavaScript

## Quick Start

### 1. Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/api-keys)
2. Create a new API key
3. Copy the API key for configuration

### 2. Configure API Key
The extension will work with fallback parsing, but for AI-powered event extraction:

 **Using Environment Variables (Recommended)**
   - Create a `.env` file in the project root
   - Add your API key: `GEMINI_API_KEY=your_actual_api_key_here`
   - The API key will be built into the extension during the build process

### 3. Build the Extension
```bash
npm run build
```

### 4. Load in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the **`dist`** folder
5. Extension is ready to use!

## How to Use

1. **Select Text**: Highlight any text on a webpage that contains event information
   - Example: "Meeting tomorrow at 3 PM in conference room A"
   - Example: "Team lunch on Friday at noon"

2. **Right-Click**: Right-click on the selected text

3. **Create Event**: Choose "Create Event from Text" from the context menu

4. **Modal Appears**: An overlay modal will appear on the same page

5. **Review & Create**: Click "Create Event" to process the text

6. **Add to Calendar**: Click "Add to Google Calendar" to add the event

### Building
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Troubleshooting

### Extension Not Loading
- Make sure you're loading the `dist/` folder, not the project root
- Check that "Developer mode" is enabled in `chrome://extensions/`
- Try refreshing the extension after rebuilding

### Context Menu Not Appearing
- The context menu only appears when text is selected
- Make sure you're right-clicking on selected text, not empty space

### Modal Not Appearing
- Check the browser console for error messages
- Ensure the content script is loading (check console logs)
- Try refreshing the webpage

## Permissions

The extension requests the following permissions:
- `contextMenus`: To add the right-click menu option
- `storage`: For saving preferences (if needed in future)
- `activeTab`: To access the current tab
- `host_permissions`: To run on all websites

## Future Enhancements

- Support for recurring events
- Event templates and quick actions
- Multiple calendar providers
- Event conflict detection
- Team event coordination
