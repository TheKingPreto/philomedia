// scripts/quotesAPI.js

export async function getDailyQuote() {
  const proxy = "https://api.allorigins.win/raw?url=";
  const apiURL = "https://quotes.rest/qod?category=philosophy";

  try {
    const response = await fetch(proxy + encodeURIComponent(apiURL));

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    // Estrutura da resposta da TheySaidSo API
    return {
      text: data.contents.quotes[0].quote,
      author: data.contents.quotes[0].author
    };
  } catch (error) {
    console.error("Error fetching philosophy quote:", error);

    // Fallback local - frases filosóficas fixas
    const localQuotes = [
      {
        text: "The unexamined life is not worth living.",
        author: "Socrates"
      },
      {
        text: "He who has a why to live can bear almost any how.",
        author: "Friedrich Nietzsche"
      },
      {
        text: "Happiness depends upon ourselves.",
        author: "Aristotle"
      },
      {
        text: "Man is condemned to be free.",
        author: "Jean-Paul Sartre"
      },
      {
        text: "Do not spoil what you have by desiring what you have not.",
        author: "Epicurus"
      }
    ];

    const randomQuote =
      localQuotes[Math.floor(Math.random() * localQuotes.length)];

    return randomQuote;
  }
}
