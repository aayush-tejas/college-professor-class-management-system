const express = require('express');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { auth } = require('../middleware/auth');
const { studentValidation, paramValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/students
// @desc    Get all students (with pagination and search)
// @access  Private
router.get('/', auth, queryValidation.pagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const classId = req.query.classId;

        let query = {};

        // If classId is provided, filter students enrolled in that class
        if (classId) {
            const classDoc = await Class.findOne({ 
                _id: classId, 
                professor: req.professorId 
            });
            
            if (!classDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Class not found'
                });
            }

            const enrolledStudentIds = classDoc.enrolledStudents
                .filter(enrollment => enrollment.status === 'enrolled')
                .map(enrollment => enrollment.student);
            
            query._id = { $in: enrolledStudentIds };
        } else {
            // If no classId, get all students from professor's classes
            const professorClasses = await Class.find({ 
                professor: req.professorId 
            });
            
            const allStudentIds = professorClasses.reduce((acc, cls) => {
                const enrolledIds = cls.enrolledStudents
                    .filter(enrollment => enrollment.status === 'enrolled')
                    .map(enrollment => enrollment.student);
                acc.push(...enrolledIds);
                return acc;
            }, []);
            
            const uniqueStudentIds = [...new Set(allStudentIds.map(id => id.toString()))];
            query._id = { $in: uniqueStudentIds };
        }

        // Add search functionality
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await Student.find(query)
            .sort({ lastName: 1, firstName: 1 })
            .skip(skip)
            .limit(limit);

        const total = await Student.countDocuments(query);

        res.json({
            success: true,
            data: {
                students,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get students'
        });
    }
});

// @route   GET /api/students/:id
// @desc    Get student by ID
// @access  Private
router.get('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Check if professor has access to this student
        const professorClasses = await Class.find({ professor: req.professorId });
        const hasAccess = professorClasses.some(cls => 
            cls.enrolledStudents.some(enrollment => 
                enrollment.student.toString() === req.params.id && 
                enrollment.status === 'enrolled'
            )
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this student'
            });
        }

        res.json({
            success: true,
            data: {
                student
            }
        });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get student'
        });
    }
});

// @route   POST /api/students
// @desc    Create a new student
// @access  Private
router.post('/', auth, studentValidation.create, async (req, res) => {
    try {
        // Check if student ID already exists
        const existingStudent = await Student.findOne({ studentId: req.body.studentId });
        if (existingStudent) {
            return res.status(400).json({
                success: false,
                message: 'Student with this ID already exists'
            });
        }

        // Check if email already exists
        const existingEmail = await Student.findOne({ email: req.body.email });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Student with this email already exists'
            });
        }

        const student = new Student(req.body);
        await student.save();

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: {
                student
            }
        });
    } catch (error) {
        console.error('Create student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create student'
        });
    }
});

// @route   PUT /api/students/:id
// @desc    Update student by ID
// @access  Private
router.put('/:id', auth, paramValidation.mongoId, studentValidation.update, async (req, res) => {
    try {
        // Check if professor has access to this student
        const professorClasses = await Class.find({ professor: req.professorId });
        const hasAccess = professorClasses.some(cls => 
            cls.enrolledStudents.some(enrollment => 
                enrollment.student.toString() === req.params.id && 
                enrollment.status === 'enrolled'
            )
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to update this student'
            });
        }

        const student = await Student.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.json({
            success: true,
            message: 'Student updated successfully',
            data: {
                student
            }
        });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update student'
        });
    }
});

// @route   DELETE /api/students/:id
// @desc    Delete student by ID (soft delete)
// @access  Private
router.delete('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        // Check if professor has access to this student
        const professorClasses = await Class.find({ professor: req.professorId });
        const hasAccess = professorClasses.some(cls => 
            cls.enrolledStudents.some(enrollment => 
                enrollment.student.toString() === req.params.id && 
                enrollment.status === 'enrolled'
            )
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to delete this student'
            });
        }

        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.json({
            success: true,
            message: 'Student deleted successfully'
        });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete student'
        });
    }
});

// @route   POST /api/students/:id/notes
// @desc    Add note to student
// @access  Private
router.post('/:id/notes', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Note content is required'
            });
        }

        // Check if professor has access to this student
        const professorClasses = await Class.find({ professor: req.professorId });
        const hasAccess = professorClasses.some(cls => 
            cls.enrolledStudents.some(enrollment => 
                enrollment.student.toString() === req.params.id && 
                enrollment.status === 'enrolled'
            )
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to add notes to this student'
            });
        }

        const student = await Student.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    notes: {
                        content: content.trim(),
                        createdBy: req.professorId,
                        createdAt: new Date()
                    }
                }
            },
            { new: true }
        ).populate('notes.createdBy', 'firstName lastName');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.json({
            success: true,
            message: 'Note added successfully',
            data: {
                student
            }
        });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add note'
        });
    }
});

// @route   GET /api/students/:id/grades
// @desc    Get student's grades
// @access  Private
router.get('/:id/grades', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const Grade = require('../models/Grade');
        
        // Check if professor has access to this student
        const professorClasses = await Class.find({ professor: req.professorId });
        const hasAccess = professorClasses.some(cls => 
            cls.enrolledStudents.some(enrollment => 
                enrollment.student.toString() === req.params.id && 
                enrollment.status === 'enrolled'
            )
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to view grades for this student'
            });
        }

        const grades = await Grade.find({
            student: req.params.id,
            professor: req.professorId
        })
        .populate('class', 'className courseCode')
        .sort({ 'assignment.dueDate': -1, createdAt: -1 });

        res.json({
            success: true,
            data: {
                grades
            }
        });
    } catch (error) {
        console.error('Get student grades error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get student grades'
        });
    }
});

module.exports = router;
