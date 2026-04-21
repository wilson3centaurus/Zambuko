/**
 * Zambuko Emergency Dispatch App - JavaScript
 */

// ── Inline SVG icon constants ──────────────────────────────────
const SVG_ALERT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const SVG_PIN   = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SVG_CLOCK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const SVG_FILE  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
const SVG_PHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.64-1.64a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SVG_TRUCK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
const SVG_MAP   = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`;
const SVG_USER  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
// ──────────────────────────────────────────────────────────────

let currentDispatch = null;
let currentDispatchProfile = null;
let emergenciesPollInterval = null;
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
    if (session && session.userType === 'dispatch') {
        currentDispatch = session;
        loadDispatchProfile().then(() => {
            showMainApp();
        });
    }

    // Setup form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Get current location
    getCurrentLocation();
}

// ============ AUTHENTICATION ============

async function handleLogin(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!identifier || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }

    showLoading();
    try {
        const user = await AuthService.login(identifier, password);
        
        if (user.userType !== 'dispatch') {
            hideLoading();
            showToast('Invalid dispatch credentials', 'error');
            AuthService.logout();
            return;
        }

        currentDispatch = user;
        await loadDispatchProfile();
        
        hideLoading();
        showMainApp();
        showToast('Welcome back!', 'success');
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
}

async function loadDispatchProfile() {
    try {
        const dispatches = await ZambukoDB.getAll('dispatches');
        currentDispatchProfile = dispatches.find(d => d.userId === currentDispatch.id);
        
        if (!currentDispatchProfile) {
            // This shouldn't happen as admin creates dispatch accounts
            console.error('Dispatch profile not found');
        }
    } catch (error) {
        console.error('Error loading dispatch profile:', error);
    }
}

function showMainApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    
    if (currentDispatchProfile) {
        document.getElementById('dispatchName').textContent = currentDispatchProfile.name;
        document.getElementById('unitId').textContent = currentDispatchProfile.unitId;
        updateStatusUI();
    }
    
    loadDashboard();
    startEmergencyPolling();
}

function logout() {
    AuthService.logout();
    stopEmergencyPolling();
    
    currentDispatch = null;
    currentDispatchProfile = null;

    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    showToast('Logged out successfully', 'success');
}

// ============ LOCATION SERVICES ============

function getCurrentLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true }
    );
}

// ============ STATUS MANAGEMENT ============

function updateStatusUI() {
    if (!currentDispatchProfile) return;
    
    const toggle = document.getElementById('statusToggle');
    const text = document.getElementById('statusText');
    
    if (toggle && text) {
        toggle.className = 'status-toggle ' + currentDispatchProfile.status.toLowerCase();
        text.textContent = currentDispatchProfile.status.toUpperCase();
    }
}

async function toggleStatus() {
    if (!currentDispatchProfile) return;

    const statuses = ['OFFLINE', 'AVAILABLE', 'RESPONDING'];
    const currentIndex = statuses.indexOf(currentDispatchProfile.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
        currentDispatchProfile.status = nextStatus;
        await ZambukoDB.put('dispatches', currentDispatchProfile);
        updateStatusUI();
        showToast(`Status changed to ${nextStatus}`, 'success');
    } catch (error) {
        showToast('Failed to update status', 'error');
    }
}

// ============ DASHBOARD ============

async function loadDashboard() {
    await loadEmergencies();
    await loadStats();
    await loadHistory();
}

async function loadStats() {
    try {
        const emergencies = await ZambukoDB.getAll('emergencies');
        const myEmergencies = emergencies.filter(e => 
            e.assignedDispatch === currentDispatchProfile?.id
        );

        // Active emergencies
        const active = myEmergencies.filter(e => 
            e.status === 'PENDING' || e.status === 'RESPONDING'
        ).length;
        document.getElementById('activeEmergencies').textContent = active;

        // Completed today
        const today = new Date().setHours(0, 0, 0, 0);
        const completedToday = myEmergencies.filter(e => 
            e.status === 'COMPLETED' && new Date(e.updatedAt).getTime() >= today
        ).length;
        document.getElementById('completedToday').textContent = completedToday;

        // Average response time
        const completed = myEmergencies.filter(e => e.status === 'COMPLETED' && e.responseTime);
        const avgTime = completed.length > 0
            ? Math.round(completed.reduce((sum, e) => sum + e.responseTime, 0) / completed.length)
            : 0;
        document.getElementById('avgResponseTime').textContent = avgTime + ' min';

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadEmergencies() {
    const container = document.getElementById('emergenciesList');
    if (!container) return;

    try {
        const emergencies = await ZambukoDB.getAll('emergencies');
        
        // Filter for unassigned or assigned to this dispatch
        const relevantEmergencies = emergencies.filter(e => 
            (e.status === 'PENDING' || e.status === 'RESPONDING') &&
            (!e.assignedDispatch || e.assignedDispatch === currentDispatchProfile?.id)
        );

        if (relevantEmergencies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No active emergencies</p>
                </div>
            `;
            return;
        }

        // Sort by priority and distance
        relevantEmergencies.sort((a, b) => {
            const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        container.innerHTML = relevantEmergencies.map(emergency => createEmergencyCard(emergency)).join('');

    } catch (error) {
        console.error('Error loading emergencies:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p>Error loading emergencies</p>
            </div>
        `;
    }
}

function createEmergencyCard(emergency) {
    const distance = calculateDistance(emergency.location);
    const timeAgo = getTimeAgo(emergency.createdAt);
    const isAssigned = emergency.assignedDispatch === currentDispatchProfile?.id;

    return `
        <div class="emergency-card-item ${emergency.priority.toLowerCase()}" onclick="showEmergencyDetails('${emergency.id}')">
            <div class="emergency-header-row">
                <div class="emergency-patient">
                    <h3>${emergency.patientName}</h3>
                    <p>${SVG_PHONE} ${emergency.phone || 'No phone'}</p>
                </div>
                <span class="priority-badge ${emergency.priority.toLowerCase()}">${emergency.priority}</span>
            </div>
            
            <div class="emergency-details-row">
                <div class="detail-item">
                    <span>${SVG_ALERT}</span>
                    <span><strong>Type:</strong> ${emergency.type}</span>
                </div>
                <div class="detail-item">
                    <span>${SVG_PIN}</span>
                    <span><strong>Distance:</strong> ${distance}</span>
                </div>
                <div class="detail-item">
                    <span>${SVG_CLOCK}</span>
                    <span><strong>Reported:</strong> ${timeAgo}</span>
                </div>
                <div class="detail-item">
                    <span>${SVG_FILE}</span>
                    <span><strong>Status:</strong> ${emergency.status}</span>
                </div>
            </div>

            <div class="emergency-actions" onclick="event.stopPropagation()">
                ${!isAssigned ? `
                    <button class="btn-respond" onclick="respondToEmergency('${emergency.id}')">
                        ${SVG_TRUCK} Respond
                    </button>
                ` : `
                    <button class="btn-respond" onclick="updateEmergencyStatus('${emergency.id}', 'COMPLETED')">
                        ${SVG_CHECK} Complete
                    </button>
                `}
                <button class="btn-track" onclick="openGoogleMaps('${emergency.id}')">
                    ${SVG_MAP} Track
                </button>
            </div>
        </div>
    `;
}

// ============ EMERGENCY ACTIONS ============

async function showEmergencyDetails(emergencyId) {
    try {
        const emergency = await ZambukoDB.get('emergencies', emergencyId);
        if (!emergency) return;

        const distance = calculateDistance(emergency.location);
        const patient = await ZambukoDB.get('users', emergency.patientId);

        document.getElementById('emergencyDetails').innerHTML = `
            <div class="detail-section">
                <h3>${SVG_ALERT} Emergency Information</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <label>Priority:</label>
                        <span class="priority-badge ${emergency.priority.toLowerCase()}">${emergency.priority}</span>
                    </div>
                    <div class="detail-row">
                        <label>Type:</label>
                        <span>${emergency.type}</span>
                    </div>
                    <div class="detail-row">
                        <label>Status:</label>
                        <span>${emergency.status}</span>
                    </div>
                    <div class="detail-row">
                        <label>Reported:</label>
                        <span>${new Date(emergency.createdAt).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>${SVG_USER} Patient Details</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <label>Name:</label>
                        <span>${emergency.patientName}</span>
                    </div>
                    <div class="detail-row">
                        <label>Phone:</label>
                        <span>${emergency.phone || 'Not provided'}</span>
                    </div>
                    <div class="detail-row">
                        <label>Age:</label>
                        <span>${patient?.age || 'Unknown'}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>${SVG_FILE} Description</h3>
                <div class="detail-row">
                    <p style="margin: 0;">${emergency.description || 'No description provided'}</p>
                </div>
            </div>

            <div class="detail-section">
                <h3>${SVG_PIN} Location</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <label>Distance:</label>
                        <span>${distance}</span>
                    </div>
                    <div class="detail-row">
                        <label>Coordinates:</label>
                        <span>${emergency.location.lat.toFixed(4)}, ${emergency.location.lng.toFixed(4)}</span>
                    </div>
                </div>
                <div class="location-map">
                    <p style="color: var(--text-secondary);">${SVG_PIN} Patient Location</p>
                </div>
            </div>

            <div class="modal-actions">
                ${!emergency.assignedDispatch || emergency.assignedDispatch === currentDispatchProfile?.id ? `
                    <button class="btn-respond" onclick="respondToEmergency('${emergency.id}'); closeEmergencyModal();">
                        ${SVG_TRUCK} ${emergency.assignedDispatch ? 'En Route' : 'Respond'}
                    </button>
                    <button class="btn-track" onclick="openGoogleMaps('${emergency.id}')">
                        ${SVG_MAP} Open in Maps
                    </button>
                ` : `
                    <p style="text-align: center; color: var(--text-secondary);">
                        Already assigned to another dispatch unit
                    </p>
                `}
            </div>
        `;

        document.getElementById('emergencyModal').classList.add('active');
    } catch (error) {
        console.error('Error showing emergency details:', error);
        showToast('Failed to load emergency details', 'error');
    }
}

function closeEmergencyModal() {
    document.getElementById('emergencyModal').classList.remove('active');
}

async function respondToEmergency(emergencyId) {
    if (!currentDispatchProfile) return;

    try {
        const emergency = await ZambukoDB.get('emergencies', emergencyId);
        if (!emergency) return;

        // Assign this dispatch to the emergency
        emergency.assignedDispatch = currentDispatchProfile.id;
        emergency.dispatchName = currentDispatchProfile.name;
        emergency.status = 'RESPONDING';
        emergency.responseTime = Math.floor((Date.now() - new Date(emergency.createdAt).getTime()) / 60000);
        emergency.updatedAt = new Date().toISOString();

        await ZambukoDB.put('emergencies', emergency);

        // Update dispatch status
        currentDispatchProfile.status = 'RESPONDING';
        await ZambukoDB.put('dispatches', currentDispatchProfile);
        updateStatusUI();

        showToast('Emergency assigned! Opening navigation...', 'success');
        await loadDashboard();

        // Auto-open Google Maps
        setTimeout(() => openGoogleMaps(emergencyId), 1000);

    } catch (error) {
        console.error('Error responding to emergency:', error);
        showToast('Failed to respond to emergency', 'error');
    }
}

async function updateEmergencyStatus(emergencyId, status) {
    try {
        const emergency = await ZambukoDB.get('emergencies', emergencyId);
        if (!emergency) return;

        emergency.status = status;
        emergency.updatedAt = new Date().toISOString();
        
        if (status === 'COMPLETED') {
            emergency.completedAt = new Date().toISOString();
        }

        await ZambukoDB.put('emergencies', emergency);

        // Update dispatch status back to available
        if (status === 'COMPLETED') {
            currentDispatchProfile.status = 'AVAILABLE';
            await ZambukoDB.put('dispatches', currentDispatchProfile);
            updateStatusUI();
        }

        showToast(`Emergency marked as ${status}`, 'success');
        await loadDashboard();

    } catch (error) {
        console.error('Error updating emergency:', error);
        showToast('Failed to update emergency', 'error');
    }
}

async function openGoogleMaps(emergencyId) {
    try {
        const emergency = await ZambukoDB.get('emergencies', emergencyId);
        if (!emergency || !emergency.location) {
            showToast('Location not available', 'error');
            return;
        }

        const userLat = currentLocation?.lat || (currentDispatchProfile?.location?.lat || 0);
        const userLng = currentLocation?.lng || (currentDispatchProfile?.location?.lng || 0);
        const propertyLat = emergency.location.lat;
        const propertyLng = emergency.location.lng;

        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${propertyLat},${propertyLng}&travelmode=driving`;
        
        window.open(googleMapsUrl, '_blank');
        showToast('Opening Google Maps...', 'info');

    } catch (error) {
        console.error('Error opening maps:', error);
        showToast('Failed to open maps', 'error');
    }
}

// ============ HISTORY ============

async function loadHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    try {
        const emergencies = await ZambukoDB.getAll('emergencies');
        const myHistory = emergencies.filter(e => 
            e.assignedDispatch === currentDispatchProfile?.id &&
            (e.status === 'COMPLETED' || e.status === 'CANCELLED')
        ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);

        if (myHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No history available</p>
                </div>
            `;
            return;
        }

        container.innerHTML = myHistory.map(emergency => `
            <div class="history-item">
                <div class="history-info">
                    <h4>${emergency.patientName}</h4>
                    <p>${new Date(emergency.updatedAt).toLocaleDateString()} - ${emergency.type}</p>
                </div>
                <span class="history-status ${emergency.status.toLowerCase()}">${emergency.status}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// ============ POLLING ============

function startEmergencyPolling() {
    refreshEmergencies();
    emergenciesPollInterval = setInterval(refreshEmergencies, 10000); // Every 10 seconds
}

function stopEmergencyPolling() {
    if (emergenciesPollInterval) {
        clearInterval(emergenciesPollInterval);
        emergenciesPollInterval = null;
    }
}

async function refreshEmergencies() {
    await loadEmergencies();
    await loadStats();
}

// ============ UTILITIES ============

function calculateDistance(location) {
    if (!currentLocation || !location) return 'Unknown';

    const R = 6371; // Earth's radius in km
    const dLat = (location.lat - currentLocation.lat) * Math.PI / 180;
    const dLng = (location.lng - currentLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(currentLocation.lat * Math.PI / 180) * Math.cos(location.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    if (distance < 1) {
        return Math.round(distance * 1000) + ' m';
    }
    return distance.toFixed(1) + ' km';
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return seconds + ' sec ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    return hours + ' hr ago';
}

function showDashboard() {
    loadDashboard();
}

function showSettings() {
    showToast('Settings coming soon', 'info');
}

// ============ UI UTILITIES ============

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}
