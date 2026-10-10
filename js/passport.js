// ============================================================
// js/passport.js
// ------------------------------------------------------------
// Логика страницы "Менің музей паспортым" (passport.html).
// Показывает всех персонажей музея с портретом: пройденные — со
// штампом (датой) и записью открытого ответа; непройденные — без
// штампа, но так же открыты для перехода в модуль персонажа.
// ============================================================

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("kk-KZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderPassportPage() {
  const passport = getPassport();
  const completedIds = Object.keys(passport);

  document.getElementById("progressLabel").textContent = `${completedIds.length} / ${CHARACTERS.length} штамп жиналды`;
  document.getElementById("progressFill").style.width = `${(completedIds.length / CHARACTERS.length) * 100}%`;

  const grid = document.getElementById("passportGrid");

  if (CHARACTERS.length === 0) {
    grid.innerHTML = `<p class="passport-empty-hint">Музейде әлі кейіпкер жоқ.</p>`;
    return;
  }

  grid.innerHTML = CHARACTERS.map((character) => {
    const record = passport[character.id];
    const hall = HALLS.find((h) => h.id === character.hall);

    if (record) {
      return `
        <a class="passport-stamp-card" href="character.html?id=${character.id}" style="text-decoration:none; color:inherit;" data-corridor>
          <div class="stamp-portrait">${getPortraitInnerHTML(character)}</div>
          <h4>${character.name}</h4>
          <div class="stamp-date">🏅 ${formatDate(record.completedAt)}</div>
          ${
            record.openAnswer
              ? `<div class="passport-answer-note">«${escapeHtmlPassport(record.openAnswer)}»</div>`
              : ""
          }
        </a>
      `;
    }

    return `
      <a class="passport-stamp-card" href="character.html?id=${character.id}" style="text-decoration:none; color:inherit;" data-corridor>
        <div class="stamp-portrait">${getPortraitInnerHTML(character)}</div>
        <h4>${character.name}</h4>
        <div class="stamp-date">${hall ? hall.title : ""}</div>
      </a>
    `;
  }).join("");
}

function escapeHtmlPassport(str) {
  return str.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

document.addEventListener("DOMContentLoaded", () => {
  renderPassportPage();
  initCorridorTransitions();
});
