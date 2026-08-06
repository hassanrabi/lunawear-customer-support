// ============================================================================
// LUNAWEAR — script.js
// Handles: mobile navigation toggle + the "Ask LunaWear AI" live chat widget,
// which sends each message to an n8n webhook and renders the AI's actual
// reply as a chat bubble in the thread.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. MOBILE NAVIGATION TOGGLE
// ---------------------------------------------------------------------------
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");

navToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
});

// Close the mobile menu automatically once a nav link is tapped
mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// ---------------------------------------------------------------------------
// 2. AI CUSTOMER SUPPORT CHAT
// ---------------------------------------------------------------------------

// Replace with your real n8n production webhook URL (not the Test URL).
// The workflow must respond with a "Respond to Webhook" node returning JSON,
// e.g. { "reply": "Your order shipped yesterday and arrives Thursday." }
const WEBHOOK_URL = "https://naheed2.app.n8n.cloud/webhook/chat";

const chatThread = document.getElementById("chatThread");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const formError = document.getElementById("formError");

// A stable ID for this visit, sent with every message. If your n8n workflow
// stores conversation history (e.g. in a database or n8n's own memory node),
// this is what lets it tell one visitor's messages apart from another's.
let sessionId = localStorage.getItem("lunawear-session");

if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("lunawear-session", sessionId);
}
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = chatInput.value.trim();
  if (!message) return;

  formError.hidden = true;

  // Show the visitor's own message immediately, then clear the input
  addBubble(message, "user");
  chatInput.value = "";
  autoResizeInput();

  // Show a typing indicator while we wait for n8n to respond
  const typingBubble = addTypingIndicator();
  setSending(true);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, message }),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }

    const data = await response.json();
    const reply = extractReply(data);

    typingBubble.remove();

    if (reply) {
      addBubble(reply, "ai");
    } else {
      // The request succeeded, but the workflow didn't return recognizable
      // reply text — most likely the "Respond to Webhook" node's output
      // field doesn't match what extractReply() below is looking for.
      addBubble(
        "I received that, but didn't get a proper reply from the workflow. Check the n8n \"Respond to Webhook\" node's output format.",
        "error"
      );
    }
  } catch (error) {
    // Network failure, CORS issue, or non-2xx response all land here
    console.error("LunaWear AI chat request failed:", error);
    typingBubble.remove();
    formError.hidden = false;
  } finally {
    setSending(false);
  }
});

// Let Enter send the message, but Shift+Enter add a new line
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

// Grow the textarea as the visitor types, up to the CSS max-height
chatInput.addEventListener("input", autoResizeInput);

/**
 * Pulls the reply text out of whatever shape n8n sends back. Different
 * n8n setups return the AI's answer under different key names, so this
 * checks the common ones rather than assuming just one.
 * @param {any} data - Parsed JSON body from the webhook response
 * @returns {string|null}
 */
function extractReply(data) {
  // Some "Respond to Webhook" configs return an array of items instead
  // of a single object — unwrap the first item if so.
  if (Array.isArray(data)) {
    data = data[0];
  }

  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    return (
      data.reply ||
      data.output ||
      data.text ||
      data.message ||
      data.response ||
      null
    );
  }

  return null;
}

/**
 * Appends a chat bubble to the thread and scrolls it into view.
 * @param {string} text
 * @param {"user"|"ai"|"error"} sender
 */
function addBubble(text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble-${sender}`;
  bubble.textContent = text;
  chatThread.appendChild(bubble);
  scrollThreadToBottom();
  return bubble;
}

/** Appends the animated three-dot "typing" bubble and returns it so it can be removed later. */
function addTypingIndicator() {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble-typing";
  bubble.innerHTML = "<span></span><span></span><span></span>";
  chatThread.appendChild(bubble);
  scrollThreadToBottom();
  return bubble;
}

function scrollThreadToBottom() {
  chatThread.scrollTop = chatThread.scrollHeight;
}

/** Disables the input and button while a request is in flight. */
function setSending(isSending) {
  chatInput.disabled = isSending;
  chatSendBtn.disabled = isSending;
}

/** Keeps the message textarea's height in sync with its content. */
function autoResizeInput() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${chatInput.scrollHeight}px`;
}