import { jest } from '@jest/globals';
import {
  fillPortraitHost,
  sanitizePortraitUrl,
} from '../../public/scripts/domain/safePortraitUrl.js';

describe('sanitizePortraitUrl', () => {
  test('aceita https de philosophersapi e wikimedia', () => {
    expect(sanitizePortraitUrl('https://philosophersapi.com/api/images/kant.jpg'))
      .toBe('https://philosophersapi.com/api/images/kant.jpg');
    expect(sanitizePortraitUrl('https://upload.wikimedia.org/wikipedia/commons/a/a2/x.jpg'))
      .toBe('https://upload.wikimedia.org/wikipedia/commons/a/a2/x.jpg');
  });

  test('aceita o proxy same-origin só com src wikimedia https', () => {
    const src = 'https://upload.wikimedia.org/wikipedia/commons/a/a2/x.jpg';
    expect(sanitizePortraitUrl(`/api/assets/portrait?src=${encodeURIComponent(src)}`))
      .toBe(`/api/assets/portrait?src=${encodeURIComponent(src)}`);
  });

  test('rejeita javascript, data, http e hosts fora da CSP', () => {
    expect(sanitizePortraitUrl('javascript:alert(1)')).toBe('');
    expect(sanitizePortraitUrl('data:image/svg+xml,<svg>')).toBe('');
    expect(sanitizePortraitUrl('http://philosophersapi.com/x.jpg')).toBe('');
    expect(sanitizePortraitUrl('https://evil.example/a.jpg')).toBe('');
    expect(sanitizePortraitUrl('https://upload.wikimedia.org.evil.com/x.jpg')).toBe('');
  });

  test('rejeita quebra de atributo no índice de pensadores', () => {
    const payload = 'https://philosophersapi.com/a" onerror="fetch(\'/api/me/library\')';
    const safe = sanitizePortraitUrl(payload);
    expect(safe).toBeTruthy();
    expect(safe).not.toMatch(/ onerror=/i);
    expect(safe.startsWith('https://philosophersapi.com/')).toBe(true);
  });

  test('rejeita proxy cujo src não é https permitido', () => {
    expect(sanitizePortraitUrl('/api/assets/portrait?src=javascript:alert(1)')).toBe('');
    expect(sanitizePortraitUrl('/api/assets/portrait?src=https://evil.example/x.jpg')).toBe('');
    expect(sanitizePortraitUrl('/html/philosophers.html')).toBe('');
  });
});

describe('fillPortraitHost', () => {
  test('aplica src via setAttribute e nunca interpola URL crua', () => {
    const host = {
      classList: { add: jest.fn(), remove: jest.fn() },
      textContent: 'XX',
      child: null,
      replaceChildren() {
        this.child = null;
        this.textContent = '';
      },
      appendChild(node) {
        this.child = node;
      },
    };

    const created = [];
    const originalCreate = global.document?.createElement;
    global.document = {
      createElement(tag) {
        const node = {
          tagName: tag,
          loading: '',
          decoding: '',
          attrs: {},
          setAttribute(name, value) {
            this.attrs[name] = value;
          },
        };
        created.push(node);
        return node;
      },
    };

    const ok = fillPortraitHost(host, {
      url: 'https://philosophersapi.com/face.jpg',
      alt: 'Kant',
      initials: 'IK',
    });

    expect(ok).toBe(true);
    expect(created[0].attrs.src).toBe('https://philosophersapi.com/face.jpg');
    expect(created[0].attrs.alt).toBe('Kant');
    expect(host.child).toBe(created[0]);

    const rejected = fillPortraitHost(host, {
      url: 'javascript:alert(1)',
      initials: 'IK',
    });
    expect(rejected).toBe(false);
    expect(host.textContent).toBe('IK');

    if (originalCreate) {
      global.document.createElement = originalCreate;
    } else {
      delete global.document;
    }
  });
});
