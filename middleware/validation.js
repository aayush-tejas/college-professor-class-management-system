const { body, param, query, validationResult } = require('express-validator');

// Validation result checker
const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Professor validation rules
const professorValidation = {
    register: [
        body('firstName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('First name must be between 2 and 50 characters'),
        body('lastName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Last name must be between 2 and 50 characters'),
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long'),
        body('department')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Department must be between 2 and 100 characters'),
        body('phoneNumber')
            .optional()
            .matches(/^\+?[\d\s\-\(\)]+$/)
            .withMessage('Please provide a valid phone number'),
        checkValidation
    ],
    
    login: [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
        checkValidation
    ],
    
    update: [
        body('firstName')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('First name must be between 2 and 50 characters'),
        body('lastName')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Last name must be between 2 and 50 characters'),
        body('department')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Department must be between 2 and 100 characters'),
        body('phoneNumber')
            .optional()
            .matches(/^\+?[\d\s\-\(\)]+$/)
            .withMessage('Please provide a valid phone number'),
        body('bio')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Bio cannot exceed 500 characters'),
        checkValidation
    ]
};

// Student validation rules
const studentValidation = {
    create: [
        body('studentId')
            .trim()
            .isLength({ min: 1, max: 20 })
            .withMessage('Student ID must be between 1 and 20 characters'),
        body('firstName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('First name must be between 2 and 50 characters'),
        body('lastName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Last name must be between 2 and 50 characters'),
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('phoneNumber')
            .optional()
            .matches(/^\+?[\d\s\-\(\)]+$/)
            .withMessage('Please provide a valid phone number'),
        body('dateOfBirth')
            .optional()
            .isISO8601()
            .withMessage('Please provide a valid date'),
        checkValidation
    ],
    
    update: [
        body('firstName')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('First name must be between 2 and 50 characters'),
        body('lastName')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Last name must be between 2 and 50 characters'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('phoneNumber')
            .optional()
            .matches(/^\+?[\d\s\-\(\)]+$/)
            .withMessage('Please provide a valid phone number'),
        body('dateOfBirth')
            .optional()
            .isISO8601()
            .withMessage('Please provide a valid date'),
        checkValidation
    ]
};

// Class validation rules
const classValidation = {
    create: [
        body('className')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Class name must be between 2 and 100 characters'),
        body('courseCode')
            .trim()
            .isLength({ min: 2, max: 20 })
            .withMessage('Course code must be between 2 and 20 characters'),
        body('semester')
            .isIn(['Fall', 'Spring', 'Summer', 'Winter'])
            .withMessage('Semester must be Fall, Spring, Summer, or Winter'),
        body('year')
            .isInt({ min: 2000, max: 2100 })
            .withMessage('Year must be between 2000 and 2100'),
        body('credits')
            .isInt({ min: 1, max: 10 })
            .withMessage('Credits must be between 1 and 10'),
        body('schedule.startTime')
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage('Start time must be in HH:MM format'),
        body('schedule.endTime')
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage('End time must be in HH:MM format'),
        body('maxEnrollment')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Max enrollment must be at least 1'),
        checkValidation
    ]
};

// Grade validation rules
const gradeValidation = {
    create: [
        body('student')
            .isMongoId()
            .withMessage('Valid student ID is required'),
        body('class')
            .isMongoId()
            .withMessage('Valid class ID is required'),
        body('assignment.name')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Assignment name must be between 1 and 100 characters'),
        body('assignment.type')
            .isIn(['homework', 'quiz', 'exam', 'project', 'participation', 'attendance', 'midterm', 'final'])
            .withMessage('Invalid assignment type'),
        body('assignment.maxPoints')
            .isFloat({ min: 0 })
            .withMessage('Maximum points must be at least 0'),
        body('score.points')
            .isFloat({ min: 0 })
            .withMessage('Points scored must be at least 0'),
        checkValidation
    ]
};

// Calendar event validation rules
const calendarValidation = {
    create: [
        body('title')
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Title must be between 1 and 200 characters'),
        body('eventType')
            .isIn(['lecture', 'exam', 'quiz', 'assignment_due', 'project_due', 'office_hours', 'meeting', 'conference', 'holiday', 'break', 'deadline', 'presentation', 'lab', 'seminar', 'workshop', 'other'])
            .withMessage('Invalid event type'),
        body('startDateTime')
            .isISO8601()
            .withMessage('Valid start date and time is required'),
        body('endDateTime')
            .isISO8601()
            .withMessage('Valid end date and time is required'),
        body('priority')
            .optional()
            .isIn(['low', 'medium', 'high', 'urgent'])
            .withMessage('Priority must be low, medium, high, or urgent'),
        body('color')
            .optional()
            .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
            .withMessage('Color must be a valid hex color'),
        checkValidation
    ]
};

// Parameter validation
const paramValidation = {
    mongoId: [
        param('id')
            .isMongoId()
            .withMessage('Invalid ID format'),
        checkValidation
    ]
};

// Query validation
const queryValidation = {
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        checkValidation
    ]
};

module.exports = {
    checkValidation,
    professorValidation,
    studentValidation,
    classValidation,
    gradeValidation,
    calendarValidation,
    paramValidation,
    queryValidation
};
