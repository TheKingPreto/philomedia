export async function getPhilosophyQuote() {
  try {
    const response = await fetch('https://philosophyapi.pythonanywhere.com/api/quotes/');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    const quotes = data.results || data;
    if (!quotes.length) throw new Error('No quotes found');

    const randomIndex = Math.floor(Math.random() * quotes.length);
    const quote = quotes[randomIndex];

    return {
      quote: quote.text || quote.quote || '',
      author: quote.author || 'Unknown'
    };
  } catch (error) {
    throw error;
  }
}