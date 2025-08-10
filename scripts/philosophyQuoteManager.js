import { getPhilosophyQuote as getMockQuote } from 'scripts/quotesAPI.js';
import { getPhilosophyQuote as getRealQuote } from 'scripts/philosophyAPI.js';

export async function getPhilosophyQuote() {
  try {
    return await getRealQuote();
  } catch (error) {
    console.warn("Philosophy API failed, using local mock quote.", error);
    return await getMockQuote();
  }
}
