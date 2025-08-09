const quotes = [
  { quote: "The unexamined life is not worth living.", author: "Socrates" },
  { quote: "Happiness depends upon ourselves.", author: "Aristotle" },
  { quote: "I think, therefore I am.", author: "Descartes" },
  { quote: "To be is to be perceived.", author: "Berkeley" },
  { quote: "One cannot step twice in the same river.", author: "Heraclitus" },
];

export async function getPhilosophyQuote() {
  return new Promise((resolve) => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setTimeout(() => resolve(quotes[randomIndex]), 300);
  });
}
