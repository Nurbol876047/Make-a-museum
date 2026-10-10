// ============================================================
// js/hall.js
// ------------------------------------------------------------
// Логика страницы одного зала (hall.html?hall=ID).
// Читает параметр "hall" из URL, находит нужный зал в HALLS
// и выводит стену портретов персонажей этого зала.
// ============================================================

function getHallIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("hall");
}

// Рисует карточку одного портрета (используется и для "Басты экспонаттар",
// и для обычной стены — различие даёт только размер контейнера-грида).
function renderPortraitCard(character) {
  return `
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
  `;
}

function renderHallPage() {
  const hallId = getHallIdFromUrl();
  const hall = HALLS.find((h) => h.id === hallId) || HALLS[0];
  const charactersInHall = CHARACTERS.filter((c) => c.hall === hall.id);

  document.title = `${hall.title} — Сөйлейтін музей`;
  document.getElementById("pageTitle").textContent = `${hall.title} — Сөйлейтін музей`;
  document.getElementById("hallIcon").innerHTML = getHallIconSvg(hall.id);
  document.getElementById("hallTitle").textContent = hall.title;
  document.getElementById("hallDescription").textContent = hall.description;

  // Басты экспонаттар зала тұрады бірінші болып, үлкенірек рамкада.
  const featured = charactersInHall.filter((c) => c.featured);
  const rest = charactersInHall.filter((c) => !c.featured);

  document.getElementById("featuredWall").innerHTML = featured.map(renderPortraitCard).join("");
  document.getElementById("portraitsWall").innerHTML = rest.map(renderPortraitCard).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderHallPage();
  initCorridorTransitions();
});
