# Technical Specification & Project Plan: "AnchorRead" (Working Title)

### An AI-Driven Selective Highlighting Extension for Brave & Chrome

---

## 1. Executive Summary & Purpose

The objective of this project is to build a modern browser extension that increases a user's reading speed and cognitive processing **without** resorting to text summarization, layout manipulation, or aggressive rapid-flash UI (RSVP).

Unlike traditional speed-reading tools, this extension preserves the author's original voice, text layout, and structural flow. It leverages a lightweight Large Language Model (LLM) via a cloud API to dynamically analyze text and perform **Selective Highlighting** — painting 1 to 3 critical **Content Words** (semantic anchors, technical terminology, core actions, and necessary negation modifiers) per sentence using a high-salience background highlight.

This approach guides eye saccades directly to dense information packets while letting the brain naturally "autocomplete" the low-salience function words.

**V1 Goal:** Deliver a working, load-unpacked prototype that feels immediately useful on real articles.

---

## 2. Core Constraints & Technical Decisions (V1)

* **Format:** Cross-Browser Extension (Manifest V3).
* **Target Browsers:** Chromium-based, optimized for **Brave** (full compatibility with Chrome, Edge, Opera).
* **Infrastructure Strategy:** Completely on-demand. The extension does nothing until the user explicitly clicks the action in the popup on an article tab. No background polling, no automatic processing.
* **AI Architecture:** Cloud-based, single-provider for V1 (provider choice to be finalized). Use cheap, low-latency "frontier-light" models with native JSON mode.
* **Data Integrity:** Never alter underlying text, never change spacing or layout. Only wrap matched words in styled `<span>` elements that can be cleanly removed.
* **V1 Packaging:** Pure vanilla JavaScript. No build step, no bundler, no package.json for the prototype. All files are static and directly loadable as an unpacked extension.
* **Highlight Style (V1):** Background highlight (soft yellow / warm tone) instead of red text color for better readability across sites.

---

## 3. Technology Stack (V1)

* **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Extension Framework:** Web Extensions API (Manifest V3).
* **Components:**
  - `popup.html` + `popup.js` — trigger button, simple settings form (API key), status messages, Clear button.
  - `background.js` — Manifest V3 service worker. Owns all API calls, orchestration, and state.
  - `content.js` — Injected into article pages. Handles Readability, DOM analysis, highlighting, and MutationObserver.
  - `styles.css` — Highlight styles + any popup styling.
* **Parsing:** Mozilla Readability.js (single static file dropped into the project).
* **AI:** One provider for V1 using model "gpt-5-nano-2025-08-07". Structured JSON output enforced. The model name is easy to change in background.js.
* **Storage:** chrome.storage.local for API key and any light settings.

---

## 4. System Architecture & Lifecycle (V1)

The execution follows a clean three-component flow. All network work happens in the background worker.

```
[ User on Article Page ]
       │
       ▼ (Clicks "Highlight" in Popup)
┌──────────────────────┐
│       POPUP          │  (UI + Settings + Status)
└──────────────────────┘
       │  (message to background)
       ▼
┌──────────────────────┐
│   BACKGROUND WORKER  │  (API key lookup, LLM call, result forwarding)
└──────────────────────┘
       │  (message to content script)
       ▼
┌──────────────────────┐
│     CONTENT SCRIPT   │  (Readability container ID + text extraction
│                      │   → safe highlighting inside article only
│                      │   → MutationObserver for dynamic content)
└──────────────────────┘
       │
       ▼ (Background-style highlights applied)
[ Article with salient anchors highlighted — fully reversible ]
```

Key improvement over original plan: **All text extraction and highlighting is strictly scoped to the main article container** identified by Readability in the live DOM. No more global page-wide string search.

---

## 5. Step-by-Step Implementation Roadmap (V1 Focus)

### Phase 1: Foundation & Architecture

* Create the project directory with these exact files:
  - manifest.json (Manifest V3, proper permissions + host permissions for chosen API)
  - popup.html + popup.js + popup styles
  - background.js (service worker)
  - content.js
  - styles.css (highlight rules)
  - readability.js (static copy of the library)
* Set up manifest with:
  - permissions: ["activeTab", "scripting", "storage"]
  - host_permissions for the chosen LLM API
  - background.service_worker
  - content_scripts targeting http/https
  - action.default_popup
* Implement popup with three states: Idle, Settings form (API key input + Save), Processing / Success / Error.
* Add "Highlight Article" and "Clear Highlights" buttons.
* Wire simple chrome.runtime messaging between popup ↔ background ↔ content.

### Phase 2: Article Container Identification + Safe Extraction

* In content.js, on trigger:
  1. Clone the current document.
  2. Run `new Readability(clonedDoc).parse()` to obtain the article object.
  3. Use heuristics (or the returned article's root) to locate the **live main article container element** in the real DOM (not the clone). This is the critical improvement.
  4. Store a reference to this live `articleRoot` element.
  5. Extract clean text **only from inside articleRoot** (paragraphs, list items, headings).
* Split the clean text inside the article container into logical paragraphs, assign sequential indices, and send the structured paragraphs array to the background worker.

### Phase 3: API Gateway, Prompt & Structured Output

* Background worker handles the actual fetch to the LLM using the stored API key.
* Enforce JSON mode / structured outputs.
* V1 prompt (to be refined together):

  "You are an elite speed-reading anchor engine. You will receive an array of paragraphs from an article, each with an index.

  For each paragraph, select 1–3 of the most important content words or short phrases (key nouns, verbs, technical terms, and any critical negation words such as 'not' or 'never').

  Return ONLY a JSON object in this exact shape:
  {
    \"highlights\": [
      {\"index\": 0, \"anchors\": [\"revenue\", \"growth\"]},
      {\"index\": 1, \"anchors\": [\"not\", \"expected\"]}
    ]
  }

  Use the original casing from the text. Keep anchors short and precise. Do not add any other fields or explanations."

* Basic length guard and error handling in background.
* Forward the array of anchors back to the content script.

### Phase 4: DOM Surgery — Container-Scoped, Reversible Highlighting

* Content script receives the richer "highlights" array containing paragraph indices + anchors.
* First locates the corresponding paragraph element inside articleRoot using the index (by walking the container's paragraph-like children in order).
* Then walks **only text nodes inside that specific paragraph**.
* Uses a TreeWalker + regex with word boundaries (`\b`) for safe, case-insensitive matching. This gives excellent locality and accuracy.
* For each match, splits the text node and inserts:
  ```html
  <span class="anchor-read-highlight">word</span>
  ```
* Highlight CSS (background style):

  ```css
  .anchor-read-highlight {
      background-color: #fff59d !important;   /* warm, readable yellow */
      color: #1f1f1f !important;
      font-weight: 600 !important;
      padding: 1px 3px !important;
      border-radius: 2px !important;
      box-decoration-break: clone;
  }
  ```

* **Clear functionality:** Walk the articleRoot again, find all highlight spans, and unwrap them (replace with their text content) so the original DOM is restored perfectly.

* Handle multiple non-overlapping matches inside the same text node correctly.

### Phase 5: Basic Dynamic Content Support + Polish (V1)

* Add a lightweight MutationObserver on the articleRoot (or body with filtering).
* When new nodes are added while highlights are active, re-apply the current anchor list to any new text nodes inside the article container **without** making another LLM call (for V1).
* Popup shows clear status messages ("Analyzing article…", "Highlighted 52 anchors", "Error: API key missing", etc.).
* Basic error recovery and re-trigger support.
* Simple "Remove Highlights" always available.

---

## 6. Risk Analysis & Mitigation (Updated for V1 Strategy)

| Identified Technical Risk                        | Impact | Strategic Mitigation (V1) |
|--------------------------------------------------|--------|---------------------------|
| Wrong highlights outside real article (nav, comments, ads) | High | **Primary fix:** All extraction and surgery locked to Readability-identified live article container. Global search is never performed. |
| Layout breakage from DOM mutations               | High | Strict TreeWalker on text nodes only. Never touch innerHTML of structural elements. Spans are leaf elements and fully removable. |
| LLM returns generic or low-value words           | Medium | Improved prompt + user can instantly Clear + Re-trigger. Future prompt tuning in later phases. |
| API key / provider configuration                 | Medium | Dedicated settings form in popup. Stored in chrome.storage.local. Clear error messaging if missing. |
| Performance on very long articles                | Low    | On-demand only. Client-side length guard before sending to LLM. Container scoping reduces work. |
| Infinite scroll / dynamic loading (Medium, etc.) | Medium | Basic MutationObserver in V1 that reapplies existing anchors to new content. No new API calls during scroll. |
| CSS conflicts with site styles                   | Low    | Heavy use of `!important` + specific background + padding rules. |

---

## 7. V1 Prototype Scope & Success Criteria

**In scope for first working version:**
- Complete Manifest V3 extension with popup + background + content split.
- Simple settings UI for pasting and saving one API key.
- End-to-end: click highlight → container detection → LLM call → background-style highlights inside article only.
- Working Clear button that perfectly restores original text.
- Basic status and error handling in the popup.
- Load-unpacked in Brave/Chrome with zero build tools.
- Static readability.js included in the folder.
- Documentation in the folder (this plan + a short README.md with setup steps).

**Out of scope for V1 (deferred):**
- Multi-provider switching UI.
- Advanced per-paragraph structured output from LLM.
- Sophisticated negation phrase handling ("not increase").
- Full prompt engineering iteration.
- Token usage dashboard or cost warnings.
- Packaging for Chrome Web Store.
- Theming or advanced customization.

**Success metric:** User can load the folder as an unpacked extension, set a key, open a real article, click Highlight, see useful background highlights appear quickly inside the article body, and clear them cleanly.

---

## 8. Packaging Recommendation for V1

**Use pure vanilla static files. No build step.**

- No package.json
- No webpack, vite, or esbuild
- Just the files listed above + one static readability.js

**How we will obtain readability.js (once):**
We will curl the official browser-friendly version from the Mozilla GitHub repo into the project directory. It will be declared in manifest.json under content_scripts and web_accessible_resources as needed.

This approach makes "Load unpacked" trivial, keeps the repo clean, and matches the "working prototype" requirement perfectly. We can always introduce a minimal build later if the project grows.

---

## 9. Open Items for Next Discussion

After you review this updated plan, let's decide:

1. Confirm the model string "gpt-5-nano-2025-08-07" is the one we want to use in the first implementation (or change it now).
2. Exact prompt wording — should we try a slightly richer output format even in V1 (e.g. array of objects with minimal context) or stay with flat array?
3. Specific highlight color / intensity — the warm yellow above is a starting suggestion; we can tune after you test on real pages.
4. Any additional popup fields in V1 (e.g. "Max tokens to send" slider or just hard limits)?
5. Do you want a very small README.md created alongside this plan with "How to load and test" instructions?
6. Once the plan feels solid, shall we begin creating the actual files?

---

This revised plan keeps the original vision and constraints while fixing the most dangerous technical assumption (global string matching) and adding the missing practical pieces for a usable V1 prototype.

Ready for your feedback and the next round of refinements.