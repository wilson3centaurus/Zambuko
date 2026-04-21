/**
 * Zambuko Patient App - JavaScript
 * Using real IndexedDB database for persistence
 */

// ── Inline SVG icon constants ──────────────────────────────────
const SVG_STAR  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const SVG_PIN   = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SVG_USERS = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const SVG_TRUCK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
// ──────────────────────────────────────────────────────────────

let currentPatient = null;
let selectedDoctor = null;
let selectedSymptoms = [];
let triageResult = null;
let selectedPaymentMethod = 'ecocash';
let currentConsultation = null;
let emergencyLocation = null;
let chatPollInterval = null;
let userLocation = null;

// Symptom options for triage
const symptomOptions = [
    'Headache', 'Fever', 'Cough', 'Sore Throat', 'Body Aches',
    'Fatigue', 'Nausea', 'Vomiting', 'Diarrhea', 'Dizziness',
    'Chest Pain', 'Difficulty Breathing', 'Abdominal Pain', 'Back Pain',
    'Joint Pain', 'Skin Rash', 'Runny Nose'
];

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Wait for database to be ready
    await waitForDatabase();
    initApp();
});

// Wait for database initialization
async function waitForDatabase() {
    return new Promise((resolve) => {
        const checkDb = setInterval(() => {
            if (window.ZambukoDB && window.ZambukoDB.db) {
                clearInterval(checkDb);
                resolve();
            }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkDb);
            resolve();
        }, 5000);
    });
}

function initApp() {
    // Check for existing session
    const session = AuthService.getCurrentUser();
    if (session && session.userType === 'patient') {
        currentPatient = session;
        showMainApp();
    }

    // Setup forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Setup real-time validation
    setupValidation();

    // Populate symptom tags
    populateSymptomTags();

    // Load doctors initially (even before login for preview)
    setTimeout(() => loadAvailableDoctorsPreview(), 500);

    // Listen for real-time updates
    setupRealTimeListeners();
}

// ============ AUTHENTICATION ============

function showLoginForm() {
    document.getElementById('loginCard').style.display = 'block';
    document.getElementById('registerCard').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('registerCard').style.display = 'block';
}

function setupValidation() {
    // Email validation
    const regEmail = document.getElementById('regEmail');
    if (regEmail) {
        regEmail.addEventListener('blur', function() {
            const result = AuthService.validateEmail(this.value);
            showValidationHint('regEmailHint', result);
        });
    }

    // Phone validation
    const regPhone = document.getElementById('regPhone');
    if (regPhone) {
        regPhone.addEventListener('blur', function() {
            const result = AuthService.validatePhone(this.value);
            showValidationHint('regPhoneHint', result);
        });
    }

    // Password validation
    const regPassword = document.getElementById('regPassword');
    if (regPassword) {
        regPassword.addEventListener('input', function() {
            const result = AuthService.validatePassword(this.value);
            showValidationHint('regPasswordHint', result);
        });
    }
}

function showValidationHint(elementId, result) {
    const hint = document.getElementById(elementId);
    if (hint) {
        if (result.valid) {
            hint.textContent = '✓ Valid';
            hint.style.color = 'var(--success)';
        } else {
            hint.textContent = result.message;
            hint.style.color = 'var(--danger)';
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!identifier || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    showLoading('Logging in...');

    try {
        const user = await AuthService.login(identifier, password);
        
        if (user.userType !== 'patient') {
            AuthService.logout();
            throw new Error('Please use the Doctor app to login');
        }

        currentPatient = user;
        hideLoading();
        showMainApp();
        showToast('Welcome back, ' + user.fullName.split(' ')[0] + '!', 'success');
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const fullName = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    // Validate confirm password
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    showLoading('Creating your account...');

    try {
        const user = await AuthService.register({
            fullName,
            email,
            phone,
            password,
            userType: 'patient'
        });

        // Auto-login after registration
        currentPatient = user;
        sessionStorage.setItem('zambuko_session', JSON.stringify(user));

        hideLoading();
        showMainApp();
        showToast('Account created successfully!', 'success');
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
}

function showMainApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    document.getElementById('userName').textContent = currentPatient.fullName.split(' ')[0];
    
    // Request location access
    initLocation();
    
    // Load initial data
    loadAvailableDoctorsPreview();
    loadConsultationHistory();
    loadPrescriptions();
    loadPendingAppointment();

    // Refresh appointment status every 5 seconds
    setInterval(loadPendingAppointment, 5000);

    // Start polling for doctor availability
    AvailabilityService.startPolling((doctors) => {
        if (doctors) {
            updateDoctorsList(doctors);
        }
    }, 10000);
}

function logout() {
    AuthService.logout();
    AvailabilityService.stopPolling();
    if (chatPollInterval) clearInterval(chatPollInterval);
    
    currentPatient = null;
    selectedDoctor = null;
    currentConsultation = null;

    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    closeProfileModal();
    showToast('Logged out successfully', 'success');
}

// ============ NAVIGATION ============

function navigateTo(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show target view
    document.getElementById(viewId).classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const navMap = {
        'homeView': 0,
        'doctorsView': 1,
        'doctorProfileView': 1,
        'paymentView': 1,
        'consultationView': 1,
        'historyView': 2,
        'triageView': 0,
        'pharmacyView': 0
    };
    
    const navIndex = navMap[viewId];
    if (navIndex !== undefined) {
        document.querySelectorAll('.nav-item')[navIndex].classList.add('active');
    }

    // Refresh data for specific views
    if (viewId === 'doctorsView') {
        loadDoctors();
    } else if (viewId === 'historyView') {
        loadConsultationHistory();
    } else if (viewId === 'pharmacyView') {
        loadPrescriptions();
    }
}

// ============ TRIAGE / SYMPTOM CHECKER ============

function populateSymptomTags() {
    const container = document.getElementById('symptomTags');
    if (!container) return;
    
    container.innerHTML = symptomOptions.map(symptom => 
        `<span class="symptom-tag" onclick="toggleSymptom(this, '${symptom}')">${symptom}</span>`
    ).join('');
}

function toggleSymptom(element, symptom) {
    element.classList.toggle('selected');
    
    if (element.classList.contains('selected')) {
        selectedSymptoms.push(symptom.toLowerCase());
    } else {
        selectedSymptoms = selectedSymptoms.filter(s => s !== symptom.toLowerCase());
    }
}

function performTriageCheck() {
    if (selectedSymptoms.length === 0) {
        showToast('Please select at least one symptom', 'error');
        return;
    }

    const age = parseInt(document.getElementById('patientAge').value) || 30;
    
    // Perform triage using utility function
    triageResult = Zambuko.performTriage(selectedSymptoms, age, {}, []);
    
    // Display result
    const resultDiv = document.getElementById('triageResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="triage-result ${triageResult.level.toLowerCase()}">
            <div class="triage-level">${triageResult.level}</div>
            <p>${triageResult.recommendation}</p>
            <p style="margin-top: 12px; font-size: 0.9rem;">Risk Score: ${triageResult.score}</p>
        </div>
        ${triageResult.level === 'EMERGENCY' ? 
            `<button class="btn btn-danger btn-block" onclick="showEmergencyModal()">
                Request Emergency Dispatch
            </button>` :
            `<button class="btn btn-primary btn-block" onclick="navigateTo('doctorsView')" style="margin-top: 12px;">
                Find a Doctor
            </button>`
        }
    `;
}

// ============ DOCTORS ============

async function loadAvailableDoctorsPreview() {
    const container = document.getElementById('availableDoctorsPreview');
    if (!container) return;

    try {
        const doctors = await AvailabilityService.getAvailableDoctors();
        
        if (doctors.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>No doctors available right now</p>
                </div>
            `;
            return;
        }

        const displayDoctors = doctors.slice(0, 2);
        container.innerHTML = displayDoctors.map(doc => createDoctorCard(doc)).join('');
    } catch (error) {
        // Fallback to mock data if no doctors in DB yet
        const mockDoctors = Zambuko.data?.doctors?.filter(d => d.status === 'AVAILABLE')?.slice(0, 2) || [];
        if (mockDoctors.length > 0) {
            container.innerHTML = mockDoctors.map(doc => createDoctorCard(doc)).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>No doctors available right now</p>
                </div>
            `;
        }
    }
}

async function loadDoctors(specialty = null) {
    const container = document.getElementById('doctorsList');
    if (!container) return;

    try {
        let doctors = await AvailabilityService.getAvailableDoctors();
        
        // Filter by specialty if provided
        if (specialty) {
            doctors = doctors.filter(d => d.specialty === specialty);
        }

        if (doctors.length === 0) {
            // Fall back to mock data
            doctors = Zambuko.matchDoctors(
                currentPatient?.location || { lat: -17.8292, lng: 31.0522 },
                specialty,
                triageResult?.level || 'LOW'
            );
        }

        if (doctors.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No doctors available matching your criteria</p>
                </div>
            `;
            return;
        }

        container.innerHTML = doctors.map(doc => createDoctorCard(doc)).join('');
    } catch (error) {
        console.error('Error loading doctors:', error);
        // Fallback to mock
        const doctors = Zambuko.matchDoctors(
            currentPatient?.location || { lat: -17.8292, lng: 31.0522 },
            specialty,
            triageResult?.level || 'LOW'
        );
        container.innerHTML = doctors.map(doc => createDoctorCard(doc)).join('');
    }
}

function createDoctorCard(doc) {
    const docId = doc.id || doc.odctrId;
    const status = doc.status || 'AVAILABLE';
    const photo = doc.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name || 'Doctor')}&background=0D9488&color=fff`;
    
    return `
        <div class="doctor-card" onclick="showDoctorProfile('${docId}')">
            <img src="${photo}" alt="${doc.name}" class="doctor-avatar">
            <div class="doctor-info">
                <div class="doctor-name">${doc.name || 'Dr. Unknown'}</div>
                <div class="doctor-specialty">${doc.specialty || 'General Practice'}</div>
                <div class="doctor-meta">
                    <span class="doctor-rating">${SVG_STAR} ${doc.rating || '5.0'}</span>
                    ${doc.distance ? `<span>${SVG_PIN} ${doc.distance} km</span>` : ''}
                    <span>${SVG_USERS} ${doc.queue || 0} in queue</span>
                </div>
            </div>
            <span class="badge badge-${status.toLowerCase().replace('_', '-')}">${status.replace('_', ' ')}</span>
        </div>
    `;
}

function updateDoctorsList(doctors) {
    // Update the preview on home
    const preview = document.getElementById('availableDoctorsPreview');
    if (preview && doctors.length > 0) {
        const displayDoctors = doctors.slice(0, 2);
        preview.innerHTML = displayDoctors.map(doc => createDoctorCard(doc)).join('');
    }
}

function filterDoctors() {
    const specialty = document.getElementById('specialtyFilter').value;
    loadDoctors(specialty || null);
}

async function showDoctorProfile(doctorId) {
    // Try to find doctor in database first
    let doctor = await ZambukoDB.get('doctors', doctorId);
    
    // If not found, check mock data
    if (!doctor) {
        doctor = Zambuko.data?.doctors?.find(d => d.id === doctorId);
    }

    if (!doctor) {
        showToast('Doctor not found', 'error');
        return;
    }

    selectedDoctor = doctor;

    const content = document.getElementById('doctorProfileContent');
    const photo = doctor.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name || 'Doctor')}&background=0D9488&color=fff`;
    
    content.innerHTML = `
        <div class="doctor-profile-header">
            <img src="${photo}" alt="${doctor.name}" class="doctor-profile-avatar">
            <h2>${doctor.name || 'Dr. Unknown'}</h2>
            <p style="color: var(--gray);">${doctor.specialty || 'General Practice'}</p>
            <span class="badge badge-${(doctor.status || 'AVAILABLE').toLowerCase().replace('_', '-')}">${(doctor.status || 'AVAILABLE').replace('_', ' ')}</span>
        </div>

        <div class="card" style="margin-top: 20px;">
            <div class="stats-row">
                <div class="stat">
                    <div class="stat-value">${SVG_STAR} ${doctor.rating || '5.0'}</div>
                    <div class="stat-label">Rating</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${doctor.totalConsults || 0}</div>
                    <div class="stat-label">Consultations</div>
                </div>
                <div class="stat">
                    <div class="stat-value">$5</div>
                    <div class="stat-label">Fee</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h4>About</h4>
            <p style="color: var(--gray); margin-top: 8px;">
                ${doctor.bio || `Experienced ${doctor.specialty || 'General Practice'} specialist providing quality telehealth consultations.`}
            </p>
        </div>

        ${doctor.status === 'AVAILABLE' || doctor.status === 'BUSY' ? `
            <button class="btn btn-primary btn-block" onclick="navigateTo('paymentView')">
                Book Consultation - $5.00
            </button>
        ` : `
            <button class="btn btn-secondary btn-block" disabled>
                Doctor is currently offline
            </button>
        `}
    `;

    navigateTo('doctorProfileView');
}

// ============ PAYMENT ============

function selectPayment(element) {
    document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedPaymentMethod = element.dataset.method;
}

async function processPaymentFlow() {
    const phone = document.getElementById('paymentPhone').value.trim();
    
    if (!phone) {
        showToast('Please enter your phone number', 'error');
        return;
    }

    // Validate phone
    const phoneCheck = AuthService.validatePhone(phone);
    if (!phoneCheck.valid) {
        showToast(phoneCheck.message, 'error');
        return;
    }

    showLoading('Processing payment...');

    try {
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create consultation in database
        // Use odctrId (user ID) for doctorId to ensure doctor can find this request
        const doctorUserId = selectedDoctor.odctrId || selectedDoctor.id;
        const consultation = await ConsultationService.createRequest(
            currentPatient.id,
            doctorUserId,
            selectedSymptoms.join(', ') || 'General consultation',
            triageResult?.level || 'LOW'
        );

        currentConsultation = consultation;

        hideLoading();
        showToast('Appointment request sent! The doctor will confirm shortly.', 'success');

        // Show home view with appointment tracker
        loadPendingAppointment();
        navigateTo('homeView');
    } catch (error) {
        hideLoading();
        showToast('Payment failed: ' + error.message, 'error');
    }
}

// ============ APPOINTMENT TRACKING ============

async function loadPendingAppointment() {
    const banner = document.getElementById('pendingAppointmentBanner');
    if (!banner || !currentPatient) return;

    try {
        const consultations = await ConsultationService.getPatientConsultations(currentPatient.id);
        const active = consultations
            .filter(c => ['PENDING', 'SCHEDULED', 'IN_SESSION'].includes(c.status))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        if (!active) {
            banner.style.display = 'none';
            return;
        }

        const doctor = active.doctorId
            ? await ZambukoDB.getOneByIndex('doctors', 'odctrId', active.doctorId)
            : null;
        const doctorName = doctor?.name || selectedDoctor?.name || 'Your doctor';

        let statusHtml = '';
        if (active.status === 'PENDING') {
            statusHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">⏳</span>
                    <div>
                        <strong>Awaiting confirmation</strong><br>
                        <small style="color:var(--gray);">Waiting for ${doctorName} to confirm your appointment</small>
                    </div>
                </div>`;
        } else if (active.status === 'SCHEDULED') {
            const apptTime = new Date(active.scheduledTime);
            statusHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">✅</span>
                    <div>
                        <strong>Appointment Confirmed</strong><br>
                        <small style="color:var(--gray);">${doctorName} · ${apptTime.toLocaleString()}</small>
                    </div>
                </div>`;
        } else if (active.status === 'IN_SESSION') {
            statusHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">🟢</span>
                    <div>
                        <strong>Consultation in progress</strong><br>
                        <small style="color:var(--gray);">${doctorName} is ready for you</small>
                    </div>
                </div>
                <button class="btn btn-primary" style="margin-top:10px; width:100%;" onclick="navigateTo('consultationView')">Join Consultation</button>`;
            if (!currentConsultation) currentConsultation = active;
        }

        banner.style.display = 'block';
        banner.innerHTML = `
            <div class="card" style="border-left: 4px solid var(--primary); padding: 14px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <strong style="font-size:0.8rem; letter-spacing:0.05em; color:var(--gray);">YOUR APPOINTMENT</strong>
                    ${active.status !== 'IN_SESSION' ? `<button onclick="this.closest('#pendingAppointmentBanner').style.display='none'" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:1.2rem;line-height:1;">×</button>` : ''}
                </div>
                ${statusHtml}
            </div>
        `;
    } catch (error) {
        console.error('Error loading pending appointment:', error);
    }
}

// ============ WAITING FOR DOCTOR ============

let consultationPollInterval = null;

function showWaitingForDoctor() {
    const doctorInfo = document.getElementById('consultationDoctorInfo');
    const photo = selectedDoctor.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDoctor.name || 'Doctor')}&background=0D9488&color=fff`;
    
    doctorInfo.innerHTML = `
        <img src="${photo}" alt="${selectedDoctor.name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--primary); margin-bottom: 12px;">
        <h3 style="color: white;">${selectedDoctor.name}</h3>
        <p style="color: #ccc;">${selectedDoctor.specialty}</p>
    `;
    
    // Update placeholder to show waiting state
    const placeholder = document.querySelector('#videoContainer .video-placeholder');
    if (placeholder) {
        placeholder.innerHTML = `
            <div id="consultationDoctorInfo">
                <img src="${photo}" alt="${selectedDoctor.name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--primary); margin-bottom: 12px;">
                <h3 style="color: white;">${selectedDoctor.name}</h3>
                <p style="color: #ccc;">${selectedDoctor.specialty}</p>
            </div>
            <p style="color: #ffd700; margin-top: 20px;">⏳ Waiting for doctor to accept...</p>
            <div class="spinner" style="margin: 20px auto;"></div>
            <p style="color: #888; font-size: 0.9rem; margin-top: 10px;">You will be connected once the doctor accepts your request</p>
        `;
    }

    navigateTo('consultationView');

    // Start polling for doctor acceptance
    startConsultationPolling();
}

function startConsultationPolling() {
    if (consultationPollInterval) clearInterval(consultationPollInterval);
    
    consultationPollInterval = setInterval(async () => {
        if (!currentConsultation) {
            clearInterval(consultationPollInterval);
            return;
        }
        
        try {
            // Fetch updated consultation status
            const updated = await ZambukoDB.get('consultations', currentConsultation.id);
            
            // Check for any "accepted" status (ACCEPTED, IN_PROGRESS, IN_SESSION)
            if (updated && (updated.status === 'ACCEPTED' || updated.status === 'IN_PROGRESS' || updated.status === 'IN_SESSION')) {
                // Doctor accepted! Stop polling and show connected state
                clearInterval(consultationPollInterval);
                consultationPollInterval = null;
                currentConsultation = updated;
                showDoctorConnected();
            } else if (updated && (updated.status === 'CANCELLED' || updated.status === 'DECLINED')) {
                clearInterval(consultationPollInterval);
                consultationPollInterval = null;
                showToast('Consultation was cancelled', 'error');
                currentConsultation = null;
                navigateTo('homeView');
            }
        } catch (e) {
            console.error('Error polling consultation:', e);
        }
    }, 2000);
}

function showDoctorConnected() {
    showToast('Doctor has accepted! Starting consultation...', 'success');
    
    const photo = selectedDoctor.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDoctor.name || 'Doctor')}&background=0D9488&color=fff`;
    
    // Update to connected state
    const placeholder = document.querySelector('#videoContainer .video-placeholder');
    if (placeholder) {
        placeholder.innerHTML = `
            <div id="consultationDoctorInfo">
                <img src="${photo}" alt="${selectedDoctor.name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #2563eb; margin-bottom: 12px;">
                <h3 style="color: white;">${selectedDoctor.name}</h3>
                <p style="color: #ccc;">${selectedDoctor.specialty}</p>
            </div>
            <p style="color: #22c55e; margin-top: 20px;">Connected with Doctor</p>
            <p style="color: #888; font-size: 0.9rem; margin-top: 10px;">Use the chat button to message your doctor</p>
        `;
    }
    
    // Add connected class to video container
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer) {
        videoContainer.classList.add('connected');
    }

    // Start chat message polling
    startChatPolling();

    // Listen for new messages
    ChatService.startListening((data) => {
        if (data && data.message && data.message.consultationId === currentConsultation?.id) {
            addMessageToChat(data.message);
        }
    });
}

// ============ CONSULTATION ============

function startConsultationView() {
    const doctorInfo = document.getElementById('consultationDoctorInfo');
    const photo = selectedDoctor.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDoctor.name || 'Doctor')}&background=0D9488&color=fff`;
    
    doctorInfo.innerHTML = `
        <img src="${photo}" alt="${selectedDoctor.name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--primary); margin-bottom: 12px;">
        <h3 style="color: white;">${selectedDoctor.name}</h3>
        <p style="color: #ccc;">${selectedDoctor.specialty}</p>
    `;

    navigateTo('consultationView');

    // Start chat message polling
    startChatPolling();

    // Listen for new messages
    ChatService.startListening((data) => {
        if (data && data.message && data.message.consultationId === currentConsultation?.id) {
            addMessageToChat(data.message);
        }
    });
}

function toggleChat() {
    const chatPanel = document.getElementById('consultationChat');
    chatPanel.classList.toggle('active');
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    
    if (!content || !currentConsultation) return;

    if (currentConsultation.status === 'PENDING' || currentConsultation.status === 'SCHEDULED') {
        showToast('Please wait for the doctor to begin the consultation', 'info');
        return;
    }

    try {
        const message = await ChatService.sendMessage(
            currentConsultation.id,
            currentPatient.id,
            'patient',
            content
        );

        addMessageToChat(message);
        input.value = '';
    } catch (error) {
        showToast('Failed to send message', 'error');
    }
}

function addMessageToChat(message) {
    const container = document.getElementById('chatMessages');
    const isOwn = message.senderId === currentPatient.id;
    
    // Check if message already exists
    if (document.getElementById(`msg-${message.id}`)) return;

    const msgEl = document.createElement('div');
    msgEl.id = `msg-${message.id}`;
    msgEl.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    msgEl.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
    `;
    
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

async function startChatPolling() {
    if (chatPollInterval) clearInterval(chatPollInterval);
    
    chatPollInterval = setInterval(async () => {
        if (!currentConsultation) return;
        
        const messages = await ChatService.getMessages(currentConsultation.id);
        const container = document.getElementById('chatMessages');
        
        messages.forEach(msg => {
            if (!document.getElementById(`msg-${msg.id}`)) {
                addMessageToChat(msg);
            }
        });

        // Mark as read
        await ChatService.markAsRead(currentConsultation.id, currentPatient.id);
    }, 3000);
}

function toggleMute() {
    showToast('Microphone toggled', 'info');
}

function toggleVideo() {
    showToast('Camera toggled', 'info');
}

async function endConsultation() {
    if (confirm('Are you sure you want to end this consultation?')) {
        // Clear all polling intervals
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
        }
        if (consultationPollInterval) {
            clearInterval(consultationPollInterval);
            consultationPollInterval = null;
        }

        if (currentConsultation) {
            try {
                await ConsultationService.endConsultation(currentConsultation.id);
            } catch (e) {
                console.error('Error ending consultation:', e);
            }
        }

        // Reset video container state
        const videoContainer = document.getElementById('videoContainer');
        if (videoContainer) {
            videoContainer.classList.remove('connected');
        }

        currentConsultation = null;
        selectedDoctor = null;
        navigateTo('homeView');
        showToast('Consultation ended', 'success');
    }
}

// ============ HISTORY ============

async function loadConsultationHistory() {
    const container = document.getElementById('consultationHistory');
    if (!container || !currentPatient) return;

    try {
        const consultations = await ConsultationService.getPatientConsultations(currentPatient.id);
        
        if (consultations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No consultations yet</p>
                </div>
            `;
            return;
        }

        // Sort by date, newest first
        consultations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        container.innerHTML = consultations.map(c => `
            <div class="card" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>Consultation</h4>
                        <p style="color: var(--gray); font-size: 0.9rem;">${new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span class="badge badge-${c.status.toLowerCase()}">${c.status}</span>
                </div>
                <p style="margin-top: 8px; font-size: 0.9rem;">Symptoms: ${c.symptoms || 'General consultation'}</p>
                ${c.duration ? `<p style="font-size: 0.85rem; color: var(--gray);">Duration: ${Math.round(c.duration / 60)} minutes</p>` : ''}
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No consultations yet</p>
            </div>
        `;
    }
}

// ============ PRESCRIPTIONS ============

async function loadPrescriptions() {
    const container = document.getElementById('prescriptionsList');
    if (!container || !currentPatient) return;

    try {
        const prescriptions = await ZambukoDB.getByIndex('prescriptions', 'patientId', currentPatient.id);
        
        if (prescriptions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No prescriptions yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = prescriptions.map(rx => `
            <div class="card" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>Prescription</h4>
                        <p style="color: var(--gray); font-size: 0.9rem;">${new Date(rx.createdAt || Date.now()).toLocaleDateString()}</p>
                    </div>
                    <span class="badge badge-success">Active</span>
                </div>
                <div style="margin-top: 12px;">
                    ${rx.medications?.map(med => `
                        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
                            <strong>${med.name}</strong>
                            <p style="font-size: 0.85rem; color: var(--gray);">${med.dosage} - ${med.frequency}</p>
                        </div>
                    `).join('') || '<p>No medications listed</p>'}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No prescriptions yet</p>
            </div>
        `;
    }
}

// ============ EMERGENCY ============

function showEmergencyModal() {
    document.getElementById('emergencyModal').classList.add('active');
    getEmergencyLocation();
}

function closeEmergencyModal() {
    document.getElementById('emergencyModal').classList.remove('active');
    document.getElementById('emergencyStatus').style.display = 'none';
}

async function getEmergencyLocation() {
    const statusEl = document.getElementById('locationStatus');
    statusEl.textContent = 'Getting your location...';

    try {
        emergencyLocation = await EmergencyService.getCurrentLocation();
        statusEl.innerHTML = `
            <span style="color: var(--success);">Location acquired</span><br>
            <small style="color: var(--gray);">Lat: ${emergencyLocation.latitude.toFixed(4)}, Lng: ${emergencyLocation.longitude.toFixed(4)}</small>
        `;
    } catch (error) {
        statusEl.innerHTML = `
            <span style="color: var(--danger);">⚠ ${error.message}</span><br>
            <small>Please enable location services</small>
        `;
        emergencyLocation = null;
    }
}

async function dispatchEmergencyNow() {
    const emergencyType = document.getElementById('emergencyType').value;
    const additionalInfo = document.getElementById('emergencyDescription').value;

    if (!emergencyType) {
        showToast('Please select emergency type', 'error');
        return;
    }

    if (!emergencyLocation) {
        showToast('Please enable location services', 'error');
        getEmergencyLocation();
        return;
    }

    const dispatchBtn = document.getElementById('dispatchBtn');
    dispatchBtn.disabled = true;
    dispatchBtn.textContent = 'Dispatching...';

    try {
        const emergency = await EmergencyService.createEmergency({
            patientId: currentPatient?.id || 'anonymous',
            patientName: currentPatient?.fullName || 'Anonymous',
            patientPhone: currentPatient?.phone || null,
            emergencyType,
            additionalInfo,
            location: emergencyLocation
        });

        // Try to find closest dispatch and assign
        const closestDispatch = await EmergencyService.findClosestDispatch(emergencyLocation);
        if (closestDispatch) {
            emergency.assignedDispatch = closestDispatch.id;
            emergency.dispatchName = closestDispatch.name;
            emergency.status = 'PENDING';
            await ZambukoDB.put('emergencies', emergency);
        }

        const statusEl = document.getElementById('emergencyStatus');
        statusEl.style.display = 'block';
        statusEl.innerHTML = `
            <div class="card" style="background: #FEF3C7; border: 2px solid #F59E0B; color: #381805ff;">
                <h4 style="color: #92400E;">${SVG_TRUCK} Emergency Dispatched!</h4>
                <p style="margin-top: 8px;">Reference: <strong>${emergency.id}</strong></p>
                <p>Priority: <strong>${emergency.priority}</strong></p>
                ${closestDispatch ? `
                    <p>Assigned: <strong>${closestDispatch.name}</strong></p>
                    <p style="font-size: 0.9rem; color: #92400E;">
                        Unit ID: ${closestDispatch.unitId}
                    </p>
                ` : ''}
                <p style="margin-top: 12px; color: #92400E;">
                    Emergency responders have been notified and are on their way.
                </p>
            </div>
        `;

        dispatchBtn.textContent = 'Dispatched';
        showToast('Emergency dispatched successfully!', 'success');
    } catch (error) {
        dispatchBtn.disabled = false;
        dispatchBtn.textContent = 'Dispatch Now';
        showToast('Failed to dispatch: ' + error.message, 'error');
    }
}

// ============ PROFILE ============

function showProfile() {
    const content = document.getElementById('profileContent');
    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 12px;">
                ${(currentPatient?.fullName || 'P').charAt(0).toUpperCase()}
            </div>
            <h3>${currentPatient?.fullName || 'Patient'}</h3>
            <p style="color: var(--gray);">Patient</p>
        </div>

        <div class="card">
            <div style="margin-bottom: 12px;">
                <label style="font-size: 0.85rem; color: var(--gray);">Email</label>
                <p style="font-weight: 500;">${currentPatient?.email || 'Not set'}</p>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="font-size: 0.85rem; color: var(--gray);">Phone</label>
                <p style="font-weight: 500;">${currentPatient?.phone || 'Not set'}</p>
            </div>
            <div>
                <label style="font-size: 0.85rem; color: var(--gray);">Member Since</label>
                <p style="font-weight: 500;">${currentPatient?.createdAt ? new Date(currentPatient.createdAt).toLocaleDateString() : 'N/A'}</p>
            </div>
        </div>
    `;
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

// ============ REAL-TIME LISTENERS ============

function setupRealTimeListeners() {
    // Listen for consultation updates
    window.addEventListener('storage', (e) => {
        if (e.key === 'zambuko_consultation_update') {
            const data = JSON.parse(e.newValue);
            if (data.consultation.patientId === currentPatient?.id) {
                if (data.action === 'SCHEDULED') {
                    const apptTime = new Date(data.consultation.scheduledTime).toLocaleString();
                    showToast('Appointment confirmed for ' + apptTime + '!', 'success');
                    loadPendingAppointment();
                } else if (data.action === 'ACCEPTED') {
                    showToast('Your doctor is ready! Join your consultation.', 'success');
                    loadPendingAppointment();
                }
            }
        }
    });
}

// ============ LOCATION ============

async function requestLocationAccess() {
    const locationEl = document.getElementById('headerLocation');
    
    if (!navigator.geolocation) {
        locationEl.textContent = 'Location not supported';
        return;
    }

    locationEl.textContent = 'Getting location...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Try to get address from coordinates (reverse geocoding)
            try {
                const address = await reverseGeocode(userLocation.lat, userLocation.lng);
                locationEl.textContent = address;
                // Save to session
                if (currentPatient) {
                    currentPatient.location = userLocation;
                    currentPatient.address = address;
                }
            } catch (e) {
                locationEl.textContent = `${userLocation.lat.toFixed(3)}, ${userLocation.lng.toFixed(3)}`;
            }
        },
        (error) => {
            console.error('Location error:', error);
            locationEl.textContent = 'Enable location';
            showToast('Please enable location access', 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes cache
        }
    );
}

async function reverseGeocode(lat, lng) {
    // Using a free nominatim API for reverse geocoding
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`
        );
        const data = await response.json();
        
        if (data.address) {
            // Build a short address
            const parts = [];
            if (data.address.suburb) parts.push(data.address.suburb);
            else if (data.address.neighbourhood) parts.push(data.address.neighbourhood);
            else if (data.address.road) parts.push(data.address.road);
            
            if (data.address.city) parts.push(data.address.city);
            else if (data.address.town) parts.push(data.address.town);
            
            return parts.length > 0 ? parts.join(', ') : 'Location found';
        }
        return 'Location found';
    } catch (e) {
        return 'Location found';
    }
}

// Request location on app load
function initLocation() {
    // Check if we already have permission
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state === 'granted') {
                requestLocationAccess();
            }
        });
    }
}

// ============ UTILITIES ============

function showLoading(text = 'Processing...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    // Use Zambuko utility if available
    if (window.Zambuko?.showToast) {
        Zambuko.showToast(message, type);
        return;
    }

    // Fallback toast
    const container = document.getElementById('toastContainer') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#14B8A6'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
