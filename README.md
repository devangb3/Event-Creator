# Gemini Event Creator - Chrome Extension

A Chrome extension that allows you to select text on any webpage and quickly create Google Calendar events using Google's Gemini AI.

## Features

- **Text Selection**: Right-click on any webpage to create calendar events from selected text
- **AI-Powered**: Uses Google Gemini AI to intelligently parse event details
- **Image Analysis**: Upload and analyze images with Gemini AI
- **Modern UI**: Built with React and Tailwind CSS

## Prerequisites

- Node.js (v16 or higher)
- Google Chrome browser
- Gemini API key

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env.local` file in the project root:
```bash
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env.local
```

Replace `your_gemini_api_key_here` with your actual Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 3. Build the Extension
```bash
npm run build
```

This will create a `dist/` folder with all the extension files.

### 4. Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the **`dist`** folder from your project directory
6. The extension should now appear in your extensions list

## Usage

1. **Create Calendar Events**:
   - Select any text on a webpage
   - Right-click and choose "Create Calendar Event with Gemini"
   - The extension popup will open with the selected text
   - Gemini AI will analyze the text and extract event details

2. **Image Analysis**:
   - Open the extension popup
   - Switch to the "Image Analysis" tab
   - Upload an image and ask questions about it

## Development

### Building for Development
```bash
npm run build
```

### Development Notes
- **Don't use `npm run dev`** for Chrome extensions - this causes MIME type issues
- Always build the extension before loading it in Chrome
- The extension uses local dependencies (no external CDNs) to comply with Chrome's Content Security Policy

## Troubleshooting

### Common Issues

1. **MIME Type Errors**: Make sure you're loading the `dist/` folder, not the project root
2. **API Key Errors**: Ensure your `.env.local` file has the correct `GEMINI_API_KEY`
3. **CSP Violations**: The extension uses local dependencies only - no external CDNs

### Rebuilding After Changes
After making code changes, rebuild the extension:
```bash
npm run build
```
Then reload the extension in Chrome (click the refresh icon on the extension card).

## Project Structure

```
├── components/          # React components
├── features/           # Main feature components
├── services/           # API services (Gemini integration)
├── dist/              # Built extension files (after npm run build)
├── manifest.json      # Chrome extension manifest
└── vite.config.ts     # Vite configuration for extension building
```
