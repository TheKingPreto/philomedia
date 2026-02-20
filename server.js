import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv'; 
import quoteRoutes from './src/routes/quotes.js';
import matchRoutes from './src/routes/matches.js';
import authRoutes from './src/routes/auth.js';
import tmdbRoutes from './src/routes/tmdb.js';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';

// Load environment file except during tests to avoid noisy tips/logs
if (process.env.NODE_ENV !== 'test') {
        dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

if (process.env.NODE_ENV !== 'test') {
        app.use(session({
                secret: process.env.SESSION_SECRET || 'change-me',
                resave: false,
                saveUninitialized: false,
                store: MongoStore.create({ mongoUrl: MONGODB_URI }),
                cookie: {
                        maxAge: 24 * 60 * 60 * 1000,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax'
                }
        }));

        app.use(passport.initialize());
        app.use(passport.session());

        // Dynamically load passport strategy setup so tests don't construct
        // OAuth strategies that require real environment variables.
        import('./config/passport.js').catch(err => console.error('Passport load error:', err));
} else {
        // During tests we don't initialize sessions or passport to avoid open handles
}

if (process.env.NODE_ENV !== 'test') {
        mongoose.connect(MONGODB_URI)
                .then(() => console.log('✅ Connected to MongoDB'))
                .catch(err => console.error('❌ MongoDB error:', err.message));
}

app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/', (req, res) => {
    res.send('Welcome to the PhiloMedia REST API! Check the documentation route for endpoints.');
});

app.use('/auth', authRoutes);

app.use('/api/quotes', quoteRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/tmdb', tmdbRoutes);

app.use((req, res, next) => {
        res.status(404).json({ 
                error: 'Not Found', 
                message: `The requested endpoint ${req.originalUrl} was not found on this server.` 
        });
});

app.use((err, req, res, next) => {
        console.error(err.stack);

        if (err.name === 'ValidationError') {
                const messages = Object.values(err.errors).map(val => val.message);
                return res.status(400).json({ 
                        error: 'Validation Error', 
                        messages: messages 
                });
        }

        if (err.name === 'CastError') {
                return res.status(400).json({ 
                        error: 'Invalid ID Format', 
                        message: `The ID provided is not valid: ${err.value}` 
                });
        }
        res.status(500).json({ 
                error: 'Internal Server Error', 
                message: 'Something went wrong on the server side. Check the logs.' 
        });
});

if (process.env.NODE_ENV !== 'test') {
        app.listen(PORT, () => {
                console.log(`PhiloMedia server running on: ${PORT}`);
        });
}

export default app;