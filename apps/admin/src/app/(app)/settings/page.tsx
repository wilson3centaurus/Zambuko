"use client";

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Platform configuration</p>
      </div>

      {/* App info */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {[
          { label: "App Name", value: "Hutano" },
          { label: "Version", value: "1.0.0 MVP" },
          { label: "Platform", value: "Telehealth · Zimbabwe" },
          { label: "Support Email", value: "support@hutano.co.zw" },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-600">{label}</span>
            <span className="text-sm text-gray-900 font-semibold">{value}</span>
          </div>
        ))}
      </div>

      {/* Supabase */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-black text-gray-700 mb-3">Infrastructure</h2>
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Supabase (Cloud) — Connected
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Auth — Email + Password
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            SMS / Phone Auth — Not configured (post-MVP)
          </div>
        </div>
      </div>

      <p className="text-xs text-center text-gray-400">Additional settings coming in future releases</p>
    </div>
  );
}
