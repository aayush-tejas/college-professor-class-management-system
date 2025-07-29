const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
        maxLength: [200, 'Title cannot exceed 200 characters']
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
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    eventType: {
        type: String,
        required: [true, 'Event type is required'],
        enum: [
            'lecture',
            'exam',
            'quiz',
            'assignment_due',
            'project_due',
            'office_hours',
            'meeting',
            'conference',
            'holiday',
            'break',
            'deadline',
            'presentation',
            'lab',
            'seminar',
            'workshop',
            'other'
        ]
    },
    startDateTime: {
        type: Date,
        required: [true, 'Start date and time is required']
    },
    endDateTime: {
        type: Date,
        required: [true, 'End date and time is required']
    },
    isAllDay: {
        type: Boolean,
        default: false
    },
    location: {
        building: String,
        room: String,
        campus: String,
        virtual: {
            platform: String,
            link: String,
            meetingId: String,
            password: String
        }
    },
    recurrence: {
        isRecurring: {
            type: Boolean,
            default: false
        },
        pattern: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'yearly'],
            default: 'weekly'
        },
        interval: {
            type: Number,
            min: 1,
            default: 1
        },
        daysOfWeek: [{
            type: String,
            enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        }],
        endDate: Date,
        occurrences: Number
    },
    attendees: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student'
        },
        status: {
            type: String,
            enum: ['invited', 'accepted', 'declined', 'tentative'],
            default: 'invited'
        }
    }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'],
        default: 'scheduled'
    },
    color: {
        type: String,
        default: '#3498db',
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color']
    },
    reminders: [{
        type: {
            type: String,
            enum: ['email', 'notification', 'sms'],
            default: 'notification'
        },
        minutesBefore: {
            type: Number,
            min: 0,
            default: 15
        },
        isEnabled: {
            type: Boolean,
            default: true
        }
    }],
    attachments: [{
        fileName: String,
        filePath: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    notes: {
        type: String,
        maxLength: [2000, 'Notes cannot exceed 2000 characters']
    },
    isVisible: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for duration in minutes
calendarEventSchema.virtual('durationMinutes').get(function() {
    if (!this.startDateTime || !this.endDateTime) return 0;
    return Math.round((this.endDateTime - this.startDateTime) / (1000 * 60));
});

// Virtual for duration formatted
calendarEventSchema.virtual('durationFormatted').get(function() {
    const minutes = this.durationMinutes;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
});

// Virtual for formatted date range
calendarEventSchema.virtual('dateRange').get(function() {
    if (!this.startDateTime || !this.endDateTime) return '';
    
    const start = this.startDateTime;
    const end = this.endDateTime;
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    if (this.isAllDay) {
        return start.toLocaleDateString();
    }
    
    if (start.toDateString() === end.toDateString()) {
        return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    return `${start.toLocaleString([], options)} - ${end.toLocaleString([], options)}`;
});

// Pre-save validation
calendarEventSchema.pre('save', function(next) {
    // Validate that end time is after start time
    if (this.endDateTime <= this.startDateTime) {
        return next(new Error('End date and time must be after start date and time'));
    }
    
    // If it's an all-day event, set times to start and end of day
    if (this.isAllDay) {
        this.startDateTime.setHours(0, 0, 0, 0);
        this.endDateTime.setHours(23, 59, 59, 999);
    }
    
    next();
});

// Index for better query performance
calendarEventSchema.index({ professor: 1 });
calendarEventSchema.index({ class: 1 });
calendarEventSchema.index({ startDateTime: 1, endDateTime: 1 });
calendarEventSchema.index({ eventType: 1 });
calendarEventSchema.index({ status: 1 });

// Compound index for date range queries
calendarEventSchema.index({ professor: 1, startDateTime: 1, endDateTime: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
