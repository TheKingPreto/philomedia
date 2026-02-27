/**
 * @file curatedmatches.js
 * @description Maps TMDB media IDs to custom quote IDs for the best curated
 * philosophical match. This is the highest-priority lookup — it overrides
 * the automated theme analysis.
 *
 * To find the correct TMDB id for any title: open the details page, check
 * the URL bar for the `?id=` param, and use that value as the key here.
 *
 * Format: { 'tmdbId': quoteId }
 */
export const curatedQuoteMatches = {
  // ─── Movies ─────────────────────────────────────────────────────────────────
  '278':    1047,  // The Shawshank Redemption
  '238':    1016,  // The Godfather
  '680':    1045,  // Pulp Fiction
  '550':    1025,  // Fight Club
  '13':     1014,  // Forrest Gump
  '49047':  1030,  // Gravity
  '101':    1020,  // Leon: The Professional
  '244786': 1004,  // La La Land
  '311':    1011,  // Once Upon a Time in America
  '157336': 1035,  // Interstellar
  '603':    1029,  // The Matrix
  '120':    1027,  // The Lord of the Rings: The Fellowship
  '76341':  1030,  // Mad Max: Fury Road
  '3170':   1012,  // My Neighbor Totoro
  '181812': 1043,  // Star Wars: The Rise of Skywalker
  '155':    1042,  // The Dark Knight
  '27205':  1007,  // Inception
  '122':    1039,  // The Lord of the Rings: The Return of the King
  '438631': 1022,  // Dune
  '530915': 1030,  // 1917
  '424':    1017,  // Schindler's List
  '857':    1019,  // Saving Private Ryan
  '98':     1047,  // Gladiator
  '129':    1037,  // Spirited Away
  '496243': 1023,  // Parasite
  '324857': 1013,  // Spider-Man: Into the Spider-Verse

  // A Silent Voice — both known TMDB ids mapped to be safe
  // (open details page and check the URL ?id= param to confirm which is active)
  '378064': 1008,  // A Silent Voice: The Movie (most common TMDB id)
  '384018': 1008,  // A Silent Voice: The Movie (alternate TMDB id)

  '10681':  1015,  // WALL-E
  '82694':  1048,  // The Secret Life of Walter Mitty

  // ─── TV Series ───────────────────────────────────────────────────────────────
  '1396':   1026,  // Breaking Bad
  '1399':   1010,  // Game of Thrones
  '1402':   1036,  // The Walking Dead
  '1668':   1040,  // Friends
  '2316':   1002,  // The Office
  '4607':   1041,  // Lost
  '1418':   1005,  // The Big Bang Theory
  '60735':  1044,  // The Flash
  '1429':   1018,  // Game of Thrones (alternate)
  '60625':  1046,  // Rick and Morty
  '19885':  1028,  // Avatar: The Last Airbender
  '63174':  1032,  // Lucifer
  '119051': 1038,  // Arcane
  '71446':  1034,  // Money Heist
  '57243':  1049,  // Doctor Who
  '1104':   1050,  // Suits
  '456':    1009,  // The Simpsons
  '1438':   1051,  // Prison Break
  '70523':  1024,  // Black Mirror
  '1424':   1031,  // House M.D.
  '1408':   1021,  // House of Cards
  '62560':  1003,  // Mr. Robot
  '1407':   1006,  // Lost
  '1991':   1017,  // Sons of Anarchy
  '9322':   1043,  // Sense8
  '43865':  1010,  // Band of Brothers
  '88751':  1047,  // The Witcher

  // ─── Anime ───────────────────────────────────────────────────────────────────
  '128':    1035,  // Fullmetal Alchemist: Brotherhood
  '46260':  1027,  // Attack on Titan
  '46298':  1022,  // Death Note
  '395':    1030,  // Tokyo Ghoul
};