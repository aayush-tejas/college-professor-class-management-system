const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const professorRoutes = require('./routes/professors');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const calendarRoutes = require('./routes/calendar');
const gradeRoutes = require('./routes/grades');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { limiter } = require('./middleware/rateLimiter');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
            fontSrc: ["'self'", "https:", "data:"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true
    } : false
}));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? [process.env.FRONTEND_URL || 'https://your-domain.com'] : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve from both root and public directories
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Connected to MongoDB successfully');
})
.catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/professors', professorRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/import', require('./routes/import'));

// Serve the main index.html file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Test data initialization endpoint
app.post('/api/test/init', async (req, res) => {
    try {
        const Professor = require('./models/Professor');
        const Student = require('./models/Student');
        const Class = require('./models/Class');
        const Grade = require('./models/Grade');
        const CalendarEvent = require('./models/CalendarEvent');

        // Check if test professor already exists
        let testProfessor = await Professor.findOne({ email: 'test@professor.com' });
        
        if (!testProfessor) {
            // Create test professor
            testProfessor = new Professor({
                firstName: 'Dr. John',
                lastName: 'Smith',
                email: 'test@professor.com',
                password: 'test123',
                department: 'Computer Science',
                phoneNumber: '+1-555-0123',
                officeLocation: 'Science Building Room 301',
                bio: 'Professor of Computer Science with 15 years of experience in software engineering and web development.'
            });
            await testProfessor.save();
        }

        // Create test students
        const testStudents = [
            {
                studentId: 'CS001',
                firstName: 'Alice',
                lastName: 'Johnson',
                email: 'alice.johnson@student.edu',
                phoneNumber: '+1-555-0101',
                academicInfo: {
                    major: 'Computer Science',
                    year: 'Junior',
                    gpa: 3.8
                }
            },
            {
                studentId: 'CS002',
                firstName: 'Bob',
                lastName: 'Williams',
                email: 'bob.williams@student.edu',
                phoneNumber: '+1-555-0102',
                academicInfo: {
                    major: 'Computer Science',
                    year: 'Senior',
                    gpa: 3.6
                }
            },
            {
                studentId: 'CS003',
                firstName: 'Carol',
                lastName: 'Brown',
                email: 'carol.brown@student.edu',
                phoneNumber: '+1-555-0103',
                academicInfo: {
                    major: 'Information Systems',
                    year: 'Sophomore',
                    gpa: 3.9
                }
            }
        ];

        const students = [];
        for (const studentData of testStudents) {
            let student = await Student.findOne({ studentId: studentData.studentId });
            if (!student) {
                student = new Student(studentData);
                await student.save();
            }
            students.push(student);
        }

        // Create test classes
        const testClasses = [
            {
                className: 'Web Development Fundamentals',
                courseCode: 'CS101',
                description: 'Introduction to web development using HTML, CSS, JavaScript, and modern frameworks.',
                professor: testProfessor._id,
                semester: 'Fall',
                year: 2025,
                credits: 3,
                schedule: {
                    days: ['Monday', 'Wednesday', 'Friday'],
                    startTime: '09:00',
                    endTime: '10:30',
                    location: {
                        building: 'Science Building',
                        room: '201',
                        campus: 'Main Campus'
                    }
                },
                maxEnrollment: 30
            },
            {
                className: 'Database Systems',
                courseCode: 'CS201',
                description: 'Comprehensive study of database design, implementation, and management.',
                professor: testProfessor._id,
                semester: 'Fall',
                year: 2025,
                credits: 4,
                schedule: {
                    days: ['Tuesday', 'Thursday'],
                    startTime: '14:00',
                    endTime: '16:00',
                    location: {
                        building: 'Science Building',
                        room: '301',
                        campus: 'Main Campus'
                    }
                },
                maxEnrollment: 25
            }
        ];

        const classes = [];
        for (const classData of testClasses) {
            let classDoc = await Class.findOne({ 
                courseCode: classData.courseCode,
                professor: testProfessor._id,
                semester: classData.semester,
                year: classData.year
            });
            
            if (!classDoc) {
                classDoc = new Class(classData);
                // Enroll test students
                classDoc.enrolledStudents = students.map(student => ({
                    student: student._id,
                    enrollmentDate: new Date(),
                    status: 'enrolled'
                }));
                await classDoc.save();
            }
            classes.push(classDoc);
        }

        // Create test grades
        const testGrades = [
            // CS101 grades
            {
                student: students[0]._id,
                class: classes[0]._id,
                professor: testProfessor._id,
                assignment: {
                    name: 'HTML/CSS Project',
                    type: 'project',
                    maxPoints: 100,
                    dueDate: new Date('2025-09-15')
                },
                score: {
                    points: 95
                },
                feedback: {
                    comments: 'Excellent work on the layout and styling!'
                }
            },
            {
                student: students[1]._id,
                class: classes[0]._id,
                professor: testProfessor._id,
                assignment: {
                    name: 'HTML/CSS Project',
                    type: 'project',
                    maxPoints: 100,
                    dueDate: new Date('2025-09-15')
                },
                score: {
                    points: 88
                },
                feedback: {
                    comments: 'Good work, but could improve on responsive design.'
                }
            },
            // CS201 grades
            {
                student: students[0]._id,
                class: classes[1]._id,
                professor: testProfessor._id,
                assignment: {
                    name: 'Database Design Quiz',
                    type: 'quiz',
                    maxPoints: 50,
                    dueDate: new Date('2025-09-10')
                },
                score: {
                    points: 47
                },
                feedback: {
                    comments: 'Strong understanding of normalization concepts.'
                }
            }
        ];

        for (const gradeData of testGrades) {
            const existingGrade = await Grade.findOne({
                student: gradeData.student,
                class: gradeData.class,
                'assignment.name': gradeData.assignment.name
            });

            if (!existingGrade) {
                const grade = new Grade(gradeData);
                await grade.save();
            }
        }

        // Create test calendar events
        const testEvents = [
            {
                title: 'CS101 - Web Development Lecture',
                description: 'Introduction to JavaScript DOM manipulation',
                professor: testProfessor._id,
                class: classes[0]._id,
                eventType: 'lecture',
                startDateTime: new Date('2025-08-01T09:00:00'),
                endDateTime: new Date('2025-08-01T10:30:00'),
                location: {
                    building: 'Science Building',
                    room: '201'
                }
            },
            {
                title: 'CS201 - Database Midterm Exam',
                description: 'Midterm examination covering database design and SQL',
                professor: testProfessor._id,
                class: classes[1]._id,
                eventType: 'exam',
                startDateTime: new Date('2025-08-15T14:00:00'),
                endDateTime: new Date('2025-08-15T16:00:00'),
                priority: 'high',
                color: '#dc3545'
            },
            {
                title: 'Office Hours',
                description: 'Available for student consultations',
                professor: testProfessor._id,
                eventType: 'office_hours',
                startDateTime: new Date('2025-08-02T15:00:00'),
                endDateTime: new Date('2025-08-02T17:00:00'),
                recurrence: {
                    isRecurring: true,
                    pattern: 'weekly',
                    daysOfWeek: ['Tuesday', 'Thursday']
                }
            }
        ];

        for (const eventData of testEvents) {
            const existingEvent = await CalendarEvent.findOne({
                title: eventData.title,
                professor: testProfessor._id,
                startDateTime: eventData.startDateTime
            });

            if (!existingEvent) {
                const event = new CalendarEvent(eventData);
                await event.save();
            }
        }

        res.json({
            success: true,
            message: 'Test data initialized successfully',
            data: {
                professor: {
                    email: 'test@professor.com',
                    password: 'test123'
                },
                studentsCreated: students.length,
                classesCreated: classes.length,
                gradesCreated: testGrades.length,
                eventsCreated: testEvents.length
            }
        });

    } catch (error) {
        console.error('Test data initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize test data',
            error: error.message
        });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Error handling middleware
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Unhandled Rejection: ${err.message}`);
    // In production, don't crash the server
    if (process.env.NODE_ENV !== 'production') {
        // Close server & exit process in development for immediate attention
        server.close(() => {
            process.exit(1);
        });
    }
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

module.exports = app;
