/**
 * Retratos curados em Wikimedia Commons.
 * Preferimos as URLs de thumbnail que a Wikipedia REST já serve (330px),
 * no host thumb/upload.wikimedia.org — o browser só as vê via /api/assets/portrait.
 * Lucas Costa Roxo não tem ficheiro Commons estável; o sigil fica como fallback honesto.
 */
export const CURATED_PORTRAIT_URLS = {
  socrates: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Socrates_Louvre.jpg/330px-Socrates_Louvre.jpg',
  plato: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Plato_Silanion_Musei_Capitolini_MC1377.png/330px-Plato_Silanion_Musei_Capitolini_MC1377.png',
  aristotle: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Aristotle_Altemps_Inv8575.jpg/330px-Aristotle_Altemps_Inv8575.jpg',
  'niccolo-machiavelli': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Portrait_of_Niccol%C3%B2_Machiavelli_by_Santi_di_Tito.jpg/330px-Portrait_of_Niccol%C3%B2_Machiavelli_by_Santi_di_Tito.jpg',
  'john-locke': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Godfrey_Kneller_-_Portrait_of_John_Locke_%28Hermitage%29.jpg/330px-Godfrey_Kneller_-_Portrait_of_John_Locke_%28Hermitage%29.jpg',
  'charles-darwin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Charles_Darwin_seated_crop.jpg/330px-Charles_Darwin_seated_crop.jpg',
  'karl-marx': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Karl_Marx_by_John_Jabez_Edwin_Mayall_1875_-_Restored.png/330px-Karl_Marx_by_John_Jabez_Edwin_Mayall_1875_-_Restored.png',
  'friedrich-nietzsche': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Nietzsche187a.jpg/330px-Nietzsche187a.jpg',
  'simone-de-beauvoir': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Simone_De_Beauvoir_%28cropped%29.jpg/330px-Simone_De_Beauvoir_%28cropped%29.jpg',
  'clovis-de-barros-filho': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Caf%C3%A9_Filos%C3%B3fico_com_Cl%C3%B3vis_de_B._Filho_em_Sorocaba_%284369984909%29.jpg/330px-Caf%C3%A9_Filos%C3%B3fico_com_Cl%C3%B3vis_de_B._Filho_em_Sorocaba_%284369984909%29.jpg',
  'leandro-karnal': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/2022-08-09_Primeiro_dia_do_COMAC_SC%2C_026_%28Leandro_Karnal%29.jpg/330px-2022-08-09_Primeiro_dia_do_COMAC_SC%2C_026_%28Leandro_Karnal%29.jpg',
  'mario-sergio-cortella': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Mario_Sergio_Cortella.jpg/330px-Mario_Sergio_Cortella.jpg',
  'lucas-costa-roxo': '',
  'immanuel-kant': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Immanuel_Kant_-_Gemaelde_2.jpg/330px-Immanuel_Kant_-_Gemaelde_2.jpg',
  'baruch-spinoza': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Spinoza.jpg/330px-Spinoza.jpg',
  'david-hume': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Painting_of_David_Hume.jpg/330px-Painting_of_David_Hume.jpg',
  'ludwig-wittgenstein': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Ludwig_Wittgenstein.jpg/330px-Ludwig_Wittgenstein.jpg',
  'arthur-schopenhauer': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Arthur_Schopenhauer_by_J_Sch%C3%A4fer%2C_1859b.jpg/330px-Arthur_Schopenhauer_by_J_Sch%C3%A4fer%2C_1859b.jpg',
  heraclitus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Heraclitus_b_4_compressed.jpg/330px-Heraclitus_b_4_compressed.jpg',
  epicurus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Epicurus_bust2.jpg/330px-Epicurus_bust2.jpg',
  'blaise-pascal': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Blaise_Pascal_Versailles.JPG/330px-Blaise_Pascal_Versailles.JPG',
  'francis-bacon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Somer_Francis_Bacon.jpg/330px-Somer_Francis_Bacon.jpg',
  voltaire: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Nicolas_de_Largilli%C3%A8re_-_Portrait_de_Voltaire_%281694-1778%29_en_1718_-_P208_-_mus%C3%A9e_Carnavalet_-_5_%28cropped%29.jpg/330px-Nicolas_de_Largilli%C3%A8re_-_Portrait_de_Voltaire_%281694-1778%29_en_1718_-_P208_-_mus%C3%A9e_Carnavalet_-_5_%28cropped%29.jpg',
  'john-stuart-mill': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/John_Stuart_Mill_by_London_Stereoscopic_Company%2C_c1870.jpg/330px-John_Stuart_Mill_by_London_Stereoscopic_Company%2C_c1870.jpg',
  'saint-augustine': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Saint_Augustine_by_Philippe_de_Champaigne.jpg/330px-Saint_Augustine_by_Philippe_de_Champaigne.jpg',
  'soren-kierkegaard': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Kierkegaard.jpg/330px-Kierkegaard.jpg',
  'hannah-arendt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Hannah_Arendt_auf_dem_1._Kulturkritikerkongress%2C_Barbara_Niggl_Radloff%2C_FM-2019-1-5-9-16_%28cropped%29.jpg/330px-Hannah_Arendt_auf_dem_1._Kulturkritikerkongress%2C_Barbara_Niggl_Radloff%2C_FM-2019-1-5-9-16_%28cropped%29.jpg',
  'augusto-cury': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Augusto_Cury%2C_escritor_%2828339139296%29_%28cropped%29.jpg/330px-Augusto_Cury%2C_escritor_%2828339139296%29_%28cropped%29.jpg',
  'sigmund-freud': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sigmund_Freud%2C_by_Max_Halberstadt_%28cropped%29.jpg/330px-Sigmund_Freud%2C_by_Max_Halberstadt_%28cropped%29.jpg',
  plotinus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Plotinos.jpg/330px-Plotinos.jpg',
  'isaac-newton': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Portrait_of_Sir_Isaac_Newton%2C_1689_%28brightened%29.jpg/330px-Portrait_of_Sir_Isaac_Newton%2C_1689_%28brightened%29.jpg',
};
