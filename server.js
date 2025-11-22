import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv'; 
import quoteRoutes from './routes/quotes.js';
import matchRoutes from './routes/matches.js';
import authRoutes from './routes/auth.js';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.js';
import session from 'express-session';
import passport from 'passport';
import './passport.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,              
    saveUninitialized: false,     
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
    }
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

app.listen(PORT, () => {
  console.log(`PhiloMedia server running on: ${PORT}`);
});


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