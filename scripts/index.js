import { getDailyQuote } from "./quotesAPI.js";

document.addEventListener("DOMContentLoaded", async () => {
  const quoteText = document.getElementById("quote-text");
  const quoteAuthor = document.getElementById("quote-author");

  const quote = await getDailyQuote();

  quoteText.textContent = quote.text;
  quoteAuthor.textContent = quote.author ? `— ${quote.author}` : "";
});
