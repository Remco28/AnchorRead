// AnchorRead Popup Script (V1)

const statusEl = document.getElementById('status');
const highlightBtn = document.getElementById('highlight-btn');
const clearBtn = document.getElementById('clear-btn');
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key-btn');

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#c00' : '#555';
}

function setLoading(isLoading) {
  highlightBtn.disabled = isLoading;
  clearBtn.disabled = isLoading;
}

async function loadSavedKey() {
  const result = await chrome.storage.local.get(['apiKey']);
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
}

async function saveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setStatus('Please enter an API key', true);
    return;
  }
  await chrome.storage.local.set({ apiKey: key });
  setStatus('API key saved.');
  setTimeout(() => setStatus(''), 1500);
}

async function sendMessageToBackground(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      resolve(response);
    });
  });
}

async function triggerHighlight() {
  setLoading(true);
  setStatus('Processing article...');

  try {
    const response = await sendMessageToBackground('HIGHLIGHT');

    if (response && response.success) {
      setStatus(`Highlighted ${response.count || 0} anchors.`);
    } else {
      setStatus(response?.error || 'Failed to highlight', true);
    }
  } catch (err) {
    setStatus('Error: ' + err.message, true);
  } finally {
    setLoading(false);
  }
}

async function triggerClear() {
  setLoading(true);
  setStatus('Clearing highlights...');

  try {
    const response = await sendMessageToBackground('CLEAR');
    if (response && response.success) {
      setStatus('Highlights removed.');
    } else {
      setStatus(response?.error || 'Failed to clear', true);
    }
  } catch (err) {
    setStatus('Error: ' + err.message, true);
  } finally {
    setLoading(false);
  }
}

// Event listeners
highlightBtn.addEventListener('click', triggerHighlight);
clearBtn.addEventListener('click', triggerClear);
saveKeyBtn.addEventListener('click', saveKey);

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  loadSavedKey();
  setStatus('');
});