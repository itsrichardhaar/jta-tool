// ── FAQ Accordion ──
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const toggle = btn.querySelector('.faq-toggle');
  const isOpen = answer.classList.contains('open');

  document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-question').forEach(q => {
    q.classList.remove('open');
    q.querySelector('.faq-toggle').classList.remove('open');
  });

  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
    toggle.classList.add('open');
  }
}

// ── API / Chat Logic ──
const API_BASE_URL = 'https://earthcenterportal.azurewebsites.net/api/Jta';
const STORAGE_KEY_SESSION = 'jta_session_id';
const STORAGE_KEY_HISTORY = 'jta_chat_history';

const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const excelButton = document.getElementById('excel-button');

let history = [];

function getSessionId() {
  let sessionId = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
  }
  return sessionId;
}

function loadLocalHistory() {
  const json = localStorage.getItem(STORAGE_KEY_HISTORY);
  return json ? JSON.parse(json) : [];
}

function saveLocalHistory(hist) {
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(hist));
}

function appendMessage(role, content, skipSave = false) {
  const messageContent = content || '';

  chatWindow.classList.add('has-messages');

  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message');

  if (role === 'user') {
    msgDiv.classList.add('user-message');
    msgDiv.innerHTML = `
      <div class="avatar">You</div>
      <div class="bubble">${messageContent.replace(/\n/g, '<br>')}</div>
    `;
  } else if (role === 'system') {
    msgDiv.classList.add('system-message');
    msgDiv.innerHTML = `<div class="bubble">${messageContent}</div>`;
  } else {
    msgDiv.classList.add('assistant-message');
    msgDiv.innerHTML = `
      <div class="avatar">JTA</div>
      <div class="bubble">${messageContent.replace(/\n/g, '<br>')}</div>
    `;
  }

  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  if (!skipSave && role !== 'system') {
    history = loadLocalHistory();
    history.push({ Role: role, Content: messageContent });
    saveLocalHistory(history);
  }
}

function showTyping() {
  const el = document.createElement('div');
  el.classList.add('chat-message', 'assistant-message');
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="avatar">JTA</div>
    <div class="bubble typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `;
  chatWindow.classList.add('has-messages');
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function setLoading(buttonId, loading) {
  const btn = document.getElementById(buttonId);
  if (buttonId === 'send-button') {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<div class="spinner dark"></div>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="#11304b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<div class="spinner dark"></div> Generating&hellip;`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg> Generate &amp; Download Excel`;
  }
}

const INPUT_PLACEHOLDER = messageInput.getAttribute('placeholder');

async function initializeChat() {
  getSessionId();
  history = loadLocalHistory();
  if (history.length > 0) {
    markChatStarted();
    history.forEach(msg => appendMessage(msg.Role, msg.Content, true));
    messageInput.removeAttribute('placeholder');
  }
}

async function handleSendMessage() {
  const userMessage = messageInput.value.trim();
  if (!userMessage) return;
  markChatStarted();
  appendMessage('user', userMessage, false);
  messageInput.removeAttribute('placeholder');
  messageInput.value = '';
  messageInput.style.height = 'auto';
  showTyping();
  setLoading('send-button', true);
  try {
    const updatedHistory = loadLocalHistory();
    const requestBody = JSON.stringify({ ChatHistory: updatedHistory });
    const response = await fetch(`${API_BASE_URL}/SendChatMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });
    removeTyping();
    if (response.ok) {
      const data = await response.json();
      appendMessage('assistant', data.assistantResponse || 'No response received from assistant.', false);
    } else {
      const errorText = await response.text();
      appendMessage('system', `Error: Could not get assistant response. Status ${response.status}.`, true);
      console.error('API Error:', errorText);
    }
  } catch (error) {
    removeTyping();
    appendMessage('system', 'Network error. Could not reach the API.', true);
    console.error('Error during chat:', error);
  } finally {
    setLoading('send-button', false);
  }
}

async function handleExcelGenerate() {
  const currentHistory = loadLocalHistory();
  if (currentHistory.length === 0) {
    alert('Please start a conversation first to define the occupation before generating the report.');
    return;
  }
  setLoading('excel-button', true);
  try {
    const requestBody = JSON.stringify({ ChatHistory: currentHistory });
    const response = await fetch(`${API_BASE_URL}/GenerateJtaExcel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });
    if (response.ok) {
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'JTA_Export.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?;?/i);
        if (match && match[1]) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        alert('The server returned an empty file. Please try again.');
        return;
      }
      const excelBlob = new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(excelBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
      markSessionEnded();
      showFeedbackModal();
    } else {
      const errorText = await response.text();
      const shortError = errorText.length > 200 ? errorText.substring(0, 200) + '…' : errorText;
      alert(`Error generating Excel file (HTTP ${response.status}): ${shortError}`);
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('A network error occurred while attempting to download the file.');
  } finally {
    setLoading('excel-button', false);
  }
}

// ── Auto-resize textarea ──
messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ── Session Expiry ──
// Once the chat has started, the browser's native confirmation prompt guards
// against accidentally closing the tab/window. `chatStarted` arms the guard.
let chatStarted = false;

function clearSession() {
  localStorage.removeItem(STORAGE_KEY_HISTORY);
  localStorage.removeItem(STORAGE_KEY_SESSION);
  history = [];
  chatWindow.innerHTML = '';
  chatWindow.classList.remove('has-messages');
  messageInput.setAttribute('placeholder', INPUT_PLACEHOLDER);
}

// Called once the user begins a conversation — arms the close guard.
function markChatStarted() {
  chatStarted = true;
}

// Called once the JTA export has downloaded — the session's work is done, so
// disarm the close guard and stop prompting on tab/window close.
function markSessionEnded() {
  chatStarted = false;
}

// Native browser confirmation when the user tries to close/navigate away
// after starting the chat. The browser shows its own "Leave site?" prompt.
window.addEventListener('beforeunload', (e) => {
  if (!chatStarted) return;
  e.preventDefault();
  e.returnValue = '';
});

// Clear session silently when user leaves the page
window.addEventListener('pagehide', clearSession);

// ── Feedback Modal — step-by-step wizard ──
const FEEDBACK_THANK_YOU_MS = 2200;
const FEEDBACK_ENDPOINT = 'https://formspree.io/f/xdenzrzv';

let feedbackOverlay   = null;
let feedbackForm      = null;
let feedbackThankYou  = null;
let feedbackPrevBtn   = null;
let feedbackNextBtn   = null;
let feedbackSubmitBtn = null;
let feedbackSteps     = [];
let feedbackCurrentStep = 1;
let feedbackThankYouTimer = null;

function feedbackStepIsValid(stepEl) {
  if (!stepEl) return false;
  const radios = stepEl.querySelectorAll('input[type="radio"]');
  if (radios.length === 0) return true; // open-ended step is optional
  return Array.from(radios).some(r => r.checked);
}

function feedbackAllRatingsAnswered() {
  return feedbackSteps.every(step => {
    const radios = step.querySelectorAll('input[type="radio"]');
    if (radios.length === 0) return true;
    return Array.from(radios).some(r => r.checked);
  });
}

function feedbackGoToStep(step) {
  if (!feedbackSteps.length) return;
  feedbackCurrentStep = Math.max(1, Math.min(step, feedbackSteps.length));
  feedbackSteps.forEach((el, idx) => {
    el.classList.toggle('active', idx === feedbackCurrentStep - 1);
  });
  feedbackUpdateProgress();
  feedbackUpdateButtons();
}

function feedbackUpdateProgress() {
  const current = document.getElementById('feedback-step-current');
  const total   = document.getElementById('feedback-step-total');
  const fill    = document.getElementById('feedback-progress-fill');
  if (current) current.textContent = feedbackCurrentStep;
  if (total)   total.textContent   = feedbackSteps.length;
  if (fill)    fill.style.width    = (feedbackCurrentStep / feedbackSteps.length * 100) + '%';
}

function feedbackUpdateButtons() {
  if (!feedbackPrevBtn || !feedbackNextBtn || !feedbackSubmitBtn) return;
  const isFirst = feedbackCurrentStep === 1;
  const isLast  = feedbackCurrentStep === feedbackSteps.length;
  const activeStep = feedbackSteps[feedbackCurrentStep - 1];

  feedbackPrevBtn.hidden   = isFirst;
  feedbackNextBtn.hidden   = isLast;
  feedbackSubmitBtn.hidden = !isLast;

  feedbackNextBtn.disabled   = !feedbackStepIsValid(activeStep);
  feedbackSubmitBtn.disabled = !feedbackAllRatingsAnswered();
}

function feedbackReset() {
  if (feedbackThankYouTimer) { clearTimeout(feedbackThankYouTimer); feedbackThankYouTimer = null; }
  if (feedbackForm)     { feedbackForm.reset(); feedbackForm.hidden = false; }
  if (feedbackThankYou) { feedbackThankYou.hidden = true; }
  feedbackGoToStep(1);
}

function showFeedbackModal() {
  if (!feedbackOverlay) return;
  feedbackReset();
  feedbackOverlay.classList.add('visible');
}

function hideFeedbackModal() {
  if (feedbackOverlay) feedbackOverlay.classList.remove('visible');
  if (feedbackThankYouTimer) { clearTimeout(feedbackThankYouTimer); feedbackThankYouTimer = null; }
}

function handleFeedbackSubmit(e) {
  e.preventDefault();
  if (!feedbackAllRatingsAnswered()) return;
  const formData = new FormData(e.target);
  // Flat payload so each field is its own readable column in Formspree.
  const payload = {
    sessionId: getSessionId(),
    submittedAt: new Date().toISOString(),
    openResponse: (formData.get('open-response') || '').toString().trim(),
    _subject: 'JTA Tool feedback'
  };
  for (let i = 1; i <= 5; i++) {
    const value = formData.get('q' + i);
    payload['q' + i] = value !== null ? Number(value) : null;
  }

  if (feedbackSubmitBtn) feedbackSubmitBtn.disabled = true;

  fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => {
    // Non-fatal: don't trap the user if the network hiccups.
    console.error('JTA feedback submission failed:', err);
  });

  if (feedbackForm)     feedbackForm.hidden = true;
  if (feedbackThankYou) feedbackThankYou.hidden = false;
  feedbackThankYouTimer = setTimeout(hideFeedbackModal, FEEDBACK_THANK_YOU_MS);
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
  feedbackOverlay   = document.getElementById('feedback-modal-overlay');
  feedbackForm      = document.getElementById('feedback-form');
  feedbackThankYou  = document.getElementById('feedback-thank-you');
  feedbackPrevBtn   = document.getElementById('feedback-prev-btn');
  feedbackNextBtn   = document.getElementById('feedback-next-btn');
  feedbackSubmitBtn = document.getElementById('feedback-submit-btn');
  feedbackSteps     = Array.from(document.querySelectorAll('.feedback-step'));

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    feedbackForm.addEventListener('change', feedbackUpdateButtons);
  }
  if (feedbackPrevBtn) feedbackPrevBtn.addEventListener('click', () => feedbackGoToStep(feedbackCurrentStep - 1));
  if (feedbackNextBtn) feedbackNextBtn.addEventListener('click', () => feedbackGoToStep(feedbackCurrentStep + 1));
  const feedbackCloseBtn = document.getElementById('feedback-close-btn');
  if (feedbackCloseBtn) feedbackCloseBtn.addEventListener('click', hideFeedbackModal);

  feedbackGoToStep(1);

  sendButton.addEventListener('click', handleSendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  excelButton.addEventListener('click', handleExcelGenerate);
  initializeChat();
});
