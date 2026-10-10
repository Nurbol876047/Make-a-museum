// ============================================================
// js/common.js
// ------------------------------------------------------------
// Общие функции, подключаемые на КАЖДОЙ странице сайта:
//  - подсветка активного пункта меню
//  - работа с "паспортом музея" в localStorage
//  - включение/выключение фонового эмбиента музея
// ============================================================

// Ключ в localStorage, под которым храним прогресс паспорта.
// Значение — объект { [characterId]: { completedAt, openAnswer } }
const PASSPORT_STORAGE_KEY = "soileitinMuzei_passport";

/* -------------------- Работа с паспортом музея -------------------- */

// Считать весь паспорт из localStorage
function getPassport() {
  try {
    const raw = localStorage.getItem(PASSPORT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Паспортты оқу кезінде қате:", e);
    return {};
  }
}

// Сохранить весь паспорт в localStorage
function savePassport(passport) {
  try {
    localStorage.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(passport));
  } catch (e) {
    console.warn("Паспортты сақтау кезінде қате:", e);
  }
}

// Отметить персонажа как "пройденного" + сохранить открытый ответ ученика
function markCharacterCompleted(characterId, openAnswer) {
  const passport = getPassport();
  passport[characterId] = {
    completedAt: new Date().toISOString(),
    openAnswer: openAnswer || "",
  };
  savePassport(passport);
}

// Проверить, пройден ли персонаж
function isCharacterCompleted(characterId) {
  const passport = getPassport();
  return !!passport[characterId];
}

/* -------------------- Подсветка активного пункта меню -------------------- */

function highlightActiveNav() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const linkPage = link.getAttribute("href").split("/").pop();
    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });
}

/* -------------------- Фоновый эмбиент музея -------------------- */
// Тихий фоновый звук музея (отдельный от голоса гида).
// Если файл assets/audio/ambient.mp3 отсутствует — кнопка
// просто покажет короткую подсказку и не будет мешать работе сайта.

const AMBIENT_STORAGE_KEY = "soileitinMuzei_ambientOn";
let ambientAudioEl = null;

function initAmbientToggle() {
  const btn = document.querySelector(".ambient-toggle");
  if (!btn) return;

  ambientAudioEl = new Audio("assets/audio/ambient.mp3");
  ambientAudioEl.loop = true;
  ambientAudioEl.volume = 0.35;

  const wasOn = localStorage.getItem(AMBIENT_STORAGE_KEY) === "true";
  btn.setAttribute("data-on", wasOn ? "true" : "false");
  updateAmbientLabel(btn, wasOn);

  // Автозапуск без клика пользователя браузеры блокируют —
  // поэтому реально запускаем звук только по нажатию кнопки.
  btn.addEventListener("click", () => {
    const isOn = btn.getAttribute("data-on") === "true";
    if (isOn) {
      ambientAudioEl.pause();
      btn.setAttribute("data-on", "false");
      localStorage.setItem(AMBIENT_STORAGE_KEY, "false");
      updateAmbientLabel(btn, false);
    } else {
      ambientAudioEl.play().catch(() => {
        showToast("Фон дыбысы файлы әлі қосылмаған (assets/audio/ambient.mp3)");
      });
      btn.setAttribute("data-on", "true");
      localStorage.setItem(AMBIENT_STORAGE_KEY, "true");
      updateAmbientLabel(btn, true);
    }
  });
}

function updateAmbientLabel(btn, isOn) {
  btn.innerHTML = isOn ? "🔊 Музей үні" : "🔈 Музей үні";
}

/* -------------------- Небольшая подсказка (toast) -------------------- */
function showToast(message) {
  let toast = document.querySelector(".global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "global-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#0c0b0d";
    toast.style.border = "1px solid #c9a24a";
    toast.style.color = "#f1ece0";
    toast.style.padding = "10px 18px";
    toast.style.borderRadius = "999px";
    toast.style.fontSize = "13px";
    toast.style.zIndex = "500";
    toast.style.transition = "opacity 0.3s ease";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}

/* -------------------- Портрет персонажа (с заглушкой-силуэтом) -------------------- */
// Возвращает HTML для внутренней части рамки: либо <img>, либо силуэт-заглушка,
// если файл портрета ещё не добавлен (assets/portraits/*.jpg) или не загрузился.
function getPortraitInnerHTML(character) {
  const silhouetteSvg = `
    <svg class="silhouette" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <circle cx="50" cy="38" r="26" />
      <path d="M8 118c2-34 26-50 42-50s40 16 42 50z" />
    </svg>`;

  if (!character.portrait) {
    return `<div class="portrait-placeholder">${silhouetteSvg}<span class="placeholder-name">${character.name}</span></div>`;
  }

  // onerror подменяет содержимое рамки на силуэт-заглушку, если файла нет на диске
  return `
    <img src="${character.portrait}" alt="${character.name}"
         onerror="this.parentElement.innerHTML = getPlaceholderHTML('${character.name.replace(/'/g, "\\'")}');" />`;
}

function getPlaceholderHTML(name) {
  return `
    <div class="portrait-placeholder">
      <svg class="silhouette" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <circle cx="50" cy="38" r="26" />
        <path d="M8 118c2-34 26-50 42-50s40 16 42 50z" />
      </svg>
      <span class="placeholder-name">${name}</span>
    </div>`;
}

// Золотой бейдж "Басты экспонат" — показывается на портретах персонажей
// из учительской подборки (character.featured === true).
function getFeaturedBadgeHTML(character) {
  return character.featured ? `<span class="featured-badge">★ Басты экспонат</span>` : "";
}

/* -------------------- SVG-иконки залов музея -------------------- */
// Единый стиль: линейные иконки (viewBox 0 0 24 24, тонкий контур,
// цвет золота наследуется через currentColor + CSS-класс hall-icon-svg).
// Подбираются по id зала (см. HALLS в data/characters.js).
const HALL_ICONS = {
  // Балалық шақ әлемі — бала аты (ойыншық тұлпар)
  balalyk: `
    <path d="M4 19c3 3 13 3 16 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M9 19V13c0-3 2-5 4-5 1 0 1.6 0.8 0.9 1.5-0.6 0.6-1.5 0.7-2.3 0.6l2.6 1c1 0.5 1.1 1.8 0.2 2.5l-1.8 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="13.2" cy="9.4" r="0.6" fill="currentColor" stroke="none"/>
  `,
  // Батырлар жыры — қылыш пен қалқан (скрещённые мечи)
  batyrlar: `
    <line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="3" y1="21" x2="5" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="7.2" y1="14.2" x2="9.8" y2="16.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="3" y1="3" x2="5" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="7.2" y1="9.8" x2="9.8" y2="7.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  // Ғашықтық жыры — жүрек
  gashyktyk: `
    <path d="M12 20.5s-7.5-4.6-10-9.3C0.5 7.8 2 4 6 4c2.4 0 4.2 1.4 6 3.5C13.8 5.4 15.6 4 18 4c4 0 5.5 3.8 4 7.2-2.5 4.7-10 9.3-10 9.3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `,
  // Классика — ашық кітап
  klassika: `
    <path d="M12 6.5c-1.8-1.6-4.6-2-8-1.5v13c3.4-0.5 6.2-0.1 8 1.5 1.8-1.6 4.6-2 8-1.5v-13c-3.4-0.5-6.2-0.1-8 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <line x1="12" y1="6.5" x2="12" y2="19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  // Халық даналығы — домбыра/қобыз
  danalyk: `
    <ellipse cx="9" cy="17" rx="5" ry="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <line x1="12.5" y1="14" x2="19" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="19" y1="3" x2="21" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="19" y1="3" x2="20" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="7.8" y1="13.7" x2="17.5" y2="5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    <line x1="9.8" y1="14.7" x2="18.7" y2="6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
  `,
  // Әлем әдебиеті — глобус
  alem: `
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <path d="M4.5 7.5c2 1 4.8 1.5 7.5 1.5s5.5-0.5 7.5-1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M4.5 16.5c2-1 4.8-1.5 7.5-1.5s5.5 0.5 7.5 1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
  `,
};

// Возвращает готовую <svg> разметку для иконки зала по его id.
// Если зала с таким id нет в HALL_ICONS — показываем нейтральный ромб-заглушку.
function getHallIconSvg(hallId) {
  const inner =
    HALL_ICONS[hallId] ||
    `<rect x="6" y="6" width="12" height="12" stroke="currentColor" stroke-width="1.5" fill="none" transform="rotate(45 12 12)"/>`;
  return `<svg class="hall-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/* -------------------- Переход между страницами "по коридору" -------------------- */
// Создаёт плавное затемнение перед переходом по ссылке.
function initCorridorTransitions() {
  let fadeEl = document.querySelector(".corridor-fade");
  if (!fadeEl) {
    fadeEl = document.createElement("div");
    fadeEl.className = "corridor-fade";
    document.body.appendChild(fadeEl);
  }

  document.querySelectorAll("a[data-corridor]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      e.preventDefault();
      fadeEl.classList.add("active");
      setTimeout(() => {
        window.location.href = href;
      }, 420);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNav();
  initAmbientToggle();
  initCorridorTransitions();
});
