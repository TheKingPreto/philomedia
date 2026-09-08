/**
 * Runs in <head> (classic script) so documentElement.lang matches the stored
 * UI locale before first paint. Keep in sync with services/uiLocale.js.
 */
(function bootDocumentLang() {
  var STORAGE_KEY = 'philomedia_ui_lang';
  var loc = 'en';

  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt' || stored === 'en') {
      loc = stored;
    } else if (String(navigator.language || '').toLowerCase().indexOf('pt') === 0) {
      loc = 'pt';
    }
  } catch (_error) {
    /* private mode / blocked storage */
  }

  document.documentElement.lang = loc === 'pt' ? 'pt-BR' : 'en';
})();
