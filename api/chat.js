// ============================================================
// api/chat.js
// ------------------------------------------------------------
// Vercel serverless function. Фронтенд (js/chat.js) осы endpoint-ке
// POST { message, history } жібереді, функция OpenAI-ға сұрау салып,
// { reply } қайтарады.
//
// OPENAI_API_KEY ешқашан клиентке жіберілмейді — тек осы серверлік
// функция ішінде, process.env арқылы оқылады. Vercel жобасының
// Settings → Environment Variables бөлімінде орнатылады.
// ============================================================

const { CHARACTERS, HALLS } = require("../data/characters.js");

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_MESSAGE_LENGTH = 400;
const MAX_HISTORY_TURNS = 6;

function buildCharacterDirectory() {
  const hallTitleById = Object.fromEntries(HALLS.map((h) => [h.id, h.title]));
  return CHARACTERS.map((c) => {
    const topics = (c.keywords || []).join(", ");
    return `- ${c.name} | «${c.work}» (${c.author}) | зал: ${hallTitleById[c.hall] || c.hall} | тақырыптар: ${topics} | сөзі: "${c.keyPhrase}"`;
  }).join("\n");
}

function buildSystemPrompt() {
  return `Сен — «Әдеби цифрлық мұражай» атты қазақ әдеби виртуалды мұражайының сөйлейтін гидісің. Тек осы мұражай, оның залдары және төмендегі кейіпкерлер туралы қазақ тілінде жауап бересің. Жауабың жылы, қысқа әрі нақты болсын (2-5 сөйлем), мектеп оқушысына түсінікті тілмен. Нақты дерек болмаса, ойдан шығарма — мұражай деректеріне сүйен. Сұрақ мұражайға/кейіпкерлерге қатысы жоқ болса, сыпайы түрде мұражай тақырыбына қайтар.

Мұражай залдары: ${HALLS.map((h) => h.title).join(", ")}.

Кейіпкерлер тізімі:
${buildCharacterDirectory()}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Сервер дұрыс бапталмаған: OPENAI_API_KEY орнатылмаған." });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) {
    res.status(400).json({ error: "Сұрақ мәтіні жоқ." });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: "Сұрақ тым ұзын." });
    return;
  }

  const safeHistory = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          ...safeHistory,
          { role: "user", content: message },
        ],
        max_tokens: 400,
        temperature: 0.6,
      }),
    });

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();
      res.status(502).json({ error: "OpenAI сұранысы сәтсіз аяқталды.", detail });
      return;
    }

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    res.status(200).json({ reply: reply || "Кешіріңіз, қазір жауап бере алмадым." });
  } catch (err) {
    res.status(500).json({ error: "Сервер қатесі.", detail: String(err) });
  }
};
