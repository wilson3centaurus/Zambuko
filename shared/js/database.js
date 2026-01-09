/**
 * Zambuko Database Layer
 * Uses IndexedDB for persistent, structured data storage
 * This is a real database that persists across sessions
 */

const ZambukoDB = {
    dbName: 'ZambukoHealthDB',
    dbVersion: 5,
    db: null,

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Zambuko Database initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Users store (patients and doctors)
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id' });
                    usersStore.createIndex('email', 'email', { unique: true });
                    usersStore.createIndex('phone', 'phone', { unique: true });
                    usersStore.createIndex('userType', 'userType', { unique: false });
                }

                // Doctors store (extended profile) - uses id as key
                if (db.objectStoreNames.contains('doctors')) {
                    db.deleteObjectStore('doctors');
                }
                const doctorsStore = db.createObjectStore('doctors', { keyPath: 'id' });
                doctorsStore.createIndex('specialty', 'specialty', { unique: false });
                doctorsStore.createIndex('status', 'status', { unique: false });
                doctorsStore.createIndex('odctrId', 'odctrId', { unique: true });

                // Consultations store
                if (!db.objectStoreNames.contains('consultations')) {
                    const consultStore = db.createObjectStore('consultations', { keyPath: 'id' });
                    consultStore.createIndex('patientId', 'patientId', { unique: false });
                    consultStore.createIndex('doctorId', 'doctorId', { unique: false });
                    consultStore.createIndex('status', 'status', { unique: false });
                    consultStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Chat messages store
                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
                    msgStore.createIndex('consultationId', 'consultationId', { unique: false });
                    msgStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Emergencies store
                if (!db.objectStoreNames.contains('emergencies')) {
                    const emergStore = db.createObjectStore('emergencies', { keyPath: 'id' });
                    emergStore.createIndex('status', 'status', { unique: false });
                    emergStore.createIndex('patientId', 'patientId', { unique: false });
                }

                // Prescriptions store
                if (!db.objectStoreNames.contains('prescriptions')) {
                    const rxStore = db.createObjectStore('prescriptions', { keyPath: 'id' });
                    rxStore.createIndex('consultationId', 'consultationId', { unique: false });
                    rxStore.createIndex('patientId', 'patientId', { unique: false });
                }

                // Availability updates (for real-time status)
                if (db.objectStoreNames.contains('availability')) {
                    db.deleteObjectStore('availability');
                }
                const availStore = db.createObjectStore('availability', { keyPath: 'odctrId' });
                availStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });

                // Dispatches store (ambulances/hospitals)
                if (db.objectStoreNames.contains('dispatches')) {
                    db.deleteObjectStore('dispatches');
                }
                const dispatchStore = db.createObjectStore('dispatches', { keyPath: 'id' });
                dispatchStore.createIndex('userId', 'userId', { unique: true });
                dispatchStore.createIndex('status', 'status', { unique: false });
                dispatchStore.createIndex('type', 'type', { unique: false });

                console.log('📦 Database schema created/updated');
            };
        });
    },

    // Generic CRUD operations
    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getOneByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.get(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // Count records
    async count(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

/**
 * Authentication Service
 */
const AuthService = {
    // Validation patterns
    patterns: {
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        phone: /^(07[1-9]|08[1-6])\d{7}$/, // Zimbabwe phone format: 07XXXXXXXX or 08XXXXXXXX
        password: /^.{6,}$/ // Minimum 6 characters
    },

    // Validate email
    validateEmail(email) {
        if (!email) return { valid: false, message: 'Email is required' };
        if (!this.patterns.email.test(email)) {
            return { valid: false, message: 'Invalid email format' };
        }
        return { valid: true };
    },

    // Validate phone (Zimbabwe format)
    validatePhone(phone) {
        if (!phone) return { valid: false, message: 'Phone number is required' };
        // Remove spaces and dashes
        const cleaned = phone.replace(/[\s-]/g, '');
        if (!this.patterns.phone.test(cleaned)) {
            return { valid: false, message: 'Invalid phone number. Use format: 07XXXXXXXX' };
        }
        return { valid: true, cleaned };
    },

    // Validate password
    validatePassword(password) {
        if (!password) return { valid: false, message: 'Password is required' };
        if (password.length < 6) {
            return { valid: false, message: 'Password must be at least 6 characters' };
        }
        return { valid: true };
    },

    // Hash password (simple hash for demo - in production use bcrypt)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'zambuko_salt_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Register new user
    async register(userData) {
        const { email, phone, password, fullName, userType = 'patient' } = userData;

        // Validate all fields
        const emailCheck = this.validateEmail(email);
        if (!emailCheck.valid) throw new Error(emailCheck.message);

        const phoneCheck = this.validatePhone(phone);
        if (!phoneCheck.valid) throw new Error(phoneCheck.message);

        const passCheck = this.validatePassword(password);
        if (!passCheck.valid) throw new Error(passCheck.message);

        if (!fullName || fullName.trim().length < 2) {
            throw new Error('Full name is required');
        }

        // Check if email already exists
        const existingEmail = await ZambukoDB.getOneByIndex('users', 'email', email.toLowerCase());
        if (existingEmail) {
            throw new Error('Email already registered');
        }

        // Check if phone already exists
        const existingPhone = await ZambukoDB.getOneByIndex('users', 'phone', phoneCheck.cleaned || phone);
        if (existingPhone) {
            throw new Error('Phone number already registered');
        }

        // Create user
        const hashedPassword = await this.hashPassword(password);
        const user = {
            id: 'USR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            email: email.toLowerCase(),
            phone: phoneCheck.cleaned || phone,
            fullName: fullName.trim(),
            userType,
            passwordHash: hashedPassword,
            createdAt: new Date().toISOString(),
            isActive: true,
            profileComplete: false
        };

        await ZambukoDB.add('users', user);

        // If registering as doctor, create doctor profile
        if (userType === 'doctor') {
            const doctorProfile = {
                id: 'DOC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                odctrId: user.id,
                name: fullName.trim(),
                specialty: userData.specialty || 'General Practice',
                status: 'OFFLINE',
                rating: 5.0,
                totalConsults: 0,
                emergencyCapable: false,
                queue: 0,
                location: null,
                lastHeartbeat: null,
                photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=14B8A6&color=fff`
            };
            await ZambukoDB.add('doctors', doctorProfile);
        }

        // Return user without password
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    },

    // Login user
    async login(identifier, password) {
        // Determine if identifier is email or phone
        let user;
        if (this.patterns.email.test(identifier)) {
            user = await ZambukoDB.getOneByIndex('users', 'email', identifier.toLowerCase());
        } else {
            const cleaned = identifier.replace(/[\s-]/g, '');
            user = await ZambukoDB.getOneByIndex('users', 'phone', cleaned);
        }

        if (!user) {
            throw new Error('Account not found');
        }

        // Verify password
        const hashedPassword = await this.hashPassword(password);
        if (user.passwordHash !== hashedPassword) {
            throw new Error('Invalid password');
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        await ZambukoDB.put('users', user);

        // Store session
        const { passwordHash, ...safeUser } = user;
        sessionStorage.setItem('zambuko_session', JSON.stringify(safeUser));

        return safeUser;
    },

    // Get current session
    getCurrentUser() {
        const session = sessionStorage.getItem('zambuko_session');
        return session ? JSON.parse(session) : null;
    },

    // Logout
    logout() {
        sessionStorage.removeItem('zambuko_session');
    },

    // Check if logged in
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }
};

/**
 * Doctor Availability Service (Real-time)
 */
const AvailabilityService = {
    heartbeatInterval: null,
    pollInterval: null,

    // Start heartbeat for doctors (call every 30 seconds)
    startHeartbeat(doctorId) {
        this.sendHeartbeat(doctorId);
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat(doctorId);
        }, 30000); // Every 30 seconds
    },

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    },

    async sendHeartbeat(odctrId) {
        const availability = await ZambukoDB.get('availability', odctrId);
        const now = new Date().toISOString();
        
        if (availability) {
            availability.lastUpdate = now;
            await ZambukoDB.put('availability', availability);
        } else {
            await ZambukoDB.add('availability', {
                odctrId,
                status: 'AVAILABLE',
                lastUpdate: now
            });
        }
    },

    // Update doctor status
    async updateStatus(userId, status) {
        // Find doctor by odctrId index
        const doctor = await ZambukoDB.getOneByIndex('doctors', 'odctrId', userId);
        
        if (doctor) {
            doctor.status = status;
            doctor.lastHeartbeat = new Date().toISOString();
            await ZambukoDB.put('doctors', doctor);
        }

        // Also update availability store
        await ZambukoDB.put('availability', {
            odctrId: userId,
            status,
            lastUpdate: new Date().toISOString()
        });

        // Broadcast to other tabs/windows
        localStorage.setItem('zambuko_status_update', JSON.stringify({
            odctrId: userId,
            status,
            timestamp: Date.now()
        }));
    },

    // Get all available doctors (shows ALL doctors, not just available)
    async getAvailableDoctors() {
        const doctors = await ZambukoDB.getAll('doctors');
        const now = Date.now();
        const timeout = 90000; // 90 seconds

        // Update status based on heartbeat
        for (const doc of doctors) {
            if (doc.lastHeartbeat) {
                const lastBeat = new Date(doc.lastHeartbeat).getTime();
                if (now - lastBeat > timeout && doc.status !== 'OFFLINE') {
                    doc.status = 'OFFLINE';
                    await ZambukoDB.put('doctors', doc);
                }
            }
        }
        
        return doctors;
    },
    
    // Get only online doctors
    async getOnlineDoctors() {
        const doctors = await this.getAvailableDoctors();
        return doctors.filter(doc => doc.status === 'AVAILABLE');
    },

    // Start polling for status updates (for patients)
    startPolling(callback, interval = 5000) {
        this.pollInterval = setInterval(async () => {
            const doctors = await this.getAvailableDoctors();
            callback(doctors);
        }, interval);

        // Also listen for localStorage changes (cross-tab communication)
        window.addEventListener('storage', (e) => {
            if (e.key === 'zambuko_status_update') {
                callback(null, JSON.parse(e.newValue));
            }
        });
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
};

/**
 * Emergency Service
 */
const EmergencyService = {
    // Common emergency descriptions
    commonEmergencies: [
        { id: 'chest_pain', label: 'Chest Pain / Heart Attack', priority: 'CRITICAL' },
        { id: 'breathing', label: 'Difficulty Breathing', priority: 'CRITICAL' },
        { id: 'unconscious', label: 'Person Unconscious', priority: 'CRITICAL' },
        { id: 'severe_bleeding', label: 'Severe Bleeding', priority: 'CRITICAL' },
        { id: 'stroke', label: 'Stroke Symptoms', priority: 'CRITICAL' },
        { id: 'accident', label: 'Accident / Injury', priority: 'HIGH' },
        { id: 'seizure', label: 'Seizure / Convulsions', priority: 'HIGH' },
        { id: 'allergic', label: 'Severe Allergic Reaction', priority: 'HIGH' },
        { id: 'poisoning', label: 'Poisoning / Overdose', priority: 'HIGH' },
        { id: 'burn', label: 'Severe Burns', priority: 'HIGH' },
        { id: 'childbirth', label: 'Childbirth / Labor', priority: 'HIGH' },
        { id: 'other', label: 'Other Emergency', priority: 'MEDIUM' }
    ],

    // Get current GPS location
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString()
                    });
                },
                (error) => {
                    reject(new Error('Could not get location: ' + error.message));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    },

    // Create emergency dispatch
    async createEmergency(data) {
        const { patientId, emergencyType, additionalInfo, location, patientName, patientPhone } = data;

        // Get patient info if not provided
        let pName = patientName;
        let pPhone = patientPhone;
        if (!pName && patientId && patientId !== 'anonymous') {
            try {
                const patient = await ZambukoDB.get('users', patientId);
                if (patient) {
                    pName = patient.fullName;
                    pPhone = patient.phone;
                }
            } catch (e) { /* ignore */ }
        }

        const emergency = {
            id: 'EMG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            patientId,
            patientName: pName || 'Anonymous',
            phone: pPhone || null,
            type: this.commonEmergencies.find(e => e.id === emergencyType)?.label || emergencyType,
            emergencyType,
            description: additionalInfo || this.commonEmergencies.find(e => e.id === emergencyType)?.label || emergencyType,
            additionalInfo,
            location: {
                lat: location?.latitude || location?.lat,
                lng: location?.longitude || location?.lng
            },
            status: 'PENDING',
            priority: this.commonEmergencies.find(e => e.id === emergencyType)?.priority || 'HIGH',
            createdAt: new Date().toISOString(),
            responder: null,
            eta: null
        };

        await ZambukoDB.add('emergencies', emergency);

        // Notify (store in localStorage for cross-tab communication)
        localStorage.setItem('zambuko_emergency_alert', JSON.stringify({
            emergency,
            timestamp: Date.now()
        }));

        return emergency;
    },

    // Get active emergencies (for admin/doctors)
    async getActiveEmergencies() {
        const all = await ZambukoDB.getAll('emergencies');
        return all.filter(e => e.status !== 'RESOLVED' && e.status !== 'CANCELLED');
    },

    // Find closest available dispatch unit
    async findClosestDispatch(patientLocation) {
        try {
            const dispatches = await ZambukoDB.getAll('dispatches');
            
            // Filter for available dispatches
            const availableDispatches = dispatches.filter(d => 
                d.status === 'AVAILABLE' && d.location
            );

            if (availableDispatches.length === 0) {
                // If no available, get any dispatch
                return dispatches.find(d => d.location) || null;
            }

            // Calculate distances and find closest
            let closest = null;
            let minDistance = Infinity;

            for (const dispatch of availableDispatches) {
                const distance = this.calculateDistance(
                    patientLocation.latitude, 
                    patientLocation.longitude,
                    dispatch.location.lat,
                    dispatch.location.lng
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    closest = dispatch;
                }
            }

            return closest;
        } catch (error) {
            console.error('Error finding closest dispatch:', error);
            return null;
        }
    },

    // Calculate distance between two points (Haversine formula)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
    }
};

/**
 * Chat Service
 */
const ChatService = {
    // Send a message
    async sendMessage(consultationId, senderId, senderType, content) {
        const message = {
            id: 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            consultationId,
            senderId,
            senderType, // 'patient' or 'doctor'
            content,
            timestamp: new Date().toISOString(),
            read: false
        };

        await ZambukoDB.add('messages', message);

        // Notify other participants
        localStorage.setItem('zambuko_new_message', JSON.stringify({
            message,
            timestamp: Date.now()
        }));

        return message;
    },

    // Get messages for a consultation
    async getMessages(consultationId) {
        return await ZambukoDB.getByIndex('messages', 'consultationId', consultationId);
    },

    // Mark messages as read
    async markAsRead(consultationId, readerId) {
        const messages = await this.getMessages(consultationId);
        for (const msg of messages) {
            if (msg.senderId !== readerId && !msg.read) {
                msg.read = true;
                await ZambukoDB.put('messages', msg);
            }
        }
    },

    // Listen for new messages
    startListening(callback) {
        window.addEventListener('storage', (e) => {
            if (e.key === 'zambuko_new_message') {
                callback(JSON.parse(e.newValue));
            }
        });
    }
};

/**
 * Consultation Service
 */
const ConsultationService = {
    // Create a consultation request
    async createRequest(patientId, doctorId, symptoms, triageLevel) {
        const consultation = {
            id: 'CONS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            patientId,
            doctorId,
            symptoms,
            triageLevel,
            status: 'PENDING', // PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED
            paymentStatus: 'UNPAID',
            createdAt: new Date().toISOString(),
            startedAt: null,
            endedAt: null,
            duration: null,
            notes: ''
        };

        await ZambukoDB.add('consultations', consultation);

        // Notify doctor
        localStorage.setItem('zambuko_consultation_request', JSON.stringify({
            consultation,
            timestamp: Date.now()
        }));

        return consultation;
    },

    // Accept consultation (doctor)
    async acceptConsultation(consultationId, doctorId) {
        const consultation = await ZambukoDB.get('consultations', consultationId);
        if (!consultation) throw new Error('Consultation not found');
        if (consultation.doctorId !== doctorId) throw new Error('Unauthorized');

        consultation.status = 'IN_SESSION';
        consultation.acceptedAt = new Date().toISOString();
        await ZambukoDB.put('consultations', consultation);

        localStorage.setItem('zambuko_consultation_update', JSON.stringify({
            consultation,
            action: 'ACCEPTED',
            timestamp: Date.now()
        }));

        return consultation;
    },

    // Start consultation
    async startConsultation(consultationId) {
        const consultation = await ZambukoDB.get('consultations', consultationId);
        if (!consultation) throw new Error('Consultation not found');

        consultation.status = 'IN_SESSION';
        consultation.startedAt = new Date().toISOString();
        await ZambukoDB.put('consultations', consultation);

        return consultation;
    },

    // End consultation
    async endConsultation(consultationId, notes = '') {
        const consultation = await ZambukoDB.get('consultations', consultationId);
        if (!consultation) throw new Error('Consultation not found');

        const endTime = new Date();
        const startTime = new Date(consultation.startedAt);
        const duration = Math.round((endTime - startTime) / 1000); // in seconds

        consultation.status = 'COMPLETED';
        consultation.endedAt = endTime.toISOString();
        consultation.duration = duration;
        consultation.notes = notes;
        await ZambukoDB.put('consultations', consultation);

        return consultation;
    },

    // Get consultations for patient
    async getPatientConsultations(patientId) {
        return await ZambukoDB.getByIndex('consultations', 'patientId', patientId);
    },

    // Get consultations for doctor
    async getDoctorConsultations(doctorId) {
        return await ZambukoDB.getByIndex('consultations', 'doctorId', doctorId);
    },

    // Get pending consultations for doctor
    async getPendingForDoctor(doctorId) {
        const all = await this.getDoctorConsultations(doctorId);
        return all.filter(c => c.status === 'PENDING');
    }
};

// Initialize database when script loads
window.ZambukoDB = ZambukoDB;
window.AuthService = AuthService;
window.AvailabilityService = AvailabilityService;
window.EmergencyService = EmergencyService;
window.ChatService = ChatService;
window.ConsultationService = ConsultationService;

// Auto-initialize database
ZambukoDB.init().then(() => {
    console.log('🏥 Zambuko services ready');
}).catch(err => {
    console.error('Database init failed:', err);
});
