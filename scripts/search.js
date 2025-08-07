import { searchMulti } from "./seriesAPI.js";

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const resultsContainer = document.getElementById("search-results");

  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const query = searchInput.value.trim();
    if (!query) return;

    resultsContainer.innerHTML = "<p>Searching...</p>";

    const data = await searchMulti(query);

    if (!data || !data.results || data.results.length === 0) {
      resultsContainer.innerHTML = "<p>No results found.</p>";
      return;
    }

    resultsContainer.innerHTML = ""; // limpar resultados anteriores

    data.results.forEach(item => {
      const card = document.createElement("div");
      card.classList.add("result-card");

      const img = document.createElement("img");
      img.src = item.poster_path
        ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
        : "images/no-image.png";
      img.alt = item.title || item.name || "Untitled";

      const title = document.createElement("h3");
      title.textContent = item.title || item.name;

      const type = document.createElement("span");
      type.classList.add("media-type");
      type.textContent = item.media_type === "movie"
        ? "🎬 Movie"
        : item.media_type === "tv"
        ? "📺 TV / Anime"
        : "❓ Unknown";

      const overview = document.createElement("p");
      overview.textContent = item.overview
        ? item.overview
        : "No description available.";

      card.appendChild(img);
      card.appendChild(title);
      card.appendChild(type);
      card.appendChild(overview);
      resultsContainer.appendChild(card);
    });
  });
});
