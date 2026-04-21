/**
 * One-time script to create test users in cloud Supabase.
 * Run: node scripts/create-test-users.mjs
 */

import https from "https";

const HOST = "lkndeccqexejflcgkwiy.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrbmRlY2NxZXhlamZsY2drd2l5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE2NzYyOCwiZXhwIjoyMDkwNzQzNjI4fQ.XPFbmMv7PgKBc1DvWIX0y3yMMaqmwOUUJG0IFaj9S34";

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: HOST,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const users = [
  // Admin
  { email: "admin@zambuko.co.zw",              password: "Admin1234!",    role: "admin",      name: "System Admin" },
  // Doctors
  { email: "doctor.takudzwa@zambuko.co.zw",    password: "Doctor1234!",   role: "doctor",     name: "Dr. Takudzwa Moyo" },
  { email: "doctor.rudo@zambuko.co.zw",        password: "Doctor1234!",   role: "doctor",     name: "Dr. Rudo Ncube" },
  { email: "doctor.farai@zambuko.co.zw",       password: "Doctor1234!",   role: "doctor",     name: "Dr. Farai Chikwanda" },
  { email: "doctor.priscilla@zambuko.co.zw",   password: "Doctor1234!",   role: "doctor",     name: "Dr. Priscilla Dube" },
  { email: "doctor.blessing@zambuko.co.zw",    password: "Doctor1234!",   role: "doctor",     name: "Dr. Blessing Sithole" },
  // Patients
  { email: "patient.chiedza@zambuko.co.zw",    password: "Patient1234!",  role: "patient",    name: "Chiedza Mapfumo" },
  { email: "patient.tendai@zambuko.co.zw",     password: "Patient1234!",  role: "patient",    name: "Tendai Zvobgo" },
  { email: "patient.nyasha@zambuko.co.zw",     password: "Patient1234!",  role: "patient",    name: "Nyasha Mubvumbi" },
  // Dispatchers
  { email: "dispatch.simba@zambuko.co.zw",     password: "Dispatch1234!", role: "dispatcher", name: "Simba Chirwo" },
  { email: "dispatch.tatenda@zambuko.co.zw",   password: "Dispatch1234!", role: "dispatcher", name: "Tatenda Mutasa" },
];

console.log("Creating test users in Supabase...\n");

for (const user of users) {
  const { status, body } = await post("/auth/v1/admin/users", {
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { role: user.role, full_name: user.name },
  });

  const msg = body?.msg || body?.message || body?.error_description || "";
  if (status === 200 || status === 201) {
    console.log(`  OK    ${user.email}`);
  } else if (msg.toLowerCase().includes("already")) {
    console.log(`  SKIP  ${user.email} (already exists)`);
  } else {
    console.log(`  FAIL  ${user.email} [${status}] — ${msg || JSON.stringify(body)}`);
  }
}

console.log("\nDone! All users processed.");
console.log("\nLogin credentials:");
console.log("  Admin:      admin@zambuko.co.zw          / Admin1234!");
console.log("  Doctor:     doctor.takudzwa@zambuko.co.zw / Doctor1234!");
console.log("  Patient:    patient.chiedza@zambuko.co.zw / Patient1234!");
console.log("  Dispatcher: dispatch.simba@zambuko.co.zw  / Dispatch1234!");
