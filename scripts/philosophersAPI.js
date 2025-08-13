// Este é o único ponto do seu aplicativo que fala com a API de filósofos.

const API_URL = 'https://philosophersapi.com/api/quotes'; // URL da nova API

/**
 * Fetches all quotes from the PhilosophersAPI and formats them for the app.
 * @returns {Promise<Array<object>>} A list of formatted quote objects.
 */
export async function getAllQuotesFromAPI() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const data = await response.json();

    // Adapt the data from the API to the format our app expects: { quote, author, themes }.
    // IMPORTANT: You may need to adjust the keys ('item.source', 'item.tags') to match the real API response.
    const formattedQuotes = data.map(item => ({
      quote: item.quote,
      author: item.source, // Assuming the API returns author in the 'source' field.
      themes: item.tags || [] // If the API provides tags/themes, we use them.
    }));

    return formattedQuotes;

  } catch (error) {
    console.error("Error fetching from PhilosophersAPI:", error);
    return []; // Return an empty array on error to prevent the app from crashing.
  }
}