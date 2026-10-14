// ============================================================
// js/chat.js
// ------------------------------------------------------------
// "Музей гиді" чаты (museum.html). Таза мәтіндік чат: сұрақ
// api/chat.js serverless функциясына жіберіледі (ол OpenAI-ды
// шақырады, кілт — тек серверде, браузерге ешқашан жетпейді).
// Батырма/тармақ/карточка жоқ — тек сұрақ-жауап.
// ============================================================

const chatAiHistory = [];

function chatScrollToBottom() {
  const box = document.getElementById("chatMessages");
  if (box) box.scrollTop = box.scrollHeight;
}

function chatAppend(html, who) {
  const box = document.getElementById("chatMessages");
  if (!box) return;
  const row = document.createElement("div");
  row.className = `chat-bubble ${who}`;
  row.innerHTML = html;
  box.appendChild(row);
  chatScrollToBottom();
  return row;
}

function chatAppendBot(html) {
  return chatAppend(
    `<span class="chat-avatar" aria-hidden="true">🏛️</span><div class="chat-bubble-content">${html}</div>`,
    "bot"
  );
}

function chatAppendUser(text) {
  return chatAppend(`<div class="chat-bubble-content">${escapeHtml(text)}</div>`, "user");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// api/chat.js serverless функциясын шақырады. Функция қолжетімсіз/қате
// қайтарса (мыс. OPENAI_API_KEY бапталмаса) — null қайтарады.
async function chatCallAI(message) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: chatAiHistory }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.reply === "string" ? data.reply : null;
  } catch (err) {
    return null;
  }
}

async function chatHandleFreeText(text) {
  chatAppendUser(text);

  const typingRow = chatAppendBot(`<span class="chat-typing">гид ойлануда…</span>`);
  const aiReply = await chatCallAI(text);
  if (typingRow) typingRow.remove();

  if (aiReply) {
    chatAppendBot(escapeHtml(aiReply).replace(/\n/g, "<br>"));
    chatAiHistory.push({ role: "user", content: text }, { role: "assistant", content: aiReply });
    if (chatAiHistory.length > 12) chatAiHistory.splice(0, chatAiHistory.length - 12);
    return;
  }

  chatAppendBot("Кешіріңіз, қазір жауап бере алмадым. Сәлден соң қайта көріңізші.");
}

/* -------------------- Инициализация -------------------- */

function initGuideChat() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  if (!form || !input) return;

  chatAppendBot("Музей туралы немесе кейіпкерлер туралы қалаған сұрағыңызды қойыңыз.");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    chatHandleFreeText(text);
  });
}

document.addEventListener("DOMContentLoaded", initGuideChat);
