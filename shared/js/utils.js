// Zambuko Shared Utilities

// Mock Data Store (simulating backend)
const ZambukoData = {
    patients: [
        { id: 'P001', name: 'Tendai Moyo', phone: '0771234567', email: 'tendai@email.com', location: { lat: -17.8292, lng: 31.0522 }, password: '123456' },
        { id: 'P002', name: 'Grace Mutasa', phone: '0772345678', email: 'grace@email.com', location: { lat: -17.8312, lng: 31.0542 }, password: '123456' },
    ],
    doctors: [
        { id: 'D001', name: 'Dr. Chenai Madziva', specialty: 'General Practice', rating: 4.8, status: 'AVAILABLE', emergencyCapable: true, photo: 'https://ui-avatars.com/api/?name=Chenai+Madziva&background=0D9488&color=fff', queue: 2, location: { lat: -17.8252, lng: 31.0502 }, password: '123456' },
        { id: 'D002', name: 'Dr. Tafadzwa Ncube', specialty: 'Pediatrics', rating: 4.9, status: 'AVAILABLE', emergencyCapable: false, photo: 'https://ui-avatars.com/api/?name=Tafadzwa+Ncube&background=0D9488&color=fff', queue: 1, location: { lat: -17.8272, lng: 31.0512 }, password: '123456' },
        { id: 'D003', name: 'Dr. Rumbidzai Choto', specialty: 'Cardiology', rating: 4.7, status: 'IN_SESSION', emergencyCapable: true, photo: 'https://ui-avatars.com/api/?name=Rumbidzai+Choto&background=0D9488&color=fff', queue: 5, location: { lat: -17.8232, lng: 31.0492 }, password: '123456' },
        { id: 'D004', name: 'Dr. Kudakwashe Dube', specialty: 'General Practice', rating: 4.6, status: 'OFFLINE', emergencyCapable: false, photo: 'https://ui-avatars.com/api/?name=Kudakwashe+Dube&background=0D9488&color=fff', queue: 0, location: { lat: -17.8302, lng: 31.0532 }, password: '123456' },
    ],
    responders: [
        { id: 'R001', name: 'Harare Central Ambulance', type: 'ambulance', status: 'AVAILABLE', location: { lat: -17.8200, lng: 31.0450 } },
        { id: 'R002', name: 'Parirenyatwa Emergency', type: 'ambulance', status: 'AVAILABLE', location: { lat: -17.8350, lng: 31.0600 } },
    ],
    consultations: [],
    prescriptions: [],
    emergencies: [],
    payments: []
};

// Symptom weights for triage
const symptomWeights = {
    'chest pain': 50,
    'difficulty breathing': 45,
    'severe bleeding': 50,
    'unconscious': 60,
    'stroke symptoms': 55,
    'high fever': 25,
    'persistent cough': 15,
    'headache': 10,
    'body aches': 10,
    'nausea': 12,
    'vomiting': 15,
    'diarrhea': 15,
    'fatigue': 8,
    'sore throat': 10,
    'runny nose': 5,
    'skin rash': 12,
    'joint pain': 10,
    'dizziness': 20,
    'abdominal pain': 18,
    'back pain': 12
};

// Triage thresholds
const TRIAGE_THRESHOLDS = {
    emergency: 45,
    high: 30,
    moderate: 15
};

// AI Triage Algorithm
function performTriage(symptoms, age, vitals = {}, comorbidities = []) {
    // Check for immediate emergency conditions
    const emergencySymptoms = ['chest pain', 'unconscious', 'stroke symptoms', 'severe bleeding'];
    for (let symptom of symptoms) {
        if (emergencySymptoms.includes(symptom.toLowerCase())) {
            return { level: 'EMERGENCY', score: 100, recommendation: 'Seek immediate emergency care. Dispatching responder.' };
        }
    }
    
    // Check vitals
    if (vitals.spo2 && vitals.spo2 < 90) {
        return { level: 'EMERGENCY', score: 100, recommendation: 'Low oxygen saturation detected. Seek emergency care immediately.' };
    }
    
    // Calculate risk score
    let riskScore = 0;
    for (let symptom of symptoms) {
        riskScore += symptomWeights[symptom.toLowerCase()] || 5;
    }
    
    // Age factor
    if (age > 65) riskScore *= 1.3;
    else if (age < 5) riskScore *= 1.2;
    
    // Comorbidity factor
    riskScore *= (1 + comorbidities.length * 0.15);
    
    // Determine triage level
    let level, recommendation;
    if (riskScore >= TRIAGE_THRESHOLDS.emergency) {
        level = 'EMERGENCY';
        recommendation = 'Your symptoms indicate a serious condition. Emergency dispatch recommended.';
    } else if (riskScore >= TRIAGE_THRESHOLDS.high) {
        level = 'HIGH';
        recommendation = 'Priority consultation recommended. Please consult a doctor soon.';
    } else if (riskScore >= TRIAGE_THRESHOLDS.moderate) {
        level = 'MODERATE';
        recommendation = 'Schedule a consultation at your convenience.';
    } else {
        level = 'LOW';
        recommendation = 'Self-care may be sufficient. Consult if symptoms persist.';
    }
    
    return { level, score: Math.round(riskScore), recommendation };
}

// Doctor Matching Algorithm
function matchDoctors(patientLocation, specialty = null, urgencyLevel = 'LOW') {
    let doctors = [...ZambukoData.doctors];
    
    // Filter by specialty if specified
    if (specialty) {
        doctors = doctors.filter(d => d.specialty.toLowerCase() === specialty.toLowerCase());
    }
    
    // Filter by availability
    if (urgencyLevel === 'EMERGENCY') {
        doctors = doctors.filter(d => d.status !== 'OFFLINE' && (d.status === 'AVAILABLE' || d.emergencyCapable));
    } else {
        doctors = doctors.filter(d => d.status === 'AVAILABLE');
    }
    
    // Score and rank doctors
    const weights = { proximity: 0.3, rating: 0.4, queue: 0.3 };
    
    doctors = doctors.map(doctor => {
        const distance = calculateDistance(patientLocation, doctor.location);
        const proximityScore = Math.max(0, 100 - distance * 10);
        const ratingScore = doctor.rating * 20;
        const queueScore = Math.max(0, 100 - doctor.queue * 15);
        
        const totalScore = (weights.proximity * proximityScore) +
                          (weights.rating * ratingScore) -
                          (weights.queue * (100 - queueScore) * 0.3);
        
        return { ...doctor, matchScore: Math.round(totalScore), distance: distance.toFixed(1) };
    });
    
    // Sort by score
    doctors.sort((a, b) => b.matchScore - a.matchScore);
    
    return doctors;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(loc1, loc2) {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Emergency Dispatch Algorithm
function dispatchEmergency(patientLocation) {
    let responders = ZambukoData.responders.filter(r => r.status === 'AVAILABLE');
    
    if (responders.length === 0) {
        return {
            success: false,
            message: 'No responders available. Escalating to national hotline.',
            hotline: '994'
        };
    }
    
    // Calculate ETA for each responder
    responders = responders.map(r => {
        const distance = calculateDistance(patientLocation, r.location);
        const eta = Math.round(distance * 3); // Approximate minutes
        return { ...r, distance, eta };
    });
    
    // Sort by ETA
    responders.sort((a, b) => a.eta - b.eta);
    
    const assigned = responders[0];
    assigned.status = 'EN_ROUTE';
    
    return {
        success: true,
        responder: assigned,
        message: `${assigned.name} dispatched. ETA: ${assigned.eta} minutes`
    };
}

// Payment simulation
function processPayment(method, amount, phone) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const transactionId = 'TXN' + Date.now();
            resolve({
                success: true,
                transactionId,
                method,
                amount,
                timestamp: new Date().toISOString()
            });
        }, 2000);
    });
}

// Local storage helpers
function saveToLocal(key, data) {
    localStorage.setItem(`zambuko_${key}`, JSON.stringify(data));
}

function loadFromLocal(key) {
    const data = localStorage.getItem(`zambuko_${key}`);
    return data ? JSON.parse(data) : null;
}

// Session management
function setSession(type, user) {
    sessionStorage.setItem(`zambuko_${type}_session`, JSON.stringify(user));
}

function getSession(type) {
    const session = sessionStorage.getItem(`zambuko_${type}_session`);
    return session ? JSON.parse(session) : null;
}

function clearSession(type) {
    sessionStorage.removeItem(`zambuko_${type}_session`);
}

// Format currency
function formatCurrency(amount) {
    return `$${amount.toFixed(2)} USD`;
}

// Generate unique ID
function generateId(prefix) {
    return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
}

// Format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-ZW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show notification toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="toast-message">${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Export for use
window.Zambuko = {
    data: ZambukoData,
    performTriage,
    matchDoctors,
    dispatchEmergency,
    processPayment,
    saveToLocal,
    loadFromLocal,
    setSession,
    getSession,
    clearSession,
    formatCurrency,
    generateId,
    formatDate,
    showToast,
    calculateDistance
};
