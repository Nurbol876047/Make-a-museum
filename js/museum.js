// ============================================================
// js/museum.js
// ------------------------------------------------------------
// Логика страницы "Музей картасы" (museum.html).
// Строит карточки залов на основе массива HALLS из data/characters.js
// и считает, сколько персонажей в каждом зале.
// ============================================================

function renderHallsGrid() {
  const grid = document.getElementById("hallsGrid");
  if (!grid) return;

  grid.innerHTML = HALLS.map((hall) => {
    const count = CHARACTERS.filter((c) => c.hall === hall.id).length;
    return `
      <article class="hall-card">
        <span class="hall-icon">${getHallIconSvg(hall.id)}</span>
        <h3>${hall.title}</h3>
        <p>${hall.description}</p>
        <span class="hall-count">${count} кейіпкер</span>
        <a class="hall-link" href="hall.html?hall=${hall.id}" data-corridor aria-label="${hall.title} залына өту"></a>
      </article>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderHallsGrid();
  // Коридор-переход навешивается на ссылки, добавленные динамически —
  // поэтому повторно инициализируем переход после рендера карточек.
  initCorridorTransitions();
});
