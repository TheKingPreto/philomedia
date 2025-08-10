import { OPENAI_API_KEY } from "config.js";
export const philosophyThemes = {
  existentialism: ["freedom", "responsibility", "anguish", "authenticity"],
  nihilism: ["meaninglessness", "void", "detachment", "destruction"],
  stoicism: ["virtue", "acceptance", "resilience", "self-control"],
  hedonism: ["pleasure", "happiness", "satisfaction", "desire"],
  platonism: ["ideas", "perfection", "soul", "morality"],
  pessimism: ["suffering", "tragedy", "finitude", "destiny"]
};

export function classifyByTheme(text) {
  const foundThemes = [];
  const lowerText = text.toLowerCase();

  for (const [theme, words] of Object.entries(philosophyThemes)) {
    if (words.some(w => lowerText.includes(w))) {
      foundThemes.push(theme);
    }
  }

  return foundThemes.length ? foundThemes : ["unknown_theme"];
}

export async function generateEmbedding(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text
    })
  });
  const data = await resp.json();
  return data.data[0].embedding;
}

export function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}
export async function relateQuoteAndWork(quote, workDescription) {
  const quoteThemes = classifyByTheme(quote);
  const workThemes = classifyByTheme(workDescription);

  const hasCommonTheme = quoteThemes.some(t => workThemes.includes(t));
  if (!hasCommonTheme) return { match: false, reason: "Different themes" };

  const [quoteVec, workVec] = await Promise.all([
    generateEmbedding(quote),
    generateEmbedding(workDescription)
  ]);

  const similarity = cosineSimilarity(quoteVec, workVec);

  return {
    match: similarity >= 0.65,
    similarity,
    commonThemes: quoteThemes.filter(t => workThemes.includes(t))
  };
}
