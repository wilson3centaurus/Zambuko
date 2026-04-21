import type { Metadata } from 'next';
import { Sidebar } from '@/components/admin/Sidebar';
import { AdminTopbar } from '@/components/admin/Topbar';

export const metadata: Metadata = {
  title: 'Connect Admin',
  description: 'Connect WiFi management dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen admin-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar />
        <main className="flex-1 flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
