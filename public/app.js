const pageEl = document.querySelector('.page');
const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('chat-input');
const chatPanel = document.getElementById('chat-panel');
const keyboardButton = document.getElementById('keyboard-toggle');
const muteButton = document.getElementById('mute-toggle');
const orbEl = document.querySelector('.orb');

let muted = false;
let chatVisible = false;
const conversation = [];
let pendingReplyEl = null;

const emotionStates = {
  0: {
    id: 0,
    name: 'joy',
    color: 'yellow',
    palette: {
      core: 'rgba(254, 240, 138, 0.95)',
      halo: 'rgba(252, 211, 77, 0.4)',
      glowOne: 'rgba(253, 224, 71, 0.75)',
      glowTwo: 'rgba(250, 204, 21, 0.45)',
      glowThree: 'rgba(250, 204, 21, 0.55)',
      glowFour: 'rgba(253, 224, 71, 0.35)'
    }
  },
  1: {
    id: 1,
    name: 'anger',
    color: 'red',
    palette: {
      core: 'rgba(248, 113, 113, 0.78)',
      halo: 'rgba(239, 68, 68, 0.4)',
      glowOne: 'rgba(239, 68, 68, 0.6)',
      glowTwo: 'rgba(220, 38, 38, 0.4)',
      glowThree: 'rgba(252, 165, 165, 0.42)',
      glowFour: 'rgba(248, 113, 113, 0.3)'
    }
  },
  2: {
    id: 2,
    name: 'fear',
    color: 'purple',
    palette: {
      core: 'rgba(196, 181, 253, 0.82)',
      halo: 'rgba(167, 139, 250, 0.35)',
      glowOne: 'rgba(167, 139, 250, 0.55)',
      glowTwo: 'rgba(139, 92, 246, 0.35)',
      glowThree: 'rgba(139, 92, 246, 0.45)',
      glowFour: 'rgba(196, 181, 253, 0.28)'
    }
  },
  3: {
    id: 3,
    name: 'disgust',
    color: 'green',
    palette: {
      core: 'rgba(167, 243, 208, 0.82)',
      halo: 'rgba(110, 231, 183, 0.35)',
      glowOne: 'rgba(110, 231, 183, 0.5)',
      glowTwo: 'rgba(52, 211, 153, 0.3)',
      glowThree: 'rgba(52, 211, 153, 0.4)',
      glowFour: 'rgba(167, 243, 208, 0.25)'
    }
  },
  4: {
    id: 4,
    name: 'sadness',
    color: 'blue',
    palette: {
      core: 'rgba(147, 197, 253, 0.82)',
      halo: 'rgba(96, 165, 250, 0.35)',
      glowOne: 'rgba(96, 165, 250, 0.52)',
      glowTwo: 'rgba(59, 130, 246, 0.32)',
      glowThree: 'rgba(59, 130, 246, 0.42)',
      glowFour: 'rgba(147, 197, 253, 0.26)'
    }
  }
};

const defaultEmotionState = emotionStates[0];
const ORB_OVERLAY_FADE_MS = 900;

let avatarState = emotionStates[0];
let orbOverlayEl = null;
let orbOverlayFadeTimeout = null;

if (orbEl) {
  orbEl.classList.add(`orb--${avatarState.name}`);
  ensureOrbOverlay();
}

function applyAvatarState(nextStateId) {
  const nextState = emotionStates[nextStateId] ?? emotionStates[0];

  if (!orbEl || nextState.name === avatarState.name) {
    avatarState = nextState;
    return;
  }

  const previousState = avatarState;
  const overlayEl = applyOverlayPalette(previousState ?? defaultEmotionState);
  if (overlayEl) {
    activateOverlay(overlayEl);
  }

  if (previousState?.name) {
    orbEl.classList.remove(`orb--${previousState.name}`);
  }
  orbEl.classList.add(`orb--${nextState.name}`);

  if (overlayEl) {
    if (orbOverlayFadeTimeout) {
      clearTimeout(orbOverlayFadeTimeout);
    }
    orbOverlayFadeTimeout = window.setTimeout(() => {
      overlayEl.classList.remove('orb__overlay--active');
      orbOverlayFadeTimeout = null;
    }, ORB_OVERLAY_FADE_MS + 60);
  }

  avatarState = nextState;
}

function ensureOrbOverlay() {
  if (!orbEl) {
    return null;
  }
  if (!orbOverlayEl) {
    orbOverlayEl = document.createElement('div');
    orbOverlayEl.className = 'orb__overlay';
    orbEl.appendChild(orbOverlayEl);
    setOverlayPaletteValues(orbOverlayEl, avatarState?.palette ?? defaultEmotionState.palette);
  }
  return orbOverlayEl;
}

function applyOverlayPalette(state) {
  const overlayEl = ensureOrbOverlay();
  if (!overlayEl) {
    return null;
  }

  const palette = state?.palette ?? defaultEmotionState.palette;
  setOverlayPaletteValues(overlayEl, palette);

  return overlayEl;
}

function setOverlayPaletteValues(element, palette) {
  element.style.setProperty('--overlay-core', palette.core);
  element.style.setProperty('--overlay-halo', palette.halo);
  element.style.setProperty('--overlay-glow-one', palette.glowOne);
  element.style.setProperty('--overlay-glow-two', palette.glowTwo);
  element.style.setProperty('--overlay-glow-three', palette.glowThree);
  element.style.setProperty('--overlay-glow-four', palette.glowFour);
}

function activateOverlay(overlayEl) {
  overlayEl.classList.remove('orb__overlay--active');
  // Flush removal before forcing the overlay visible without transition.
  void overlayEl.offsetHeight;
  overlayEl.style.transition = 'none';
  overlayEl.classList.add('orb__overlay--active');
  void overlayEl.offsetHeight;
  overlayEl.style.transition = '';
}

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
      const emotionId = Number.isInteger(data?.emotionId) ? data.emotionId : 0;
      applyAvatarState(emotionId);

      const reply = data?.reply?.trim();
      const rawReply = (data?.rawReply ?? reply ?? '').trim();

      if (!reply) {
        updatePendingReply('I could not find anything to say just now.');
        return;
      }
      conversation.push({ role: 'assistant', content: rawReply });
      updatePendingReply(reply);
    });
}
