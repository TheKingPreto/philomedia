import { jest } from '@jest/globals';
import {
  MAX_PORTRAIT_BYTES,
  fetchPortraitAsset,
  parsePortraitSource,
  readLimitedBody,
} from '../../src/services/remoteAssetProxy.js';

function mockStreamResponse(chunks, { ok = true, status = 200, headers = {} } = {}) {
  let index = 0;
  return {
    ok,
    status,
    headers: {
      get: (name) => headers[String(name).toLowerCase()] ?? headers[name] ?? null,
    },
    body: {
      getReader() {
        return {
          read: async () => {
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          },
          cancel: async () => {},
        };
      },
    },
    arrayBuffer: async () => Buffer.concat(chunks.map(chunk => Buffer.from(chunk))),
  };
}

describe('remoteAssetProxy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects hosts outside the portrait allowlist', () => {
    expect(parsePortraitSource('https://evil.example/a.jpg')).toMatchObject({ status: 403 });
    expect(parsePortraitSource('https://upload.wikimedia.org/foo.jpg').url.hostname)
      .toBe('upload.wikimedia.org');
    expect(parsePortraitSource('https://philosophersapi.com/face.jpg').url.hostname)
      .toBe('philosophersapi.com');
  });

  test('readLimitedBody returns 413 when the stream exceeds the cap', async () => {
    const tooBig = mockStreamResponse([
      Buffer.alloc(300 * 1024),
      Buffer.alloc(300 * 1024),
    ]);

    await expect(readLimitedBody(tooBig, MAX_PORTRAIT_BYTES)).rejects.toMatchObject({
      status: 413,
      code: 'payload_too_large',
    });
  });

  test('fetchPortraitAsset returns 413 when Content-Length is over the cap', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => (String(name).toLowerCase() === 'content-length' ? String(MAX_PORTRAIT_BYTES + 1) : null),
      },
      body: { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => {} }) },
      arrayBuffer: async () => Buffer.alloc(0),
    });

    await expect(
      fetchPortraitAsset('https://upload.wikimedia.org/wikipedia/commons/a.jpg')
    ).rejects.toMatchObject({ status: 413 });

    fetchSpy.mockRestore();
  });
});
