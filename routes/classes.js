const express = require('express');
const Class = require('../models/Class');
const Student = require('../models/Student');
const { auth } = require('../middleware/auth');
const { classValidation, paramValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/classes
// @desc    Get all classes for the professor
// @access  Private
router.get('/', auth, queryValidation.pagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const semester = req.query.semester;
        const year = req.query.year;

        let query = { professor: req.professorId };

        // Add search functionality
        if (search) {
            query.$or = [
                { className: { $regex: search, $options: 'i' } },
                { courseCode: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by semester
        if (semester) {
            query.semester = semester;
        }

        // Filter by year
        if (year) {
            query.year = parseInt(year);
        }

        const classes = await Class.find(query)
            .populate('enrolledStudents.student', 'firstName lastName studentId email')
            .sort({ year: -1, semester: 1, courseCode: 1 })
            .skip(skip)
            .limit(limit);

        const total = await Class.countDocuments(query);

        res.json({
            success: true,
            data: {
                classes,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get classes'
        });
    }
});

// @route   GET /api/classes/:id
// @desc    Get class by ID
// @access  Private
router.get('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const classDoc = await Class.findOne({
            _id: req.params.id,
            professor: req.professorId
        }).populate('enrolledStudents.student', 'firstName lastName studentId email phoneNumber academicInfo');

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.json({
            success: true,
            data: {
                class: classDoc
            }
        });
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get class'
        });
    }
});

// @route   POST /api/classes
// @desc    Create a new class
// @access  Private
router.post('/', auth, classValidation.create, async (req, res) => {
    try {
        // Check if course code already exists for this professor in the same semester and year
        const existingClass = await Class.findOne({
            professor: req.professorId,
            courseCode: req.body.courseCode.toUpperCase(),
            semester: req.body.semester,
            year: req.body.year
        });

        if (existingClass) {
            return res.status(400).json({
                success: false,
                message: 'A class with this course code already exists for this semester and year'
            });
        }

        const classData = {
            ...req.body,
            professor: req.professorId,
            courseCode: req.body.courseCode.toUpperCase()
        };

        const newClass = new Class(classData);
        await newClass.save();

        const populatedClass = await Class.findById(newClass._id)
            .populate('professor', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: {
                class: populatedClass
            }
        });
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create class'
        });
    }
});

// @route   PUT /api/classes/:id
// @desc    Update class by ID
// @access  Private
router.put('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const classDoc = await Class.findOneAndUpdate(
            { _id: req.params.id, professor: req.professorId },
            req.body,
            { new: true, runValidators: true }
        ).populate('enrolledStudents.student', 'firstName lastName studentId email');

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.json({
            success: true,
            message: 'Class updated successfully',
            data: {
                class: classDoc
            }
        });
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update class'
        });
    }
});

// @route   DELETE /api/classes/:id
// @desc    Delete class by ID (soft delete)
// @access  Private
router.delete('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const classDoc = await Class.findOneAndUpdate(
            { _id: req.params.id, professor: req.professorId },
            { isActive: false },
            { new: true }
        );

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.json({
            success: true,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete class'
        });
    }
});

// @route   POST /api/classes/:id/enroll
// @desc    Enroll a student in the class
// @access  Private
router.post('/:id/enroll', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        const classDoc = await Class.findOne({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // Check if class is full
        if (classDoc.currentEnrollment >= classDoc.maxEnrollment) {
            return res.status(400).json({
                success: false,
                message: 'Class is full'
            });
        }

        // Check if student exists
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Check if student is already enrolled
        const isEnrolled = classDoc.enrolledStudents.some(
            enrollment => enrollment.student.toString() === studentId && enrollment.status === 'enrolled'
        );

        if (isEnrolled) {
            return res.status(400).json({
                success: false,
                message: 'Student is already enrolled in this class'
            });
        }

        // Enroll the student
        classDoc.enrolledStudents.push({
            student: studentId,
            enrollmentDate: new Date(),
            status: 'enrolled'
        });

        await classDoc.save();

        const updatedClass = await Class.findById(classDoc._id)
            .populate('enrolledStudents.student', 'firstName lastName studentId email');

        res.json({
            success: true,
            message: 'Student enrolled successfully',
            data: {
                class: updatedClass
            }
        });
    } catch (error) {
        console.error('Enroll student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enroll student'
        });
    }
});

// @route   PUT /api/classes/:id/students/:studentId/status
// @desc    Update student enrollment status
// @access  Private
router.put('/:id/students/:studentId/status', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['enrolled', 'dropped', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be enrolled, dropped, or completed'
            });
        }

        const classDoc = await Class.findOne({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // Find and update student enrollment
        const enrollment = classDoc.enrolledStudents.find(
            e => e.student.toString() === req.params.studentId
        );

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'Student not found in this class'
            });
        }

        enrollment.status = status;
        await classDoc.save();

        const updatedClass = await Class.findById(classDoc._id)
            .populate('enrolledStudents.student', 'firstName lastName studentId email');

        res.json({
            success: true,
            message: 'Student status updated successfully',
            data: {
                class: updatedClass
            }
        });
    } catch (error) {
        console.error('Update student status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update student status'
        });
    }
});

// @route   POST /api/classes/:id/announcements
// @desc    Add announcement to class
// @access  Private
router.post('/:id/announcements', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const { title, content, priority, expiryDate } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        const classDoc = await Class.findOne({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        const announcement = {
            title: title.trim(),
            content: content.trim(),
            priority: priority || 'medium',
            publishDate: new Date()
        };

        if (expiryDate) {
            announcement.expiryDate = new Date(expiryDate);
        }

        classDoc.announcements.unshift(announcement);
        await classDoc.save();

        res.json({
            success: true,
            message: 'Announcement added successfully',
            data: {
                announcement: classDoc.announcements[0]
            }
        });
    } catch (error) {
        console.error('Add announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add announcement'
        });
    }
});

// @route   GET /api/classes/:id/roster
// @desc    Get class roster
// @access  Private
router.get('/:id/roster', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const classDoc = await Class.findOne({
            _id: req.params.id,
            professor: req.professorId
        }).populate('enrolledStudents.student', 'firstName lastName studentId email phoneNumber academicInfo');

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        const roster = classDoc.enrolledStudents
            .filter(enrollment => enrollment.status === 'enrolled')
            .map(enrollment => ({
                ...enrollment.student.toObject(),
                enrollmentDate: enrollment.enrollmentDate,
                status: enrollment.status
            }))
            .sort((a, b) => a.lastName.localeCompare(b.lastName));

        res.json({
            success: true,
            data: {
                roster,
                totalEnrolled: roster.length,
                maxEnrollment: classDoc.maxEnrollment,
                availableSpots: classDoc.availableSpots
            }
        });
    } catch (error) {
        console.error('Get roster error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get class roster'
        });
    }
});

module.exports = router;
