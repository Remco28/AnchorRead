# AnchorRead - Browser Extension (V1 Prototype)

AI-powered selective highlighting for faster reading. Highlights 1-3 key content words per paragraph using a background highlight style, without changing layout or summarizing the text.

## Current Status

This is the working prototype phase. The extension is designed to be loaded as an unpacked extension in Brave or Chrome.

## Quick Start (Load Unpacked)

1. Make sure you have the full folder:
   - manifest.json
   - popup.html / popup.js
   - background.js
   - content.js
   - styles.css
   - readability.js
   - plan.md + this README.md

2. Open Brave (or Chrome):
   - Go to `brave://extensions/` (or `chrome://extensions/`)

3. Enable **Developer mode** (toggle in top right).

4. Click **Load unpacked**.

5. Select this entire `AnchorRead` folder.

6. The extension icon should appear in your toolbar.

## First Use

1. Click the extension icon to open the popup.
2. Go to the Settings section and paste your API key for the model `gpt-5-nano-2025-08-07`.
3. Save the key.
4. Navigate to any article page (news, blog, Substack, etc.).
5. Click the **Highlight Article** button in the popup.
6. Wait for processing (usually 1-3 seconds).
7. Key anchors should appear with a warm yellow background highlight inside the main article body.
8. Use **Clear Highlights** to remove them completely (original text is restored).

## Files Overview

- `manifest.json` — Extension definition and permissions
- `popup.*` — User interface and settings
- `background.js` — Service worker that talks to the LLM API
- `content.js` — Runs on web pages, does the heavy DOM work with Readability
- `readability.js` — Mozilla Readability library (static copy)
- `styles.css` — Highlight styling

## Notes for V1

- Currently supports one provider/model (gpt-5-nano-2025-08-07).
- Uses paragraph-indexed structured output from the LLM for accurate highlighting.
- All processing is on-demand only.
- Highlights are scoped to the main article content to avoid sidebars and navigation.

## Development

When making changes:
- After editing JS files, go back to `brave://extensions/` and click the reload icon on the extension.
- For manifest changes, you may need to remove and re-load the extension.

## Next Steps

See `plan.md` for the full technical specification and remaining tasks.

---

Built as a clean vanilla Manifest V3 extension with no build tools required for the prototype.