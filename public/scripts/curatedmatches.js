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
 *
 * Tags filosóficos auditáveis por obra: ver curatedPhilosophicalProfiles.js (complementar).
 */
export const curatedQuoteMatches = {
  // ─── Movies ─────────────────────────────────────────────────────────────────
  '278':    1047,  // The Shawshank Redemption
  '238':    1016,  // The Godfather
  '680':    1026,  // Pulp Fiction — violência, círculos morais, “o que não mata…” (Nietzsche)
  '550':    1025,  // Fight Club
  '13':     1014,  // Forrest Gump
  '49047':  1030,  // Gravity
  '101':    1006,  // Leon: The Professional — o “começo” do vínculo com Mathilda define o filme (Platão)
  '244786': 1033,  // La La Land — instantes de plenitude, tempo que passa, arte e escolha
  '311':    1011,  // Once Upon a Time in America
  '157336': 1035,  // Interstellar
  '603':    1029,  // The Matrix
  '120':    1027,  // The Lord of the Rings: The Fellowship
  '76341':  1030,  // Mad Max: Fury Road
  '3170':   1031,  // My Neighbor Totoro — abertura ao mundo, infância, maravilha cotidiana
  '181812': 1034,  // Star Wars: The Rise of Skywalker — destino, herança e “determinações” sobre o sujeito
  '155':    1042,  // The Dark Knight
  '27205':  1007,  // Inception
  '122':    1039,  // The Lord of the Rings: The Return of the King
  '438631': 1019,  // Dune — leão/raposa: estratégia e sobrevivência no jogo imperial
  '530915': 1030,  // 1917
  '424':    1017,  // Schindler's List
  '857':    1030,  // Saving Private Ryan — sentido no sofrimento da guerra (Nietzsche)
  '98':     1047,  // Gladiator
  '129':    1012,  // Spirited Away — autonomia, nome, tornar-se quem se é (autoconhecimento)
  '496243': 1023,  // Parasite
  '324857': 1020,  // Spider-Man: Into the Spider-Verse — máscara, aparência vs. quem se é (Machiavelli)

  // A Silent Voice — both known TMDB ids mapped to be safe
  // (open details page and check the URL ?id= param to confirm which is active)
  '378064': 1008,  // A Silent Voice: The Movie (most common TMDB id)
  '384018': 1008,  // A Silent Voice: The Movie (alternate TMDB id)

  '10681':  1015,  // WALL-E
  '82694':  1048,  // The Secret Life of Walter Mitty

  // ─── TV Series ───────────────────────────────────────────────────────────────
  '1396':   1026,  // Breaking Bad
  '1399':   1010,  // Game of Thrones
  '1402':   1036,  // The Walking Dead — vitalidade diante do colapso (sofrimento/psique)
  '1668':   1032,  // Friends — ética como inteligência compartilhada / convivência
  '2316':   1002,  // The Office
  '4607':   1013,  // Lost — conviver com hipóteses sem fechar o mistério cedo demais (Aristóteles)
  '1418':   1005,  // The Big Bang Theory
  '60735':  1033,  // The Flash — tempo, instantes, o que passa (velocidade / linha do tempo)
  '1429':   1023,  // Game of Thrones (alternate) — luta por poder e classes (Marx)
  '60625':  1046,  // Rick and Morty
  '19885':  1049,  // Avatar: The Last Airbender — espiritualidade, equilíbrio, transcendência imanente
  '63174':  1040,  // Lucifer — ironia intelectual e persona pública (Karnal)
  '119051': 1038,  // Arcane
  '71446':  1034,  // Money Heist
  '57243':  1005,  // Doctor Who — maravilha cósmica como início de sabedoria
  '1104':   1050,  // Suits
  '456':    1009,  // The Simpsons
  '1438':   1044,  // Prison Break — urgência de agir, fugir do adiamento (de Beauvoir)
  '70523':  1025,  // Black Mirror — tecnologia, utilidade inútil, alienação (Marx)
  '1424':   1031,  // House M.D.
  '1408':   1021,  // House of Cards
  '62560':  1003,  // Mr. Robot
  '1407':   1013,  // Lost (id alternativo)
  '1991':   1017,  // Sons of Anarchy
  '9322':   1043,  // Sense8
  '43865':  1027,  // Band of Brothers — propósito e suportar o inimaginável (combatentes)
  '88751':  1018,  // The Witcher — engano e força no tabuleiro moral da política

  // ─── Anime ───────────────────────────────────────────────────────────────────
  '128':    1035,  // Fullmetal Alchemist: Brotherhood
  '46260':  1027,  // Attack on Titan
  '46298':  1017,  // Death Note — os fins justificam os meios no projeto de “justiça” de Light (Machiavelli)
  '395':    1030,  // Tokyo Ghoul
};