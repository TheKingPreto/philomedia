export const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    
    res.status(401).json({ 
        message: 'Authentication required. Please log in to perform this action.' 
    });
};