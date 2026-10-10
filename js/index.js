// ============================================================
// js/index.js
// ------------------------------------------------------------
// Логика главной страницы (index.html).
// Рисует блок "Басты экспонаттар" — 5 портретов персонажей,
// отмеченных полем featured: true в data/characters.js.
// ============================================================

function renderFeaturedHomeGrid() {
  const grid = document.getElementById("featuredHomeGrid");
  if (!grid) return;

  const featured = CHARACTERS.filter((c) => c.featured);

  grid.innerHTML = featured
    .map(
      (character) => `
    <div>
      <a class="frame" href="character.html?id=${character.id}" data-corridor>
        ${getFeaturedBadgeHTML(character)}
        <div class="spotlight-glow"></div>
        <div class="frame-inner">
          ${getPortraitInnerHTML(character)}
        </div>
      </a>
      <div class="plaque">
        <div class="plaque-name">${character.name}</div>
        <div class="plaque-work">${character.work}</div>
        <div class="plaque-author">${character.author}</div>
      </div>
    </div>
  `
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderFeaturedHomeGrid();
  initCorridorTransitions();
});
