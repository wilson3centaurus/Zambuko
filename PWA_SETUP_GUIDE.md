# Zambuko Telehealth Platform - PWA Setup Guide

## Progressive Web App (PWA) Features

All 4 apps (Patient, Doctor, Dispatch, Admin) are now full PWAs with:
- ✅ **Offline functionality** - Works without internet connection
- ✅ **Installable** - Add to home screen on mobile/desktop
- ✅ **App-like experience** - Runs in standalone mode
- ✅ **Service Worker caching** - Fast loading and offline support
- ✅ **Push notifications** - Stay updated with real-time alerts

---

## Local Network Setup (Same WiFi)

### Step 1: Find Your PC's IP Address

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" (e.g., `192.168.1.5`)

**Mac/Linux:**
```bash
ifconfig
```
or
```bash
hostname -I
```

### Step 2: Start Your Development Server

**Using Live Server (VS Code):**
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html` in the root folder
3. Select "Open with Live Server"
4. Note the port (usually `5500`)

**Using Python:**
```bash
cd Zambuko
python -m http.server 8000
```

**Using Node.js:**
```bash
npx http-server -p 8000
```

### Step 3: Access on Mobile/Tablet

On your mobile device (connected to **same WiFi**):

1. Open Chrome browser
2. Enter: `http://YOUR_PC_IP:PORT/patient-app/`
   - Example: `http://192.168.1.5:5500/patient-app/`
3. For other apps:
   - Doctor: `http://192.168.1.5:5500/doctor-app/`
   - Dispatch: `http://192.168.1.5:5500/dispatch-app/`
   - Admin: `http://192.168.1.5:5500/admin-dashboard/`

### Step 4: Install as App

**Android (Chrome):**
1. Open the app in Chrome
2. Tap the menu (⋮)
3. Select "Add to Home screen" or "Install app"
4. Confirm installation
5. App icon will appear on your home screen

**iOS (Safari):**
1. Open the app in Safari
2. Tap the Share button (□↑)
3. Scroll down and tap "Add to Home Screen"
4. Name the app and tap "Add"
5. App icon will appear on your home screen

**Desktop (Chrome/Edge):**
1. Look for the install icon in the address bar (⊕ or 🖥️)
2. Click "Install"
3. App will open in its own window

---

## Making It Work Without Your PC

### Option 1: Deploy to Hosting (Recommended)

Deploy to a web hosting service for permanent access:

**Free Options:**
- **GitHub Pages** (recommended for static sites)
- **Netlify** (easy deployment, custom domains)
- **Vercel** (optimized for web apps)
- **Firebase Hosting** (Google's free tier)

**Quick Deploy with GitHub Pages:**
```bash
# 1. Initialize git repo
git init
git add .
git commit -m "Initial commit"

# 2. Create GitHub repository
# Go to github.com and create new repo named "zambuko-telehealth"

# 3. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/zambuko-telehealth.git
git branch -M main
git push -u origin main

# 4. Enable GitHub Pages
# Go to repo Settings > Pages > Source: "main branch" > Save
```

Your apps will be available at:
- `https://YOUR_USERNAME.github.io/zambuko-telehealth/patient-app/`
- `https://YOUR_USERNAME.github.io/zambuko-telehealth/doctor-app/`
- `https://YOUR_USERNAME.github.io/zambuko-telehealth/dispatch-app/`
- `https://YOUR_USERNAME.github.io/zambuko-telehealth/admin-dashboard/`

### Option 2: Use ngrok for Testing

**ngrok** creates a public URL for your local server:

```bash
# 1. Download ngrok from https://ngrok.com
# 2. Start your local server (port 5500)
# 3. Run ngrok
ngrok http 5500
```

You'll get a URL like: `https://abc123.ngrok.io`

Access your apps:
- Patient: `https://abc123.ngrok.io/patient-app/`
- Doctor: `https://abc123.ngrok.io/doctor-app/`
- etc.

**Note:** Free ngrok URLs expire after 2 hours and change each time.

### Option 3: Self-Hosted Server

Set up a permanent server on your PC:

**Using Node.js + PM2:**
```bash
# Install PM2
npm install -g pm2 http-server

# Start server
pm2 start http-server -- -p 8080

# Save for auto-restart
pm2 save
pm2 startup
```

**Using XAMPP/WAMP:**
1. Install XAMPP
2. Place Zambuko folder in `htdocs/`
3. Access via `http://YOUR_PC_IP/Zambuko/patient-app/`

---

## PWA Features Explained

### Offline Functionality
- All static files (HTML, CSS, JS) are cached
- Database (IndexedDB) persists offline
- Users can browse history, view data without internet
- New data syncs when connection restored

### Service Worker
Each app has its own service worker:
- `patient-app/service-worker.js`
- `doctor-app/service-worker.js`
- `dispatch-app/service-worker.js`
- `admin-dashboard/service-worker.js`

**Cache Strategy:**
- **Static assets** → Cache first (HTML, CSS, JS)
- **API calls** → Network first with cache fallback
- **Navigation** → Network with offline fallback

### Updating the PWA

When you update code:
1. User opens app
2. Service worker detects new version
3. Downloads in background
4. Activates on next app restart
5. Old cache is cleared automatically

**Force update:**
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister())
})
location.reload()
```

---

## Testing PWA Features

### Test Offline Mode (Chrome DevTools)

1. Open app in Chrome
2. Press `F12` (Developer Tools)
3. Go to "Application" tab
4. Under "Service Workers":
   - Check "Offline" checkbox
5. Refresh page - app should still work!

### Test Install Prompt

1. Open DevTools > Application
2. Under "Manifest" - verify all settings
3. Check "Service Workers" - should show "activated"
4. Try installing via address bar icon

### Test Cache

1. DevTools > Application > Cache Storage
2. Expand cache names
3. See all cached files
4. Right-click to clear cache for testing

---

## Troubleshooting

### Service Worker Not Registering

**Check:**
- Must use HTTPS or localhost
- Check browser console for errors
- Verify path in registration code
- Try incognito mode (fresh state)

**Fix:**
```javascript
// Unregister and re-register
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister())
})
```

### App Not Updating

**Solution:**
1. Update version in service worker: `const CACHE_NAME = 'zambuko-patient-v2';`
2. Service worker will auto-update
3. Or manually clear cache and reload

### Can't Install on iOS

**Requirements:**
- Must use Safari browser
- Must be on HTTPS (or localhost)
- iOS 11.3 or higher

### Database Not Persisting

**Check:**
- IndexedDB is enabled in browser
- Not in incognito/private mode
- Storage quota not exceeded

---

## Production Deployment Checklist

- [ ] Update all URLs in service workers to production domain
- [ ] Generate proper app icons (72x72 to 512x512)
- [ ] Enable HTTPS (required for PWA)
- [ ] Test on multiple devices (iOS, Android, Desktop)
- [ ] Verify offline functionality
- [ ] Test install on all platforms
- [ ] Set up analytics (track installs, usage)
- [ ] Configure push notification service (optional)
- [ ] Add app screenshots to manifest
- [ ] Test cache strategy (verify files load fast)

---

## App Icon Generation

Create icons in these sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

**Quick tool:** https://realfavicongenerator.net/

Place in:
- `patient-app/icons/`
- `doctor-app/icons/`
- `dispatch-app/icons/`
- `admin-dashboard/icons/`

---

## Support

For issues or questions:
- Check browser console for errors
- Verify service worker status in DevTools
- Test in incognito mode (fresh state)
- Clear cache and reload if problems persist

---

## Current Status

✅ **All 4 apps are PWA-ready!**
- Patient App - installable, offline-capable
- Doctor App - installable, offline-capable  
- Dispatch App - installable, offline-capable
- Admin Dashboard - installable, offline-capable

**Just deploy to hosting and enjoy native app experience!** 🚀
