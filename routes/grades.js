const express = require('express');
const Grade = require('../models/Grade');
const Class = require('../models/Class');
const Student = require('../models/Student');
const { auth } = require('../middleware/auth');
const { gradeValidation, paramValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/grades
// @desc    Get all grades with filtering
// @access  Private
router.get('/', auth, queryValidation.pagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const classId = req.query.classId;
        const studentId = req.query.studentId;
        const assignmentType = req.query.assignmentType;

        let query = { professor: req.professorId };

        // Filter by class
        if (classId) {
            query.class = classId;
        }

        // Filter by student
        if (studentId) {
            query.student = studentId;
        }

        // Filter by assignment type
        if (assignmentType) {
            query['assignment.type'] = assignmentType;
        }

        const grades = await Grade.find(query)
            .populate('student', 'firstName lastName studentId')
            .populate('class', 'className courseCode')
            .sort({ 'assignment.dueDate': -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Grade.countDocuments(query);

        res.json({
            success: true,
            data: {
                grades,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Get grades error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get grades'
        });
    }
});

// @route   GET /api/grades/:id
// @desc    Get grade by ID
// @access  Private
router.get('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const grade = await Grade.findOne({
            _id: req.params.id,
            professor: req.professorId
        })
        .populate('student', 'firstName lastName studentId email')
        .populate('class', 'className courseCode semester year');

        if (!grade) {
            return res.status(404).json({
                success: false,
                message: 'Grade not found'
            });
        }

        res.json({
            success: true,
            data: {
                grade
            }
        });
    } catch (error) {
        console.error('Get grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get grade'
        });
    }
});

// @route   POST /api/grades
// @desc    Create a new grade
// @access  Private
router.post('/', auth, gradeValidation.create, async (req, res) => {
    try {
        // Verify the class belongs to the professor
        const classDoc = await Class.findOne({
            _id: req.body.class,
            professor: req.professorId
        });

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // Verify the student is enrolled in the class
        const isEnrolled = classDoc.enrolledStudents.some(
            enrollment => enrollment.student.toString() === req.body.student && 
            enrollment.status === 'enrolled'
        );

        if (!isEnrolled) {
            return res.status(400).json({
                success: false,
                message: 'Student is not enrolled in this class'
            });
        }

        // Check if grade already exists for this assignment
        const existingGrade = await Grade.findOne({
            student: req.body.student,
            class: req.body.class,
            'assignment.name': req.body.assignment.name
        });

        if (existingGrade) {
            return res.status(400).json({
                success: false,
                message: 'Grade already exists for this assignment'
            });
        }

        const gradeData = {
            ...req.body,
            professor: req.professorId
        };

        const grade = new Grade(gradeData);
        await grade.save();

        const populatedGrade = await Grade.findById(grade._id)
            .populate('student', 'firstName lastName studentId')
            .populate('class', 'className courseCode');

        res.status(201).json({
            success: true,
            message: 'Grade created successfully',
            data: {
                grade: populatedGrade
            }
        });
    } catch (error) {
        console.error('Create grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create grade'
        });
    }
});

// @route   PUT /api/grades/:id
// @desc    Update grade by ID
// @access  Private
router.put('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const grade = await Grade.findOneAndUpdate(
            { _id: req.params.id, professor: req.professorId },
            req.body,
            { new: true, runValidators: true }
        )
        .populate('student', 'firstName lastName studentId')
        .populate('class', 'className courseCode');

        if (!grade) {
            return res.status(404).json({
                success: false,
                message: 'Grade not found'
            });
        }

        res.json({
            success: true,
            message: 'Grade updated successfully',
            data: {
                grade
            }
        });
    } catch (error) {
        console.error('Update grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update grade'
        });
    }
});

// @route   DELETE /api/grades/:id
// @desc    Delete grade by ID
// @access  Private
router.delete('/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const grade = await Grade.findOneAndDelete({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!grade) {
            return res.status(404).json({
                success: false,
                message: 'Grade not found'
            });
        }

        res.json({
            success: true,
            message: 'Grade deleted successfully'
        });
    } catch (error) {
        console.error('Delete grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete grade'
        });
    }
});

// @route   GET /api/grades/class/:classId/summary
// @desc    Get grade summary for a class
// @access  Private
router.get('/class/:classId/summary', auth, paramValidation.mongoId, async (req, res) => {
    try {
        // Verify the class belongs to the professor
        const classDoc = await Class.findOne({
            _id: req.params.classId,
            professor: req.professorId
        });

        if (!classDoc) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        const grades = await Grade.find({
            class: req.params.classId,
            professor: req.professorId
        })
        .populate('student', 'firstName lastName studentId')
        .sort({ 'student.lastName': 1, 'assignment.dueDate': 1 });

        // Group grades by student
        const studentGrades = {};
        grades.forEach(grade => {
            const studentId = grade.student._id.toString();
            if (!studentGrades[studentId]) {
                studentGrades[studentId] = {
                    student: grade.student,
                    grades: [],
                    totalPoints: 0,
                    maxTotalPoints: 0,
                    percentage: 0
                };
            }
            studentGrades[studentId].grades.push(grade);
            if (!grade.isExcused && !grade.isExtra) {
                studentGrades[studentId].totalPoints += grade.score.points;
                studentGrades[studentId].maxTotalPoints += grade.assignment.maxPoints;
            }
        });

        // Calculate final percentages
        Object.values(studentGrades).forEach(student => {
            if (student.maxTotalPoints > 0) {
                student.percentage = Math.round((student.totalPoints / student.maxTotalPoints) * 100 * 100) / 100;
            }
        });

        // Calculate class statistics
        const percentages = Object.values(studentGrades).map(s => s.percentage).filter(p => p > 0);
        const classAverage = percentages.length > 0 ? 
            Math.round((percentages.reduce((sum, p) => sum + p, 0) / percentages.length) * 100) / 100 : 0;

        const statistics = {
            totalStudents: Object.keys(studentGrades).length,
            totalGrades: grades.length,
            classAverage,
            highestGrade: percentages.length > 0 ? Math.max(...percentages) : 0,
            lowestGrade: percentages.length > 0 ? Math.min(...percentages) : 0
        };

        res.json({
            success: true,
            data: {
                studentGrades: Object.values(studentGrades),
                statistics
            }
        });
    } catch (error) {
        console.error('Get grade summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get grade summary'
        });
    }
});

// @route   GET /api/grades/student/:studentId/summary
// @desc    Get grade summary for a student
// @access  Private
router.get('/student/:studentId/summary', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const grades = await Grade.find({
            student: req.params.studentId,
            professor: req.professorId
        })
        .populate('class', 'className courseCode semester year')
        .sort({ 'assignment.dueDate': -1 });

        if (grades.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No grades found for this student'
            });
        }

        // Group grades by class
        const classSummaries = {};
        grades.forEach(grade => {
            const classId = grade.class._id.toString();
            if (!classSummaries[classId]) {
                classSummaries[classId] = {
                    class: grade.class,
                    grades: [],
                    totalPoints: 0,
                    maxTotalPoints: 0,
                    percentage: 0
                };
            }
            classSummaries[classId].grades.push(grade);
            if (!grade.isExcused && !grade.isExtra) {
                classSummaries[classId].totalPoints += grade.score.points;
                classSummaries[classId].maxTotalPoints += grade.assignment.maxPoints;
            }
        });

        // Calculate percentages for each class
        Object.values(classSummaries).forEach(classSum => {
            if (classSum.maxTotalPoints > 0) {
                classSum.percentage = Math.round((classSum.totalPoints / classSum.maxTotalPoints) * 100 * 100) / 100;
            }
        });

        res.json({
            success: true,
            data: {
                classSummaries: Object.values(classSummaries),
                totalGrades: grades.length
            }
        });
    } catch (error) {
        console.error('Get student grade summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get student grade summary'
        });
    }
});

// @route   POST /api/grades/bulk
// @desc    Create multiple grades at once
// @access  Private
router.post('/bulk', auth, async (req, res) => {
    try {
        const { grades } = req.body;

        if (!grades || !Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Grades array is required'
            });
        }

        // Validate each grade and add professor ID
        const validatedGrades = grades.map(grade => ({
            ...grade,
            professor: req.professorId
        }));

        // Insert all grades
        const createdGrades = await Grade.insertMany(validatedGrades, { ordered: false });

        res.status(201).json({
            success: true,
            message: `${createdGrades.length} grades created successfully`,
            data: {
                grades: createdGrades
            }
        });
    } catch (error) {
        console.error('Bulk create grades error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create grades in bulk'
        });
    }
});

module.exports = router;
