// AnchorRead Content Script (V1)

let articleRoot = null;
let currentHighlights = null; // for potential future re-apply on mutations

function findArticleContainer() {
  // Clone document to run Readability safely
  const docClone = document.cloneNode(true);
  const reader = new Readability(docClone);
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.length < 200) {
    // Fallback: try to find a reasonable main content container
    const candidates = [
      document.querySelector('article'),
      document.querySelector('[role="main"]'),
      document.querySelector('main'),
      document.querySelector('#content'),
      document.querySelector('.post-content'),
      document.querySelector('.article-body')
    ].filter(Boolean);

    return candidates[0] || document.body;
  }

  // Try to find the best matching live element by comparing text
  // For V1 we use a pragmatic approach: look for the largest text block
  // that contains the article title or first 100 chars of extracted text

  const searchText = (article.title || article.textContent.slice(0, 120)).toLowerCase();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let bestMatch = null;
  let bestScore = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (['ARTICLE', 'MAIN', 'DIV', 'SECTION'].includes(node.tagName)) {
      const nodeText = node.textContent.toLowerCase();
      if (nodeText.includes(searchText.slice(0, 60))) {
        const score = node.textContent.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = node;
        }
      }
    }
  }

  return bestMatch || document.body;
}

function getParagraphsFromContainer(container) {
  const paragraphs = [];
  const elements = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');

  let index = 0;
  for (const el of elements) {
    const text = el.textContent.trim();
    if (text.length > 20) {  // skip very short lines
      paragraphs.push({
        index: index,
        text: text
      });
      index++;
    }
  }

  return paragraphs;
}

function applyHighlightsToDOM(highlights) {
  if (!articleRoot) {
    articleRoot = findArticleContainer();
  }

  let totalApplied = 0;

  // Build a map of paragraph index -> anchors
  const highlightMap = new Map();
  for (const h of highlights) {
    if (typeof h.index === 'number' && Array.isArray(h.anchors)) {
      highlightMap.set(h.index, h.anchors);
    }
  }

  // Get all paragraph-like elements in order inside the container
  const paraElements = articleRoot.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');

  let currentParaIndex = 0;

  for (const paraEl of paraElements) {
    const text = paraEl.textContent.trim();
    if (text.length < 20) continue;

    const anchors = highlightMap.get(currentParaIndex);
    if (anchors && anchors.length > 0) {
      // Walk text nodes inside this paragraph only
      const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        textNodes.push(node);
      }

      for (const textNode of textNodes) {
        let nodeText = textNode.nodeValue;
        let modified = false;

        for (const anchor of anchors) {
          if (!anchor || anchor.length < 2) continue;

          // Word boundary regex, case insensitive
          const regex = new RegExp(`\\b(${escapeRegExp(anchor)})\\b`, 'gi');

          if (regex.test(nodeText)) {
            // Split and wrap
            const newHtml = nodeText.replace(regex, (match) => {
              return `<span class="anchor-read-highlight">${match}</span>`;
            });

            const wrapper = document.createElement('span');
            wrapper.innerHTML = newHtml;

            // Replace the text node with the new structure
            const parent = textNode.parentNode;
            while (wrapper.firstChild) {
              parent.insertBefore(wrapper.firstChild, textNode);
            }
            parent.removeChild(textNode);
            modified = true;
            totalApplied += 1;
          }
        }
      }
    }
    currentParaIndex++;
  }

  currentHighlights = highlights;
  return totalApplied;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearHighlights() {
  if (!articleRoot) return;

  const spans = articleRoot.querySelectorAll('.anchor-read-highlight');
  for (const span of spans) {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent), span);
      // Normalize to merge adjacent text nodes
      parent.normalize();
    }
  }
  currentHighlights = null;
}

function clearHighlightsFromWholePage() {
  const spans = document.querySelectorAll('.anchor-read-highlight');
  for (const span of spans) {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    }
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "EXTRACT_PARAGRAPHS") {
        articleRoot = findArticleContainer();
        const paragraphs = getParagraphsFromContainer(articleRoot);

        sendResponse({
          success: true,
          paragraphs: paragraphs
        });
      }

      else if (message.type === "APPLY_HIGHLIGHTS") {
        const count = applyHighlightsToDOM(message.highlights || []);
        sendResponse({ success: true, count });
      }

      else if (message.type === "CLEAR_HIGHLIGHTS") {
        clearHighlightsFromWholePage();
        sendResponse({ success: true });
      }
    } catch (err) {
      console.error("AnchorRead content error:", err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true;
});

// Optional: basic mutation observer for V1 (re-apply existing highlights to new content)
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!currentHighlights) return;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // Re-apply highlights to newly added nodes inside articleRoot if possible
        // For V1 we keep it simple — only full re-trigger from popup for new content
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize observer (lightweight for V1)
setupMutationObserver();

console.log("AnchorRead content script loaded");