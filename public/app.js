const pageEl = document.querySelector('.page');
const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('chat-input');
const chatPanel = document.getElementById('chat-panel');
const keyboardButton = document.getElementById('keyboard-toggle');
const muteButton = document.getElementById('mute-toggle');

let muted = false;
let chatVisible = false;
const conversation = [
  {
    role: 'system',
    content: 'You are a thoughtful, encouraging assistant who keeps responses concise and helpful.'
  }
];
let pendingReplyEl = null;

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(sender, text) {
  const message = document.createElement('article');
  message.className = `message message--${sender}`;

  const bubble = document.createElement('p');
  bubble.className = 'message__bubble';
  bubble.textContent = text;

  const meta = document.createElement('span');
  meta.className = 'message__meta';
  const author = sender === 'user' ? 'You' : 'Avatar';
  meta.textContent = `${author} • ${formatTime(new Date())}`;

  message.append(bubble, meta);
  messagesEl.append(message);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return message;
}

function updatePendingReply(text) {
  if (pendingReplyEl) {
    const bubble = pendingReplyEl.querySelector('.message__bubble');
    if (bubble) {
      bubble.textContent = text;
    }
    pendingReplyEl = null;
  } else {
    addMessage('avatar', text);
  }
}

function setChatVisibility(visible) {
  chatVisible = visible;
  chatPanel.classList.toggle('chat--visible', visible);
  chatPanel.setAttribute('aria-hidden', String(!visible));
  keyboardButton.setAttribute('aria-expanded', String(visible));
  keyboardButton.classList.toggle('keyboard--active', visible);
  pageEl.classList.toggle('page--chat-open', visible);
  const label = visible ? 'Hide chat keyboard' : 'Open chat keyboard';
  keyboardButton.setAttribute('aria-label', label);
  keyboardButton.setAttribute('title', label);

  if (visible) {
    window.setTimeout(() => {
      inputEl.focus({ preventScroll: true });
    }, 350);
  } else {
    inputEl.blur();
  }
}

formEl.addEventListener('submit', event => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) {
    return;
  }

  addMessage('user', text);
  conversation.push({ role: 'user', content: text });
  inputEl.value = '';

  if (muted) {
    updatePendingReply('I am muted right now. Tap the speaker icon when you are ready for a reply.');
    return;
  }

  pendingReplyEl = addMessage('avatar', 'Thinking…');
  sendChatRequest().catch(error => {
    console.error('Chat request failed:', error);
    updatePendingReply('Sorry, I had trouble replying. Please try again in a moment.');
  });
});

keyboardButton.addEventListener('click', () => {
  setChatVisibility(!chatVisible);
});

muteButton.addEventListener('click', () => {
  muted = !muted;
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.textContent = muted ? '🔊' : '🔇';
  muteButton.setAttribute('aria-label', muted ? 'Unmute avatar' : 'Mute avatar');
  muteButton.setAttribute('title', muted ? 'Unmute avatar' : 'Mute avatar');
});

function sendChatRequest() {
  return fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: conversation
    })
  })
    .then(async response => {
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        console.error('LLM request failed', problem);
        throw new Error(problem.error || problem.detail || 'Unexpected response');
      }
      return response.json();
    })
    .then(data => {
      const reply = data?.reply?.trim();
      if (!reply) {
        updatePendingReply('I could not find anything to say just now.');
        return;
      }
      conversation.push({ role: 'assistant', content: reply });
      updatePendingReply(reply);
    });
}

conversation.push({
  role: 'system',
  content: 'You are a thoughtful, encouraging assistant who keeps responses concise and helpful.'
});
