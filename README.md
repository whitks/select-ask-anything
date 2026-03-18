# Understand Deeply (Chrome Extension)

Select text on any page and use either `Ctrl+Shift+Y` (deep explain) or type `wzz` (short definition) to get AI help in a floating panel.

## Stack
- Chrome Extension Manifest V3
- Groq Chat Completions API (`moonshotai/kimi-k2-instruct-0905` default)
- Tailwind CSS for panel + options UI

## Setup
1. Install dependencies:
   - `npm install`
2. Build Tailwind CSS assets:
   - `npm run build:css`
3. Load extension in Chrome:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click **Load unpacked** and select this project folder
4. Open extension options and set your Groq API key.

## Usage
1. Highlight text on a page.
2. Press `Ctrl+Shift+Y` for deep explanation, or type `wzz` for a short 3-5 line definition.
3. A floating panel appears and streams the response live as it is generated.
4. Click `Stop` in the panel if you want to cancel generation mid-stream.

## Notes
- History is saved locally in `chrome.storage.local`.
- You can clear history from the options page.
- Shortcut is configurable at `chrome://extensions/shortcuts`.
- If you edit extension code, reload it in `chrome://extensions` before retesting.
