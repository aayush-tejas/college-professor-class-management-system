const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'Student is required']
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: [true, 'Class is required']
    },
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Professor',
        required: [true, 'Professor is required']
    },
    assignment: {
        name: {
            type: String,
            required: [true, 'Assignment name is required'],
            trim: true,
            maxLength: [100, 'Assignment name cannot exceed 100 characters']
        },
        type: {
            type: String,
            required: [true, 'Assignment type is required'],
            enum: ['homework', 'quiz', 'exam', 'project', 'participation', 'attendance', 'midterm', 'final']
        },
        dueDate: {
            type: Date
        },
        maxPoints: {
            type: Number,
            required: [true, 'Maximum points is required'],
            min: [0, 'Maximum points must be at least 0']
        },
        weight: {
            type: Number,
            min: [0, 'Weight must be at least 0'],
            max: [100, 'Weight cannot exceed 100'],
            default: 1
        }
    },
    score: {
        points: {
            type: Number,
            required: [true, 'Points scored is required'],
            min: [0, 'Points cannot be negative']
        },
        percentage: {
            type: Number,
            min: [0, 'Percentage cannot be negative'],
            max: [100, 'Percentage cannot exceed 100']
        },
        letterGrade: {
            type: String,
            enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'I', 'W']
        }
    },
    feedback: {
        comments: {
            type: String,
            maxLength: [1000, 'Comments cannot exceed 1000 characters']
        },
        strengths: [String],
        improvements: [String],
        isPrivate: {
            type: Boolean,
            default: false
        }
    },
    submissionInfo: {
        submittedAt: Date,
        isLate: {
            type: Boolean,
            default: false
        },
        latePenalty: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        }
    },
    rubric: [{
        criteria: String,
        maxPoints: Number,
        earnedPoints: Number,
        comments: String
    }],
    isExcused: {
        type: Boolean,
        default: false
    },
    isExtra: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for calculated percentage
gradeSchema.virtual('calculatedPercentage').get(function() {
    if (this.assignment.maxPoints === 0) return 0;
    return Math.round((this.score.points / this.assignment.maxPoints) * 100 * 100) / 100;
});

// Virtual for letter grade calculation
gradeSchema.virtual('calculatedLetterGrade').get(function() {
    const percentage = this.calculatedPercentage;
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
});

// Pre-save middleware to calculate percentage and letter grade
gradeSchema.pre('save', function(next) {
    // Calculate percentage if not provided
    if (!this.score.percentage && this.assignment.maxPoints > 0) {
        this.score.percentage = this.calculatedPercentage;
    }
    
    // Calculate letter grade if not provided
    if (!this.score.letterGrade) {
        this.score.letterGrade = this.calculatedLetterGrade;
    }
    
    // Check if submission is late
    if (this.assignment.dueDate && this.submissionInfo.submittedAt) {
        this.submissionInfo.isLate = this.submissionInfo.submittedAt > this.assignment.dueDate;
    }
    
    next();
});

// Index for better query performance
gradeSchema.index({ student: 1, class: 1 });
gradeSchema.index({ class: 1 });
gradeSchema.index({ professor: 1 });
gradeSchema.index({ 'assignment.type': 1 });

// Compound index for unique assignment per student per class
gradeSchema.index({ student: 1, class: 1, 'assignment.name': 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
