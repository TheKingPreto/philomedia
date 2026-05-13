import {
  getSession,
  redirectToLogin,
  setupAuthUI,
} from '/scripts/auth-ui.js';
import {
  getPhilosopherDirectory,
  getQuoteCatalog,
  getSubmittedPhilosophers,
  submitPhilosopherContribution,
} from '/scripts/philosophersapi.js';
import {
  buildPhilosopherProfiles,
  filterPhilosopherCatalogQuotes,
} from '/scripts/philosopher-data.js';

const quoteList = document.getElementById('quote-list');
const contributionForm = document.getElementById('contribution-form');
const feedback = document.getElementById('contribution-feedback');
const addQuoteButton = document.getElementById('add-quote-button');
const submitButton = document.getElementById('submit-contribution-button');
const modeTabs = [...document.querySelectorAll('[data-contribution-mode]')];
const newThinkerFields = document.getElementById('new-thinker-fields');
const existingThinkerPanel = document.getElementById('existing-thinker-panel');
const existingThinkerInput = document.getElementById('existing-thinker-input');
const existingThinkerOptions = document.getElementById('existing-thinker-options');
const existingThinkerFeedback = document.getElementById('existing-thinker-feedback');
const existingThinkerPreview = document.getElementById('existing-thinker-preview');
const quotesSectionSubtitle = document.getElementById('quotes-section-subtitle');

const state = {
  mode: 'new',
  existingProfiles: [],
  existingLookup: new Map(),
  selectedExistingProfile: null,
  existingProfilesReady: false,
};

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderAuthPrompt(container, session) {
  const loginAvailable = Boolean(session?.oauthEnabled);

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${loginAvailable ? 'Sign in to contribute' : 'Login unavailable'}</p>
      <p class="empty-state-text">
        ${loginAvailable
          ? 'Use your Google account to add thinkers and quotes to the public reading archive.'
          : 'Google OAuth is not configured on this server yet.'}
      </p>
      ${loginAvailable ? '<button type="button" class="library-cta-button" id="contribute-login-button">Sign in with Google</button>' : ''}
    </div>
  `;

  document.getElementById('contribute-login-button')?.addEventListener('click', redirectToLogin);
}

function createQuoteCard(index) {
  const article = document.createElement('article');
  article.className = 'quote-entry-card';
  article.dataset.quoteIndex = String(index);
  article.innerHTML = `
    <div class="quote-entry-header">
      <h3>Quote ${index + 1}</h3>
      <button type="button" class="ghost-button quote-remove-button" data-role="remove-quote">Remove</button>
    </div>
    <div class="contribution-grid">
      <div class="contribution-field contribution-field-wide">
        <label>Quote text</label>
        <textarea name="quoteText" rows="4" maxlength="500" placeholder="Enter the quote in English." required></textarea>
      </div>
      <div class="contribution-field contribution-field-wide">
        <label>Suggested themes</label>
        <input name="themes" type="text" maxlength="240" placeholder="Comma-separated, e.g. existentialism, absurd, self-knowledge">
      </div>
    </div>
  `;

  return article;
}

function syncQuoteLabels() {
  [...quoteList.querySelectorAll('.quote-entry-card')].forEach((card, index) => {
    card.dataset.quoteIndex = String(index);
    const title = card.querySelector('h3');
    if (title) {
      title.textContent = `Quote ${index + 1}`;
    }

    const removeButton = card.querySelector('[data-role="remove-quote"]');
    if (removeButton) {
      removeButton.hidden = quoteList.children.length <= 1;
    }
  });
}

function addQuoteCard() {
  const card = createQuoteCard(quoteList.children.length);
  quoteList.appendChild(card);
  syncQuoteLabels();
}

function parseCommaList(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  )];
}

function setFeedback(message, tone = 'muted') {
  feedback.textContent = message;
  feedback.dataset.tone = tone;
}

function setExistingFeedback(message, tone = 'muted') {
  if (!existingThinkerFeedback) return;

  if (!message) {
    existingThinkerFeedback.hidden = true;
    existingThinkerFeedback.textContent = '';
    existingThinkerFeedback.dataset.tone = tone;
    return;
  }

  existingThinkerFeedback.hidden = false;
  existingThinkerFeedback.textContent = message;
  existingThinkerFeedback.dataset.tone = tone;
}

function setPending(isPending) {
  [...contributionForm.querySelectorAll('textarea, input, button')].forEach(element => {
    element.disabled = isPending;
  });
}

function buildPayload(form) {
  const formData = new FormData(form);
  const quotes = [...quoteList.querySelectorAll('.quote-entry-card')]
    .map(card => ({
      quoteText: card.querySelector('textarea[name="quoteText"]')?.value.trim() || '',
      themes: parseCommaList(card.querySelector('input[name="themes"]')?.value || ''),
    }))
    .filter(quote => quote.quoteText);

  if (state.mode === 'existing') {
    const profile = state.selectedExistingProfile;

    return {
      name: String(profile?.name || '').trim(),
      period: String(profile?.period || '').trim(),
      summary: String(profile?.summary || '').trim(),
      focus: String(profile?.focus || '').trim(),
      portraitUrl: String(profile?.portraitUrl || '').trim(),
      wikiTitle: String(profile?.wikiTitle || '').trim(),
      aliases: Array.isArray(profile?.aliases) ? [...new Set(profile.aliases.filter(Boolean))] : [],
      quotes,
    };
  }

  return {
    name: String(formData.get('name') || '').trim(),
    period: String(formData.get('period') || '').trim(),
    summary: String(formData.get('summary') || '').trim(),
    focus: String(formData.get('focus') || '').trim(),
    portraitUrl: String(formData.get('portraitUrl') || '').trim(),
    wikiTitle: String(formData.get('wikiTitle') || '').trim(),
    aliases: parseCommaList(formData.get('aliases') || ''),
    quotes,
  };
}

function buildValidationMessage(error) {
  if (Array.isArray(error?.details) && error.details.length > 0) {
    return error.details[0]?.msg || 'Please review the form fields.';
  }

  return error?.message || 'Could not submit this thinker.';
}

function renderExistingPortrait(profile) {
  if (profile?.portraitUrl) {
    return `
      <div class="philosopher-sigil philosopher-sigil-small philosopher-sigil-photo contribution-profile-sigil" aria-hidden="true">
        <img src="${profile.portraitUrl}" alt="${escapeHtml(profile.name)} portrait" loading="lazy">
      </div>
    `;
  }

  return `
    <div class="philosopher-sigil philosopher-sigil-small contribution-profile-sigil" aria-hidden="true">
      ${escapeHtml(profile?.initials || 'PM')}
    </div>
  `;
}

function renderExistingPreview(profile) {
  if (!existingThinkerPreview || !profile) return;

  existingThinkerPreview.hidden = false;
  existingThinkerPreview.innerHTML = `
    <div class="contribution-profile-preview-top">
      <div class="contribution-profile-preview-identity">
        ${renderExistingPortrait(profile)}
        <div>
          <p class="profile-eyebrow contribution-profile-preview-eyebrow">Existing thinker</p>
          <h3>${escapeHtml(profile.name)}</h3>
          <p class="section-subtitle">${escapeHtml(profile.period || 'Thinker in the archive')}</p>
        </div>
      </div>
      <a href="${profile.url}" class="profile-action-link profile-action-link-secondary contribution-preview-link">Open page</a>
    </div>
    <p class="contribution-profile-preview-summary">${escapeHtml(profile.summary || profile.focus || 'This profile is already part of the site archive.')}</p>
    ${Array.isArray(profile.themeLabels) && profile.themeLabels.length
      ? `<div class="philosopher-chip-row">${profile.themeLabels.slice(0, 3).map(label => `<span class="philosopher-chip">${escapeHtml(label)}</span>`).join('')}</div>`
      : ''}
    <div class="contribution-profile-preview-stats">
      <span>${Number(profile.quoteCount || 0)} quote${Number(profile.quoteCount || 0) === 1 ? '' : 's'}</span>
      <span>${Number(profile.linkedWorkCount || 0)} related work${Number(profile.linkedWorkCount || 0) === 1 ? '' : 's'}</span>
    </div>
  `;
}

function clearExistingPreview() {
  if (!existingThinkerPreview) return;
  existingThinkerPreview.hidden = true;
  existingThinkerPreview.innerHTML = '';
}

function updateModeCopy() {
  const isExistingMode = state.mode === 'existing';

  if (newThinkerFields) {
    newThinkerFields.hidden = isExistingMode;
  }

  if (existingThinkerPanel) {
    existingThinkerPanel.hidden = !isExistingMode;
  }

  if (submitButton) {
    submitButton.textContent = isExistingMode ? 'Publish quotes' : 'Publish thinker';
  }

  if (quotesSectionSubtitle) {
    quotesSectionSubtitle.textContent = isExistingMode
      ? 'Add one or more English quotes. They will be attached to the selected thinker and re-used across the thinker pages.'
      : 'Add one or more English quotes. Optional themes help the first match, but the site also analyzes the quote text.';
  }

  if (isExistingMode) {
    if (state.selectedExistingProfile) {
      setExistingFeedback('Existing thinker found — your quotes will be added to this profile.', 'success');
      renderExistingPreview(state.selectedExistingProfile);
    } else if (state.existingProfilesReady) {
      setExistingFeedback('Select a thinker from the site list to attach new quotes to that existing profile.', 'muted');
    } else {
      setExistingFeedback('Loading thinker index...', 'muted');
    }
  } else {
    setExistingFeedback('', 'muted');
    clearExistingPreview();
  }
}

function setMode(mode) {
  state.mode = mode === 'existing' ? 'existing' : 'new';

  modeTabs.forEach(tab => {
    const isActive = tab.dataset.contributionMode === state.mode;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  updateModeCopy();
}

function buildExistingLookup(profiles = []) {
  const lookup = new Map();

  profiles.forEach(profile => {
    const keys = [
      profile.slug,
      profile.name,
      ...(profile.aliases || []),
    ];

    keys.forEach(key => {
      const normalized = normalizeKey(key);
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, profile);
      }
    });
  });

  return lookup;
}

function buildInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function upsertExistingProfileOption(philosopher, createdQuotes = 0) {
  if (!philosopher?.name || !philosopher?.slug) return;

  const currentIndex = state.existingProfiles.findIndex(profile => (
    profile.slug === philosopher.slug
    || normalizeKey(profile.name) === normalizeKey(philosopher.name)
  ));

  const current = currentIndex >= 0 ? state.existingProfiles[currentIndex] : null;
  const nextProfile = {
    ...current,
    ...philosopher,
    aliases: [...new Set([...(current?.aliases || []), ...(philosopher.aliases || [])])],
    quoteCount: Math.max(1, Number(current?.quoteCount || 0) + Number(createdQuotes || 0)),
    linkedWorkCount: Number(current?.linkedWorkCount || 0),
    themeLabels: current?.themeLabels || [],
    portraitUrl: philosopher.portraitUrl || current?.portraitUrl || '',
    wikiTitle: philosopher.wikiTitle || current?.wikiTitle || '',
    url: current?.url || `/html/philosopher.html?slug=${encodeURIComponent(philosopher.slug)}`,
    initials: current?.initials || buildInitials(philosopher.name),
  };

  if (currentIndex >= 0) {
    state.existingProfiles.splice(currentIndex, 1, nextProfile);
  } else {
    state.existingProfiles.push(nextProfile);
  }

  state.existingProfiles.sort((a, b) => a.name.localeCompare(b.name));
  state.existingProfilesReady = true;
  state.existingLookup = buildExistingLookup(state.existingProfiles);
  renderExistingOptions(state.existingProfiles);
  state.selectedExistingProfile = nextProfile;
}

function renderExistingOptions(profiles = []) {
  if (!existingThinkerOptions) return;

  existingThinkerOptions.innerHTML = profiles
    .map(profile => `
      <option value="${escapeHtml(profile.name)}">${escapeHtml(`${profile.period || 'Thinker in the archive'} · ${profile.quoteCount} quotes`)}</option>
    `)
    .join('');
}

function resolveExistingProfile(query) {
  const normalized = normalizeKey(query);
  if (!normalized) return null;

  const exact = state.existingLookup.get(normalized);
  if (exact) return exact;

  const prefixMatches = state.existingProfiles.filter(profile => {
    const names = [profile.name, ...(profile.aliases || [])];
    return names.some(name => normalizeKey(name).startsWith(normalized));
  });

  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function selectExistingProfile(profile, announce = true) {
  state.selectedExistingProfile = profile;

  if (existingThinkerInput) {
    existingThinkerInput.value = profile?.name || '';
  }

  if (profile) {
    renderExistingPreview(profile);
    if (announce) {
      setExistingFeedback('Existing thinker found — your quotes will be added to this profile.', 'success');
    }
    return;
  }

  clearExistingPreview();
}

async function loadExistingProfiles() {
  if (!existingThinkerInput) return;

  existingThinkerInput.disabled = true;
  setExistingFeedback('Loading thinker index...', 'muted');

  try {
    const [quotes, philosopherDirectory, submittedProfiles] = await Promise.all([
      getQuoteCatalog('en'),
      getPhilosopherDirectory(),
      getSubmittedPhilosophers(),
    ]);

    const profiles = buildPhilosopherProfiles(
      filterPhilosopherCatalogQuotes(quotes),
      philosopherDirectory,
      submittedProfiles
    ).sort((a, b) => a.name.localeCompare(b.name));

    state.existingProfiles = profiles;
    state.existingLookup = buildExistingLookup(profiles);
    state.existingProfilesReady = true;

    renderExistingOptions(profiles);
    existingThinkerInput.disabled = false;

    if (state.mode === 'existing' && !state.selectedExistingProfile) {
      setExistingFeedback(`Select from ${profiles.length} existing thinkers to attach new quotes instantly.`, 'muted');
    }
  } catch (error) {
    existingThinkerInput.disabled = true;
    state.existingProfilesReady = false;
    setExistingFeedback('Could not load the thinker index right now. You can still create a new thinker.', 'error');
  }
}

function syncExistingSelectionFromInput({ strict = false } = {}) {
  const query = existingThinkerInput?.value || '';
  if (!query.trim()) {
    state.selectedExistingProfile = null;
    clearExistingPreview();
    setExistingFeedback(
      state.existingProfilesReady
        ? 'Select a thinker from the site list to attach new quotes to that existing profile.'
        : 'Loading thinker index...',
      'muted'
    );
    return;
  }

  const profile = resolveExistingProfile(query);
  if (profile) {
    selectExistingProfile(profile);
    return;
  }

  state.selectedExistingProfile = null;
  clearExistingPreview();
  setExistingFeedback(
    strict
      ? 'Select an existing thinker from the suggestions before publishing.'
      : 'Keep typing or choose one of the existing thinkers from the suggestions.',
    strict ? 'error' : 'muted'
  );
}

function resetFormForCurrentMode() {
  const preservedProfile = state.mode === 'existing' ? state.selectedExistingProfile : null;

  contributionForm.reset();
  quoteList.innerHTML = '';
  addQuoteCard();

  if (preservedProfile) {
    selectExistingProfile(preservedProfile, false);
  } else {
    clearExistingPreview();
  }

  updateModeCopy();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (state.mode === 'existing' && !state.selectedExistingProfile) {
    setFeedback('Choose an existing thinker from the list before publishing.', 'error');
    return;
  }

  const payload = buildPayload(contributionForm);
  if (!payload.quotes.length) {
    setFeedback('Add at least one quote before publishing.', 'error');
    return;
  }

  if (state.mode === 'new' && !payload.name) {
    setFeedback('Add a thinker name and at least one quote before publishing.', 'error');
    return;
  }

  setPending(true);
  setFeedback(
    state.mode === 'existing'
      ? 'Publishing quotes to the selected thinker...'
      : 'Publishing thinker and quotes...',
    'muted'
  );

  try {
    const result = await submitPhilosopherContribution(payload);
    upsertExistingProfileOption(result.philosopher, result.createdQuotes);
    const title = state.mode === 'existing' ? 'Quotes published.' : 'Contribution published.';
    const copy = state.mode === 'existing'
      ? `${escapeHtml(result.createdQuotes)} quote(s) added to ${escapeHtml(result.philosopher.name)}, ${escapeHtml(result.skippedQuotes)} skipped as duplicates.`
      : `${escapeHtml(result.createdQuotes)} quote(s) created, ${escapeHtml(result.skippedQuotes)} skipped as duplicates.`;

    feedback.innerHTML = `
      <p class="contribution-feedback-title">${title}</p>
      <p>${copy}</p>
      <a class="profile-action-link profile-action-link-secondary" href="/html/philosopher.html?slug=${encodeURIComponent(result.philosopher.slug)}">Open thinker page</a>
    `;
    feedback.dataset.tone = 'success';

    resetFormForCurrentMode();
  } catch (error) {
    setFeedback(buildValidationMessage(error), 'error');
  } finally {
    setPending(false);
  }
}

async function init() {
  const gate = document.getElementById('contribute-gate');
  const content = document.getElementById('contribute-content');

  await setupAuthUI();
  const session = await getSession();

  if (!session.authenticated || !session.user) {
    content.hidden = true;
    gate.hidden = false;
    renderAuthPrompt(gate, session);
    return;
  }

  gate.hidden = true;
  content.hidden = false;
  addQuoteCard();
  setMode('new');
  loadExistingProfiles().catch(() => {});
}

quoteList?.addEventListener('click', event => {
  const removeButton = event.target.closest('[data-role="remove-quote"]');
  if (!removeButton) return;

  removeButton.closest('.quote-entry-card')?.remove();
  syncQuoteLabels();
});

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    setMode(tab.dataset.contributionMode);
  });
});

existingThinkerInput?.addEventListener('input', () => {
  syncExistingSelectionFromInput({ strict: false });
});

existingThinkerInput?.addEventListener('change', () => {
  syncExistingSelectionFromInput({ strict: true });
});

addQuoteButton?.addEventListener('click', addQuoteCard);
contributionForm?.addEventListener('submit', handleSubmit);

init().catch(() => {
  setFeedback('Could not load the contribution page right now.', 'error');
});
