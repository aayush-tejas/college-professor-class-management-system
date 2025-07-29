// Class Management System - Frontend JavaScript

class ClassManagementApp {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('cms_token');
        this.currentUser = null;
        this.calendar = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing app...');
            
            // Ensure DOM elements exist before proceeding
            if (!document.getElementById('appContainer') || !document.getElementById('loginModal')) {
                throw new Error('Required DOM elements not found');
            }

            // For now, always show login - don't try to verify token on first load
            this.showLogin();
            this.bindEvents();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('App initialization failed:', error);
            throw error; // Re-throw to be caught by the outer try-catch
        } finally {
            this.hideLoading();
        }
    }

    bindEvents() {
        try {
            // Auth forms
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => this.handleLogin(e));
            }
            if (registerForm) {
                registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            }

            // CRUD forms
            const addClassForm = document.getElementById('addClassForm');
            const addStudentForm = document.getElementById('addStudentForm');
            const addGradeForm = document.getElementById('addGradeForm');
            const addEventForm = document.getElementById('addEventForm');

            if (addClassForm) {
                addClassForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(addClassForm);
                    this.handleAddClass(formData);
                });
            }

            if (addStudentForm) {
                addStudentForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(addStudentForm);
                    this.handleAddStudent(formData);
                });
            }

            if (addGradeForm) {
                addGradeForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(addGradeForm);
                    this.handleAddGrade(formData);
                });
            }

            if (addEventForm) {
                addEventForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(addEventForm);
                    this.handleAddEvent(formData);
                });
            }

            // Search inputs - only bind if elements exist
            const classSearch = document.getElementById('classSearch');
            const studentSearch = document.getElementById('studentSearch');
            const gradeSearch = document.getElementById('gradeSearch');
            
            if (classSearch) {
                classSearch.addEventListener('input', (e) => this.searchClasses(e.target.value));
            }
            if (studentSearch) {
                studentSearch.addEventListener('input', (e) => this.searchStudents(e.target.value));
            }
            if (gradeSearch) {
                gradeSearch.addEventListener('input', (e) => this.searchGrades(e.target.value));
            }

            // Filter selects - only bind if elements exist
            const classFilterSemester = document.getElementById('classFilterSemester');
            const gradeFilterClass = document.getElementById('gradeFilterClass');
            const gradeFilterType = document.getElementById('gradeFilterType');
            
            if (classFilterSemester) {
                classFilterSemester.addEventListener('change', (e) => this.filterClasses());
            }
            if (gradeFilterClass) {
                gradeFilterClass.addEventListener('change', (e) => this.filterGrades());
            }
            if (gradeFilterType) {
                gradeFilterType.addEventListener('change', (e) => this.filterGrades());
            }

            // Setup search and filter functionality
            this.setupSearchAndFilter();
        } catch (error) {
            console.error('Error binding events:', error);
        }
    }

    // Utility Methods
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Create container if it doesn't exist
        let alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alertContainer';
            alertContainer.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
            alertContainer.style.zIndex = '9999';
            document.body.appendChild(alertContainer);
        }
        
        alertContainer.innerHTML = alertHtml;
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }

    async apiCall(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        if (data) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            // Check if response is ok first
            if (!response.ok) {
                // Try to parse as JSON, but handle cases where it's not JSON
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    // Response is not JSON, use status text
                    console.warn('Non-JSON error response:', response.statusText);
                }
                throw new Error(errorMessage);
            }

            // Check if response has content
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response format - expected JSON');
            }

            const text = await response.text();
            if (!text) {
                throw new Error('Empty response received');
            }

            try {
                const result = JSON.parse(text);
                return result;
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text:', text);
                throw new Error('Failed to parse server response');
            }

        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    // Authentication Methods
    async handleLogin(e) {
        e.preventDefault();
        this.showLoading();

        try {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const response = await this.apiCall('/auth/login', 'POST', { email, password });
            
            this.token = response.data.token;
            this.currentUser = response.data.professor;
            localStorage.setItem('cms_token', this.token);

            this.showApp();
            this.showDashboard();
            this.showAlert('Login successful!', 'success');
        } catch (error) {
            this.showAlert(error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async testLogin() {
        try {
            console.log('Starting test login...');
            this.showLoading();

            // Show progress message
            this.showAlert('Initializing demo environment...', 'info');
            
            // First initialize test data
            console.log('Initializing test data...');
            const initResponse = await this.apiCall('/test/init', 'POST');
            console.log('Test data initialized:', initResponse.data);
            
            // Then login with test credentials
            console.log('Logging in with test credentials...');
            const response = await this.apiCall('/auth/login', 'POST', { 
                email: 'test@professor.com', 
                password: 'test123' 
            });
            
            this.token = response.data.token;
            this.currentUser = response.data.professor;
            localStorage.setItem('cms_token', this.token);

            console.log('Login successful, showing app...');
            
            // Show the app and dashboard
            this.showApp();
            
            // Wait a moment to ensure DOM is ready
            setTimeout(() => {
                this.showDashboard();
                this.showAlert(`Welcome ${this.currentUser.firstName}! Demo loaded with ${initResponse.data.studentsCreated} students, ${initResponse.data.classesCreated} classes, and sample data.`, 'success');
            }, 300);
            
        } catch (error) {
            console.error('Test login error:', error);
            this.showAlert('Failed to initialize demo. Please try manual registration.', 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        this.showLoading();

        try {
            const formData = {
                firstName: document.getElementById('registerFirstName').value,
                lastName: document.getElementById('registerLastName').value,
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value,
                department: document.getElementById('registerDepartment').value,
                phoneNumber: document.getElementById('registerPhone').value,
                officeLocation: document.getElementById('registerOffice').value
            };

            const response = await this.apiCall('/auth/register', 'POST', formData);
            
            this.token = response.data.token;
            this.currentUser = response.data.professor;
            localStorage.setItem('cms_token', this.token);

            this.showApp();
            this.showDashboard();
            this.showAlert('Registration successful!', 'success');
        } catch (error) {
            this.showAlert(error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async verifyToken() {
        const response = await this.apiCall('/auth/verify-token');
        this.currentUser = response.data.professor;
        return response;
    }

    logout() {
        localStorage.removeItem('cms_token');
        this.token = null;
        this.currentUser = null;
        this.showLogin();
        this.showAlert('Logged out successfully!', 'info');
    }

    showLogin() {
        try {
            console.log('Showing login modal...');
            
            const appContainer = document.getElementById('appContainer');
            if (appContainer) {
                appContainer.classList.add('d-none');
            }
            
            // Ensure Bootstrap is loaded before showing modal
            setTimeout(() => {
                try {
                    const loginModalElement = document.getElementById('loginModal');
                    if (loginModalElement && typeof bootstrap !== 'undefined') {
                        const loginModal = new bootstrap.Modal(loginModalElement);
                        loginModal.show();
                        console.log('Login modal shown successfully');
                    } else {
                        console.error('Bootstrap or login modal element not found');
                    }
                } catch (modalError) {
                    console.error('Error showing login modal:', modalError);
                }
            }, 200);
        } catch (error) {
            console.error('Error in showLogin:', error);
        }
    }

    showApp() {
        document.getElementById('appContainer').classList.remove('d-none');
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
        
        if (loginModal) loginModal.hide();
        if (registerModal) registerModal.hide();

        // Update professor name
        if (this.currentUser) {
            document.getElementById('professorName').textContent = this.currentUser.fullName;
        }
    }

    // Navigation Methods
    showDashboard() {
        this.hideAllContent();
        document.getElementById('dashboardContent').classList.remove('d-none');
        this.updateActiveNav('dashboard');
        this.loadDashboardData();
    }

    showClasses() {
        this.hideAllContent();
        document.getElementById('classesContent').classList.remove('d-none');
        this.updateActiveNav('classes');
        this.loadClasses();
    }

    showStudents() {
        this.hideAllContent();
        document.getElementById('studentsContent').classList.remove('d-none');
        this.updateActiveNav('students');
        this.loadStudents();
    }

    showGrades() {
        this.hideAllContent();
        document.getElementById('gradesContent').classList.remove('d-none');
        this.updateActiveNav('grades');
        this.loadGrades();
        this.loadClassesForFilter();
    }

    showCalendar() {
        this.hideAllContent();
        document.getElementById('calendarContent').classList.remove('d-none');
        this.updateActiveNav('calendar');
        this.initCalendar();
    }

    hideAllContent() {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('d-none');
        });
    }

    updateActiveNav(section) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`[onclick="show${section.charAt(0).toUpperCase() + section.slice(1)}()"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    // Dashboard Methods
    async loadDashboardData() {
        // Only load data if user is authenticated
        if (!this.token || !this.currentUser) {
            console.warn('Cannot load dashboard data: user not authenticated');
            return;
        }

        try {
            // Load stats and events separately to avoid one failure affecting the other
            let stats = { totalClasses: 0, totalStudents: 0, totalGrades: 0, upcomingEvents: 0 };
            let events = [];

            try {
                const statsResponse = await this.apiCall('/professors/stats');
                stats = statsResponse.data;
            } catch (error) {
                console.warn('Failed to load stats:', error.message);
                this.showAlert('Failed to load statistics', 'warning');
            }

            try {
                const eventsResponse = await this.apiCall('/calendar/events/upcoming?limit=5');
                events = eventsResponse.data.events;
            } catch (error) {
                console.warn('Failed to load events:', error.message);
                this.showAlert('Failed to load upcoming events', 'warning');
            }

            // Update stats
            document.getElementById('totalClasses').textContent = stats.totalClasses;
            document.getElementById('totalStudents').textContent = stats.totalStudents;
            document.getElementById('totalGrades').textContent = stats.totalGrades;
            document.getElementById('upcomingEvents').textContent = stats.upcomingEvents;

            // Update upcoming events
            this.renderUpcomingEvents(events);
        } catch (error) {
            console.error('Dashboard loading error:', error);
            this.showAlert('Failed to load dashboard data', 'danger');
        }
    }

    renderUpcomingEvents(events) {
        const container = document.getElementById('upcomingEventsList');
        
        if (events.length === 0) {
            container.innerHTML = '<p class="text-muted">No upcoming events</p>';
            return;
        }

        const html = events.map(event => `
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                <div>
                    <h6 class="mb-1">${event.title}</h6>
                    <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
                        ${new Date(event.startDateTime).toLocaleDateString()}
                        <i class="fas fa-clock ms-2 me-1"></i>
                        ${new Date(event.startDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </small>
                </div>
                <span class="badge bg-${this.getEventTypeColor(event.eventType)}">${event.eventType}</span>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    getEventTypeColor(type) {
        const colors = {
            'lecture': 'primary',
            'exam': 'danger',
            'quiz': 'warning',
            'assignment_due': 'info',
            'meeting': 'secondary',
            'office_hours': 'success'
        };
        return colors[type] || 'secondary';
    }

    // CRUD Methods
    async handleAddClass(formData) {
        try {
            this.showLoading();
            
            // Get selected days
            const days = [];
            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach(day => {
                if (document.getElementById(`day${day}`).checked) {
                    days.push(day);
                }
            });

            const classData = {
                className: document.getElementById('className').value,
                courseCode: document.getElementById('courseCode').value,
                description: document.getElementById('classDescription').value,
                semester: document.getElementById('classSemester').value,
                year: parseInt(document.getElementById('classYear').value),
                credits: parseInt(document.getElementById('classCredits').value),
                schedule: {
                    days: days,
                    startTime: document.getElementById('startTime').value,
                    endTime: document.getElementById('endTime').value,
                    location: {
                        building: document.getElementById('classBuilding').value,
                        room: document.getElementById('classRoom').value,
                        campus: 'Main Campus'
                    }
                },
                maxEnrollment: parseInt(document.getElementById('maxEnrollment').value)
            };

            const response = await this.apiCall('/classes', 'POST', classData);
            this.showAlert('Class created successfully!', 'success');
            this.loadClasses(); // Refresh the list
            bootstrap.Modal.getInstance(document.getElementById('addClassModal')).hide();
            document.getElementById('addClassForm').reset();
        } catch (error) {
            this.showAlert('Failed to create class: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async handleAddStudent(formData) {
        try {
            this.showLoading();

            const studentData = {
                studentId: document.getElementById('studentId').value,
                firstName: document.getElementById('studentFirstName').value,
                lastName: document.getElementById('studentLastName').value,
                email: document.getElementById('studentEmail').value,
                phoneNumber: document.getElementById('studentPhone').value,
                dateOfBirth: document.getElementById('studentDateOfBirth').value || undefined,
                academicInfo: {
                    major: document.getElementById('studentMajor').value,
                    year: document.getElementById('studentYear').value,
                    gpa: document.getElementById('studentGPA').value ? parseFloat(document.getElementById('studentGPA').value) : undefined
                }
            };

            const response = await this.apiCall('/students', 'POST', studentData);
            this.showAlert('Student added successfully!', 'success');
            this.loadStudents(); // Refresh the list
            bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
            document.getElementById('addStudentForm').reset();
        } catch (error) {
            this.showAlert('Failed to add student: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async handleAddGrade(formData) {
        try {
            this.showLoading();

            const gradeData = {
                student: document.getElementById('gradeStudent').value,
                class: document.getElementById('gradeClass').value,
                assignment: {
                    name: document.getElementById('assignmentName').value,
                    type: document.getElementById('assignmentType').value,
                    maxPoints: parseFloat(document.getElementById('maxPoints').value),
                    dueDate: document.getElementById('dueDate').value || undefined
                },
                score: {
                    points: parseFloat(document.getElementById('pointsEarned').value)
                },
                feedback: {
                    comments: document.getElementById('gradeComments').value
                }
            };

            const response = await this.apiCall('/grades', 'POST', gradeData);
            this.showAlert('Grade added successfully!', 'success');
            this.loadGrades(); // Refresh the list
            bootstrap.Modal.getInstance(document.getElementById('addGradeModal')).hide();
            document.getElementById('addGradeForm').reset();
        } catch (error) {
            this.showAlert('Failed to add grade: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async handleAddEvent(formData) {
        try {
            this.showLoading();

            const isAllDay = document.getElementById('eventAllDay').checked;
            
            const eventData = {
                title: document.getElementById('eventTitle').value,
                description: document.getElementById('eventDescription').value,
                eventType: document.getElementById('eventType').value,
                startDateTime: document.getElementById('eventStartDate').value,
                endDateTime: document.getElementById('eventEndDate').value,
                isAllDay: isAllDay,
                priority: document.getElementById('eventPriority').value,
                color: document.getElementById('eventColor').value,
                location: {
                    building: document.getElementById('eventBuilding').value,
                    room: document.getElementById('eventRoom').value
                }
            };

            // Add class if selected
            if (document.getElementById('eventClass').value) {
                eventData.class = document.getElementById('eventClass').value;
            }

            const response = await this.apiCall('/calendar/events', 'POST', eventData);
            this.showAlert('Event created successfully!', 'success');
            
            // Refresh calendar if it's currently shown
            if (this.calendar) {
                this.calendar.refetchEvents();
            }
            
            bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
            document.getElementById('addEventForm').reset();
        } catch (error) {
            this.showAlert('Failed to create event: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    // Search and Filter Methods
    setupSearchAndFilter() {
        // Class search
        const classSearch = document.getElementById('classSearch');
        if (classSearch) {
            classSearch.addEventListener('input', (e) => {
                this.filterClasses(e.target.value);
            });
        }

        // Class semester filter
        const semesterFilter = document.getElementById('classFilterSemester');
        if (semesterFilter) {
            semesterFilter.addEventListener('change', (e) => {
                this.filterClassesBySemester(e.target.value);
            });
        }

        // Student search
        const studentSearch = document.getElementById('studentSearch');
        if (studentSearch) {
            studentSearch.addEventListener('input', (e) => {
                this.filterStudents(e.target.value);
            });
        }

        // Grade filters
        const gradeClassFilter = document.getElementById('gradeFilterClass');
        if (gradeClassFilter) {
            gradeClassFilter.addEventListener('change', (e) => {
                this.filterGradesByClass(e.target.value);
            });
        }
    }

    filterClasses(searchTerm) {
        const cards = document.querySelectorAll('.class-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            card.style.display = matches ? 'block' : 'none';
        });
    }

    filterClassesBySemester(semester) {
        const cards = document.querySelectorAll('.class-card');
        cards.forEach(card => {
            if (!semester) {
                card.style.display = 'block';
                return;
            }
            const text = card.textContent;
            const matches = text.includes(semester);
            card.style.display = matches ? 'block' : 'none';
        });
    }

    filterStudents(searchTerm) {
        const cards = document.querySelectorAll('.student-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            card.style.display = matches ? 'block' : 'none';
        });
    }

    async filterGradesByClass(classId) {
        try {
            let url = '/grades';
            if (classId) {
                url += `?class=${classId}`;
            }
            
            const response = await this.apiCall(url);
            this.renderGrades(response.data.grades);
        } catch (error) {
            this.showAlert('Failed to filter grades', 'danger');
        }
    }

    // Classes Methods
    async loadClasses() {
        try {
            const response = await this.apiCall('/classes');
            this.renderClasses(response.data.classes);
        } catch (error) {
            this.showAlert('Failed to load classes', 'danger');
        }
    }

    renderClasses(classes) {
        const container = document.getElementById('classesList');
        
        if (classes.length === 0) {
            container.innerHTML = '<p class="text-muted">No classes found</p>';
            return;
        }

        const html = classes.map(cls => `
            <div class="card class-card mb-3">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h5 class="card-title">${cls.courseCode} - ${cls.className}</h5>
                            <p class="card-text text-muted">${cls.description || 'No description'}</p>
                            <div class="row text-sm">
                                <div class="col-md-6">
                                    <i class="fas fa-calendar me-1"></i>${cls.semester} ${cls.year}
                                </div>
                                <div class="col-md-6">
                                    <i class="fas fa-clock me-1"></i>${cls.schedule.startTime} - ${cls.schedule.endTime}
                                </div>
                                <div class="col-md-6">
                                    <i class="fas fa-users me-1"></i>${cls.currentEnrollment}/${cls.maxEnrollment} students
                                </div>
                                <div class="col-md-6">
                                    <i class="fas fa-graduation-cap me-1"></i>${cls.credits} credits
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="btn-group-vertical">
                                <button class="btn btn-outline-primary btn-sm" onclick="viewClass('${cls._id}')">
                                    <i class="fas fa-eye me-1"></i>View
                                </button>
                                <button class="btn btn-outline-success btn-sm" onclick="manageStudents('${cls._id}')">
                                    <i class="fas fa-users me-1"></i>Students
                                </button>
                                <button class="btn btn-outline-info btn-sm" onclick="viewGrades('${cls._id}')">
                                    <i class="fas fa-chart-bar me-1"></i>Grades
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Students Methods
    async loadStudents() {
        try {
            const response = await this.apiCall('/students');
            this.renderStudents(response.data.students);
        } catch (error) {
            this.showAlert('Failed to load students', 'danger');
        }
    }

    renderStudents(students) {
        const container = document.getElementById('studentsList');
        
        if (students.length === 0) {
            container.innerHTML = '<p class="text-muted">No students found</p>';
            return;
        }

        const html = students.map(student => `
            <div class="card student-card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h5 class="card-title">${student.fullName}</h5>
                            <div class="row text-sm text-muted">
                                <div class="col-md-6">
                                    <i class="fas fa-id-card me-1"></i>ID: ${student.studentId}
                                </div>
                                <div class="col-md-6">
                                    <i class="fas fa-envelope me-1"></i>${student.email}
                                </div>
                                ${student.academicInfo?.major ? `
                                <div class="col-md-6">
                                    <i class="fas fa-graduation-cap me-1"></i>${student.academicInfo.major}
                                </div>
                                ` : ''}
                                ${student.academicInfo?.year ? `
                                <div class="col-md-6">
                                    <i class="fas fa-calendar me-1"></i>${student.academicInfo.year}
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="btn-group">
                                <button class="btn btn-outline-primary btn-sm" onclick="viewStudent('${student._id}')">
                                    <i class="fas fa-eye me-1"></i>View
                                </button>
                                <button class="btn btn-outline-success btn-sm" onclick="editStudent('${student._id}')">
                                    <i class="fas fa-edit me-1"></i>Edit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Grades Methods
    async loadGrades() {
        try {
            const response = await this.apiCall('/grades');
            this.renderGrades(response.data.grades);
        } catch (error) {
            this.showAlert('Failed to load grades', 'danger');
        }
    }

    async loadClassesForFilter() {
        try {
            const response = await this.apiCall('/classes');
            const select = document.getElementById('gradeFilterClass');
            
            const options = response.data.classes.map(cls => 
                `<option value="${cls._id}">${cls.courseCode} - ${cls.className}</option>`
            ).join('');
            
            select.innerHTML = '<option value="">All Classes</option>' + options;
        } catch (error) {
            console.error('Failed to load classes for filter');
        }
    }

    renderGrades(grades) {
        const container = document.getElementById('gradesList');
        
        if (grades.length === 0) {
            container.innerHTML = '<p class="text-muted">No grades found</p>';
            return;
        }

        const html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Assignment</th>
                            <th>Type</th>
                            <th>Score</th>
                            <th>Grade</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grades.map(grade => `
                            <tr>
                                <td>${grade.student.fullName}</td>
                                <td>${grade.class.courseCode}</td>
                                <td>${grade.assignment.name}</td>
                                <td><span class="badge bg-secondary">${grade.assignment.type}</span></td>
                                <td>${grade.score.points}/${grade.assignment.maxPoints}</td>
                                <td>
                                    <span class="grade-display grade-${grade.score.letterGrade.toLowerCase().replace('+', '').replace('-', '')}">
                                        ${grade.score.letterGrade}
                                    </span>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" onclick="editGrade('${grade._id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" onclick="deleteGrade('${grade._id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    // Calendar Methods
    async initCalendar() {
        if (this.calendar) {
            this.calendar.destroy();
        }

        const calendarEl = document.getElementById('calendar');
        
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: async (info) => {
                try {
                    const startDate = encodeURIComponent(info.startStr);
                    const endDate = encodeURIComponent(info.endStr);
                    const response = await this.apiCall(`/calendar/events?startDate=${startDate}&endDate=${endDate}`);
                    return response.data.events.map(event => ({
                        id: event._id,
                        title: event.title,
                        start: event.startDateTime,
                        end: event.endDateTime,
                        className: `event-${event.eventType}`,
                        extendedProps: {
                            type: event.eventType,
                            description: event.description,
                            location: event.location
                        }
                    }));
                } catch (error) {
                    this.showAlert('Failed to load calendar events', 'danger');
                    return [];
                }
            },
            eventClick: (info) => {
                this.showEventDetails(info.event);
            },
            selectable: true,
            select: (info) => {
                this.showAddEventModal(info.startStr, info.endStr);
            }
        });

        this.calendar.render();
    }

    showEventDetails(event) {
        const modalHtml = `
            <div class="modal fade" id="eventDetailsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${event.title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Type:</strong> ${event.extendedProps.type}</p>
                            <p><strong>Date:</strong> ${event.start.toLocaleDateString()}</p>
                            <p><strong>Time:</strong> ${event.start.toLocaleTimeString()} - ${event.end?.toLocaleTimeString() || 'N/A'}</p>
                            ${event.extendedProps.description ? `<p><strong>Description:</strong> ${event.extendedProps.description}</p>` : ''}
                            ${event.extendedProps.location ? `<p><strong>Location:</strong> ${event.extendedProps.location}</p>` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="editEvent('${event.id}')">Edit</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('eventDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
        modal.show();
    }

    // Search and Filter Methods
    searchClasses(query) {
        // Implement client-side filtering or make API call
        console.log('Searching classes:', query);
    }

    searchStudents(query) {
        // Implement client-side filtering or make API call
        console.log('Searching students:', query);
    }

    searchGrades(query) {
        // Implement client-side filtering or make API call
        console.log('Searching grades:', query);
    }

    filterClasses() {
        // Implement filtering logic
        console.log('Filtering classes');
    }

    filterGrades() {
        // Implement filtering logic
        console.log('Filtering grades');
    }

    // Detailed View Methods
    async viewClassDetails(id) {
        try {
            const response = await this.apiCall(`/classes/${id}`);
            const classData = response.data.class;
            
            // Create and show detailed view modal
            const modalHtml = `
                <div class="modal fade" id="classDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${classData.courseCode} - ${classData.className}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Course Code:</strong> ${classData.courseCode}</p>
                                        <p><strong>Credits:</strong> ${classData.credits}</p>
                                        <p><strong>Semester:</strong> ${classData.semester} ${classData.year}</p>
                                        <p><strong>Schedule:</strong> ${classData.schedule.days.join(', ')}</p>
                                        <p><strong>Time:</strong> ${classData.schedule.startTime} - ${classData.schedule.endTime}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>Location:</strong> ${classData.schedule.location.building} ${classData.schedule.location.room}</p>
                                        <p><strong>Enrollment:</strong> ${classData.currentEnrollment}/${classData.maxEnrollment}</p>
                                        <p><strong>Available Spots:</strong> ${classData.availableSpots}</p>
                                    </div>
                                </div>
                                ${classData.description ? `<p><strong>Description:</strong> ${classData.description}</p>` : ''}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="manageStudents('${id}')">Manage Students</button>
                                <button type="button" class="btn btn-info" onclick="viewGrades('${id}')">View Grades</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.showModal(modalHtml, 'classDetailsModal');
        } catch (error) {
            this.showAlert('Failed to load class details', 'danger');
        }
    }

    async manageClassStudents(classId) {
        try {
            const response = await this.apiCall(`/classes/${classId}/students`);
            const students = response.data.students;
            
            // Create students management modal
            const modalHtml = `
                <div class="modal fade" id="manageStudentsModal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Manage Students</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Student ID</th>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Status</th>
                                                <th>Enrolled</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${students.map(student => `
                                                <tr>
                                                    <td>${student.studentId}</td>
                                                    <td>${student.fullName}</td>
                                                    <td>${student.email}</td>
                                                    <td><span class="badge bg-success">${student.enrollmentStatus}</span></td>
                                                    <td>${new Date(student.enrollmentDate).toLocaleDateString()}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-outline-danger" onclick="removeStudentFromClass('${student._id}', '${classId}')">
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="addStudentToClass('${classId}')">Add Students</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.showModal(modalHtml, 'manageStudentsModal');
        } catch (error) {
            this.showAlert('Failed to load students', 'danger');
        }
    }

    async viewClassGrades(classId) {
        try {
            const response = await this.apiCall(`/grades?class=${classId}`);
            const grades = response.data.grades;
            
            this.showGrades();
            this.renderGrades(grades);
            this.showAlert('Showing grades for selected class', 'info');
        } catch (error) {
            this.showAlert('Failed to load class grades', 'danger');
        }
    }

    async viewStudentDetails(id) {
        try {
            const response = await this.apiCall(`/students/${id}`);
            const student = response.data.student;
            
            const modalHtml = `
                <div class="modal fade" id="studentDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${student.fullName}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Student ID:</strong> ${student.studentId}</p>
                                        <p><strong>Email:</strong> ${student.email}</p>
                                        <p><strong>Phone:</strong> ${student.phoneNumber || 'N/A'}</p>
                                        ${student.dateOfBirth ? `<p><strong>Date of Birth:</strong> ${new Date(student.dateOfBirth).toLocaleDateString()}</p>` : ''}
                                        ${student.age ? `<p><strong>Age:</strong> ${student.age}</p>` : ''}
                                    </div>
                                    <div class="col-md-6">
                                        ${student.academicInfo?.major ? `<p><strong>Major:</strong> ${student.academicInfo.major}</p>` : ''}
                                        ${student.academicInfo?.year ? `<p><strong>Year:</strong> ${student.academicInfo.year}</p>` : ''}
                                        ${student.academicInfo?.gpa ? `<p><strong>GPA:</strong> ${student.academicInfo.gpa}</p>` : ''}
                                        <p><strong>Enrolled:</strong> ${new Date(student.academicInfo?.enrollmentDate || student.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="editStudent('${id}')">Edit Student</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.showModal(modalHtml, 'studentDetailsModal');
        } catch (error) {
            this.showAlert('Failed to load student details', 'danger');
        }
    }

    async editStudentDetails(id) {
        try {
            const response = await this.apiCall(`/students/${id}`);
            const student = response.data.student;
            
            // Pre-fill the add student form with existing data
            document.getElementById('studentId').value = student.studentId;
            document.getElementById('studentFirstName').value = student.firstName;
            document.getElementById('studentLastName').value = student.lastName;
            document.getElementById('studentEmail').value = student.email;
            document.getElementById('studentPhone').value = student.phoneNumber || '';
            document.getElementById('studentDateOfBirth').value = student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '';
            document.getElementById('studentMajor').value = student.academicInfo?.major || '';
            document.getElementById('studentYear').value = student.academicInfo?.year || '';
            document.getElementById('studentGPA').value = student.academicInfo?.gpa || '';
            
            // Change form submission to update instead of create
            const form = document.getElementById('addStudentForm');
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.handleUpdateStudent(id);
            };
            
            // Update modal title
            document.querySelector('#addStudentModal .modal-title').textContent = 'Edit Student';
            document.querySelector('#addStudentModal button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Update Student';
            
            const modal = new bootstrap.Modal(document.getElementById('addStudentModal'));
            modal.show();
        } catch (error) {
            this.showAlert('Failed to load student for editing', 'danger');
        }
    }

    async handleUpdateStudent(id) {
        try {
            this.showLoading();

            const studentData = {
                studentId: document.getElementById('studentId').value,
                firstName: document.getElementById('studentFirstName').value,
                lastName: document.getElementById('studentLastName').value,
                email: document.getElementById('studentEmail').value,
                phoneNumber: document.getElementById('studentPhone').value,
                dateOfBirth: document.getElementById('studentDateOfBirth').value || undefined,
                academicInfo: {
                    major: document.getElementById('studentMajor').value,
                    year: document.getElementById('studentYear').value,
                    gpa: document.getElementById('studentGPA').value ? parseFloat(document.getElementById('studentGPA').value) : undefined
                }
            };

            const response = await this.apiCall(`/students/${id}`, 'PUT', studentData);
            this.showAlert('Student updated successfully!', 'success');
            this.loadStudents(); // Refresh the list
            bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
            
            // Reset form handler
            this.resetStudentForm();
        } catch (error) {
            this.showAlert('Failed to update student: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    async deleteGrade(id) {
        try {
            this.showLoading();
            await this.apiCall(`/grades/${id}`, 'DELETE');
            this.showAlert('Grade deleted successfully!', 'success');
            this.loadGrades(); // Refresh the list
        } catch (error) {
            this.showAlert('Failed to delete grade: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    // Utility method to show modals
    showModal(modalHtml, modalId) {
        // Remove existing modal
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
    }

    // Reset form handlers
    resetStudentForm() {
        const form = document.getElementById('addStudentForm');
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            this.handleAddStudent(formData);
        };
        
        // Reset modal title
        document.querySelector('#addStudentModal .modal-title').textContent = 'Add New Student';
        document.querySelector('#addStudentModal button[type="submit"]').innerHTML = '<i class="fas fa-user-plus me-2"></i>Add Student';
        
        form.reset();
    }
}

// Global Functions (for onclick handlers)
function showLoginModal() {
    const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
    if (registerModal) registerModal.hide();
    
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

function showRegisterModal() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (loginModal) loginModal.hide();
    
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
}

function showDashboard() {
    app.showDashboard();
}

function showClasses() {
    app.showClasses();
}

function showStudents() {
    app.showStudents();
}

function showGrades() {
    app.showGrades();
}

function showCalendar() {
    app.showCalendar();
}

function showProfile() {
    console.log('Show profile');
}

function showSettings() {
    console.log('Show settings');
}

function logout() {
    app.logout();
}

function testLogin() {
    if (!app) {
        console.error('App not initialized yet');
        setTimeout(testLogin, 100); // Retry after 100ms
        return;
    }
    app.testLogin();
}

function showAddClassModal() {
    // Set current year as default
    document.getElementById('classYear').value = new Date().getFullYear();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addClassModal'));
    modal.show();
}

function showAddStudentModal() {
    const modal = new bootstrap.Modal(document.getElementById('addStudentModal'));
    modal.show();
}

async function showAddGradeModal() {
    try {
        // Load classes for dropdown
        const classResponse = await app.apiCall('/classes');
        const classSelect = document.getElementById('gradeClass');
        classSelect.innerHTML = '<option value="">Select Class</option>' + 
            classResponse.data.classes.map(cls => 
                `<option value="${cls._id}">${cls.courseCode} - ${cls.className}</option>`
            ).join('');

        // Load students for dropdown
        const studentResponse = await app.apiCall('/students');
        const studentSelect = document.getElementById('gradeStudent');
        studentSelect.innerHTML = '<option value="">Select Student</option>' + 
            studentResponse.data.students.map(student => 
                `<option value="${student._id}">${student.fullName} (${student.studentId})</option>`
            ).join('');

        const modal = new bootstrap.Modal(document.getElementById('addGradeModal'));
        modal.show();
    } catch (error) {
        console.error('Failed to load data for grade modal:', error);
        app.showAlert('Failed to load required data', 'danger');
    }
}

async function showAddEventModal(startDate = null, endDate = null) {
    try {
        // Load classes for dropdown
        const response = await app.apiCall('/classes');
        const classSelect = document.getElementById('eventClass');
        classSelect.innerHTML = '<option value="">No Class Associated</option>' + 
            response.data.classes.map(cls => 
                `<option value="${cls._id}">${cls.courseCode} - ${cls.className}</option>`
            ).join('');

        // Set default dates if provided
        if (startDate) {
            document.getElementById('eventStartDate').value = startDate;
        }
        if (endDate) {
            document.getElementById('eventEndDate').value = endDate;
        }

        const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
        modal.show();
    } catch (error) {
        console.error('Failed to load classes for event modal:', error);
        const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
        modal.show();
    }
}

function viewClass(id) {
    // Show detailed class information in a modal or navigate to a detailed view
    app.viewClassDetails(id);
}

function manageStudents(id) {
    // Show students enrolled in this class with options to add/remove
    app.manageClassStudents(id);
}

function viewGrades(id) {
    // Show grades for this specific class
    app.viewClassGrades(id);
}

function viewStudent(id) {
    // Show detailed student information
    app.viewStudentDetails(id);
}

function editStudent(id) {
    // Show edit student modal with pre-filled data
    app.editStudentDetails(id);
}

function editGrade(id) {
    // Show edit grade modal with pre-filled data
    app.editGradeDetails(id);
}

function deleteGrade(id) {
    // Confirm and delete grade
    if (confirm('Are you sure you want to delete this grade?')) {
        app.deleteGrade(id);
    }
}

function editEvent(id) {
    // Show edit event modal with pre-filled data
    app.editEventDetails(id);
}

// Initialize the app when DOM is ready
let app; // Global app variable

document.addEventListener('DOMContentLoaded', function() {
    try {
        app = new ClassManagementApp();
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Show a basic error message if initialization fails
        document.body.innerHTML = `
            <div class="container mt-5">
                <div class="alert alert-danger">
                    <h4>Initialization Error</h4>
                    <p>Failed to initialize the application. Please refresh the page.</p>
                    <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
                </div>
            </div>
        `;
    }
});
