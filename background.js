// AnchorRead Background Service Worker (V1)

const MODEL = "gpt-5-nano-2025-08-07";
const API_BASE = "https://api.openai.com/v1/chat/completions";

async function getApiKey() {
  const result = await chrome.storage.local.get(['apiKey']);
  return result.apiKey;
}

async function callLLM(paragraphs, apiKey) {
  const payload = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are an elite speed-reading anchor engine. You will receive an array of paragraphs from an article, each with an index.\n\nFor each paragraph, select 1–3 of the most important content words or short phrases (key nouns, verbs, technical terms, and any critical negation words such as 'not' or 'never').\n\nReturn ONLY a JSON object in this exact shape:\n{\n  \"highlights\": [\n    {\"index\": 0, \"anchors\": [\"revenue\", \"growth\"]},\n    {\"index\": 1, \"anchors\": [\"not\", \"expected\"]}\n  ]\n}\n\nUse the original casing from the text. Keep anchors short and precise."
      },
      {
        role: "user",
        content: JSON.stringify({ paragraphs })
      }
    ],
    max_completion_tokens: 800
  };

  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error("No content in LLM response");

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("LLM did not return valid JSON: " + content);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "HIGHLIGHT") {
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          sendResponse({ success: false, error: "No API key saved. Please set it in the popup." });
          return;
        }

        const tab = await getActiveTab();
        if (!tab || !tab.id) {
          sendResponse({ success: false, error: "No active tab" });
          return;
        }

        // Ask content script to extract paragraphs with indices
        let extractResponse;
        try {
          extractResponse = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PARAGRAPHS" });
        } catch (sendErr) {
          console.error("Failed to reach content script:", sendErr);
          sendResponse({ 
            success: false, 
            error: "Could not connect to the page. Please reload the tab and try again." 
          });
          return;
        }

        if (!extractResponse || !extractResponse.success) {
          sendResponse({ success: false, error: extractResponse?.error || "Failed to extract article content" });
          return;
        }

        const { paragraphs } = extractResponse;

        if (!paragraphs || paragraphs.length === 0) {
          sendResponse({ success: false, error: "No readable paragraphs found in article" });
          return;
        }

        // Call LLM
        const llmResult = await callLLM(paragraphs, apiKey);

        if (!llmResult.highlights || !Array.isArray(llmResult.highlights)) {
          sendResponse({ success: false, error: "LLM returned unexpected format" });
          return;
        }

        // Send highlights back to content script for DOM surgery
        const highlightResponse = await chrome.tabs.sendMessage(tab.id, {
          type: "APPLY_HIGHLIGHTS",
          highlights: llmResult.highlights
        });

        sendResponse({
          success: true,
          count: llmResult.highlights.reduce((sum, h) => sum + (h.anchors?.length || 0), 0)
        });

      } catch (err) {
        console.error("AnchorRead background error:", err);
        sendResponse({ success: false, error: err.message });
      }
    }

    if (message.type === "CLEAR") {
      try {
        const tab = await getActiveTab();
        if (!tab || !tab.id) {
          sendResponse({ success: false, error: "No active tab" });
          return;
        }

        await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_HIGHLIGHTS" });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
  })();

  // Return true to indicate we will respond asynchronously
  return true;
});