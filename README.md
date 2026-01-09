# Zambuko Telehealth Platform

A Progressive Web App (PWA) telehealth solution for Zimbabwe, providing remote healthcare access to underserved communities.

## 🏥 Project Overview

Zambuko is a complete telehealth platform consisting of three applications:

1. **Patient App** - For patients to book consultations, check symptoms, and manage prescriptions
2. **Doctor App** - For healthcare providers to manage consultations and issue prescriptions
3. **Admin Dashboard** - For platform administrators to monitor and manage the system

## 🚀 Features

### Core Features
- ✅ Real-time doctor availability (Online, Busy, Offline)
- ✅ EcoCash/OneMoney/Telecash payment integration (simulated)
- ✅ AI-powered symptom triage
- ✅ Video, audio, and chat consultations (UI ready)
- ✅ Emergency GPS-based dispatching
- ✅ E-prescriptions and pharmacy delivery
- ✅ Low-bandwidth mode support
- ✅ Offline storage with automatic syncing

### Algorithms Implemented
- **Doctor Matching Algorithm** - Ranks doctors by proximity, rating, and queue length
- **AI Symptom Triage** - Calculates risk scores and assigns priority levels
- **Doctor Availability Heartbeat** - Tracks doctor status in real-time
- **Emergency Dispatch Algorithm** - Finds nearest available responder

## 📁 Project Structure

```
Zambuko/
├── index.html              # Landing page with links to all apps
├── README.md               # This file
├── patient-app/            # Patient PWA
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js              # Service Worker
│   ├── css/
│   │   └── patient.css
│   └── js/
│       └── patient.js
├── doctor-app/             # Doctor PWA
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/
│   │   └── doctor.css
│   └── js/
│       └── doctor.js
├── admin-dashboard/        # Admin Dashboard
│   ├── index.html
│   ├── manifest.json
│   ├── css/
│   │   └── admin.css
│   └── js/
│       └── admin.js
└── shared/                 # Shared resources
    ├── css/
    │   └── common.css     # Common styles
    ├── js/
    │   └── utils.js       # Shared utilities & algorithms
    └── icons/
        └── icon-192.svg
```

## 🔧 How to Run

### Option 1: Simple HTTP Server (Recommended)

Using Python:
```bash
cd Zambuko
python -m http.server 8080
```

Using Node.js:
```bash
npx serve Zambuko
```

Then open: `http://localhost:8080`

### Option 2: VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 3: Direct File Access

Simply open `index.html` in your browser. Note: Some PWA features may not work without a server.

## 🔐 Demo Credentials

| App | Username | Password |
|-----|----------|----------|
| Admin | admin@zambuko.co.zw | admin123 |

## 📱 PWA Installation

Each app can be installed as a Progressive Web App:

1. Open the app in Chrome/Edge
2. Click the install icon in the address bar
3. Or use menu → "Install app"

## 🎯 Key Flows

### Patient Flow
1. Login → Enter symptoms → AI triage assigns priority
2. View available doctors → Select doctor → Pay via EcoCash
3. Start video/audio/chat consultation
4. Receive e-prescription → Order medication delivery

### Doctor Flow
1. Login → Set availability status
2. Receive consultation requests → Accept/Decline
3. Start consultation → Take notes → End session
4. Write and send prescription

### Admin Flow
1. Login → View dashboard analytics
2. Manage doctors and patients
3. Monitor consultations and emergencies
4. Configure system settings

## 💻 Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Charts**: Chart.js (Admin Dashboard)
- **Storage**: LocalStorage / SessionStorage
- **PWA**: Service Workers, Web App Manifest
- **Icons**: UI Avatars API

## 🔒 Data Storage

All data is stored locally in the browser using:
- `localStorage` - Persistent data (consultations, prescriptions)
- `sessionStorage` - Session data (current user)

## 🚧 Future Enhancements

- [ ] Backend API integration
- [ ] Real video/audio calling (WebRTC)
- [ ] Real EcoCash API integration
- [ ] Push notifications
- [ ] Offline-first architecture
- [ ] Multi-language support (Shona, Ndebele)

## 📄 License

© 2026 Zambuko Telehealth. All rights reserved.

---

Built with ❤️ for Zimbabwe's healthcare future.
