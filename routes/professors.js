const express = require('express');
const Professor = require('../models/Professor');
const { auth } = require('../middleware/auth');
const { professorValidation, paramValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/professors/profile
// @desc    Get current professor's profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const professor = await Professor.findById(req.professorId);
        
        res.json({
            success: true,
            data: {
                professor
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get professor profile'
        });
    }
});

// @route   PUT /api/professors/profile
// @desc    Update current professor's profile
// @access  Private
router.put('/profile', auth, professorValidation.update, async (req, res) => {
    try {
        const allowedUpdates = [
            'firstName', 'lastName', 'department', 'phoneNumber', 
            'officeLocation', 'bio', 'preferences'
        ];
        
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        const professor = await Professor.findByIdAndUpdate(
            req.professorId,
            updates,
            { new: true, runValidators: true }
        );

        if (!professor) {
            return res.status(404).json({
                success: false,
                message: 'Professor not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                professor
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update professor profile'
        });
    }
});

// @route   PUT /api/professors/preferences
// @desc    Update professor preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
    try {
        const { theme, notifications, gradeScale } = req.body;
        
        const updateData = {};
        if (theme) updateData['preferences.theme'] = theme;
        if (notifications) updateData['preferences.notifications'] = notifications;
        if (gradeScale) updateData['preferences.gradeScale'] = gradeScale;

        const professor = await Professor.findByIdAndUpdate(
            req.professorId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!professor) {
            return res.status(404).json({
                success: false,
                message: 'Professor not found'
            });
        }

        res.json({
            success: true,
            message: 'Preferences updated successfully',
            data: {
                preferences: professor.preferences
            }
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update preferences'
        });
    }
});

// @route   POST /api/professors/change-password
// @desc    Change professor password
// @access  Private
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get professor with password
        const professor = await Professor.findById(req.professorId).select('+password');
        
        // Verify current password
        const isValidPassword = await professor.comparePassword(currentPassword);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        professor.password = newPassword;
        await professor.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

// @route   DELETE /api/professors/account
// @desc    Deactivate professor account
// @access  Private
router.delete('/account', auth, async (req, res) => {
    try {
        const professor = await Professor.findByIdAndUpdate(
            req.professorId,
            { isActive: false },
            { new: true }
        );

        if (!professor) {
            return res.status(404).json({
                success: false,
                message: 'Professor not found'
            });
        }

        res.json({
            success: true,
            message: 'Account deactivated successfully'
        });
    } catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate account'
        });
    }
});

// @route   GET /api/professors/stats
// @desc    Get professor statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const Class = require('../models/Class');
        const Student = require('../models/Student');
        const Grade = require('../models/Grade');
        const CalendarEvent = require('../models/CalendarEvent');

        // Get professor's classes
        const classes = await Class.find({ professor: req.professorId, isActive: true });
        const classIds = classes.map(c => c._id);

        // Count total students across all classes
        const totalStudents = await Student.countDocuments({
            '_id': { 
                $in: classes.reduce((acc, cls) => {
                    acc.push(...cls.enrolledStudents.filter(e => e.status === 'enrolled').map(e => e.student));
                    return acc;
                }, [])
            }
        });

        // Count total grades given
        const totalGrades = await Grade.countDocuments({
            professor: req.professorId
        });

        // Count upcoming events
        const upcomingEvents = await CalendarEvent.countDocuments({
            professor: req.professorId,
            startDateTime: { $gte: new Date() },
            status: 'scheduled'
        });

        res.json({
            success: true,
            data: {
                totalClasses: classes.length,
                totalStudents,
                totalGrades,
                upcomingEvents,
                activeClasses: classes.filter(c => c.isActive).length
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get statistics'
        });
    }
});

module.exports = router;
