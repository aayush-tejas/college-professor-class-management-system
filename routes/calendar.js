const express = require('express');
const CalendarEvent = require('../models/CalendarEvent');
const Class = require('../models/Class');
const { auth } = require('../middleware/auth');
const { calendarValidation, paramValidation, queryValidation } = require('../middleware/validation');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// @route   GET /api/calendar/events
// @desc    Get calendar events with filtering
// @access  Private
router.get('/events', auth, queryValidation.pagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const eventType = req.query.eventType;
        const classId = req.query.classId;

        let query = { 
            professor: req.professorId,
            isVisible: true 
        };

        // Date range filter
        if (startDate && endDate) {
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            
            // Validate dates
            if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Please use valid ISO date strings.'
                });
            }
            
            query.startDateTime = {
                $gte: startDateObj,
                $lte: endDateObj
            };
        } else if (startDate) {
            const startDateObj = new Date(startDate);
            
            if (isNaN(startDateObj.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid start date format. Please use valid ISO date string.'
                });
            }
            query.startDateTime = { $gte: startDateObj };
        } else if (endDate) {
            const endDateObj = new Date(endDate);
            
            if (isNaN(endDateObj.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid end date format. Please use valid ISO date string.'
                });
            }
            query.startDateTime = { $lte: endDateObj };
        }

        // Event type filter
        if (eventType) {
            query.eventType = eventType;
        }

        // Class filter
        if (classId) {
            query.class = classId;
        }

        const events = await CalendarEvent.find(query)
            .populate('class', 'className courseCode')
            .populate('attendees.student', 'firstName lastName studentId')
            .sort({ startDateTime: 1 })
            .skip(skip)
            .limit(limit);

        const total = await CalendarEvent.countDocuments(query);

        res.json({
            success: true,
            data: {
                events,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Get calendar events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get calendar events'
        });
    }
});

// @route   GET /api/calendar/events/upcoming
// @desc    Get upcoming events
// @access  Private
router.get('/events/upcoming', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const now = new Date();

        const events = await CalendarEvent.find({
            professor: req.professorId,
            startDateTime: { $gte: now },
            status: 'scheduled',
            isVisible: true
        })
        .populate('class', 'className courseCode')
        .sort({ startDateTime: 1 })
        .limit(limit);

        res.json({
            success: true,
            data: {
                events
            }
        });
    } catch (error) {
        console.error('Get upcoming events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get upcoming events'
        });
    }
});

// @route   GET /api/calendar/events/:id
// @desc    Get calendar event by ID
// @access  Private
router.get('/events/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const event = await CalendarEvent.findOne({
            _id: req.params.id,
            professor: req.professorId
        })
        .populate('class', 'className courseCode semester year')
        .populate('attendees.student', 'firstName lastName studentId email');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        res.json({
            success: true,
            data: {
                event
            }
        });
    } catch (error) {
        console.error('Get calendar event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get calendar event'
        });
    }
});

// @route   POST /api/calendar/events
// @desc    Create a new calendar event
// @access  Private
router.post('/events', auth, calendarValidation.create, async (req, res) => {
    try {
        // If class is specified, verify it belongs to the professor
        if (req.body.class) {
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
        }

        const eventData = {
            ...req.body,
            professor: req.professorId
        };

        const event = new CalendarEvent(eventData);
        await event.save();

        const populatedEvent = await CalendarEvent.findById(event._id)
            .populate('class', 'className courseCode')
            .populate('attendees.student', 'firstName lastName studentId');

        res.status(201).json({
            success: true,
            message: 'Calendar event created successfully',
            data: {
                event: populatedEvent
            }
        });
    } catch (error) {
        console.error('Create calendar event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create calendar event'
        });
    }
});

// @route   PUT /api/calendar/events/:id
// @desc    Update calendar event by ID
// @access  Private
router.put('/events/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const event = await CalendarEvent.findOneAndUpdate(
            { _id: req.params.id, professor: req.professorId },
            req.body,
            { new: true, runValidators: true }
        )
        .populate('class', 'className courseCode')
        .populate('attendees.student', 'firstName lastName studentId');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        res.json({
            success: true,
            message: 'Calendar event updated successfully',
            data: {
                event
            }
        });
    } catch (error) {
        console.error('Update calendar event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update calendar event'
        });
    }
});

// @route   DELETE /api/calendar/events/:id
// @desc    Delete calendar event by ID
// @access  Private
router.delete('/events/:id', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const event = await CalendarEvent.findOneAndDelete({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        res.json({
            success: true,
            message: 'Calendar event deleted successfully'
        });
    } catch (error) {
        console.error('Delete calendar event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete calendar event'
        });
    }
});

// @route   GET /api/calendar/schedule/weekly
// @desc    Get weekly schedule
// @access  Private
router.get('/schedule/weekly', auth, async (req, res) => {
    try {
        const weekStart = req.query.weekStart ? new Date(req.query.weekStart) : new Date();
        
        // Set to start of week (Sunday)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const events = await CalendarEvent.find({
            professor: req.professorId,
            startDateTime: {
                $gte: weekStart,
                $lte: weekEnd
            },
            isVisible: true
        })
        .populate('class', 'className courseCode')
        .sort({ startDateTime: 1 });

        // Group events by day
        const weeklySchedule = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            weeklySchedule[day] = [];
        });

        events.forEach(event => {
            const dayName = days[event.startDateTime.getDay()];
            weeklySchedule[dayName].push(event);
        });

        res.json({
            success: true,
            data: {
                weekStart,
                weekEnd,
                schedule: weeklySchedule
            }
        });
    } catch (error) {
        console.error('Get weekly schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get weekly schedule'
        });
    }
});

// @route   POST /api/calendar/events/:id/attendees
// @desc    Add attendees to an event
// @access  Private
router.post('/events/:id/attendees', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const { studentIds } = req.body;

        if (!studentIds || !Array.isArray(studentIds)) {
            return res.status(400).json({
                success: false,
                message: 'Student IDs array is required'
            });
        }

        const event = await CalendarEvent.findOne({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        // Add new attendees
        studentIds.forEach(studentId => {
            const isAlreadyAttendee = event.attendees.some(
                attendee => attendee.student.toString() === studentId
            );

            if (!isAlreadyAttendee) {
                event.attendees.push({
                    student: studentId,
                    status: 'invited'
                });
            }
        });

        await event.save();

        const updatedEvent = await CalendarEvent.findById(event._id)
            .populate('attendees.student', 'firstName lastName studentId email');

        res.json({
            success: true,
            message: 'Attendees added successfully',
            data: {
                event: updatedEvent
            }
        });
    } catch (error) {
        console.error('Add attendees error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add attendees'
        });
    }
});

// @route   PUT /api/calendar/events/:id/attendees/:studentId/status
// @desc    Update attendee status
// @access  Private
router.put('/events/:id/attendees/:studentId/status', auth, paramValidation.mongoId, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['invited', 'accepted', 'declined', 'tentative'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const event = await CalendarEvent.findOne({
            _id: req.params.id,
            professor: req.professorId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        const attendee = event.attendees.find(
            a => a.student.toString() === req.params.studentId
        );

        if (!attendee) {
            return res.status(404).json({
                success: false,
                message: 'Attendee not found'
            });
        }

        attendee.status = status;
        await event.save();

        res.json({
            success: true,
            message: 'Attendee status updated successfully'
        });
    } catch (error) {
        console.error('Update attendee status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attendee status'
        });
    }
});

// @route   GET /api/calendar/analytics
// @desc    Get calendar analytics
// @access  Private
router.get('/analytics', auth, async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Events this month
        const eventsThisMonth = await CalendarEvent.countDocuments({
            professor: req.professorId,
            startDateTime: {
                $gte: startOfMonth,
                $lte: endOfMonth
            }
        });

        // Upcoming events
        const upcomingEvents = await CalendarEvent.countDocuments({
            professor: req.professorId,
            startDateTime: { $gte: now },
            status: 'scheduled'
        });

        // Events by type
        const eventsByType = await CalendarEvent.aggregate([
            {
                $match: {
                    professor: req.professorId,
                    startDateTime: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Busiest day of the week
        const eventsByDay = await CalendarEvent.aggregate([
            {
                $match: {
                    professor: req.professorId,
                    startDateTime: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: '$startDateTime' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const formattedEventsByDay = eventsByDay.map(item => ({
            day: dayNames[item._id - 1],
            count: item.count
        }));

        res.json({
            success: true,
            data: {
                eventsThisMonth,
                upcomingEvents,
                eventsByType,
                eventsByDay: formattedEventsByDay
            }
        });
    } catch (error) {
        console.error('Get calendar analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get calendar analytics'
        });
    }
});

// @route   GET /api/calendar/export/ical
// @desc    Export calendar as iCalendar file
// @access  Private
router.get('/export/ical', auth, async (req, res) => {
    try {
        const calendarSyncService = require('../services/calendarSync');
        const Professor = require('../models/Professor');
        
        // Get all events for the professor
        const events = await CalendarEvent.find({ 
            professor: req.professorId,
            isVisible: true
        });
        
        const professor = await Professor.findById(req.professorId);
        
        if (!professor) {
            return res.status(404).json({
                success: false,
                message: 'Professor not found'
            });
        }
        
        // Generate iCalendar content
        const icalContent = calendarSyncService.generateICalendar(events, professor);
        
        // Save to file
        const filePath = calendarSyncService.saveICalendarToFile(icalContent, req.professorId);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename=calendar.ics');
        
        // Send the iCalendar content
        res.send(icalContent);
    } catch (error) {
        console.error('Export calendar error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export calendar'
        });
    }
});

// @route   GET /api/calendar/ical/:professorId
// @desc    Get public iCalendar feed for a professor
// @access  Public
router.get('/ical/:professorId', async (req, res) => {
    try {
        const calendarSyncService = require('../services/calendarSync');
        const filePath = calendarSyncService.createICalFilePath(req.params.professorId);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Calendar not found'
            });
        }
        
        const icalContent = fs.readFileSync(filePath, 'utf8');
        
        // Set content type for iCalendar
        res.setHeader('Content-Type', 'text/calendar');
        res.send(icalContent);
    } catch (error) {
        console.error('Get iCalendar error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get calendar'
        });
    }
});

// @route   GET /api/calendar/sync/links
// @desc    Get links to sync calendar with external services
// @access  Private
router.get('/sync/links', auth, async (req, res) => {
    try {
        const calendarSyncService = require('../services/calendarSync');
        
        // Base URL for the iCalendar feed
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        // Generate the iCalendar URL
        const icalUrl = calendarSyncService.generatePublicUrl(req.professorId, baseUrl);
        
        // Generate sync links for different services
        const googleLink = calendarSyncService.generateGoogleCalendarLink(icalUrl);
        const outlookLink = calendarSyncService.generateOutlookCalendarLink(icalUrl);
        
        res.json({
            success: true,
            data: {
                icalUrl,
                googleLink,
                outlookLink
            }
        });
    } catch (error) {
        console.error('Get sync links error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate sync links'
        });
    }
});

// @route   POST /api/calendar/import/ical
// @desc    Import events from iCalendar file
// @access  Private
router.post('/import/ical', auth, async (req, res) => {
    try {
        const calendarSyncService = require('../services/calendarSync');
        const { icalContent, classId } = req.body;
        
        if (!icalContent) {
            return res.status(400).json({
                success: false,
                message: 'iCalendar content is required'
            });
        }
        
        // Parse the iCalendar content
        const parsedEvents = calendarSyncService.parseICalendar(icalContent);
        
        // Insert the events into the database
        const createdEvents = [];
        for (const eventData of parsedEvents) {
            const event = new CalendarEvent({
                ...eventData,
                professor: req.professorId,
                class: classId || null,
                isVisible: true,
                isExternal: true
            });
            
            await event.save();
            createdEvents.push(event);
        }
        
        res.status(201).json({
            success: true,
            message: `Successfully imported ${createdEvents.length} events`,
            data: {
                events: createdEvents
            }
        });
    } catch (error) {
        console.error('Import calendar error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import calendar'
        });
    }
});

module.exports = router;
