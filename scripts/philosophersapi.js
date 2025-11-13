import { customQuotes } from '/philomedia/scripts/custom-quotes.js';

const proxyUrl = 'https://corsproxy.io/?';
const quotesApiUrl = 'https://philosophersapi.com/api/quotes';
const philosophersApiUrl = 'https://philosophersapi.com/api/philosophers';

export async function getQuotes() {
  let apiQuotes = [];

  try {
    const [quotesResponse, philosophersResponse] = await Promise.all([
      fetch(proxyUrl + encodeURIComponent(quotesApiUrl)),
      fetch(proxyUrl + encodeURIComponent(philosophersApiUrl))
    ]);

    if (!quotesResponse.ok || !philosophersResponse.ok) {
      throw new Error('Failed to fetch data from one or more API endpoints.');
    }

    const quotesData = await quotesResponse.json();
    const philosophersData = await philosophersResponse.json();

    const philosopherMap = new Map();
    philosophersData.forEach(p => {
      philosopherMap.set(p.id, p.name);
    });

    apiQuotes = quotesData.map(quote => {
      const authorName = quote.philosopher ? philosopherMap.get(quote.philosopher.id) || "Unknown" : "Unknown";
      
      return {
        quote: quote.quote,
        author: authorName,
        themes: quote.tags || []
      };
    });
    
    console.log("Successfully fetched and automatically combined API quotes and authors.");

  } catch (error) {
    console.warn("Could not fetch from external API, will use only custom quotes. Error:", error.message);
  }

  const combinedMap = new Map();

  customQuotes.forEach(quote => combinedMap.set(quote.quote, quote));

  apiQuotes.forEach(quote => {
    if (!combinedMap.has(quote.quote)) {
      combinedMap.set(quote.quote, quote);
    }
  });

  const finalQuotes = Array.from(combinedMap.values());
  
  return finalQuotes;
}
