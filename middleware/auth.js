const jwt = require('jsonwebtoken');
const Professor = require('../models/Professor');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const professor = await Professor.findById(decoded.id);

        if (!professor) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Professor not found.'
            });
        }

        if (!professor.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        req.professor = professor;
        req.professorId = professor._id;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Optional auth middleware - doesn't require authentication but sets user if token is provided
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const professor = await Professor.findById(decoded.id);
            
            if (professor && professor.isActive) {
                req.professor = professor;
                req.professorId = professor._id;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
};

module.exports = { auth, optionalAuth };
