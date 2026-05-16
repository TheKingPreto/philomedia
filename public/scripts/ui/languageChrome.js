import { applyPageTranslations, t } from '/scripts/services/i18n.js';
import { getUiLocale, initDocumentLocale, normalizeUiLocale, setUiLocale } from '/scripts/services/uiLocale.js';

function syncLocaleButtons() {
  const loc = getUiLocale();
  document.querySelectorAll('.nav-locale [data-ui-lang]').forEach(btn => {
    const lang = btn.getAttribute('data-ui-lang');
    const normalized = lang === 'pt' ? 'pt' : 'en';
    btn.classList.toggle('is-active', normalized === loc);
    btn.setAttribute('aria-pressed', normalized === loc ? 'true' : 'false');
  });
}

/**
 * Injeta EN | PT no `<header><nav>` e recarrega a página ao trocar (estado global simples).
 */
export function setupLanguageChrome() {
  initDocumentLocale();

  const navs = document.querySelectorAll('header nav[aria-label="Primary"]');
  navs.forEach(nav => {
    if (nav.querySelector('.nav-locale')) {
      syncLocaleButtons();
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'nav-locale';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', t('nav.language'));

    const en = document.createElement('button');
    en.type = 'button';
    en.className = 'nav-locale-btn';
    en.setAttribute('data-ui-lang', 'en');
    en.setAttribute('aria-pressed', 'false');
    en.textContent = 'EN';

    const pt = document.createElement('button');
    pt.type = 'button';
    pt.className = 'nav-locale-btn';
    pt.setAttribute('data-ui-lang', 'pt');
    pt.setAttribute('aria-pressed', 'false');
    pt.textContent = 'PT';

    wrap.appendChild(en);
    wrap.appendChild(pt);
    nav.insertBefore(wrap, nav.firstChild);

    wrap.querySelectorAll('[data-ui-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = normalizeUiLocale(btn.getAttribute('data-ui-lang'));
        if (next === getUiLocale()) return;
        setUiLocale(next);
        syncLocaleButtons();
        window.location.reload();
      });
    });
  });

  syncLocaleButtons();
  applyPageTranslations(document);
}
