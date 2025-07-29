const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Configure multer for Excel files
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'students-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|csv)$/)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Field mapping for student data
const fieldMappings = {
    'studentid': 'studentId',
    'student_id': 'studentId',
    'id': 'studentId',
    'firstname': 'firstName',
    'first_name': 'firstName',
    'fname': 'firstName',
    'lastname': 'lastName',
    'last_name': 'lastName',
    'lname': 'lastName',
    'email': 'email',
    'emailaddress': 'email',
    'email_address': 'email',
    'phone': 'phoneNumber',
    'phonenumber': 'phoneNumber',
    'phone_number': 'phoneNumber',
    'mobile': 'phoneNumber',
    'major': 'major',
    'academicyear': 'academicYear',
    'academic_year': 'academicYear',
    'year': 'academicYear',
    'gpa': 'gpa',
    'dateofbirth': 'dateOfBirth',
    'date_of_birth': 'dateOfBirth',
    'dob': 'dateOfBirth',
    'birthdate': 'dateOfBirth'
};

// Normalize column name for mapping
function normalizeColumnName(columnName) {
    return columnName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map Excel columns to student fields
function mapColumns(headers) {
    const mappedFields = {};
    headers.forEach((header, index) => {
        const normalized = normalizeColumnName(header);
        const mappedField = fieldMappings[normalized];
        if (mappedField) {
            mappedFields[mappedField] = index;
        }
    });
    return mappedFields;
}

// Validate student data
function validateStudentData(studentData, rowIndex) {
    const errors = [];
    
    // Required fields
    if (!studentData.studentId || studentData.studentId.toString().trim() === '') {
        errors.push(`Row ${rowIndex + 2}: Student ID is required`);
    }
    if (!studentData.firstName || studentData.firstName.toString().trim() === '') {
        errors.push(`Row ${rowIndex + 2}: First Name is required`);
    }
    if (!studentData.lastName || studentData.lastName.toString().trim() === '') {
        errors.push(`Row ${rowIndex + 2}: Last Name is required`);
    }
    if (!studentData.email || studentData.email.toString().trim() === '') {
        errors.push(`Row ${rowIndex + 2}: Email is required`);
    }
    
    // Email format validation
    if (studentData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(studentData.email.toString().trim())) {
            errors.push(`Row ${rowIndex + 2}: Invalid email format`);
        }
    }
    
    // GPA validation
    if (studentData.gpa !== undefined && studentData.gpa !== null && studentData.gpa !== '') {
        const gpa = parseFloat(studentData.gpa);
        if (isNaN(gpa) || gpa < 0 || gpa > 4) {
            errors.push(`Row ${rowIndex + 2}: GPA must be between 0 and 4`);
        }
    }
    
    return errors;
}

// Parse Excel/CSV file and extract data
function parseExcelFile(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
        throw new Error('File is empty');
    }
    
    const headers = jsonData[0];
    const rows = jsonData.slice(1);
    
    return { headers, rows };
}

// Preview Excel data
router.post('/students/preview', auth, upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { headers, rows } = parseExcelFile(req.file.path);
        const mappedFields = mapColumns(headers);
        
        // Get preview data (first 5 rows)
        const previewRows = rows.slice(0, 5);
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            data: {
                headers,
                previewRows,
                mappedFields,
                totalRows: rows.length,
                requiredFieldsFound: ['studentId', 'firstName', 'lastName', 'email']
                    .every(field => mappedFields.hasOwnProperty(field))
            }
        });
        
    } catch (error) {
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Preview error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to preview file data'
        });
    }
});

// Import students from Excel
router.post('/students/import', auth, upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { headers, rows } = parseExcelFile(req.file.path);
        const mappedFields = mapColumns(headers);
        
        // Validate required fields
        const requiredFields = ['studentId', 'firstName', 'lastName', 'email'];
        const missingFields = requiredFields.filter(field => !mappedFields.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                error: `Missing required columns: ${missingFields.join(', ')}`
            });
        }
        
        const results = {
            totalRows: rows.length,
            successCount: 0,
            errorCount: 0,
            duplicateCount: 0,
            errors: [],
            duplicates: []
        };
        
        const studentsToCreate = [];
        const existingStudentIds = new Set();
        const existingEmails = new Set();
        
        // Get existing students to check for duplicates
        const existingStudents = await Student.find({}, 'studentId email');
        existingStudents.forEach(student => {
            existingStudentIds.add(student.studentId.toLowerCase());
            existingEmails.add(student.email.toLowerCase());
        });
        
        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip empty rows
            if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
                continue;
            }
            
            try {
                const studentData = {};
                
                // Map row data to student fields
                Object.keys(mappedFields).forEach(field => {
                    const columnIndex = mappedFields[field];
                    const value = row[columnIndex];
                    
                    if (value !== undefined && value !== null && value !== '') {
                        if (field === 'gpa') {
                            studentData[field] = parseFloat(value);
                        } else if (field === 'dateOfBirth') {
                            // Handle date parsing
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                studentData[field] = date;
                            }
                        } else {
                            studentData[field] = value.toString().trim();
                        }
                    }
                });
                
                // Validate student data
                const validationErrors = validateStudentData(studentData, i);
                if (validationErrors.length > 0) {
                    results.errors.push(...validationErrors);
                    results.errorCount++;
                    continue;
                }
                
                // Check for duplicates
                const studentIdLower = studentData.studentId.toLowerCase();
                const emailLower = studentData.email.toLowerCase();
                
                if (existingStudentIds.has(studentIdLower) || existingEmails.has(emailLower)) {
                    results.duplicates.push(`Row ${i + 2}: Student ID "${studentData.studentId}" or email "${studentData.email}" already exists`);
                    results.duplicateCount++;
                    continue;
                }
                
                // Add to creation list
                existingStudentIds.add(studentIdLower);
                existingEmails.add(emailLower);
                
                const studentDoc = {
                    studentId: studentData.studentId,
                    firstName: studentData.firstName,
                    lastName: studentData.lastName,
                    email: studentData.email,
                    professor: req.user.id
                };
                
                // Add optional fields if present
                if (studentData.phoneNumber) studentDoc.phoneNumber = studentData.phoneNumber;
                if (studentData.dateOfBirth) studentDoc.dateOfBirth = studentData.dateOfBirth;
                if (studentData.major || studentData.academicYear || studentData.gpa) {
                    studentDoc.academicInfo = {};
                    if (studentData.major) studentDoc.academicInfo.major = studentData.major;
                    if (studentData.academicYear) studentDoc.academicInfo.year = studentData.academicYear;
                    if (studentData.gpa !== undefined) studentDoc.academicInfo.gpa = studentData.gpa;
                }
                
                studentsToCreate.push(studentDoc);
                
            } catch (error) {
                results.errors.push(`Row ${i + 2}: ${error.message}`);
                results.errorCount++;
            }
        }
        
        // Bulk create students
        if (studentsToCreate.length > 0) {
            try {
                await Student.insertMany(studentsToCreate);
                results.successCount = studentsToCreate.length;
            } catch (error) {
                console.error('Bulk insert error:', error);
                results.errors.push('Database error during bulk insert');
                results.errorCount += studentsToCreate.length;
                results.successCount = 0;
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Import error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to import students'
        });
    }
});

// Download template route
router.get('/students/template', (req, res) => {
    try {
        // Create a sample workbook
        const workbook = xlsx.utils.book_new();
        
        // Sample data with all possible fields
        const sampleData = [
            {
                'Student ID': 'STU001',
                'First Name': 'John',
                'Last Name': 'Doe',
                'Email': 'john.doe@example.com',
                'Phone Number': '555-0123',
                'Major': 'Computer Science',
                'Academic Year': 'Junior',
                'GPA': '3.75',
                'Date of Birth': '2001-05-15'
            },
            {
                'Student ID': 'STU002',
                'First Name': 'Jane',
                'Last Name': 'Smith',
                'Email': 'jane.smith@example.com',
                'Phone Number': '555-0456',
                'Major': 'Mathematics',
                'Academic Year': 'Senior',
                'GPA': '3.92',
                'Date of Birth': '2000-12-03'
            },
            {
                'Student ID': 'STU003',
                'First Name': 'Mike',
                'Last Name': 'Johnson',
                'Email': 'mike.johnson@example.com',
                'Phone Number': '',
                'Major': 'Physics',
                'Academic Year': 'Sophomore',
                'GPA': '3.45',
                'Date of Birth': '2002-08-22'
            }
        ];
        
        // Create worksheet
        const worksheet = xlsx.utils.json_to_sheet(sampleData);
        
        // Set column widths
        const colWidths = [
            { wch: 12 }, // Student ID
            { wch: 15 }, // First Name
            { wch: 15 }, // Last Name
            { wch: 25 }, // Email
            { wch: 15 }, // Phone Number
            { wch: 20 }, // Major
            { wch: 15 }, // Academic Year
            { wch: 8 },  // GPA
            { wch: 15 }  // Date of Birth
        ];
        worksheet['!cols'] = colWidths;
        
        // Add worksheet to workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');
        
        // Create instructions sheet
        const instructions = [
            { 'Instructions': 'Student Import Template' },
            { 'Instructions': '' },
            { 'Instructions': 'Required Fields (must be present):' },
            { 'Instructions': '• Student ID - Unique identifier for each student' },
            { 'Instructions': '• First Name - Student\'s first name' },
            { 'Instructions': '• Last Name - Student\'s last name' },
            { 'Instructions': '• Email - Valid email address' },
            { 'Instructions': '' },
            { 'Instructions': 'Optional Fields:' },
            { 'Instructions': '• Phone Number - Student\'s phone number' },
            { 'Instructions': '• Major - Academic major/field of study' },
            { 'Instructions': '• Academic Year - Freshman, Sophomore, Junior, Senior, Graduate' },
            { 'Instructions': '• GPA - Grade Point Average (0.0 - 4.0)' },
            { 'Instructions': '• Date of Birth - Date in YYYY-MM-DD format' },
            { 'Instructions': '' },
            { 'Instructions': 'Notes:' },
            { 'Instructions': '• Column names can be flexible (case insensitive)' },
            { 'Instructions': '• Duplicate Student IDs or emails will be skipped' },
            { 'Instructions': '• Maximum file size: 10MB' },
            { 'Instructions': '• Supported formats: .xlsx, .xls, .csv' }
        ];
        
        const instructionsSheet = xlsx.utils.json_to_sheet(instructions);
        instructionsSheet['!cols'] = [{ wch: 60 }];
        xlsx.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
        
        // Generate buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Template generation error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

module.exports = router;
