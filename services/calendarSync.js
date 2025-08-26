const ical = require('ical-generator');
const nodeIcal = require('node-ical');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Calendar Sync Service
 * This service handles the synchronization of calendar events with external calendar platforms
 * like Google Calendar and Microsoft Outlook (via iCalendar).
 */
class CalendarSyncService {
    
    /**
     * Generate iCalendar file from events
     * @param {Array} events - Array of calendar events
     * @param {Object} professor - Professor information for the calendar owner
     * @return {String} - iCalendar content as string
     */
    generateICalendar(events, professor) {
        const calendar = ical({
            name: `${professor.firstName} ${professor.lastName}'s Class Schedule`,
            prodId: { company: 'College Management System', product: 'Class Calendar' },
            timezone: 'America/New_York'
        });

        events.forEach(event => {
            calendar.createEvent({
                start: new Date(event.startDateTime),
                end: new Date(event.endDateTime),
                summary: event.title,
                description: event.description || '',
                location: event.location || '',
                url: event.url || '',
                id: event._id.toString(),
                status: 'CONFIRMED',
                categories: [event.eventType],
                organizer: {
                    name: `${professor.firstName} ${professor.lastName}`,
                    email: professor.email
                }
            });
        });

        return calendar.toString();
    }

    /**
     * Create a file path for storing iCalendar files
     * @param {String} professorId - Professor ID
     * @return {String} - Full path to the iCalendar file
     */
    createICalFilePath(professorId) {
        const dir = path.join(__dirname, '..', 'data', 'calendars');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        
        return path.join(dir, `${professorId}.ics`);
    }

    /**
     * Save iCalendar to file
     * @param {String} icalContent - iCalendar content
     * @param {String} professorId - Professor ID
     * @return {String} - Path to the saved file
     */
    saveICalendarToFile(icalContent, professorId) {
        const filePath = this.createICalFilePath(professorId);
        fs.writeFileSync(filePath, icalContent);
        return filePath;
    }

    /**
     * Generate a public URL for the iCalendar
     * @param {String} professorId - Professor ID
     * @return {String} - Public URL for the calendar
     */
    generatePublicUrl(professorId, baseUrl) {
        return `${baseUrl}/api/calendar/ical/${professorId}`;
    }

    /**
     * Parse an imported iCalendar file
     * @param {String} icalContent - iCalendar content
     * @return {Array} - Array of parsed events
     */
    parseICalendar(icalContent) {
        const parsedEvents = nodeIcal.parseICS(icalContent);
        const events = [];

        for (const key in parsedEvents) {
            const event = parsedEvents[key];
            // Only process VEVENT objects (calendar events)
            if (event.type === 'VEVENT') {
                events.push({
                    title: event.summary,
                    description: event.description || '',
                    startDateTime: event.start,
                    endDateTime: event.end,
                    location: event.location || '',
                    eventType: this.mapEventType(event.categories?.[0] || 'other'),
                    isRecurring: !!event.rrule,
                    externalId: event.uid
                });
            }
        }

        return events;
    }

    /**
     * Map external event types to our system's event types
     * @param {String} externalType - External event type
     * @return {String} - Mapped event type
     */
    mapEventType(externalType) {
        const typeMap = {
            'lecture': 'lecture',
            'class': 'lecture',
            'exam': 'exam',
            'test': 'exam',
            'quiz': 'quiz',
            'assignment': 'assignment_due',
            'project': 'project_due',
            'office hours': 'office_hours',
            'meeting': 'meeting',
            'conference': 'conference',
            'holiday': 'holiday',
            'break': 'break',
            'deadline': 'deadline',
            'presentation': 'presentation',
            'lab': 'lab',
            'seminar': 'seminar',
            'workshop': 'workshop'
        };

        // Try to match with a known type, defaulting to 'other'
        const lowerType = externalType.toLowerCase();
        for (const [key, value] of Object.entries(typeMap)) {
            if (lowerType.includes(key)) {
                return value;
            }
        }
        return 'other';
    }

    /**
     * Generate Google Calendar sync link
     * @param {String} icalUrl - URL to the iCalendar file
     * @return {String} - Google Calendar import URL
     */
    generateGoogleCalendarLink(icalUrl) {
        return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icalUrl)}`;
    }

    /**
     * Generate Outlook Calendar sync link
     * @param {String} icalUrl - URL to the iCalendar file
     * @return {String} - Outlook Calendar import URL
     */
    generateOutlookCalendarLink(icalUrl) {
        return `https://outlook.office.com/calendar/addcalendar?url=${encodeURIComponent(icalUrl)}&name=Class+Schedule`;
    }
}

module.exports = new CalendarSyncService();
