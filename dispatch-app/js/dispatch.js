/**
 * Zambuko Emergency Dispatch App - JavaScript
 */

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
                    <p>📞 ${emergency.phone || 'No phone'}</p>
                </div>
                <span class="priority-badge ${emergency.priority.toLowerCase()}">${emergency.priority}</span>
            </div>
            
            <div class="emergency-details-row">
                <div class="detail-item">
                    <span>🚨</span>
                    <span><strong>Type:</strong> ${emergency.type}</span>
                </div>
                <div class="detail-item">
                    <span>📍</span>
                    <span><strong>Distance:</strong> ${distance}</span>
                </div>
                <div class="detail-item">
                    <span>⏱️</span>
                    <span><strong>Reported:</strong> ${timeAgo}</span>
                </div>
                <div class="detail-item">
                    <span>📝</span>
                    <span><strong>Status:</strong> ${emergency.status}</span>
                </div>
            </div>

            <div class="emergency-actions" onclick="event.stopPropagation()">
                ${!isAssigned ? `
                    <button class="btn-respond" onclick="respondToEmergency('${emergency.id}')">
                        🚑 Respond
                    </button>
                ` : `
                    <button class="btn-respond" onclick="updateEmergencyStatus('${emergency.id}', 'COMPLETED')">
                        ✓ Complete
                    </button>
                `}
                <button class="btn-track" onclick="openGoogleMaps('${emergency.id}')">
                    🗺️ Track
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
                <h3>🚨 Emergency Information</h3>
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
                <h3>👤 Patient Details</h3>
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
                <h3>📝 Description</h3>
                <div class="detail-row">
                    <p style="margin: 0;">${emergency.description || 'No description provided'}</p>
                </div>
            </div>

            <div class="detail-section">
                <h3>📍 Location</h3>
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
                    <p style="color: var(--text-secondary);">📍 Patient Location</p>
                </div>
            </div>

            <div class="modal-actions">
                ${!emergency.assignedDispatch || emergency.assignedDispatch === currentDispatchProfile?.id ? `
                    <button class="btn-respond" onclick="respondToEmergency('${emergency.id}'); closeEmergencyModal();">
                        🚑 ${emergency.assignedDispatch ? 'En Route' : 'Respond'}
                    </button>
                    <button class="btn-track" onclick="openGoogleMaps('${emergency.id}')">
                        🗺️ Open in Maps
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
