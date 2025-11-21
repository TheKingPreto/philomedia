import { Router } from 'express';
import passport from 'passport';

const authRouter = Router();

authRouter.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/', 
    successRedirect: '/auth/profile', 
  })
);

authRouter.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { 
            console.error('Logout error:', err);
            return next(err); 
        }
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return next(err);
            }
            res.redirect('/'); 
        });
    });
});

authRouter.get('/profile', (req, res) => {
    if (req.isAuthenticated()) {
        res.status(200).json({ 
            message: 'Successfully logged in!', 
            user: { 
                id: req.user.id, 
                displayName: req.user.displayName, 
            }
        });
    } else {
        res.status(401).json({ message: 'User not authenticated. Please log in.' });
    }
});


export default authRouter;