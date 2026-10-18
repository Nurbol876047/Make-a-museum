// ============================================================
// js/character.js
// ------------------------------------------------------------
// Логика модуля персонажа (character.html?id=ID) — самая сложная
// страница сайта:
//  1) портрет + анимация "прожектора";
//  2) рассказ гида: реальное аудио → Web Speech API (kk-KZ) →
//     просто субтитры по таймеру (три уровня отказоустойчивости);
//  3) "Кейіпкердің сөзі", "Кілт сөздер", "Үзінді" с глоссарием;
//  4) блок видео-интервью (заглушка, если видео нет);
//  5) блок "Оқу сауаттылығы" (3 тапсырма) + штамп в паспорт.
// ============================================================

let character = null;      // текущий персонаж (объект из CHARACTERS)
let sentences = [];         // текст рассказа, разбитый на предложения
let schedule = [];          // [{text, duration}] — расчётная длительность показа каждого предложения

// Состояние проигрывания рассказа гида
let narrationAudio = null;  // объект Audio(), если у персонажа указан файл
let audioBroken = false;    // true, если файл аудио не найден/не воспроизводится
let kkVoice = null;         // голос kk-KZ из Web Speech API, если браузер его поддерживает
let mode = null;            // 'audio' | 'speech' | 'timer' — выбранный способ озвучки
let isPlaying = false;
let isMuted = false;
let sentenceIndex = 0;

// Внутренние переменные таймерного режима (самый надёжный fallback)
let timerHandle = null;
let timerRemaining = 0;
let timerStartTs = 0;

/* ============================================================
   1. ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
   ============================================================ */

function getCharacterIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function initCharacterPage() {
  const id = getCharacterIdFromUrl();
  character = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

  document.title = `${character.name} — Әдеби цифрлық мұражай`;
  document.getElementById("pageTitle").textContent = `${character.name} — Әдеби цифрлық мұражай`;
  document.getElementById("backToHallLink").setAttribute("href", `hall.html?hall=${character.hall}`);

  // Портрет в большой рамке + бейдж "Басты экспонат", если это персонаж из подборки учителя
  document.getElementById("bigPortraitInner").innerHTML = getPortraitInnerHTML(character);
  document.getElementById("bigPortraitFrame").insertAdjacentHTML("afterbegin", getFeaturedBadgeHTML(character));

  // Заголовок, произведение, автор
  document.getElementById("characterName").textContent = character.name;
  document.getElementById("characterWork").textContent = character.work;
  document.getElementById("characterAuthor").textContent = character.author;

  // "Кейіпкердің сөзі"
  document.getElementById("keyPhrase").textContent = character.keyPhrase;

  // "Кілт сөздер"
  document.getElementById("keywordsRow").innerHTML = character.keywords
    .map((kw) => `<span class="keyword-tag">#${kw}</span>`)
    .join("");

  // "Үзінді" + подчёркнутые слова из глоссария
  document.getElementById("excerptText").innerHTML = highlightGlossary(character.excerpt, character.glossary);
  attachGlossaryTapHandlers();

  // Блок "Ұқсас кейіпкерлер"
  renderRelatedSection();

  // Блок "Оқу сауаттылығы"
  renderLiteracyTasks();

  // Подготовка и запуск рассказа гида
  prepareNarration();
  attachAudioControlHandlers();
  attemptAutoStart();
}

/* ============================================================
   2. ТЕКСТ ГИДА: ПРЕДЛОЖЕНИЯ, СУБТИТРЫ, РАСПИСАНИЕ
   ============================================================ */

function splitSentences(text) {
  const found = text.match(/[^.!?]+[.!?]+/g);
  return found ? found.map((s) => s.trim()) : [text.trim()];
}

function buildSchedule(sentenceList) {
  return sentenceList.map((s) => {
    const wordCount = s.split(/\s+/).filter(Boolean).length;
    const duration = Math.max(1800, wordCount * 380); // мс — примерный темп чтения
    return { text: s, duration };
  });
}

function renderSubtitles() {
  const box = document.getElementById("subtitlesBox");
  box.innerHTML = sentences
    .map((s, i) => `<span class="subtitle-sentence" data-index="${i}">${escapeHtml(s)}</span>`)
    .join(" ");
}

function highlightSentence(i) {
  sentenceIndex = i;
  document.querySelectorAll("#subtitlesBox .subtitle-sentence").forEach((el) => {
    el.classList.toggle("current", Number(el.dataset.index) === i);
  });
}

/* ============================================================
   3. ВЫБОР СПОСОБА ОЗВУЧКИ И УПРАВЛЕНИЕ ВОСПРОИЗВЕДЕНИЕМ
   ============================================================ */

function prepareNarration() {
  sentences = splitSentences(character.narration);
  schedule = buildSchedule(sentences);
  renderSubtitles();

  // Пытаемся подготовить реальный аудиофайл гида
  if (character.audio) {
    narrationAudio = new Audio(character.audio);
    narrationAudio.addEventListener("error", () => {
      audioBroken = true;
    });
    narrationAudio.addEventListener("timeupdate", onAudioTimeUpdate);
    narrationAudio.addEventListener("ended", finishPlayback);
  } else {
    audioBroken = true;
  }

  // Ищем казахский голос для Web Speech API (на случай, если аудиофайла нет)
  findKkVoice();
}

function findKkVoice() {
  if (!("speechSynthesis" in window)) return;
  const pick = () => {
    const voices = window.speechSynthesis.getVoices();
    kkVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("kk")) || null;
  };
  pick();
  window.speechSynthesis.addEventListener("voiceschanged", pick);
}

// Пропорции предложений по длине текста — используются, чтобы синхронизировать
// субтитры с реальной длительностью аудиофайла (если он воспроизводится).
function getCumulativeFractions() {
  const lengths = sentences.map((s) => s.length);
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return lengths.map((len) => {
    acc += len;
    return acc / total;
  });
}

function onAudioTimeUpdate() {
  if (!narrationAudio.duration) return;
  const frac = narrationAudio.currentTime / narrationAudio.duration;
  const cum = getCumulativeFractions();
  let i = cum.findIndex((f) => frac <= f);
  if (i === -1) i = sentences.length - 1;
  if (i !== sentenceIndex) highlightSentence(i);
}

function play() {
  if (mode === null) {
    // kkVoice болмаса да "speech" режимін қолданып көреміз — браузер
    // kk-KZ дауысы жоқ болса, өзінің әдепкі дауысымен оқиды (акцентпен
    // болса да дыбыс шығады). Нағыз сәтсіздік болса, speakFrom() ішіндегі
    // watchdog/onerror бізді өзі "timer" режиміне ауыстырады.
    mode = character.audio && !audioBroken ? "audio" : "speechSynthesis" in window ? "speech" : "timer";
  }

  if (mode === "audio") {
    narrationAudio
      .play()
      .then(() => {
        isPlaying = true;
        updatePlayIcon();
      })
      .catch(() => {
        audioBroken = true;
        mode = null;
        play(); // переключаемся на следующий доступный способ
      });
  } else if (mode === "speech") {
    isPlaying = true;
    updatePlayIcon();
    speakFrom(sentenceIndex);
  } else {
    isPlaying = true;
    updatePlayIcon();
    if (timerHandle === null && sentenceIndex === 0 && timerRemaining === 0) {
      startTimerSentence(0);
    } else {
      resumeTimer();
    }
  }
}

function pause() {
  if (mode === "audio") {
    narrationAudio.pause();
  } else if (mode === "speech") {
    window.speechSynthesis.pause();
  } else if (mode === "timer") {
    pauseTimer();
  }
  isPlaying = false;
  updatePlayIcon();
}

function restart() {
  sentenceIndex = 0;
  timerRemaining = 0;
  clearTimeout(timerHandle);
  timerHandle = null;

  if (mode === "audio" && narrationAudio) {
    narrationAudio.currentTime = 0;
  } else if (mode === "speech") {
    window.speechSynthesis.cancel();
  }
  highlightSentence(0);
  play();
}

function toggleMute() {
  isMuted = !isMuted;
  const muteBtn = document.getElementById("muteBtn");
  muteBtn.textContent = isMuted ? "🔇" : "🔊";

  if (mode === "audio" && narrationAudio) {
    narrationAudio.muted = isMuted;
  } else if (mode === "speech") {
    // Перезапускаем текущее предложение с новой громкостью
    window.speechSynthesis.cancel();
    if (isPlaying) speakFrom(sentenceIndex);
  } else if (mode === "timer") {
    showToast("Бұл кейіпкерде дауыс файлы жоқ — тек субтитр көрсетіледі");
  }
}

function finishPlayback() {
  isPlaying = false;
  updatePlayIcon();
}

function updatePlayIcon() {
  document.getElementById("playPauseBtn").textContent = isPlaying ? "⏸" : "▶";
}

/* ---------- Таймерный режим (надёжный fallback без звука) ---------- */

function startTimerSentence(i) {
  if (i >= schedule.length) {
    finishPlayback();
    return;
  }
  highlightSentence(i);
  timerRemaining = schedule[i].duration;
  timerStartTs = Date.now();
  timerHandle = setTimeout(() => startTimerSentence(i + 1), timerRemaining);
}

function pauseTimer() {
  clearTimeout(timerHandle);
  timerHandle = null;
  timerRemaining = Math.max(0, timerRemaining - (Date.now() - timerStartTs));
}

function resumeTimer() {
  timerStartTs = Date.now();
  timerHandle = setTimeout(() => startTimerSentence(sentenceIndex + 1), timerRemaining);
}

/* ---------- Режим Web Speech API ---------- */

function speakFrom(i) {
  window.speechSynthesis.cancel();
  if (i >= sentences.length) {
    finishPlayback();
    return;
  }
  const utter = new SpeechSynthesisUtterance(sentences[i]);
  utter.lang = "kk-KZ";
  if (kkVoice) utter.voice = kkVoice;
  utter.volume = isMuted ? 0 : 1;

  // Кейбір құрылғыларда/браузерлерде speechSynthesis бар болып көрінгенімен,
  // дауыс қозғалтқышы нақты қосылмайды — сонда speak() үнсіз ешнәрсе
  // істемейді (onstart та, onerror да шақырылмайды). Бұл "күзетшi" таймер
  // шамамен 1.5 секундта дыбыс басталмаса, сенімді таймер режиміне ауысады.
  let started = false;
  const watchdog = setTimeout(() => {
    if (!started) fallbackToTimerMode(i);
  }, 1500);

  utter.onstart = () => {
    started = true;
    clearTimeout(watchdog);
    highlightSentence(i);
  };
  utter.onend = () => {
    clearTimeout(watchdog);
    if (isPlaying) speakFrom(i + 1);
  };
  utter.onerror = () => {
    clearTimeout(watchdog);
    fallbackToTimerMode(i);
  };
  window.speechSynthesis.speak(utter);
}

// Дауыстап оқу сәтсіз аяқталғанда (қате немесе дыбыс мүлде басталмағанда)
// пайдаланушыға хабарлап, сенімді таймерлік субтитр режиміне ауысамыз.
function fallbackToTimerMode(fromIndex) {
  if (mode === "timer") return;
  mode = "timer";
  window.speechSynthesis.cancel();
  showToast("Құрылғыда дауыстап оқу қолжетімсіз — тек субтитр көрсетіледі");
  if (isPlaying) startTimerSentence(fromIndex);
}

/* ---------- Автозапуск при открытии модуля ---------- */

function attemptAutoStart() {
  // Модуль открывается кликом по портрету в зале — это пользовательский жест,
  // поэтому браузер, как правило, разрешает автозапуск звука.
  play();
}

/* ---------- Обработчики кнопок управления ---------- */

function attachAudioControlHandlers() {
  document.getElementById("playPauseBtn").addEventListener("click", () => {
    isPlaying ? pause() : play();
  });
  document.getElementById("restartBtn").addEventListener("click", restart);
  document.getElementById("muteBtn").addEventListener("click", toggleMute);
}

/* ============================================================
   4. ГЛОССАРИЙ В ТЕКСТЕ ҮЗІНДІ
   ============================================================ */

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

// Находит слова из глоссария внутри текста (с учётом кириллицы) и оборачивает
// их в <span class="glossary-word"> с всплывающей подсказкой-значением.
function highlightGlossary(text, glossary) {
  if (!glossary || !glossary.length) return escapeHtml(text);

  const glossaryMap = {};
  glossary.forEach((g) => (glossaryMap[g.word.toLowerCase()] = g.meaning));

  // Разбиваем текст на "слова" (буквы, включая кириллицу) и "всё остальное"
  const tokens = text.split(/([^\p{L}\p{M}'-]+)/u);

  return tokens
    .map((token) => {
      if (!token) return "";
      const key = token.toLowerCase();
      if (glossaryMap[key]) {
        return `<span class="glossary-word" tabindex="0">${escapeHtml(token)}<span class="tooltip">${escapeHtml(
          glossaryMap[key]
        )}</span></span>`;
      }
      return escapeHtml(token);
    })
    .join("");
}

// На телефонах hover не работает — по тапу переключаем класс show-tooltip
function attachGlossaryTapHandlers() {
  document.querySelectorAll(".glossary-word").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasShown = el.classList.contains("show-tooltip");
      document.querySelectorAll(".glossary-word.show-tooltip").forEach((o) => o.classList.remove("show-tooltip"));
      if (!wasShown) el.classList.add("show-tooltip");
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".glossary-word.show-tooltip").forEach((o) => o.classList.remove("show-tooltip"));
  });
}

/* ============================================================
   5. БЛОК "ҰҚСАС КЕЙІПКЕРЛЕР"
   ============================================================ */

function renderRelatedSection() {
  const section = document.getElementById("relatedSection");
  const grid = document.getElementById("relatedGrid");

  if (!character.related || !character.related.length) {
    section.classList.add("hidden");
    return;
  }

  grid.innerHTML = character.related
    .map((rel) => {
      const relChar = CHARACTERS.find((c) => c.id === rel.id);
      if (!relChar) return "";
      return `
        <a class="related-card" href="character.html?id=${relChar.id}" data-corridor>
          <div class="related-portrait">${getPortraitInnerHTML(relChar)}</div>
          <div class="related-info">
            <h4>${relChar.name}</h4>
            <p>${escapeHtml(rel.reason)}</p>
          </div>
        </a>
      `;
    })
    .join("");
}

/* ============================================================
   6. БЛОК "ОҚУ САУАТТЫЛЫҒЫ" (3 ТАПСЫРМА) + ШТАМП
   ============================================================ */

const LEVEL_LABELS = {
  tabu: "1-деңгей — Табу",
  tusinu: "2-деңгей — Түсіну",
  bagalau: "3-деңгей — Бағалау",
};

// answeredState[index] = true, если ученик дал ответ на тапсырма №index.
// Длина массива зависит от количества заданий персонажа (3 обычно, 5 — у "Басты экспонат").
let answeredState = [];

function renderLiteracyTasks() {
  answeredState = character.questions.map(() => false);
  const container = document.getElementById("taskCardsContainer");

  // Если персонаж уже пройден ранее — показываем короткую подсказку
  const prevAnswer = getPassport()[character.id];
  if (prevAnswer) {
    const note = document.createElement("div");
    note.className = "task-feedback correct";
    note.style.textAlign = "center";
    note.style.marginBottom = "16px";
    note.textContent = "✅ Сіз бұл кейіпкерді бұрын аяқтаған болып көрінесіз. Паспортта штамп бар.";
    container.appendChild(note);
  }

  character.questions.forEach((q, index) => {
    const card = document.createElement("div");
    card.className = "task-card";

    if (q.type === "test") {
      card.innerHTML = `
        <span class="task-level-badge">${LEVEL_LABELS[q.level] || q.level}</span>
        <h4>${escapeHtml(q.question)}</h4>
        <div class="task-options">
          ${q.options
            .map(
              (opt, optIndex) => `
            <label class="task-option" data-task="${index}" data-option="${optIndex}">
              <input type="radio" name="task-${index}" value="${optIndex}" />
              <span>${escapeHtml(opt)}</span>
            </label>
          `
            )
            .join("")}
        </div>
        <div class="task-feedback" id="feedback-${index}"></div>
      `;
    } else {
      card.innerHTML = `
        <span class="task-level-badge">${LEVEL_LABELS[q.level] || q.level}</span>
        <h4>${escapeHtml(q.question)}</h4>
        <textarea class="open-answer-textarea" id="openAnswer-${index}" placeholder="Өз ойыңды осында жаз...">${
        prevAnswer ? escapeHtml(prevAnswer.openAnswer || "") : ""
      }</textarea>
        <div class="char-counter" id="counter-${index}">0 таңба</div>
      `;
    }

    container.appendChild(card);
  });

  attachTaskHandlers();

  // Если ответ уже был введён заранее (персонаж пройден), учитываем его длину сразу
  if (prevAnswer) {
    character.questions.forEach((q, index) => {
      if (q.type === "open") {
        const textarea = document.getElementById(`openAnswer-${index}`);
        updateCounterAndState(index, textarea.value);
      }
    });
  }
}

function attachTaskHandlers() {
  character.questions.forEach((q, index) => {
    if (q.type === "test") {
      document.querySelectorAll(`.task-option[data-task="${index}"]`).forEach((label) => {
        label.addEventListener("click", () => {
          const optIndex = Number(label.dataset.option);
          selectTestOption(index, optIndex, q.correct);
        });
      });
    } else {
      const textarea = document.getElementById(`openAnswer-${index}`);
      textarea.addEventListener("input", () => updateCounterAndState(index, textarea.value));
    }
  });
}

function selectTestOption(taskIndex, optIndex, correctIndex) {
  document.querySelectorAll(`.task-option[data-task="${taskIndex}"]`).forEach((label) => {
    label.classList.remove("selected", "correct", "incorrect");
  });
  const chosen = document.querySelector(`.task-option[data-task="${taskIndex}"][data-option="${optIndex}"]`);
  chosen.classList.add("selected", optIndex === correctIndex ? "correct" : "incorrect");

  const feedback = document.getElementById(`feedback-${taskIndex}`);
  if (optIndex === correctIndex) {
    feedback.textContent = "✓ Дұрыс! Жарайсың.";
    feedback.className = "task-feedback correct";
  } else {
    feedback.textContent = "✗ Қайта ойлан — дұрыс жауап басқа.";
    feedback.className = "task-feedback incorrect";
  }

  answeredState[taskIndex] = true;
  updateFinishButton();
}

function updateCounterAndState(taskIndex, value) {
  document.getElementById(`counter-${taskIndex}`).textContent = `${value.length} таңба`;
  answeredState[taskIndex] = value.trim().length >= 10;
  updateFinishButton();
}

function updateFinishButton() {
  const finishBtn = document.getElementById("finishBtn");
  finishBtn.disabled = !answeredState.every(Boolean);
}

/* ---------- Завершение и штамп в паспорт ---------- */

function initFinishHandler() {
  document.getElementById("finishBtn").addEventListener("click", () => {
    const openIndex = character.questions.findIndex((q) => q.type === "open");
    const openAnswer = openIndex !== -1 ? document.getElementById(`openAnswer-${openIndex}`).value : "";

    markCharacterCompleted(character.id, openAnswer);
    document.getElementById("stampOverlay").classList.add("active");
  });

  document.getElementById("closeStampBtn").addEventListener("click", () => {
    document.getElementById("stampOverlay").classList.remove("active");
  });
}

/* ============================================================
   СТАРТ
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initCharacterPage();
  initFinishHandler();
  initCorridorTransitions();
});
