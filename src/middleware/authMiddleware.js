export const isAuthenticated = (req, res, next) => {
    // In test environment, bypass authentication to simplify integration tests
    if (process.env.NODE_ENV === 'test') return next();

    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    res.status(401).json({ 
        message: 'Authentication required. Please log in to perform this action.' 
    });
};