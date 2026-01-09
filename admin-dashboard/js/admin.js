// Zambuko Admin Dashboard JavaScript

let currentAdmin = null;
let charts = {};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function waitForDatabase() {
    return new Promise((resolve) => {
        const checkDb = setInterval(() => {
            if (window.ZambukoDB && window.ZambukoDB.db) {
                clearInterval(checkDb);
                resolve();
            }
        }, 100);
        setTimeout(() => {
            clearInterval(checkDb);
            resolve();
        }, 5000);
    });
}

async function initApp() {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Check for existing session
    const session = Zambuko.getSession('admin');
    if (session) {
        currentAdmin = session;
        showMainApp();
    }

    // Setup login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Wait for database
    await waitForDatabase();

    // Simple admin auth
    if (email === 'admin@zambuko.co.zw' && password === 'admin123') {
        currentAdmin = { email, name: 'Admin User', role: 'Super Admin' };
        Zambuko.setSession('admin', currentAdmin);
        showMainApp();
        Zambuko.showToast('Welcome to Zambuko Admin!', 'success');
    } else {
        Zambuko.showToast('Invalid credentials', 'error');
    }
}

function showMainApp() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    document.getElementById('adminName').textContent = currentAdmin.name;
    
    // Load dashboard
    loadDashboard();
    initCharts();
    loadNotifications();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function navigateTo(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show target view
    document.getElementById(viewName + 'View').classList.add('active');
    
    // Update sidebar
    document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
    event.target.closest('.sidebar-item')?.classList.add('active');

    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'doctors': 'Manage Doctors',
        'patients': 'Manage Patients',
        'consultations': 'Consultations',
        'emergencies': 'Emergency Dispatch',
        'dispatches': 'Dispatch Units',
        'payments': 'Payments & Revenue',
        'analytics': 'Analytics & Reports',
        'settings': 'System Settings'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || 'Dashboard';

    // Load view data
    switch(viewName) {
        case 'doctors': loadDoctors(); break;
        case 'patients': loadPatients(); break;
        case 'consultations': loadConsultations(); break;
        case 'emergencies': loadEmergencies(); break;
        case 'dispatches': loadDispatches(); break;
        case 'payments': loadPayments(); break;
        case 'analytics': initAnalyticsCharts(); break;
    }

    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.remove('active');
    }
}

async function loadDashboard() {
    // Wait for database
    await waitForDatabase();
    
    // Load stats from real database
    const doctors = await ZambukoDB.getAll('doctors') || [];
    const patients = (await ZambukoDB.getAll('users') || []).filter(u => u.userType === 'patient');
    const consultations = await ZambukoDB.getAll('consultations') || [];
    const today = new Date().toDateString();
    const todayConsults = consultations.filter(c => new Date(c.startTime).toDateString() === today);

    document.getElementById('totalDoctors').textContent = doctors.length;
    document.getElementById('doctorsOnline').textContent = doctors.filter(d => d.status === 'AVAILABLE').length + ' online';
    document.getElementById('totalPatients').textContent = patients.length;
    document.getElementById('totalConsults').textContent = todayConsults.length;
    document.getElementById('totalRevenue').textContent = '$' + (todayConsults.length * 5).toFixed(2);

    // Load recent consultations
    loadRecentConsultations();

    // Load doctor status
    loadDoctorStatus();

    // Load emergencies
    loadActiveEmergencies();
}

async function loadRecentConsultations() {
    const consultations = await ZambukoDB.getAll('consultations') || [];
    const container = document.getElementById('recentConsults');

    if (consultations.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No recent consultations</p></div>';
        return;
    }

    container.innerHTML = consultations.slice(-5).reverse().map(cons => `
        <div class="activity-item">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cons.patientName || 'Patient')}&background=6B7280&color=fff" 
                 alt="${cons.patientName}" class="activity-avatar">
            <div class="activity-info">
                <strong>${cons.patientName || 'Patient'}</strong>
                <span>with ${cons.doctorName || 'Doctor'} • ${Zambuko.formatDate(cons.startTime)}</span>
            </div>
            <span class="badge badge-${cons.status?.toLowerCase() || 'completed'}">${cons.status || 'COMPLETED'}</span>
        </div>
    `).join('');
}

async function loadDoctorStatus() {
    const doctors = await ZambukoDB.getAll('doctors') || [];
    const container = document.getElementById('doctorStatus');

    if (doctors.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No doctors registered</p></div>';
        return;
    }

    container.innerHTML = doctors.map(doc => `
        <div class="activity-item">
            <img src="${doc.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.fullName || doc.name || 'Doctor')}&background=238636&color=fff`}" alt="${doc.fullName || doc.name}" class="activity-avatar">
            <div class="activity-info">
                <strong>${doc.fullName || doc.name || 'Doctor'}</strong>
                <span>${doc.specialty || 'General Practice'}</span>
            </div>
            <span class="badge badge-${(doc.status || 'offline').toLowerCase().replace('_', '-')}">${(doc.status || 'OFFLINE').replace('_', ' ')}</span>
        </div>
    `).join('');
}

async function loadActiveEmergencies() {
    const emergencies = await ZambukoDB.getAll('emergencies') || [];
    const active = emergencies.filter(e => e.status !== 'RESOLVED');
    const container = document.getElementById('activeEmergencies');

    if (active.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No active emergencies</p></div>';
        return;
    }

    container.innerHTML = active.map(em => `
        <div class="alert-item">
            <span style="font-size: 1.5rem;">🚨</span>
            <div style="flex: 1;">
                <strong>${em.patientName || 'Patient'}</strong>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">${em.description || 'Emergency dispatch requested'}</p>
            </div>
            <span class="badge badge-emergency">${em.status || 'PENDING'}</span>
        </div>
    `).join('');
}

function initCharts() {
    // Consultations Chart
    const consultsCtx = document.getElementById('consultsChart')?.getContext('2d');
    if (consultsCtx) {
        charts.consults = new Chart(consultsCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Consultations',
                    data: [12, 19, 15, 25, 22, 18, 14],
                    borderColor: '#0D9488',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Triage Chart
    const triageCtx = document.getElementById('triageChart')?.getContext('2d');
    if (triageCtx) {
        charts.triage = new Chart(triageCtx, {
            type: 'doughnut',
            data: {
                labels: ['Low', 'Moderate', 'High', 'Emergency'],
                datasets: [{
                    data: [45, 30, 18, 7],
                    backgroundColor: ['#10B981', '#F59E0B', '#EA580C', '#DC2626']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// Doctors Management
async function loadDoctors() {
    const doctors = await ZambukoDB.getAll('doctors') || [];
    const tbody = document.getElementById('doctorsTableBody');

    if (doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No doctors registered yet</td></tr>';
        return;
    }

    tbody.innerHTML = doctors.map(doc => `
        <tr>
            <td>
                <div class="table-doctor">
                    <img src="${doc.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.fullName || doc.name || 'Doctor')}&background=238636&color=fff`}" alt="${doc.fullName || doc.name}">
                    <div>
                        <strong>${doc.fullName || doc.name || 'Doctor'}</strong>
                        <br><span style="font-size: 0.85rem; color: var(--text-secondary);">${doc.odctrId || doc.id || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>${doc.specialty || 'General Practice'}</td>
            <td><span class="badge badge-${(doc.status || 'offline').toLowerCase().replace('_', '-')}">${(doc.status || 'OFFLINE').replace('_', ' ')}</span></td>
            <td>⭐ ${doc.rating || 4.5}</td>
            <td>${doc.queue || 0}</td>
            <td>${doc.emergencyCapable ? '✓ Yes' : '✕ No'}</td>
            <td>
                <button class="action-btn edit" onclick="editDoctor('${doc.id}')">Edit</button>
                <button class="action-btn delete" onclick="deleteDoctor('${doc.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function filterDoctors() {
    const search = document.getElementById('doctorSearch').value.toLowerCase();
    const status = document.getElementById('doctorStatusFilter').value;
    const specialty = document.getElementById('specialtyFilter').value;

    let filtered = await ZambukoDB.getAll('doctors') || [];

    if (search) {
        filtered = filtered.filter(d => (d.fullName || d.name || '').toLowerCase().includes(search));
    }
    if (status) {
        filtered = filtered.filter(d => d.status === status);
    }
    if (specialty) {
        filtered = filtered.filter(d => d.specialty === specialty);
    }

    const tbody = document.getElementById('doctorsTableBody');
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No matching doctors found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(doc => `
        <tr>
            <td>
                <div class="table-doctor">
                    <img src="${doc.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.fullName || doc.name || 'Doctor')}&background=238636&color=fff`}" alt="${doc.fullName || doc.name}">
                    <div>
                        <strong>${doc.fullName || doc.name || 'Doctor'}</strong>
                        <br><span style="font-size: 0.85rem; color: var(--text-secondary);">${doc.odctrId || doc.id || 'N/A'}</span>
                    </div>
                </div>
            </td>
            <td>${doc.specialty || 'General Practice'}</td>
            <td><span class="badge badge-${(doc.status || 'offline').toLowerCase().replace('_', '-')}">${(doc.status || 'OFFLINE').replace('_', ' ')}</span></td>
            <td>⭐ ${doc.rating || 4.5}</td>
            <td>${doc.queue || 0}</td>
            <td>${doc.emergencyCapable ? '✓ Yes' : '✕ No'}</td>
            <td>
                <button class="action-btn edit" onclick="editDoctor('${doc.id}')">Edit</button>
                <button class="action-btn delete" onclick="deleteDoctor('${doc.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function showAddDoctorModal() {
    document.getElementById('addDoctorModal').classList.add('active');
}

async function addDoctor() {
    const form = document.getElementById('addDoctorForm');
    const formData = new FormData(form);
    
    const doctors = await ZambukoDB.getAll('doctors') || [];
    const newDoctor = {
        id: Date.now(),
        odctrId: 'D' + (doctors.length + 1).toString().padStart(3, '0'),
        fullName: 'Dr. ' + formData.get('name'),
        name: 'Dr. ' + formData.get('name'),
        specialty: formData.get('specialty'),
        status: 'OFFLINE',
        rating: 4.5,
        queue: 0,
        emergencyCapable: formData.get('emergencyCapable') === 'true',
        photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.get('name'))}&background=238636&color=fff`,
        location: { lat: -17.8292, lng: 31.0522 },
        password: '123456',
        createdAt: new Date().toISOString()
    };

    await ZambukoDB.add('doctors', newDoctor);
    
    closeModal('addDoctorModal');
    loadDoctors();
    loadDashboard();
    Zambuko.showToast('Doctor added successfully!', 'success');
}

function editDoctor(id) {
    Zambuko.showToast('Edit functionality - open modal with doctor data', 'info');
}

async function deleteDoctor(id) {
    if (confirm('Are you sure you want to delete this doctor?')) {
        await ZambukoDB.delete('doctors', id);
        loadDoctors();
        loadDashboard();
        Zambuko.showToast('Doctor deleted', 'success');
    }
}

// Patients Management
async function loadPatients() {
    const allUsers = await ZambukoDB.getAll('users') || [];
    const patients = allUsers.filter(u => u.userType === 'patient');
    const tbody = document.getElementById('patientsTableBody');
    const consultations = await ZambukoDB.getAll('consultations') || [];

    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No patients registered yet</td></tr>';
        return;
    }

    tbody.innerHTML = patients.map(patient => {
        const patientConsults = consultations.filter(c => c.patientId === patient.id);
        const lastVisit = patientConsults.length > 0 ? 
            Zambuko.formatDate(patientConsults[patientConsults.length - 1].startTime) : 'Never';

        return `
            <tr>
                <td>
                    <div class="table-doctor">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--dark-tertiary); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-weight: 600; border: 1px solid var(--border-color);">
                            ${(patient.fullName || patient.name || 'P').charAt(0)}
                        </div>
                        <div>
                            <strong>${patient.fullName || patient.name || 'Patient'}</strong>
                            <br><span style="font-size: 0.85rem; color: var(--text-secondary);">${patient.odctrId || patient.id || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td>${patient.phone || 'N/A'}</td>
                <td>${patient.email || 'N/A'}</td>
                <td>${patientConsults.length}</td>
                <td>${lastVisit}</td>
                <td>
                    <button class="action-btn edit" onclick="viewPatient('${patient.id}')">View</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function filterPatients() {
    const search = document.getElementById('patientSearch').value.toLowerCase();
    const allUsers = await ZambukoDB.getAll('users') || [];
    let filtered = allUsers.filter(u => u.userType === 'patient');

    if (search) {
        filtered = filtered.filter(p => 
            (p.fullName || p.name || '').toLowerCase().includes(search) || 
            (p.phone || '').includes(search) ||
            (p.email || '').toLowerCase().includes(search)
        );
    }

    // Re-render with filtered data
    const tbody = document.getElementById('patientsTableBody');
    const consultations = await ZambukoDB.getAll('consultations') || [];

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No matching patients found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(patient => {
        const patientConsults = consultations.filter(c => c.patientId === patient.id);
        const lastVisit = patientConsults.length > 0 ? 
            Zambuko.formatDate(patientConsults[patientConsults.length - 1].startTime) : 'Never';

        return `
            <tr>
                <td>
                    <div class="table-doctor">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--dark-tertiary); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-weight: 600; border: 1px solid var(--border-color);">
                            ${(patient.fullName || patient.name || 'P').charAt(0)}
                        </div>
                        <div>
                            <strong>${patient.fullName || patient.name || 'Patient'}</strong>
                            <br><span style="font-size: 0.85rem; color: var(--text-secondary);">${patient.odctrId || patient.id || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td>${patient.phone || 'N/A'}</td>
                <td>${patient.email || 'N/A'}</td>
                <td>${patientConsults.length}</td>
                <td>${lastVisit}</td>
                <td>
                    <button class="action-btn edit" onclick="viewPatient('${patient.id}')">View</button>
                </td>
            </tr>
        `;
    }).join('');
}

function viewPatient(id) {
    Zambuko.showToast('View patient details', 'info');
}

function showAddPatientModal() {
    Zambuko.showToast('Add patient modal', 'info');
}

// Consultations
async function loadConsultations() {
    const consultations = await ZambukoDB.getAll('consultations') || [];
    const tbody = document.getElementById('consultationsTableBody');

    if (consultations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">No consultations yet</td></tr>';
        return;
    }

    tbody.innerHTML = consultations.reverse().map(cons => `
        <tr>
            <td style="font-size: 0.85rem;">${cons.id}</td>
            <td>${cons.patientName || 'Patient'}</td>
            <td>${cons.doctorName || 'Doctor'}</td>
            <td>${Zambuko.formatDate(cons.startTime)}</td>
            <td>${cons.duration ? Math.floor(cons.duration / 60) + ' min' : '-'}</td>
            <td><span class="badge badge-${(cons.triageLevel || 'low').toLowerCase()}">${cons.triageLevel || 'LOW'}</span></td>
            <td><span class="badge badge-${(cons.status || 'completed').toLowerCase()}">${cons.status || 'COMPLETED'}</span></td>
            <td>
                <button class="action-btn edit" onclick="viewConsultation('${cons.id}')">View</button>
            </td>
        </tr>
    `).join('');
}

function filterConsultations() {
    // Filter logic similar to others
    loadConsultations();
}

function viewConsultation(id) {
    Zambuko.showToast('View consultation details', 'info');
}

// Emergencies
async function loadEmergencies() {
    const dispatches = await ZambukoDB.getAll('dispatches') || [];
    const emergencies = await ZambukoDB.getAll('emergencies') || [];
    
    // Stats
    document.getElementById('activeRespondersCount').textContent = 
        dispatches.filter(r => r.status === 'AVAILABLE').length;
    document.getElementById('avgResponseTime').textContent = '8 min';
    document.getElementById('resolvedToday').textContent = emergencies.filter(e => e.status === 'RESOLVED').length;

    // Responders list
    const respondersContainer = document.getElementById('respondersList');
    
    if (dispatches.length === 0) {
        respondersContainer.innerHTML = '<div class="empty-state"><p>No dispatch units registered</p></div>';
    } else {
        respondersContainer.innerHTML = dispatches.map(r => `
            <div class="responder-card">
                <div class="responder-icon">${r.type === 'ambulance' ? '🚑' : '🏥'}</div>
                <div class="responder-info">
                    <strong>${r.name || 'Dispatch Unit'}</strong>
                    <span class="badge badge-${(r.status || 'offline').toLowerCase().replace('_', '-')}">${(r.status || 'OFFLINE').replace('_', ' ')}</span>
                </div>
            </div>
        `).join('');
    }

    // Emergency log
    const logContainer = document.getElementById('emergencyLog');
    
    if (emergencies.length === 0) {
        logContainer.innerHTML = '<div class="empty-state"><p>No emergency records</p></div>';
    } else {
        logContainer.innerHTML = emergencies.map(em => `
            <div class="alert-item ${em.status === 'RESOLVED' ? 'resolved' : ''}">
                <span style="font-size: 1.5rem;">${em.status === 'RESOLVED' ? '✓' : '🚨'}</span>
                <div style="flex: 1;">
                    <strong>${em.patientName || 'Patient'}</strong>
                    <p style="font-size: 0.9rem; color: var(--gray);">${em.description || 'Emergency'}</p>
                    <span style="font-size: 0.8rem; color: var(--gray);">${Zambuko.formatDate(em.timestamp)}</span>
                </div>
                <span class="badge badge-${em.status === 'RESOLVED' ? 'low' : 'emergency'}">${em.status}</span>
            </div>
        `).join('');
    }
}

// Payments
function loadPayments() {
    const consultations = Zambuko.loadFromLocal('doctor_consultations') || [];
    const feePerConsult = 5;

    document.getElementById('grossRevenue').textContent = '$' + (consultations.length * feePerConsult).toFixed(2);
    document.getElementById('totalTransactions').textContent = consultations.length;
    document.getElementById('avgTransaction').textContent = '$' + feePerConsult.toFixed(2);

    // Mock payment method distribution
    document.getElementById('ecocashPercent').textContent = '65%';
    document.getElementById('onemoneyPercent').textContent = '25%';
    document.getElementById('telecashPercent').textContent = '10%';

    // Transactions list
    const container = document.getElementById('transactionsList');
    
    if (consultations.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Transaction ID</th>
                    <th>Patient</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${consultations.slice(-10).reverse().map(cons => `
                    <tr>
                        <td>TXN${Date.parse(cons.startTime)}</td>
                        <td>${cons.patientName || 'Patient'}</td>
                        <td style="color: var(--success); font-weight: 600;">$${feePerConsult.toFixed(2)}</td>
                        <td>EcoCash</td>
                        <td>${Zambuko.formatDate(cons.startTime)}</td>
                        <td><span class="badge badge-low">Success</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function loadPaymentStats() {
    loadPayments();
}

// Analytics
function initAnalyticsCharts() {
    // Trends Chart
    const trendsCtx = document.getElementById('trendsChart')?.getContext('2d');
    if (trendsCtx && !charts.trends) {
        charts.trends = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: 'Consultations',
                    data: Array.from({length: 30}, () => Math.floor(Math.random() * 30) + 10),
                    borderColor: '#0D9488',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Specialties Chart
    const specialtiesCtx = document.getElementById('specialtiesChart')?.getContext('2d');
    if (specialtiesCtx && !charts.specialties) {
        charts.specialties = new Chart(specialtiesCtx, {
            type: 'bar',
            data: {
                labels: ['General', 'Pediatrics', 'Cardiology', 'Dermatology'],
                datasets: [{
                    data: [45, 25, 20, 10],
                    backgroundColor: ['#0D9488', '#3B82F6', '#F59E0B', '#10B981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Hours Chart
    const hoursCtx = document.getElementById('hoursChart')?.getContext('2d');
    if (hoursCtx && !charts.hours) {
        charts.hours = new Chart(hoursCtx, {
            type: 'bar',
            data: {
                labels: ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'],
                datasets: [{
                    data: [8, 15, 22, 18, 25, 20, 12],
                    backgroundColor: '#0D9488'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

function exportReport() {
    Zambuko.showToast('Generating PDF report...', 'info');
    setTimeout(() => {
        Zambuko.showToast('Report downloaded!', 'success');
    }, 2000);
}

// Settings
function saveSettings() {
    Zambuko.showToast('Settings saved successfully!', 'success');
}

// Notifications
function loadNotifications() {
    const container = document.getElementById('notificationsList');
    const notifications = [
        { title: 'New Doctor Registration', message: 'Dr. Sarah Moyo has registered', time: '5 min ago', unread: true },
        { title: 'Emergency Alert', message: 'Emergency dispatch requested in Harare CBD', time: '15 min ago', unread: true },
        { title: 'System Update', message: 'New features have been deployed', time: '1 hour ago', unread: false }
    ];

    container.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.unread ? 'unread' : ''}">
            <h5>${n.title}</h5>
            <p>${n.message}</p>
            <time>${n.time}</time>
        </div>
    `).join('');

    document.getElementById('notifBadge').textContent = notifications.filter(n => n.unread).length;
}

function showNotifications() {
    document.getElementById('notificationsPanel').classList.add('active');
}

function closeNotifications() {
    document.getElementById('notificationsPanel').classList.remove('active');
}

// Modal helpers
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// ============ DISPATCH MANAGEMENT ============

async function loadDispatches() {
    const tbody = document.getElementById('dispatchesTableBody');
    if (!tbody) return;

    try {
        const dispatches = await ZambukoDB.getAll('dispatches');
        
        if (dispatches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                        No dispatch units registered yet. Click "Add Dispatch Unit" to get started.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = dispatches.map(dispatch => `
            <tr>
                <td><strong>${dispatch.unitId}</strong></td>
                <td>${dispatch.name}</td>
                <td>
                    <span class="badge ${dispatch.type.toLowerCase()}">${dispatch.type}</span>
                </td>
                <td>
                    <div style="font-size: 0.9rem;">
                        ${dispatch.address || 'N/A'}<br>
                        <small style="color: #666;">
                            📍 ${dispatch.location?.lat?.toFixed(4)}, ${dispatch.location?.lng?.toFixed(4)}
                        </small>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${dispatch.status.toLowerCase()}">${dispatch.status}</span>
                </td>
                <td>
                    <div style="font-size: 0.9rem;">
                        📞 ${dispatch.phone}<br>
                        <small style="color: #666;">✉️ ${dispatch.email}</small>
                    </div>
                </td>
                <td>
                    <button class="btn-icon" onclick="viewDispatch('${dispatch.id}')" title="View">👁️</button>
                    <button class="btn-icon" onclick="editDispatch('${dispatch.id}')" title="Edit">✏️</button>
                    <button class="btn-icon" onclick="deleteDispatch('${dispatch.id}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading dispatches:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: red;">
                    Error loading dispatches: ${error.message}
                </td>
            </tr>
        `;
    }
}

function getCurrentLocationForDispatch() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }

    showToast('Getting location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.querySelector('#addDispatchForm input[name="lat"]').value = position.coords.latitude.toFixed(4);
            document.querySelector('#addDispatchForm input[name="lng"]').value = position.coords.longitude.toFixed(4);
            showToast('Location captured!', 'success');
        },
        (error) => {
            showToast('Could not get location: ' + error.message, 'error');
        },
        { enableHighAccuracy: true }
    );
}

async function addDispatch() {
    const form = document.getElementById('addDispatchForm');
    const formData = new FormData(form);
    
    const dispatchData = {
        unitId: formData.get('unitId'),
        name: formData.get('name'),
        type: formData.get('type'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        password: formData.get('password'),
        address: formData.get('address'),
        location: {
            lat: parseFloat(formData.get('lat')),
            lng: parseFloat(formData.get('lng'))
        },
        equipment: formData.get('equipment')
    };

    // Validation
    if (!dispatchData.unitId || !dispatchData.name || !dispatchData.type || !dispatchData.phone || 
        !dispatchData.email || !dispatchData.password || !dispatchData.location.lat || !dispatchData.location.lng) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    try {
        // Create user account for dispatch
        const user = await AuthService.register({
            fullName: dispatchData.name,
            email: dispatchData.email,
            phone: dispatchData.phone,
            password: dispatchData.password,
            userType: 'dispatch'
        });

        // Create dispatch profile
        const dispatch = {
            id: 'DISP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            userId: user.id,
            unitId: dispatchData.unitId,
            name: dispatchData.name,
            type: dispatchData.type,
            phone: dispatchData.phone,
            email: dispatchData.email,
            address: dispatchData.address,
            location: dispatchData.location,
            equipment: dispatchData.equipment,
            status: 'OFFLINE',
            createdAt: new Date().toISOString()
        };

        await ZambukoDB.add('dispatches', dispatch);
        
        showToast('Dispatch unit added successfully!', 'success');
        closeModal('addDispatchModal');
        form.reset();
        loadDispatches();

    } catch (error) {
        console.error('Error adding dispatch:', error);
        showToast('Failed to add dispatch: ' + error.message, 'error');
    }
}

async function viewDispatch(id) {
    try {
        const dispatch = await ZambukoDB.get('dispatches', id);
        if (!dispatch) return;

        alert(`Dispatch Unit Details:\n\n` +
              `Unit ID: ${dispatch.unitId}\n` +
              `Name: ${dispatch.name}\n` +
              `Type: ${dispatch.type}\n` +
              `Status: ${dispatch.status}\n` +
              `Phone: ${dispatch.phone}\n` +
              `Email: ${dispatch.email}\n` +
              `Location: ${dispatch.location.lat}, ${dispatch.location.lng}\n` +
              `Address: ${dispatch.address || 'N/A'}\n` +
              `Equipment: ${dispatch.equipment || 'N/A'}`);
    } catch (error) {
        showToast('Error loading dispatch details', 'error');
    }
}

async function editDispatch(id) {
    showToast('Edit functionality coming soon', 'info');
}

async function deleteDispatch(id) {
    if (!confirm('Are you sure you want to delete this dispatch unit?')) return;

    try {
        await ZambukoDB.delete('dispatches', id);
        showToast('Dispatch unit deleted', 'success');
        loadDispatches();
    } catch (error) {
        showToast('Error deleting dispatch: ' + error.message, 'error');
    }
}

function showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function logout() {
    Zambuko.clearSession('admin');
    currentAdmin = null;
    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    Zambuko.showToast('Logged out successfully', 'info');
}

// Close notifications when clicking outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('notificationsPanel');
    const bell = document.querySelector('.notification-bell');
    
    if (panel.classList.contains('active') && 
        !panel.contains(e.target) && 
        !bell.contains(e.target)) {
        closeNotifications();
    }
});
