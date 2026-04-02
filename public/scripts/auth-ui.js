const SESSION_ENDPOINT = '/auth/session';

let cachedSession = null;
let inflightSessionRequest = null;

export async function getSession({ force = false } = {}) {
  if (!force && cachedSession) {
    return cachedSession;
  }

  if (!force && inflightSessionRequest) {
    return inflightSessionRequest;
  }

  inflightSessionRequest = fetch(SESSION_ENDPOINT, {
    credentials: 'same-origin',
  })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          authenticated: false,
          oauthEnabled: false,
          user: null,
          error: payload.error || 'Session unavailable',
        };
      }

      return {
        authenticated: Boolean(payload.authenticated),
        oauthEnabled: Boolean(payload.oauthEnabled),
        user: payload.user || null,
      };
    })
    .catch(() => ({
      authenticated: false,
      oauthEnabled: false,
      user: null,
      error: 'Session unavailable',
    }))
    .finally(() => {
      inflightSessionRequest = null;
    });

  cachedSession = await inflightSessionRequest;
  return cachedSession;
}

export async function refreshSession() {
  cachedSession = null;
  return getSession({ force: true });
}

export function redirectToLogin() {
  window.location.href = '/auth/google';
}

function createNavLink({ href, text, dataRole }) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  if (dataRole) {
    link.dataset.authRole = dataRole;
  }
  return link;
}

function createChipLink({ href, text, className }) {
  const link = document.createElement('a');
  link.href = href;
  link.className = className;
  link.textContent = text;
  return link;
}

function createTextChip(text, className) {
  const chip = document.createElement('span');
  chip.className = className;
  chip.textContent = text;
  return chip;
}

export function getFirstName(displayName = '') {
  return displayName.trim().split(/\s+/)[0] || 'Account';
}

export async function setupAuthUI() {
  const nav = document.querySelector('header nav');
  if (!nav) return null;

  const authSlot = document.getElementById('nav-auth-slot') || document.createElement('span');
  authSlot.id = 'nav-auth-slot';
  authSlot.className = 'nav-auth-slot';
  if (!authSlot.parentElement) {
    nav.appendChild(authSlot);
  }

  const libraryLink = nav.querySelector('[data-auth-link="library"]');
  const session = await getSession();

  if (libraryLink) {
    libraryLink.hidden = !session.authenticated;
  }

  authSlot.innerHTML = '';

  if (session.authenticated && session.user) {
    authSlot.appendChild(
      createNavLink({
        href: '/html/contribute.html',
        text: 'Contribute',
        dataRole: 'contribute',
      })
    );
    authSlot.appendChild(
      createChipLink({
        href: '/html/profile.html',
        text: getFirstName(session.user.displayName),
        className: 'nav-user-chip',
      })
    );
    authSlot.appendChild(
      createNavLink({
        href: '/auth/logout',
        text: 'Logout',
        dataRole: 'logout',
      })
    );
    return session;
  }

  if (session.oauthEnabled) {
    authSlot.appendChild(
      createNavLink({
        href: '/auth/google',
        text: 'Login',
        dataRole: 'login',
      })
    );
    return session;
  }

  authSlot.appendChild(
    createTextChip('Login unavailable', 'nav-muted-chip')
  );
  return session;
}
