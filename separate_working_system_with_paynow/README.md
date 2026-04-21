# Connect WiFi

> **Prepaid public WiFi hotspot system for Zimbabwe — A Robokorda Africa Initiative**

Connect WiFi is a production-ready, mobile-first captive portal system that integrates **MikroTik RouterOS** with **Paynow/EcoCash** payments. Built on **Next.js 14** (App Router) and **Supabase** (PostgreSQL + RLS).

---

## Architecture

```
connect/
├── app/
│   ├── portal/                  # Client captive portal (public)
│   │   ├── page.tsx             # Welcome screen – packages + voucher tab
│   │   ├── WelcomeClient.tsx    # Interactive client component
│   │   ├── buy/page.tsx         # EcoCash payment flow
│   │   └── session/page.tsx     # Active session dashboard + countdown timer
│   │
│   ├── admin/
│   │   ├── login/page.tsx       # Admin login
│   │   └── dashboard/
│   │       ├── page.tsx         # Overview + revenue chart
│   │       ├── vouchers/        # Voucher management & bulk generation
│   │       ├── sessions/        # Active user monitoring + kick/extend
│   │       ├── payments/        # Transaction history
│   │       ├── network/         # Speed limits & package control
│   │       └── logs/            # Audit trail
│   │
│   └── api/
│       ├── auth/login|logout|me
│       ├── vouchers/            # CRUD + validate endpoint
│       ├── payments/initiate|callback|status|route
│       ├── sessions/            # CRUD + disconnect/extend actions
│       └── admin/stats|logs|network
│
├── components/
│   ├── ui/                      # Button, Input, Badge, Modal, Toast
│   ├── portal/                  # PackageCard, SessionTimer
│   └── admin/                   # Sidebar, StatsCard, RevenueChart, DataTable
│
├── lib/
│   ├── auth/jwt.ts              # JWT sign/verify
│   ├── supabase/client.ts|server.ts
│   ├── paynow/client.ts         # EcoCash payment + callback verification
│   ├── mikrotik/client.ts       # RouterOS API wrapper
│   └── utils/voucher|format|validation
│
├── middleware.ts                 # JWT-based admin route protection
├── supabase/migrations/001.sql  # Full database schema
└── scripts/seed.js              # Create initial admin account
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 18 | LTS recommended |
| Supabase project | Free tier works for testing |
| Paynow account | [developers.paynow.co.zw](https://developers.paynow.co.zw) |
| MikroTik router | Optional – system runs in standalone mode without it |
| HTTPS endpoint | Required for Paynow callbacks (use ngrok for dev) |

---

## Quick Start

### 1. Clone & install

```bash
cd "connect"
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your real credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

JWT_SECRET=<64-char random string>

PAYNOW_INTEGRATION_ID=your-id
PAYNOW_INTEGRATION_KEY=your-key
PAYNOW_RESULT_URL=https://your-domain.com/api/payments/callback
PAYNOW_RETURN_URL=https://your-domain.com/portal/session

MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=your-password
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Set up the database

Run the SQL file in your Supabase SQL editor:

```
supabase/migrations/001_initial.sql
```

### 4. Create the first admin

```bash
node scripts/seed.js
```

### 5. Start development server

```bash
npm run dev
```

| URL | Description |
|---|---|
| http://localhost:3000/portal | Client captive portal |
| http://localhost:3000/admin/login | Admin login |
| http://localhost:3000/admin/dashboard | Admin dashboard |

---

## Deployment

### VPS / Local Server (recommended for low-latency captive portal)

```bash
npm run build
npm start
```

Use **PM2** to keep the server alive:
```bash
npm install -g pm2
pm2 start npm --name "connect-wifi" -- start
pm2 save && pm2 startup
```

### MikroTik Hotspot Configuration

1. In **Winbox** → IP → Hotspot → Servers → add new server pointing to your LAN interface.
2. Set **Login by** = `HTTP CHAP` or `HTTP PAP`.
3. Set **Login page** redirect to point to your Connect WiFi server URL:
   `http://<server-ip>/portal`

MikroTik will auto-redirect connected clients to the portal. After voucher validation, the system calls the RouterOS API to whitelist the user.

### HTTPS (Required for Paynow)

Use **Nginx** as a reverse proxy with a Let's Encrypt certificate:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

---

## Payment Flow (EcoCash)

```
User selects package
        │
        ▼
POST /api/payments/initiate
  → Creates pending Transaction record
  → Calls Paynow API (EcoCash STK push)
  → Returns { reference, pollInterval }
        │
        ▼
Frontend polls GET /api/payments/status/:reference (every 5s)
        │
  ┌─────┴─────┐
  │           │
Paynow POST /api/payments/callback   (webhook)
  → Verifies MD5 hash (anti-spoofing)
  → Generates voucher code
  → Updates transaction status → 'paid'
  → Links voucher to transaction
        │
        ▼
Frontend receives status=paid → shows voucher code
User enters voucher → /api/vouchers/validate
  → Activates voucher (status: active)
  → Creates MikroTik hotspot user
  → Creates session record
  → Returns login URL for MikroTik redirect
```

---

## Security Notes

- **JWT** tokens are `httpOnly` cookies (not accessible from JS).
- **Paynow callbacks** are hash-verified before processing — spoofed callbacks are rejected.
- **Voucher codes** are cryptographically random (no sequential IDs).
- **Admin routes** are protected by Next.js middleware — unauthenticated requests never reach pages.
- **Supabase RLS** is enabled on all tables; API routes use the service-role key.
- **Input validation** uses Zod schemas on all mutation endpoints.
- **Rate limiting** should be added via a middleware or reverse proxy in production.

---

## MikroTik Profiles

Create matching profiles in RouterOS for each package:

| Package | Profile Name | Rate Limit |
|---|---|---|
| 1 Hour | `1 Hour` | 5M/5M |
| 1 Day | `1 Day` | 10M/10M |
| 3 Days | `3 Days` | 10M/10M |
| 1 Month | `1 Month` | 20M/20M |

The profile name must **exactly match** the package name in the database.

---

## Built By

**Robokorda Africa** — *Connecting communities through technology*

> Connect WiFi is a subsidiary initiative of Robokorda Africa, bringing affordable internet access to communities across Zimbabwe.
