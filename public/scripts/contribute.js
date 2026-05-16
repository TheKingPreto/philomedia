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
  buildPhilosopherIndexProfiles,
  filterPhilosopherCatalogQuotes,
} from '/scripts/philosopher-data.js';
import { t } from '/scripts/services/i18n.js';
import { localizeThinkerCard } from '/scripts/services/philosopherDisplayI18n.js';
import { getUiLocale } from '/scripts/services/uiLocale.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';

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
      <p class="empty-state-title">${escapeHtml(loginAvailable ? t('contribute.sign_in_title') : t('library.oauth_unavailable_title'))}</p>
      <p class="empty-state-text">
        ${escapeHtml(loginAvailable ? t('contribute.sign_in_text') : t('library.oauth_unavailable_text'))}
      </p>
      ${loginAvailable ? '<button type="button" class="library-cta-button" id="contribute-login-button">Sign in</button>' : ''}
    </div>
  `;

  const loginButton = document.getElementById('contribute-login-button');
  if (loginButton) {
    loginButton.textContent = t('contribute.sign_in_button');
    loginButton.addEventListener('click', redirectToLogin);
  }
}

function createQuoteCard(index) {
  const article = document.createElement('article');
  article.className = 'quote-entry-card';
  article.dataset.quoteIndex = String(index);
  article.innerHTML = `
    <div class="quote-entry-header">
      <h3>${escapeHtml(t('contribute.quote_heading', { index: index + 1 }))}</h3>
      <button type="button" class="ghost-button quote-remove-button" data-role="remove-quote">${escapeHtml(t('contribute.quote_remove'))}</button>
    </div>
    <div class="contribution-grid">
      <div class="contribution-field contribution-field-wide">
        <label>${escapeHtml(t('contribute.quote_text_label'))}</label>
        <textarea name="quoteText" rows="4" maxlength="500" placeholder="${escapeHtml(t('contribute.quote_text_placeholder'))}" required></textarea>
      </div>
      <div class="contribution-field contribution-field-wide">
        <label>${escapeHtml(t('contribute.quote_themes_label'))}</label>
        <input name="themes" type="text" maxlength="240" placeholder="${escapeHtml(t('contribute.quote_themes_placeholder'))}">
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
      title.textContent = t('contribute.quote_heading', { index: index + 1 });
    }

    const removeButton = card.querySelector('[data-role="remove-quote"]');
    if (removeButton) {
      removeButton.textContent = t('contribute.quote_remove');
      removeButton.hidden = quoteList.children.length <= 1;
    }

    const quoteLabel = card.querySelector('label');
    const quoteTextarea = card.querySelector('textarea[name="quoteText"]');
    if (quoteLabel) quoteLabel.textContent = t('contribute.quote_text_label');
    if (quoteTextarea) quoteTextarea.placeholder = t('contribute.quote_text_placeholder');

    const themesLabel = card.querySelectorAll('label')[1];
    const themesInput = card.querySelector('input[name="themes"]');
    if (themesLabel) themesLabel.textContent = t('contribute.quote_themes_label');
    if (themesInput) themesInput.placeholder = t('contribute.quote_themes_placeholder');
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
    return error.details[0]?.msg || t('contribute.error_validation');
  }

  return error?.message || t('contribute.error_submit');
}

function formatCountLabel(count, singularKey, pluralKey) {
  const n = Number(count || 0);
  return n === 1 ? t(singularKey, { count: n }) : t(pluralKey, { count: n });
}

function renderExistingPortrait(profile) {
  if (profile?.portraitUrl) {
    return `
      <div class="philosopher-sigil philosopher-sigil-small philosopher-sigil-photo contribution-profile-sigil" aria-hidden="true">
        <img src="${profile.portraitUrl}" alt="${escapeHtml(t('contribute.portrait_alt', { name: profile.name }))}" loading="lazy">
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

  const display = localizeThinkerCard(profile, getUiLocale());
  const themeLabels = display.themeLabels?.length ? display.themeLabels : profile.themeLabels;

  existingThinkerPreview.hidden = false;
  existingThinkerPreview.innerHTML = `
    <div class="contribution-profile-preview-top">
      <div class="contribution-profile-preview-identity">
        ${renderExistingPortrait(profile)}
        <div>
          <p class="profile-eyebrow contribution-profile-preview-eyebrow">${escapeHtml(t('contribute.existing_eyebrow'))}</p>
          <h3>${escapeHtml(profile.name)}</h3>
          <p class="section-subtitle">${escapeHtml(display.period || t('contribute.existing_archive'))}</p>
        </div>
      </div>
      <a href="${profile.url}" class="profile-action-link profile-action-link-secondary contribution-preview-link">${escapeHtml(t('contribute.existing_open'))}</a>
    </div>
    <p class="contribution-profile-preview-summary">${escapeHtml(display.summary || profile.focus || t('contribute.existing_summary_fallback'))}</p>
    ${Array.isArray(themeLabels) && themeLabels.length
      ? `<div class="philosopher-chip-row">${themeLabels.slice(0, 3).map(label => `<span class="philosopher-chip">${escapeHtml(label)}</span>`).join('')}</div>`
      : ''}
    <div class="contribution-profile-preview-stats">
      <span>${escapeHtml(formatCountLabel(profile.quoteCount, 'contribute.existing_quotes_stat', 'contribute.existing_quotes_stat_plural'))}</span>
      <span>${escapeHtml(formatCountLabel(profile.linkedWorkCount, 'contribute.existing_works_stat', 'contribute.existing_works_stat_plural'))}</span>
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
    submitButton.textContent = isExistingMode ? t('contribute.publish_quotes') : t('contribute.publish_thinker');
  }

  if (quotesSectionSubtitle) {
    quotesSectionSubtitle.textContent = isExistingMode
      ? t('contribute.quotes_subtitle_existing')
      : t('contribute.quotes_subtitle_new');
  }

  if (addQuoteButton) {
    addQuoteButton.textContent = t('contribute.add_quote');
  }

  if (isExistingMode) {
    if (state.selectedExistingProfile) {
      setExistingFeedback(t('contribute.existing_found'), 'success');
      renderExistingPreview(state.selectedExistingProfile);
    } else if (state.existingProfilesReady) {
      setExistingFeedback(t('contribute.existing_select'), 'muted');
    } else {
      setExistingFeedback(t('contribute.existing_loading'), 'muted');
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
      <option value="${escapeHtml(profile.name)}">${escapeHtml(t('contribute.existing_quotes_option', { period: localizeThinkerCard(profile, getUiLocale()).period || t('contribute.existing_archive'), count: profile.quoteCount }))}</option>
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
      setExistingFeedback(t('contribute.existing_found'), 'success');
    }
    return;
  }

  clearExistingPreview();
}

async function loadExistingProfiles() {
  if (!existingThinkerInput) return;

  existingThinkerInput.disabled = true;
  setExistingFeedback(t('contribute.existing_loading'), 'muted');

  try {
    const locale = getUiLocale();
    const [quotes, philosopherDirectory, submittedProfiles] = await Promise.all([
      getQuoteCatalog(locale),
      getPhilosopherDirectory(),
      getSubmittedPhilosophers(),
    ]);

    const profiles = buildPhilosopherIndexProfiles(
      filterPhilosopherCatalogQuotes(quotes, locale),
      philosopherDirectory,
      submittedProfiles
    ).sort((a, b) => a.name.localeCompare(b.name));

    state.existingProfiles = profiles;
    state.existingLookup = buildExistingLookup(profiles);
    state.existingProfilesReady = true;

    renderExistingOptions(profiles);
    existingThinkerInput.disabled = false;

    if (state.mode === 'existing' && !state.selectedExistingProfile) {
      setExistingFeedback(t('contribute.existing_select_count', { count: profiles.length }), 'muted');
    }
  } catch (error) {
    existingThinkerInput.disabled = true;
    state.existingProfilesReady = false;
    setExistingFeedback(t('contribute.existing_load_error'), 'error');
  }
}

function syncExistingSelectionFromInput({ strict = false } = {}) {
  const query = existingThinkerInput?.value || '';
  if (!query.trim()) {
    state.selectedExistingProfile = null;
    clearExistingPreview();
    setExistingFeedback(
      state.existingProfilesReady
        ? t('contribute.existing_select')
        : t('contribute.existing_loading'),
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
      ? t('contribute.existing_type_strict')
      : t('contribute.existing_type_select'),
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
    setFeedback(t('contribute.error_choose_thinker'), 'error');
    return;
  }

  const payload = buildPayload(contributionForm);
  if (!payload.quotes.length) {
    setFeedback(t('contribute.error_one_quote'), 'error');
    return;
  }

  if (state.mode === 'new' && !payload.name) {
    setFeedback(t('contribute.error_name_quote'), 'error');
    return;
  }

  setPending(true);
  setFeedback(
    state.mode === 'existing'
      ? t('contribute.publishing_quotes')
      : t('contribute.publishing_thinker'),
    'muted'
  );

  try {
    const result = await submitPhilosopherContribution(payload);
    upsertExistingProfileOption(result.philosopher, result.createdQuotes);
    const title = state.mode === 'existing' ? t('contribute.success_quotes_title') : t('contribute.success_thinker_title');
    const copy = state.mode === 'existing'
      ? t('contribute.success_quotes_copy', {
        created: result.createdQuotes,
        name: result.philosopher.name,
        skipped: result.skippedQuotes,
      })
      : t('contribute.success_thinker_copy', {
        created: result.createdQuotes,
        skipped: result.skippedQuotes,
      });

    feedback.innerHTML = `
      <p class="contribution-feedback-title">${escapeHtml(title)}</p>
      <p>${escapeHtml(copy)}</p>
      <a class="profile-action-link profile-action-link-secondary" href="/html/philosopher.html?slug=${encodeURIComponent(result.philosopher.slug)}">${escapeHtml(t('contribute.success_open'))}</a>
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
  setupLanguageChrome();
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

window.addEventListener('philomedia:locale-changed', () => {
  updateModeCopy();
  syncQuoteLabels();
  if (state.selectedExistingProfile) {
    renderExistingPreview(state.selectedExistingProfile);
    renderExistingOptions(state.existingProfiles);
  }
});

init().catch(() => {
  setFeedback(t('contribute.error_load_page'), 'error');
});
