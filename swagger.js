import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PhiloMedia REST API',
      version: '1.0.0',
      description: 'A RESTful API for managing PhiloMedia philosophical Quotes and Curated Matches between media and philosophy.',
      contact: {
        name: 'PhiloMedia Support',
        url: 'https://philomedia.onrender.com', 
      },
    },
    servers: [
      {
        url: 'https://philomedia.onrender.com/api', 
        description: 'Production Server',
      },
      {
        url: 'http://localhost:3000/api', 
        description: 'Development Server',
      },
    ],
    components: {
      schemas: {
        Quote: {
          type: 'object',
          required: ['quoteText', 'authorName','themes'],
          properties: {
            quoteText: {
              type: 'string',
              description: 'The philosophical quote text.',
              example: 'The unexamined life is not worth living.',
            },
            authorName: {
              type: 'string',
              description: 'The author or philosopher of the quote.',
              example: 'Socrates',
            },
            themes: {
              type: 'array',
              items: { type: 'string' },
              description: 'An array of philosophical themes associated with the quote.',
              example: ['self-knowledge', 'wisdom'],
            },
          },
        },
        Match: {
          type: 'object',
          required: ['tmdbId', 'quoteId', 'mediaType'],
          properties: {
            tmdbId: {
              type: 'string',
              description: 'The unique ID of the movie, series, or anime (e.g., TMDB ID).',
              example: '157336', 
            },
            quoteId: {
              type: 'string',
              description: 'The ID of the custom quote to match with the media.',
              example: '66a1b0267f5e8254c25d81f2', 
            },
            mediaType: {
                type: 'string',
                enum: ['movie', 'tv', 'anime', 'unknown'],
                description: 'The type of media (e.g., movie, tv).',
                example: 'movie',
            }
          },
        },
      },
    },
    tags: [
      {
        name: 'Quotes',
        description: 'Endpoints to manage philosophical quotes',
      },
      {
        name: 'Matches',
        description: 'Endpoints to manage associations between media works and quotes',
      }
    ],
  },
  apis: ['./routes/*.js'],
};

export const specs = swaggerJsdoc(options);