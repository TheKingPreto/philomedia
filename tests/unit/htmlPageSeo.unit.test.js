import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const mockGetDetails = jest.fn();

await jest.unstable_mockModule('../../src/services/tmdbClient.js', () => ({
  getDetails: mockGetDetails,
}));

const {
  applyHtmlSeo,
  buildDetailsSeoPayload,
  serveDetailsHtml,
} = await import('../../src/services/htmlPageSeo.js');

describe('html page SEO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('applyHtmlSeo injects title, canonical, OG and JSON-LD', () => {
    const html = applyHtmlSeo(
      `<!DOCTYPE html><html lang="en"><head>
        <title>Old</title>
        <meta name="description" content="generic">
        <meta property="og:title" content="generic">
        <link rel="canonical" href="/html/details.html">
      </head><body></body></html>`,
      {
        title: 'Fight Club | PhiloMedia',
        description: 'An insomniac office worker...',
        canonical: 'https://philomedia.example/html/details.html?id=550&type=movie',
        image: 'https://image.tmdb.org/t/p/w780/poster.jpg',
        type: 'video.movie',
        locale: 'en',
        jsonLd: { '@type': 'Movie', name: 'Fight Club' },
      }
    );

    expect(html).toContain('<title>Fight Club | PhiloMedia</title>');
    expect(html).toContain('property="og:title" content="Fight Club | PhiloMedia"');
    expect(html).toContain('rel="canonical" href="https://philomedia.example/html/details.html?id=550&amp;type=movie"');
    expect(html).toContain('"@type":"Movie"');
    expect(html).toContain('Fight Club');
  });

  test('buildDetailsSeoPayload uses Movie vs TVSeries', () => {
    const movie = buildDetailsSeoPayload(
      { title: 'Fight Club', overview: 'An insomniac office worker.', poster_path: '/x.jpg' },
      { id: '550', mediaType: 'movie', locale: 'en', canonical: 'https://example.test/html/details.html?id=550&type=movie' }
    );
    expect(movie.jsonLd['@type']).toBe('Movie');
    expect(movie.title).toContain('Fight Club');

    const series = buildDetailsSeoPayload(
      { name: 'The Wire', overview: 'Baltimore.' },
      { id: '1438', mediaType: 'tv', locale: 'en', canonical: 'https://example.test/html/details.html?id=1438&type=tv' }
    );
    expect(series.jsonLd['@type']).toBe('TVSeries');
  });

  test('GET details.html?id=550&type=movie contains og:title with the movie name', async () => {
    mockGetDetails.mockResolvedValueOnce({
      id: 550,
      title: 'Fight Club',
      overview: 'An insomniac office worker and a devil-may-care soapmaker.',
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    });

    const app = express();
    app.get('/html/details.html', serveDetailsHtml);

    const response = await request(app).get('/html/details.html?id=550&type=movie');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Fight Club');
    expect(response.text).toMatch(/property="og:title"[^>]*Fight Club/);
    expect(mockGetDetails).toHaveBeenCalledWith('550', 'movie', { language: 'en-US' });
  });
});
