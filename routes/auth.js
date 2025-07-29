const express = require('express');
const jwt = require('jsonwebtoken');
const Professor = require('../models/Professor');
const { professorValidation } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new professor
// @access  Public
router.post('/register', authLimiter, professorValidation.register, async (req, res) => {
    try {
        const { firstName, lastName, email, password, department, phoneNumber, officeLocation, bio } = req.body;

        // Check if professor already exists
        const existingProfessor = await Professor.findOne({ email });
        if (existingProfessor) {
            return res.status(400).json({
                success: false,
                message: 'Professor with this email already exists'
            });
        }

        // Create new professor
        const professor = new Professor({
            firstName,
            lastName,
            email,
            password,
            department,
            phoneNumber,
            officeLocation,
            bio
        });

        await professor.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: professor._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            message: 'Professor registered successfully',
            data: {
                professor,
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register professor'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login professor
// @access  Public
router.post('/login', authLimiter, professorValidation.login, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if professor exists and get password
        const professor = await Professor.findOne({ email }).select('+password');
        if (!professor) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is active
        if (!professor.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Validate password
        const isValidPassword = await professor.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: professor._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Remove password from response
        professor.password = undefined;

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                professor,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to login'
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Initiate password reset process
// @access  Public
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        const professor = await Professor.findOne({ email });
        if (!professor) {
            return res.status(404).json({
                success: false,
                message: 'No professor found with this email address'
            });
        }

        // In a real application, you would send an email with a reset token
        // For now, we'll just return a success message
        res.json({
            success: true,
            message: 'Password reset instructions sent to your email'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request'
        });
    }
});

// @route   GET /api/auth/verify-token
// @desc    Verify if token is valid
// @access  Public
router.get('/verify-token', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const professor = await Professor.findById(decoded.id);

        if (!professor || !professor.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                professor
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

module.exports = router;
