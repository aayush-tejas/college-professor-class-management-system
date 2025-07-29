const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    className: {
        type: String,
        required: [true, 'Class name is required'],
        trim: true,
        maxLength: [100, 'Class name cannot exceed 100 characters']
    },
    courseCode: {
        type: String,
        required: [true, 'Course code is required'],
        trim: true,
        uppercase: true,
        maxLength: [20, 'Course code cannot exceed 20 characters']
    },
    description: {
        type: String,
        maxLength: [1000, 'Description cannot exceed 1000 characters']
    },
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Professor',
        required: [true, 'Professor is required']
    },
    semester: {
        type: String,
        required: [true, 'Semester is required'],
        enum: ['Fall', 'Spring', 'Summer', 'Winter']
    },
    year: {
        type: Number,
        required: [true, 'Year is required'],
        min: [2000, 'Year must be 2000 or later'],
        max: [2100, 'Year must be 2100 or earlier']
    },
    credits: {
        type: Number,
        required: [true, 'Credits are required'],
        min: [1, 'Credits must be at least 1'],
        max: [10, 'Credits cannot exceed 10']
    },
    schedule: {
        days: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        }],
        startTime: {
            type: String,
            required: [true, 'Start time is required'],
            match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format']
        },
        endTime: {
            type: String,
            required: [true, 'End time is required'],
            match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format']
        },
        location: {
            building: String,
            room: String,
            campus: String
        }
    },
    enrolledStudents: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student'
        },
        enrollmentDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['enrolled', 'dropped', 'completed'],
            default: 'enrolled'
        }
    }],
    maxEnrollment: {
        type: Number,
        default: 30,
        min: [1, 'Max enrollment must be at least 1']
    },
    syllabus: {
        objectives: [String],
        topics: [String],
        requiredBooks: [{
            title: String,
            author: String,
            isbn: String,
            edition: String
        }],
        gradingPolicy: {
            attendance: { type: Number, min: 0, max: 100, default: 10 },
            assignments: { type: Number, min: 0, max: 100, default: 30 },
            midterm: { type: Number, min: 0, max: 100, default: 25 },
            final: { type: Number, min: 0, max: 100, default: 35 }
        }
    },
    announcements: [{
        title: String,
        content: String,
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        publishDate: {
            type: Date,
            default: Date.now
        },
        expiryDate: Date
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for current enrollment count
classSchema.virtual('currentEnrollment').get(function() {
    if (!this.enrolledStudents || !Array.isArray(this.enrolledStudents)) {
        return 0;
    }
    return this.enrolledStudents.filter(enrollment => enrollment.status === 'enrolled').length;
});

// Virtual for available spots
classSchema.virtual('availableSpots').get(function() {
    return this.maxEnrollment - this.currentEnrollment;
});

// Virtual for class display name
classSchema.virtual('displayName').get(function() {
    return `${this.courseCode} - ${this.className}`;
});

// Index for better search performance
classSchema.index({ courseCode: 1 });
classSchema.index({ professor: 1 });
classSchema.index({ semester: 1, year: 1 });

// Validate that end time is after start time
classSchema.pre('save', function(next) {
    if (this.schedule.startTime && this.schedule.endTime) {
        const start = this.schedule.startTime.split(':').map(Number);
        const end = this.schedule.endTime.split(':').map(Number);
        const startMinutes = start[0] * 60 + start[1];
        const endMinutes = end[0] * 60 + end[1];
        
        if (endMinutes <= startMinutes) {
            return next(new Error('End time must be after start time'));
        }
    }
    next();
});

module.exports = mongoose.model('Class', classSchema);
