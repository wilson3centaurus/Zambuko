/**
 * Zambuko Doctor App - JavaScript
 * Using real IndexedDB database for persistence
 */

let currentDoctor = null;
let currentDoctorProfile = null;
let currentConsultation = null;
let pendingRequest = null;
let callSeconds = 0;
let callTimerInterval = null;
let chatPollInterval = null;
let currentLocation = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    await waitForDatabase();
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

function initApp() {
    // Check for existing session
    const session = AuthService.getCurrentUser();
    if (session && session.userType === 'doctor') {
        currentDoctor = session;
        loadDoctorProfile().then(() => {
            showMainApp();
        });
    }

    // Setup forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);

    // Setup validation
    setupValidation();

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
    const regEmail = document.getElementById('regEmail');
    if (regEmail) {
        regEmail.addEventListener('blur', function() {
            const result = AuthService.validateEmail(this.value);
            showValidationHint('regEmailHint', result);
        });
    }

    const regPhone = document.getElementById('regPhone');
    if (regPhone) {
        regPhone.addEventListener('blur', function() {
            const result = AuthService.validatePhone(this.value);
            showValidationHint('regPhoneHint', result);
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
        
        if (user.userType !== 'doctor') {
            AuthService.logout();
            throw new Error('Please use the Patient app to login');
        }

        currentDoctor = user;
        await loadDoctorProfile();
        
        hideLoading();
        showMainApp();
        showToast('Welcome back, Dr. ' + user.fullName.split(' ').pop() + '!', 'success');
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
    const specialty = document.getElementById('regSpecialty').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

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
            userType: 'doctor',
            specialty
        });

        currentDoctor = user;
        sessionStorage.setItem('zambuko_session', JSON.stringify(user));
        
        await loadDoctorProfile();

        hideLoading();
        showMainApp();
        showToast('Account created successfully!', 'success');
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
}

async function loadDoctorProfile() {
    try {
        // Find doctor profile by odctrId (user's ID)
        currentDoctorProfile = await ZambukoDB.getOneByIndex('doctors', 'odctrId', currentDoctor.id);
        if (!currentDoctorProfile) {
            // Create default profile
            currentDoctorProfile = {
                id: 'DOC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                odctrId: currentDoctor.id,
                name: currentDoctor.fullName,
                specialty: 'General Practice',
                status: 'OFFLINE',
                rating: 5.0,
                totalConsults: 0,
                emergencyCapable: false,
                queue: 0,
                location: null,
                lastHeartbeat: null,
                photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentDoctor.fullName)}&background=14B8A6&color=fff`
            };
            await ZambukoDB.add('doctors', currentDoctorProfile);
        }
    } catch (error) {
        console.error('Error loading doctor profile:', error);
    }
}

// ============ LOCATION SERVICES ============

function requestLocationAccess() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                resolve(currentLocation);
            },
            (error) => {
                console.error('Location error:', error);
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    });
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`
        );
        const data = await response.json();
        
        if (data.address) {
            const parts = [];
            if (data.address.road) parts.push(data.address.road);
            if (data.address.suburb) parts.push(data.address.suburb);
            if (data.address.city || data.address.town || data.address.village) {
                parts.push(data.address.city || data.address.town || data.address.village);
            }
            return parts.slice(0, 2).join(', ') || data.display_name.split(',').slice(0, 2).join(',');
        }
        return 'Location found';
    } catch (error) {
        console.error('Geocoding error:', error);
        return 'Location found';
    }
}

async function initLocation() {
    const locationBtn = document.getElementById('locationBtn');
    const locationText = document.getElementById('currentLocation');

    if (!locationBtn || !locationText) return;

    locationBtn.addEventListener('click', showLocationDropdown);

    // Check if geolocation is available
    if (!navigator.geolocation) {
        locationText.textContent = 'Location unavailable';
        showToast('Geolocation not supported', 'error');
        return;
    }

    // Check permission status if available
    if (navigator.permissions) {
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (permission.state === 'denied') {
                locationText.textContent = 'Location blocked';
                showToast('Please enable location in browser settings', 'error');
                return;
            }
        } catch (e) {
            // Permission API not available, continue anyway
        }
    }

    locationText.textContent = 'Getting location...';
    
    try {
        const position = await requestLocationAccess();
        const address = await reverseGeocode(position.lat, position.lng);
        locationText.textContent = address;
        
        // Update doctor profile with location
        if (currentDoctorProfile) {
            currentDoctorProfile.location = currentLocation;
            await ZambukoDB.put('doctors', currentDoctorProfile);
        }
    } catch (error) {
        console.error('Location error:', error);
        locationText.textContent = 'Location failed';
        
        // Show specific error message
        if (error.code === 1) {
            showToast('Location permission denied. Please enable in browser.', 'error');
        } else if (error.code === 2) {
            showToast('Unable to determine location. Try again.', 'error');
        } else if (error.code === 3) {
            showToast('Location request timed out', 'error');
        } else {
            showToast('Failed to get location: ' + error.message, 'error');
        }
    }
}

function showLocationDropdown() {
    showToast('Location updates automatically', 'info');
    initLocation();
}

function showMainApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    document.getElementById('doctorName').textContent = currentDoctor.fullName;
    
    // Request location access
    initLocation();
    
    updateStatusUI();
    loadDashboard();
    startHeartbeat();
    pollForRequests();
}

function logout() {
    AuthService.logout();
    AvailabilityService.stopHeartbeat();
    if (chatPollInterval) clearInterval(chatPollInterval);
    
    currentDoctor = null;
    currentDoctorProfile = null;
    currentConsultation = null;

    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    closeSettings();
    showToast('Logged out successfully', 'success');
}

// ============ HEARTBEAT & STATUS ============

function startHeartbeat() {
    if (currentDoctor && currentDoctorProfile) {
        AvailabilityService.startHeartbeat(currentDoctor.id);
    }
}

function updateStatusUI() {
    if (!currentDoctorProfile) return;
    
    const toggle = document.getElementById('statusToggle');
    const text = document.getElementById('statusText');
    
    if (toggle && text) {
        toggle.className = 'status-toggle ' + currentDoctorProfile.status.toLowerCase().replace('_', '-');
        text.textContent = currentDoctorProfile.status.replace('_', ' ');
    }
    
    const statusSelect = document.getElementById('statusSelect');
    const emergencyCapable = document.getElementById('emergencyCapable');
    
    if (statusSelect) statusSelect.value = currentDoctorProfile.status;
    if (emergencyCapable) emergencyCapable.value = String(currentDoctorProfile.emergencyCapable);
}

async function toggleStatus() {
    if (!currentDoctorProfile) return;
    
    const states = ['AVAILABLE', 'IN_SESSION', 'OFFLINE'];
    const currentIndex = states.indexOf(currentDoctorProfile.status);
    const nextIndex = (currentIndex + 1) % states.length;
    const newStatus = states[nextIndex];
    
    currentDoctorProfile.status = newStatus;
    await ZambukoDB.put('doctors', currentDoctorProfile);
    await AvailabilityService.updateStatus(currentDoctor.id, newStatus);
    
    updateStatusUI();
    showToast('Status: ' + newStatus.replace('_', ' '), 'info');
}

async function updateStatus() {
    if (!currentDoctorProfile) return;
    
    const newStatus = document.getElementById('statusSelect').value;
    const emergency = document.getElementById('emergencyCapable').value === 'true';
    
    currentDoctorProfile.status = newStatus;
    currentDoctorProfile.emergencyCapable = emergency;
    
    await ZambukoDB.put('doctors', currentDoctorProfile);
    await AvailabilityService.updateStatus(currentDoctor.id, newStatus);
    
    updateStatusUI();
    showToast('Settings updated', 'success');
}

// ============ NAVIGATION ============

function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const navMap = {
        'dashboardView': 0,
        'queueView': 1,
        'historyView': 2,
        'earningsView': 3,
        'consultationView': 0,
        'prescriptionView': 2
    };
    
    const navIndex = navMap[viewId];
    if (navIndex !== undefined) {
        document.querySelectorAll('.nav-item')[navIndex].classList.add('active');
    }

    if (viewId === 'historyView') loadHistory();
    if (viewId === 'earningsView') loadEarnings();
    if (viewId === 'queueView') loadQueue();
}

// ============ DASHBOARD ============

async function loadDashboard() {
    try {
        const consultations = await ConsultationService.getDoctorConsultations(currentDoctor.id);
        const today = new Date().toDateString();
        
        const todayConsults = consultations.filter(c => 
            new Date(c.createdAt).toDateString() === today && c.status === 'COMPLETED'
        );

        document.getElementById('todayConsults').textContent = todayConsults.length;
        document.getElementById('queueCount').textContent = currentDoctorProfile?.queue || 0;
        document.getElementById('totalEarnings').textContent = '$' + (todayConsults.length * 4).toFixed(2);
        document.getElementById('avgRating').textContent = '⭐ ' + (currentDoctorProfile?.rating || '5.0');

        loadIncomingRequests();
        loadSchedule();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadIncomingRequests() {
    const container = document.getElementById('incomingRequests');
    if (!container) return;

    try {
        const pending = await ConsultationService.getPendingForDoctor(currentDoctor.id);
        
        if (pending.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No pending requests</p>
                </div>
            `;
            document.getElementById('requestCount').textContent = '0';
            return;
        }

        document.getElementById('requestCount').textContent = pending.length;
        
        container.innerHTML = '';
        for (const req of pending) {
            const patient = await ZambukoDB.get('users', req.patientId);
            container.innerHTML += `
                <div class="request-card" onclick="showRequestDetails('${req.id}')">
                    <div class="request-info">
                        <strong>${patient?.fullName || 'Patient'}</strong>
                        <p style="color: var(--gray); font-size: 0.9rem;">${req.symptoms || 'General consultation'}</p>
                    </div>
                    <span class="badge badge-${(req.triageLevel || 'low').toLowerCase()}">${req.triageLevel || 'LOW'}</span>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No pending requests</p>
            </div>
        `;
    }
}

function pollForRequests() {
    setInterval(() => {
        loadIncomingRequests();
    }, 10000);
}

async function showRequestDetails(consultationId) {
    try {
        const consultation = await ZambukoDB.get('consultations', consultationId);
        if (!consultation) return;

        const patient = await ZambukoDB.get('users', consultation.patientId);
        pendingRequest = { consultation, patient };

        const details = document.getElementById('requestDetails');
        details.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 12px;">
                    ${(patient?.fullName || 'P').charAt(0).toUpperCase()}
                </div>
                <h3>${patient?.fullName || 'Patient'}</h3>
            </div>

            <div class="card">
                <h4 style="margin-bottom: 12px;">Consultation Details</h4>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 0.85rem; color: var(--gray);">Symptoms</label>
                    <p>${consultation.symptoms || 'General consultation'}</p>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 0.85rem; color: var(--gray);">Triage Level</label>
                    <p><span class="badge badge-${(consultation.triageLevel || 'low').toLowerCase()}">${consultation.triageLevel || 'LOW'}</span></p>
                </div>
                <div>
                    <label style="font-size: 0.85rem; color: var(--gray);">Requested</label>
                    <p>${new Date(consultation.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `;

        document.getElementById('requestModal').classList.add('active');
    } catch (error) {
        showToast('Error loading request details', 'error');
    }
}

function closeRequestModal() {
    document.getElementById('requestModal').classList.remove('active');
    pendingRequest = null;
}

async function acceptRequest() {
    if (!pendingRequest) return;

    try {
        await ConsultationService.acceptConsultation(
            pendingRequest.consultation.id,
            currentDoctor.id
        );

        currentConsultation = pendingRequest.consultation;
        
        // Update status to IN_SESSION
        currentDoctorProfile.status = 'IN_SESSION';
        await ZambukoDB.put('doctors', currentDoctorProfile);
        await AvailabilityService.updateStatus(currentDoctor.id, 'IN_SESSION');
        updateStatusUI();

        closeRequestModal();
        startConsultation();
        showToast('Consultation accepted!', 'success');
    } catch (error) {
        showToast('Error accepting request: ' + error.message, 'error');
    }
}

async function declineRequest() {
    // Just close modal for now
    closeRequestModal();
    showToast('Request declined', 'info');
}

// ============ CONSULTATION ============

async function startConsultation() {
    if (!currentConsultation) return;

    await ConsultationService.startConsultation(currentConsultation.id);
    
    const patient = await ZambukoDB.get('users', currentConsultation.patientId);
    
    document.getElementById('consultationPatientInfo').innerHTML = `
        <div style="width: 80px; height: 80px; border-radius: 50%; background: white; color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 12px;">
            ${(patient?.fullName || 'P').charAt(0).toUpperCase()}
        </div>
        <h3 style="color: white;">${patient?.fullName || 'Patient'}</h3>
        <p style="color: #ccc;">Consultation in progress</p>
    `;

    navigateTo('consultationView');
    startCallTimer();
    startChatPolling();
}

function startCallTimer() {
    callSeconds = 0;
    const timerEl = document.getElementById('callTimer');
    if (timerEl) timerEl.textContent = '00:00';
    
    callTimerInterval = setInterval(() => {
        callSeconds++;
        const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
        const secs = (callSeconds % 60).toString().padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
}

function toggleMute() {
    showToast('Microphone toggled', 'info');
}

function toggleVideo() {
    showToast('Camera toggled', 'info');
}

function toggleChat() {
    const chatPanel = document.getElementById('doctorChatPanel');
    if (chatPanel) chatPanel.classList.toggle('active');
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('doctorChatInput');
    const content = input.value.trim();
    
    if (!content || !currentConsultation) return;

    try {
        const message = await ChatService.sendMessage(
            currentConsultation.id,
            currentDoctor.id,
            'doctor',
            content
        );

        addMessageToChat(message);
        input.value = '';
    } catch (error) {
        showToast('Failed to send message', 'error');
    }
}

function addMessageToChat(message) {
    const container = document.getElementById('doctorChatMessages');
    if (!container) return;
    
    const isOwn = message.senderId === currentDoctor.id;
    
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

function startChatPolling() {
    if (chatPollInterval) clearInterval(chatPollInterval);
    
    chatPollInterval = setInterval(async () => {
        if (!currentConsultation) return;
        
        const messages = await ChatService.getMessages(currentConsultation.id);
        
        messages.forEach(msg => {
            if (!document.getElementById(`msg-${msg.id}`)) {
                addMessageToChat(msg);
            }
        });

        await ChatService.markAsRead(currentConsultation.id, currentDoctor.id);
    }, 3000);

    ChatService.startListening((data) => {
        if (data && data.message && data.message.consultationId === currentConsultation?.id) {
            addMessageToChat(data.message);
        }
    });
}

async function endConsultationCall() {
    if (confirm('End this consultation?')) {
        stopCallTimer();
        if (chatPollInterval) clearInterval(chatPollInterval);

        // Show prescription form
        showPrescriptionForm();
    }
}

function showPrescriptionForm() {
    navigateTo('prescriptionView');
}

async function submitPrescription() {
    const diagnosis = document.getElementById('diagnosis').value.trim();
    const notes = document.getElementById('consultNotes').value.trim();
    
    // Get medications
    const medications = [];
    document.querySelectorAll('.medication-row').forEach(row => {
        const name = row.querySelector('.med-name')?.value;
        const dosage = row.querySelector('.med-dosage')?.value;
        const frequency = row.querySelector('.med-frequency')?.value;
        const duration = row.querySelector('.med-duration')?.value;
        
        if (name) {
            medications.push({ name, dosage, frequency, duration });
        }
    });

    if (!diagnosis) {
        showToast('Please enter a diagnosis', 'error');
        return;
    }

    try {
        // Create prescription in database
        const prescription = {
            id: 'RX_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            consultationId: currentConsultation.id,
            patientId: currentConsultation.patientId,
            doctorId: currentDoctor.id,
            diagnosis,
            medications,
            notes,
            createdAt: new Date().toISOString()
        };

        await ZambukoDB.add('prescriptions', prescription);

        // End consultation
        await ConsultationService.endConsultation(currentConsultation.id, diagnosis);

        // Update doctor status back to available
        currentDoctorProfile.status = 'AVAILABLE';
        currentDoctorProfile.totalConsults = (currentDoctorProfile.totalConsults || 0) + 1;
        await ZambukoDB.put('doctors', currentDoctorProfile);
        await AvailabilityService.updateStatus(currentDoctor.id, 'AVAILABLE');
        updateStatusUI();

        currentConsultation = null;
        
        showToast('Consultation completed!', 'success');
        navigateTo('dashboardView');
        loadDashboard();
    } catch (error) {
        showToast('Error saving prescription: ' + error.message, 'error');
    }
}

function addMedication() {
    const container = document.getElementById('medicationsList');
    const row = document.createElement('div');
    row.className = 'medication-row';
    row.innerHTML = `
        <input type="text" class="form-input med-name" placeholder="Medication name">
        <input type="text" class="form-input med-dosage" placeholder="Dosage">
        <input type="text" class="form-input med-frequency" placeholder="Frequency">
        <input type="text" class="form-input med-duration" placeholder="Duration">
        <button class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

// ============ QUEUE ============

async function loadQueue() {
    const container = document.getElementById('queueList');
    if (!container) return;

    try {
        const pending = await ConsultationService.getPendingForDoctor(currentDoctor.id);
        
        if (pending.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No patients in queue</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        for (let i = 0; i < pending.length; i++) {
            const req = pending[i];
            const patient = await ZambukoDB.get('users', req.patientId);
            container.innerHTML += `
                <div class="queue-item">
                    <div class="queue-position">${i + 1}</div>
                    <div class="queue-info">
                        <strong>${patient?.fullName || 'Patient'}</strong>
                        <p style="font-size: 0.85rem; color: var(--gray);">${req.symptoms || 'General'}</p>
                    </div>
                    <span class="badge badge-${(req.triageLevel || 'low').toLowerCase()}">${req.triageLevel || 'LOW'}</span>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No patients in queue</p>
            </div>
        `;
    }
}

// ============ HISTORY ============

async function loadHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    try {
        const consultations = await ConsultationService.getDoctorConsultations(currentDoctor.id);
        const completed = consultations.filter(c => c.status === 'COMPLETED');
        
        if (completed.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No completed consultations</p>
                </div>
            `;
            return;
        }

        completed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        container.innerHTML = '';
        for (const c of completed) {
            const patient = await ZambukoDB.get('users', c.patientId);
            container.innerHTML += `
                <div class="card" style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4>${patient?.fullName || 'Patient'}</h4>
                            <p style="color: var(--gray); font-size: 0.85rem;">${new Date(c.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span class="badge badge-success">Completed</span>
                    </div>
                    <p style="margin-top: 8px; font-size: 0.9rem;">${c.symptoms || 'General consultation'}</p>
                    ${c.duration ? `<p style="font-size: 0.85rem; color: var(--gray);">Duration: ${Math.round(c.duration / 60)} min</p>` : ''}
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No completed consultations</p>
            </div>
        `;
    }
}

// ============ EARNINGS ============

async function loadEarnings() {
    try {
        const consultations = await ConsultationService.getDoctorConsultations(currentDoctor.id);
        const completed = consultations.filter(c => c.status === 'COMPLETED');

        const today = new Date().toDateString();
        const todayConsults = completed.filter(c => new Date(c.createdAt).toDateString() === today);
        
        // Calculate earnings (80% of $5 fee)
        const todayEarnings = todayConsults.length * 4;
        const totalEarnings = completed.length * 4;

        document.getElementById('todayEarningsAmount').textContent = '$' + todayEarnings.toFixed(2);
        document.getElementById('weekEarnings').textContent = '$' + (todayEarnings * 5).toFixed(2);
        document.getElementById('monthEarnings').textContent = '$' + totalEarnings.toFixed(2);
        document.getElementById('totalConsultsCount').textContent = completed.length;
    } catch (error) {
        console.error('Error loading earnings:', error);
    }
}

// ============ SCHEDULE ============

function loadSchedule() {
    const container = document.getElementById('todaySchedule');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <p>No scheduled appointments today</p>
        </div>
    `;
}

// ============ SETTINGS ============

function showSettings() {
    const content = document.getElementById('doctorProfileContent');
    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 12px;">
                ${(currentDoctor?.fullName || 'D').charAt(0).toUpperCase()}
            </div>
            <h3>${currentDoctor?.fullName || 'Doctor'}</h3>
            <p style="color: var(--gray);">${currentDoctorProfile?.specialty || 'General Practice'}</p>
        </div>

        <div class="card">
            <div style="margin-bottom: 12px;">
                <label style="font-size: 0.85rem; color: var(--gray);">Email</label>
                <p style="font-weight: 500;">${currentDoctor?.email || 'Not set'}</p>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="font-size: 0.85rem; color: var(--gray);">Phone</label>
                <p style="font-weight: 500;">${currentDoctor?.phone || 'Not set'}</p>
            </div>
            <div>
                <label style="font-size: 0.85rem; color: var(--gray);">Total Consultations</label>
                <p style="font-weight: 500;">${currentDoctorProfile?.totalConsults || 0}</p>
            </div>
        </div>
    `;
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

// ============ REAL-TIME LISTENERS ============

function setupRealTimeListeners() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'zambuko_consultation_request') {
            const data = JSON.parse(e.newValue);
            if (data.consultation.doctorId === currentDoctor?.id) {
                showToast('New consultation request!', 'info');
                loadIncomingRequests();
            }
        }
    });
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
    if (window.Zambuko?.showToast) {
        Zambuko.showToast(message, type);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#0D9488'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
