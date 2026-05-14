/**
 * @file curatedPhilosophicalProfiles.js
 * @description Tags filosóficos canónicos (chaves do THEME_DATABASE) por TMDB id,
 * para auditoria e para o scoring híbrido (além de gênero TMDB + hermenêutica).
 * quoteId continua centralizado em curatedmatches.js.
 */

/**
 * @typedef {Object} CuratedPhilosophicalProfile
 * @property {'movie'|'tv'} [mediaType]
 * @property {string[]} philosophicalTags
 * @property {string} [primaryTheme]
 * @property {string[]} [excludedLenses] ids de LENS_FILTERS em search.js
 * @property {string} [justification]
 */

/** @type {Record<string, CuratedPhilosophicalProfile>} */
export const curatedPhilosophicalProfiles = {
  '603': {
    mediaType: 'movie',
    philosophicalTags: ['truth-deception', 'consciousness-ai', 'technology-modernity', 'idealism', 'existentialism'],
    primaryTheme: 'truth-deception',
    justification: 'Realidade simulada, epistemologia da experiência e máquina.',
  },
  '550': {
    mediaType: 'movie',
    philosophicalTags: ['conformity-individuality', 'alienation', 'technology-modernity', 'self-knowledge', 'power-corruption'],
    primaryTheme: 'conformity-individuality',
    justification: 'Identidade, consumo e dupla personalidade como crítica social.',
  },
  '157336': {
    mediaType: 'movie',
    philosophicalTags: ['memory-time', 'metaphysics', 'humanism', 'existentialism'],
    primaryTheme: 'memory-time',
    excludedLenses: ['consciousness-ai'],
    justification: 'Tempo, memória afetiva e vínculo — não é narrativa de IA.',
  },
  '27205': {
    mediaType: 'movie',
    philosophicalTags: ['memory-time', 'truth-deception', 'idealism', 'epistemology'],
    primaryTheme: 'memory-time',
    justification: 'Sonhos, memória e critérios de realidade.',
  },
  '38': {
    mediaType: 'movie',
    philosophicalTags: ['memory-time', 'existentialism', 'truth-deception'],
    primaryTheme: 'memory-time',
    justification: 'Apagar memória afetiva e identidade narrativa.',
  },
  '496243': {
    mediaType: 'movie',
    philosophicalTags: ['social-justice', 'marxism-socialism', 'utopia-dystopia', 'power-corruption'],
    primaryTheme: 'social-justice',
    justification: 'Classe, exploração e ordem social; leitura marxiana pertinente.',
  },
  '155': {
    mediaType: 'movie',
    philosophicalTags: ['utopia-dystopia', 'power-corruption', 'virtue', 'truth-deception'],
    primaryTheme: 'utopia-dystopia',
    justification: 'Ordem, caos moral e simulacro de civilidade (Gotham).',
  },
  '424': {
    mediaType: 'movie',
    philosophicalTags: ['virtue', 'social-justice', 'suffering', 'humanism'],
    primaryTheme: 'virtue',
    justification: 'Resgate moral em extremos históricos.',
  },
  '129': {
    mediaType: 'movie',
    philosophicalTags: ['self-knowledge', 'heros-journey', 'humanism', 'existentialism'],
    primaryTheme: 'self-knowledge',
    justification: 'Nome, autonomia e provação como autoconhecimento.',
  },
  '3170': {
    mediaType: 'movie',
    philosophicalTags: ['humanism', 'romanticism', 'the-sublime', 'the-other-alterity'],
    primaryTheme: 'humanism',
    justification: 'Infância, natureza e compaixão — não arco de “conhecer-se” no sentido aristotélico.',
  },
  '324857': {
    mediaType: 'movie',
    philosophicalTags: ['self-knowledge', 'existentialism', 'conformity-individuality'],
    primaryTheme: 'self-knowledge',
    justification: 'Identidade, legado e “quem pode ser o herói”.',
  },
  '70523': {
    mediaType: 'tv',
    philosophicalTags: ['technology-modernity', 'utopia-dystopia', 'alienation', 'power-corruption'],
    primaryTheme: 'technology-modernity',
    justification: 'Tecnologia, distopia e alienação — não panfleto de justiça distributiva marxista.',
  },
  '19885': {
    mediaType: 'tv',
    philosophicalTags: ['sacred-profane', 'humanism', 'virtue', 'metaphysics'],
    primaryTheme: 'sacred-profane',
    justification: 'Equilíbrio espiritual e dever — citação anti-religiosa genérica é inadequada.',
  },
  '4607': {
    mediaType: 'tv',
    philosophicalTags: ['memory-time', 'truth-deception', 'existentialism', 'metaphysics'],
    primaryTheme: 'memory-time',
    justification: 'Mistério, tempo e destino — não filosofia política da linguagem como eixo.',
  },
  '1407': {
    mediaType: 'tv',
    philosophicalTags: ['memory-time', 'truth-deception', 'existentialism', 'metaphysics'],
    primaryTheme: 'memory-time',
    justification: 'Id alternativo de Lost; mesmo núcleo temático.',
  },
  '1396': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'existentialism', 'virtue', 'truth-deception'],
    primaryTheme: 'power-corruption',
    justification: 'Consequências morais do poder e da sobrevivência.',
  },
  '60625': {
    mediaType: 'tv',
    philosophicalTags: ['existentialism', 'nihilism', 'technology-modernity', 'truth-deception'],
    primaryTheme: 'existentialism',
    justification: 'Absurdo, ciência-ficção e escala moral múltipla.',
  },
  '438631': {
    mediaType: 'movie',
    philosophicalTags: ['power-corruption', 'political-philosophy', 'utopia-dystopia', 'metaphysics'],
    primaryTheme: 'power-corruption',
    justification: 'Messianismo, colonialismo e estratégia — Marx da “mudança” é deslocado.',
  },
  '181812': {
    mediaType: 'movie',
    philosophicalTags: ['freedom-choice', 'power-corruption', 'metaphysics', 'truth-deception'],
    primaryTheme: 'freedom-choice',
    excludedLenses: ['self-knowledge'],
    justification: 'Herança e escolha no arco épico — não tornar-se (Beauvoir) como eixo.',
  },
  '60735': {
    mediaType: 'tv',
    philosophicalTags: ['memory-time', 'metaphysics', 'truth-deception'],
    primaryTheme: 'memory-time',
    excludedLenses: ['self-knowledge'],
    justification: 'Linha do tempo e paradoxos temporais, não urgência existencialista genérica.',
  },
  '1402': {
    mediaType: 'tv',
    philosophicalTags: ['suffering', 'stoicism', 'existentialism', 'virtue'],
    primaryTheme: 'suffering',
    justification: 'Sobrevivência e moral em colapso — não “memória” como bucket principal.',
  },
  '46298': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'virtue', 'truth-deception', 'social-justice'],
    primaryTheme: 'power-corruption',
    justification: 'Poder de julgar e meios — leitura maquiaveliana, não slogan de classe.',
  },
  '1668': {
    mediaType: 'tv',
    philosophicalTags: ['humanism', 'social-contract', 'the-other-alterity'],
    primaryTheme: 'humanism',
    justification: 'Convívio e laços — não reflexão sobre intelectuais medíocres.',
  },
  '244786': {
    mediaType: 'movie',
    philosophicalTags: ['aesthetics', 'existentialism', 'romanticism', 'hedonism'],
    primaryTheme: 'aesthetics',
    justification: 'Arte, ambição e sacrifício — não bondade genérica como eixo.',
  },

  '278': {
    mediaType: 'movie',
    philosophicalTags: ['stoicism', 'humanism', 'virtue', 'suffering'],
    primaryTheme: 'stoicism',
    justification: 'Esperança, dignidade e resistência dentro de uma ordem injusta.',
  },
  '238': {
    mediaType: 'movie',
    philosophicalTags: ['power-corruption', 'political-philosophy', 'virtue', 'social-contract'],
    primaryTheme: 'power-corruption',
    justification: 'Lealdade, crime organizado e política da família como soberania.',
  },
  '680': {
    mediaType: 'movie',
    philosophicalTags: ['anti-hero', 'virtue', 'existentialism', 'truth-deception'],
    primaryTheme: 'anti-hero',
    justification: 'Moralidade fragmentada, violência e ironia — não epistemologia lockeana.',
  },
  '13': {
    mediaType: 'movie',
    philosophicalTags: ['humanism', 'existentialism', 'memory-time', 'virtue'],
    primaryTheme: 'humanism',
    justification: 'Destino americano, acaso e bondade ingénua como contraponto ao cinismo.',
  },
  '49047': {
    mediaType: 'movie',
    philosophicalTags: ['existentialism', 'metaphysics', 'suffering', 'aesthetics'],
    primaryTheme: 'existentialism',
    justification: 'Sobrevivência no vazio, limite do corpo e sublime do espaço.',
  },
  '101': {
    mediaType: 'movie',
    philosophicalTags: ['virtue', 'humanism', 'tragedy', 'taboo-transgression'],
    primaryTheme: 'virtue',
    justification: 'Vínculo improvável, proteção e custo moral da violência profissional.',
  },
  '311': {
    mediaType: 'movie',
    philosophicalTags: ['power-corruption', 'memory-time', 'tragedy', 'political-philosophy'],
    primaryTheme: 'power-corruption',
    justification: 'Amizade, crime e memória nacional através de décadas.',
  },
  '120': {
    mediaType: 'movie',
    philosophicalTags: ['heros-journey', 'virtue', 'metaphysics', 'power-corruption'],
    primaryTheme: 'heros-journey',
    justification: 'Dever, corrupção do poder e provação moral na comunidade.',
  },
  '122': {
    mediaType: 'movie',
    philosophicalTags: ['heros-journey', 'virtue', 'war-and-conflict', 'power-corruption'],
    primaryTheme: 'heros-journey',
    justification: 'Coroação do arco: sacrifício, liderança e custo da vitória.',
  },
  '530915': {
    mediaType: 'movie',
    philosophicalTags: ['war-and-conflict', 'memory-time', 'suffering', 'virtue'],
    primaryTheme: 'war-and-conflict',
    justification: 'Plan-sequence como experiência contínua do tempo na guerra.',
  },
  '857': {
    mediaType: 'movie',
    philosophicalTags: ['war-and-conflict', 'suffering', 'virtue', 'humanism'],
    primaryTheme: 'war-and-conflict',
    justification: 'Missão, sacrifício individual e peso moral do grupo.',
  },
  '76341': {
    mediaType: 'movie',
    philosophicalTags: ['war-and-conflict', 'utopia-dystopia', 'suffering', 'power-corruption'],
    primaryTheme: 'utopia-dystopia',
    justification: 'Mundo pós-civilização, recursos, culto e violência como ordem.',
  },
  '98': {
    mediaType: 'movie',
    philosophicalTags: ['stoicism', 'war-and-conflict', 'virtue', 'power-corruption'],
    primaryTheme: 'stoicism',
    justification: 'Honra, vingança e disciplina na arena como espelho político.',
  },
  '378064': {
    mediaType: 'movie',
    philosophicalTags: ['humanism', 'suffering', 'self-knowledge', 'redemption-forgiveness'],
    primaryTheme: 'humanism',
    justification: 'Bullying, perda auditiva e reconstrução ética da convivência.',
  },
  '384018': {
    mediaType: 'movie',
    philosophicalTags: ['humanism', 'suffering', 'self-knowledge', 'redemption-forgiveness'],
    primaryTheme: 'humanism',
    justification: 'Id alternativo de Koe no Katachi; mesmo núcleo temático.',
  },
  '10681': {
    mediaType: 'movie',
    philosophicalTags: ['technology-modernity', 'humanism', 'existentialism', 'aesthetics'],
    primaryTheme: 'technology-modernity',
    justification: 'Sozinho entre ruínas humanas, lixo e ternura como resistência.',
  },
  '82694': {
    mediaType: 'movie',
    philosophicalTags: ['existentialism', 'aesthetics', 'romanticism', 'self-knowledge'],
    primaryTheme: 'existentialism',
    justification: 'Fantasia como fuga e coragem para viver o mundano.',
  },

  '1399': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'political-philosophy', 'war-and-conflict', 'virtue'],
    primaryTheme: 'power-corruption',
    justification: 'Jogo de tronos, legítimo poder e violência institucional.',
  },
  '1418': {
    mediaType: 'tv',
    philosophicalTags: ['epistemology', 'truth-deception', 'existentialism', 'humanism'],
    primaryTheme: 'epistemology',
    justification: 'Ciência, crença e comicidade sobre o que sabemos do mundo.',
  },
  '63174': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'virtue', 'truth-deception', 'anti-hero'],
    primaryTheme: 'anti-hero',
    justification: 'Persona pública, julgamento moral e ironia sobre o bem.',
  },
  '119051': {
    mediaType: 'tv',
    philosophicalTags: ['social-justice', 'power-corruption', 'utopia-dystopia', 'marxism-socialism'],
    primaryTheme: 'social-justice',
    justification: 'Classe, tecnologia hextech e duas cidades — injustiça estrutural.',
  },
  '71446': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'social-justice', 'utilitarianism', 'truth-deception'],
    primaryTheme: 'power-corruption',
    justification: 'Assalto como teatro de resistência e custo moral coletivo.',
  },
  '57243': {
    mediaType: 'tv',
    philosophicalTags: ['metaphysics', 'existentialism', 'humanism', 'truth-deception'],
    primaryTheme: 'metaphysics',
    justification: 'Tempo, alteridade e maravilha moral no cosmos.',
  },
  '1104': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'virtue', 'truth-deception', 'political-philosophy'],
    primaryTheme: 'power-corruption',
    justification: 'Lei, ambição e ética no escritório de elite.',
  },
  '456': {
    mediaType: 'tv',
    philosophicalTags: ['political-philosophy', 'postmodernism', 'social-justice', 'hedonism'],
    primaryTheme: 'political-philosophy',
    justification: 'Sátira civilizacional e instituições americanas como espelho.',
  },
  '1438': {
    mediaType: 'tv',
    philosophicalTags: ['existentialism', 'truth-deception', 'political-philosophy', 'social-justice'],
    primaryTheme: 'existentialism',
    justification: 'Fuga, sistema e urgência de reconfigurar a vida.',
  },
  '1424': {
    mediaType: 'tv',
    philosophicalTags: ['utilitarianism', 'virtue', 'truth-deception', 'epistemology'],
    primaryTheme: 'utilitarianism',
    justification: 'Diagnóstico, cinismo e utilidade clínica vs. empatia.',
  },
  '1408': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'political-philosophy', 'truth-deception', 'utilitarianism'],
    primaryTheme: 'power-corruption',
    justification: 'Machiavelismo de gabinete, imagem pública e fim dos meios.',
  },
  '62560': {
    mediaType: 'tv',
    philosophicalTags: ['alienation', 'technology-modernity', 'truth-deception', 'power-corruption'],
    primaryTheme: 'alienation',
    justification: 'Paranoia digital, classe e revolta contra corporações e Estado.',
  },
  '1991': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'existentialism', 'war-and-conflict', 'virtue'],
    primaryTheme: 'power-corruption',
    justification: 'Clube fora-da-lei, lealdade e violência como economia moral.',
  },
  '9322': {
    mediaType: 'tv',
    philosophicalTags: ['humanism', 'self-knowledge', 'metaphysics', 'social-justice'],
    primaryTheme: 'humanism',
    justification: 'Corpo partilhado, empatia radical e identidades em rede.',
  },
  '43865': {
    mediaType: 'tv',
    philosophicalTags: ['war-and-conflict', 'virtue', 'suffering', 'humanism'],
    primaryTheme: 'war-and-conflict',
    justification: 'Combate real, camaradagem e custo psíquico da guerra.',
  },
  '88751': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'truth-deception', 'political-philosophy', 'virtue'],
    primaryTheme: 'power-corruption',
    justification: 'Neutralidade moral, monstros e jogos de poder no continente.',
  },

  '1429': {
    mediaType: 'tv',
    philosophicalTags: ['power-corruption', 'political-philosophy', 'war-and-conflict', 'marxism-socialism'],
    primaryTheme: 'power-corruption',
    justification: 'Id alternativo de Game of Thrones; mesmo núcleo de poder e classe.',
  },
  '2316': {
    mediaType: 'tv',
    philosophicalTags: ['existentialism', 'humanism', 'postmodernism', 'truth-deception'],
    primaryTheme: 'existentialism',
    justification: 'Trabalho burocrático, identidade social e humor como revelação do absurdo.',
  },

  '128': {
    mediaType: 'tv',
    philosophicalTags: ['virtue', 'metaphysics', 'humanism', 'power-corruption'],
    primaryTheme: 'virtue',
    justification: 'Lei de equivalente, sacrifício e limite ético do poder pessoal.',
  },
  '46260': {
    mediaType: 'tv',
    philosophicalTags: ['war-and-conflict', 'existentialism', 'utopia-dystopia', 'power-corruption'],
    primaryTheme: 'war-and-conflict',
    justification: 'Muralha, liberdade humana e horror político como espelho.',
  },
  '395': {
    mediaType: 'tv',
    philosophicalTags: ['alienation', 'existentialism', 'suffering', 'taboo-transgression'],
    primaryTheme: 'alienation',
    justification: 'Identidade partida entre humano e predador, pertença e trauma.',
  },
};

/**
 * @param {string|number|null|undefined} tmdbId
 * @returns {CuratedPhilosophicalProfile|null}
 */
export function getCuratedPhilosophicalProfile(tmdbId) {
  if (tmdbId == null) return null;
  return curatedPhilosophicalProfiles[String(tmdbId)] || null;
}

/**
 * Alinha tags curadas aos pesos de tema de uma citação (home / perfil filósofo).
 * @param {CuratedPhilosophicalProfile|null} profile
 * @param {Map<string, number>} themeWeights
 */
export function scorePhilosophicalTagsAgainstThemeWeights(profile, themeWeights) {
  if (!profile?.philosophicalTags?.length || !themeWeights?.size) return 0;

  let score = 0;
  for (const tag of profile.philosophicalTags) {
    const w = themeWeights.get(tag);
    if (w) score += w * 72;
  }
  if (profile.primaryTheme) {
    const w = themeWeights.get(profile.primaryTheme);
    if (w) score += w * 26;
  }
  return Math.min(130, score);
}

/**
 * @param {CuratedPhilosophicalProfile|null} profile
 * @param {{ id: string, themes: string[] }} lens
 * @returns {{ bonus: number, excluded: boolean }}
 */
export function scoreCuratedProfileForLens(profile, lens) {
  if (!profile?.philosophicalTags?.length || !lens?.themes?.length) {
    return { bonus: 0, excluded: false };
  }
  if (profile.excludedLenses?.includes(lens.id)) {
    return { bonus: 0, excluded: true };
  }
  const lensSet = new Set(lens.themes);
  const hits = profile.philosophicalTags.filter(t => lensSet.has(t)).length;
  let bonus = hits * 32;
  if (profile.primaryTheme && lensSet.has(profile.primaryTheme)) {
    bonus += 22;
  }
  return { bonus, excluded: false };
}

/**
 * @param {CuratedPhilosophicalProfile|null} sourceProfile
 * @param {CuratedPhilosophicalProfile|null} candidateProfile
 * @param {Map<string, number>} sourceThemeWeights
 */
export function scoreCuratedRelatedAffinity(sourceProfile, candidateProfile, sourceThemeWeights) {
  let score = 0;

  if (candidateProfile?.philosophicalTags?.length && sourceThemeWeights?.size) {
    for (const tag of candidateProfile.philosophicalTags) {
      const w = sourceThemeWeights.get(tag);
      if (w) score += w * 95;
    }
  }

  if (sourceProfile?.philosophicalTags?.length && candidateProfile?.philosophicalTags?.length) {
    const a = new Set(sourceProfile.philosophicalTags);
    score += candidateProfile.philosophicalTags.filter(t => a.has(t)).length * 38;
  }

  return Math.min(160, score);
}
