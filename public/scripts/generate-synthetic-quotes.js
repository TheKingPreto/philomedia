import { THEME_BUCKETS } from './theme-buckets.js';
import fs from 'fs';
import path from 'path';

const TARGET_TOTAL = 365;
const CURRENT_ENTRIES = 135;
const NEEDED_ENTRIES = TARGET_TOTAL - CURRENT_ENTRIES; // 230

// Philosophical quotes database - synthetic but inspired by real philosophy
const SYNTHETIC_QUOTES = {
  identity: [
    { quote: "To know oneself is the beginning of wisdom, but to accept oneself is the path to freedom.", author: "Ancient Wisdom" },
    { quote: "The self is not a fixed entity, but a river constantly reshaping its banks.", author: "Modern Reflection" },
    { quote: "Identity is not given, it is chosen in the face of uncertainty.", author: "Existential Thought" },
    { quote: "We are not who we think we are; we are who we choose to become.", author: "Personal Philosophy" },
    { quote: "The mirror shows us our face, but introspection reveals our soul.", author: "Inner Journey" },
    { quote: "Freedom begins when we stop seeking approval and start seeking authenticity.", author: "Self-Discovery" },
    { quote: "The most profound journey is the one that leads us back to ourselves.", author: "Philosophical Insight" },
    { quote: "Identity is the bridge between what we are and what we might become.", author: "Human Potential" },
    { quote: "To be oneself is the rarest form of courage in a world that demands conformity.", author: "Individual Spirit" },
    { quote: "The self is not a destination, but a continuous process of becoming.", author: "Ongoing Evolution" },
  ],
  power: [
    { quote: "Power without wisdom is a dangerous weapon in the hands of a child.", author: "Political Wisdom" },
    { quote: "The greatest power is not in ruling others, but in mastering oneself.", author: "Inner Strength" },
    { quote: "Corruption begins when power becomes an end rather than a means.", author: "Moral Philosophy" },
    { quote: "True leadership serves the led, not the leader's ego.", author: "Servant Leadership" },
    { quote: "Power reveals character more clearly than any mirror ever could.", author: "Human Nature" },
    { quote: "The most dangerous power is the one we don't know we possess.", author: "Hidden Influence" },
    { quote: "Authority earned through respect lasts longer than authority taken by force.", author: "Sustainable Power" },
    { quote: "Power is like fire: useful when controlled, destructive when unleashed.", author: "Balanced Force" },
    { quote: "The strongest power is the ability to empower others.", author: "Empowerment" },
    { quote: "Power corrupts, but only if character is weak.", author: "Moral Integrity" },
  ],
  love: [
    { quote: "Love is not a feeling, but a choice made moment by moment.", author: "Relationship Wisdom" },
    { quote: "To love another is to see the divine in the human.", author: "Spiritual Connection" },
    { quote: "Compassion is love in action, not just emotion.", author: "Active Kindness" },
    { quote: "The deepest love grows not from perfection, but from acceptance of flaws.", author: "Real Love" },
    { quote: "Love builds bridges where logic would build walls.", author: "Emotional Intelligence" },
    { quote: "To love is to risk pain, but the alternative is to never truly live.", author: "Vulnerable Heart" },
    { quote: "Shared humanity is the foundation of all lasting love.", author: "Common Ground" },
    { quote: "Love is the universal language that needs no translation.", author: "Universal Bond" },
    { quote: "The greatest love stories are written not with words, but with actions.", author: "Lived Love" },
    { quote: "Love transforms strangers into family, and isolation into belonging.", author: "Social Connection" },
  ],
  justice: [
    { quote: "Justice delayed is justice denied, but justice rushed is often justice corrupted.", author: "Legal Wisdom" },
    { quote: "True justice weighs not just the crime, but the circumstances that created it.", author: "Contextual Fairness" },
    { quote: "Equality before the law means nothing without equality of opportunity.", author: "Social Justice" },
    { quote: "The scales of justice must balance mercy with accountability.", author: "Balanced Judgment" },
    { quote: "Justice is not revenge, but restoration of balance.", author: "Restorative Justice" },
    { quote: "Rights without responsibilities create chaos, duties without rights create tyranny.", author: "Balanced Society" },
    { quote: "The greatest injustice is not inequality, but indifference to suffering.", author: "Moral Imperative" },
    { quote: "Justice begins with seeing the humanity in every person.", author: "Human Dignity" },
    { quote: "Fairness is not sameness, but appropriate consideration of differences.", author: "Equitable Treatment" },
    { quote: "The pursuit of justice is a lifelong commitment, not a destination.", author: "Ongoing Struggle" },
  ],
  truth: [
    { quote: "Truth is not always comfortable, but it is always liberating.", author: "Intellectual Freedom" },
    { quote: "The pursuit of truth requires the courage to question everything, including oneself.", author: "Socratic Method" },
    { quote: "Reality is that which, when you stop believing in it, doesn't go away.", author: "Objective Truth" },
    { quote: "Knowledge is the antidote to fear, truth is the cure for ignorance.", author: "Enlightened Mind" },
    { quote: "The truth we seek is often hidden in plain sight, obscured by our assumptions.", author: "Clear Vision" },
    { quote: "Certainty is the enemy of truth; doubt is its faithful companion.", author: "Intellectual Humility" },
    { quote: "Truth stands the test of time, while deception eventually reveals itself.", author: "Timeless Wisdom" },
    { quote: "The most dangerous lies are the ones we tell ourselves.", author: "Self-Deception" },
    { quote: "Understanding is the bridge between information and wisdom.", author: "Deep Knowledge" },
    { quote: "Truth is not relative, but our perception of it often is.", author: "Perceptual Limits" },
  ],
  ethics: [
    { quote: "Ethics is not about following rules, but about cultivating character.", author: "Moral Development" },
    { quote: "The right action is the one that serves the greatest good with the least harm.", author: "Utilitarian Wisdom" },
    { quote: "Virtue is not inherited, it is practiced until it becomes habit.", author: "Character Building" },
    { quote: "Moral courage is standing up for what is right, even when it costs you dearly.", author: "Ethical Courage" },
    { quote: "The highest ethics treat others as we would wish to be treated.", author: "Golden Rule" },
    { quote: "Integrity means doing the right thing even when no one is watching.", author: "Personal Ethics" },
    { quote: "Wisdom without ethics is dangerous, ethics without wisdom is blind.", author: "Balanced Morality" },
    { quote: "The purpose of ethics is not restriction, but human flourishing.", author: "Positive Morality" },
    { quote: "Moral dilemmas test our character more than our intellect.", author: "Ethical Challenges" },
    { quote: "The best ethics are those that serve both individual and community.", author: "Social Morality" },
  ],
  time: [
    { quote: "Time is the fire in which we burn, and the river in which we flow.", author: "Temporal Wisdom" },
    { quote: "Memory is the treasury of the mind, regret is its thief.", author: "Past Reflections" },
    { quote: "The future is not something we wait for, but something we create.", author: "Future Building" },
    { quote: "Change is the only constant, adaptation is the only wisdom.", author: "Evolutionary Truth" },
    { quote: "Time heals what reason cannot, and teaches what experience missed.", author: "Healing Process" },
    { quote: "The present moment is the only time that truly exists.", author: "Mindful Presence" },
    { quote: "Hope is the light that guides us through the darkness of uncertainty.", author: "Optimistic Spirit" },
    { quote: "Every ending is a beginning in disguise.", author: "Cyclical Nature" },
    { quote: "Time reveals the true value of everything and everyone.", author: "Valuation Process" },
    { quote: "The most precious gift is not time itself, but how we choose to spend it.", author: "Time Management" },
  ],
  culture: [
    { quote: "Culture is the lens through which we see the world, and the mirror in which we see ourselves.", author: "Cultural Identity" },
    { quote: "Technology extends our reach, but wisdom reminds us of our limits.", author: "Tech Philosophy" },
    { quote: "Alienation is the price we pay for progress, connection is the cure.", author: "Modern Condition" },
    { quote: "Utopia is not a destination, but a direction we choose to walk.", author: "Ideal Society" },
    { quote: "Art is the language of the soul, technology is the tool of the mind.", author: "Creative Expression" },
    { quote: "The future is not predetermined, but shaped by our present choices.", author: "Future Shaping" },
    { quote: "Media shapes reality as much as it reports it.", author: "Information Age" },
    { quote: "Capitalism rewards innovation, socialism rewards equity; wisdom balances both.", author: "Economic Philosophy" },
    { quote: "The digital age has connected us physically, but often disconnected us spiritually.", author: "Modern Paradox" },
    { quote: "Culture evolves not through preservation, but through creative adaptation.", author: "Cultural Evolution" },
  ],
};

function generateSlug(quote, author) {
  return `${author.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${quote.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

async function generateExpandedCalendar() {
  // Load existing pairings by importing the module
  const existingPath = path.join(process.cwd(), 'src', 'data', 'dailyPairings.js');
  const { DAILY_PAIRINGS: existingPairings } = await import('./../../src/data/dailyPairings.js');

  // Generate additional synthetic quotes
  const additionalQuotes = [];
  const usedSlugs = new Set(existingPairings.map(p => p.slug));

  const themes = Object.keys(THEME_BUCKETS);
  const quotesPerTheme = Math.ceil(NEEDED_ENTRIES / themes.length);

  for (const theme of themes) {
    const availableQuotes = SYNTHETIC_QUOTES[theme] || [];
    const quotesToAdd = Math.min(quotesPerTheme, availableQuotes.length);

    for (let i = 0; i < quotesToAdd; i++) {
      const quoteData = availableQuotes[i];
      let slug = generateSlug(quoteData.quote, quoteData.author);
      let counter = 1;

      // Ensure unique slug
      while (usedSlugs.has(slug)) {
        slug = `${generateSlug(quoteData.quote, quoteData.author)}-${counter}`;
        counter++;
      }
      usedSlugs.add(slug);

      const quote = {
        slug,
        quote: quoteData.quote,
        author: quoteData.author,
        themes: [theme], // Map to bucket theme
        context: THEME_BUCKETS[theme].context,
        works: THEME_BUCKETS[theme].works,
        source: 'synthetic'
      };

      additionalQuotes.push(quote);
    }
  }

  // If we still need more quotes, cycle through themes again
  let remainingNeeded = NEEDED_ENTRIES - additionalQuotes.length;
  if (remainingNeeded > 0) {
    console.log(`Still need ${remainingNeeded} more quotes, cycling through themes again...`);

    for (const theme of themes) {
      if (remainingNeeded <= 0) break;

      const availableQuotes = SYNTHETIC_QUOTES[theme] || [];
      for (const quoteData of availableQuotes) {
        if (remainingNeeded <= 0) break;

        let slug = generateSlug(quoteData.quote, quoteData.author);
        let counter = 1;

        while (usedSlugs.has(slug)) {
          slug = `${generateSlug(quoteData.quote, quoteData.author)}-${counter}`;
          counter++;
        }
        usedSlugs.add(slug);

        const quote = {
          slug,
          quote: quoteData.quote,
          author: quoteData.author,
          themes: [theme],
          context: THEME_BUCKETS[theme].context,
          works: THEME_BUCKETS[theme].works,
          source: 'synthetic'
        };

        additionalQuotes.push(quote);
        remainingNeeded--;
      }
    }
  }

  // Combine and shuffle
  const allPairings = [...existingPairings, ...additionalQuotes];
  const shuffled = allPairings.sort(() => Math.random() - 0.5);

  // Create new file content
  const newContent = `/* eslint-disable max-len */\nexport const DAILY_PAIRINGS = ${JSON.stringify(shuffled, null, 2)};`;

  // Write to main file
  fs.writeFileSync(existingPath, newContent);

  console.log(`✅ Expanded calendar from ${existingPairings.length} to ${allPairings.length} entries`);
  console.log(`📊 Added ${additionalQuotes.length} synthetic quotes`);
  console.log(`🎯 Target: ${TARGET_TOTAL} entries (currently: ${allPairings.length})`);

  return allPairings.length;
}

await generateExpandedCalendar();