import { createServiceRoleClient } from '@/lib/supabase/server';
import { WelcomeClient } from './WelcomeClient';
import type { Package } from '@/lib/types';

async function getPackages(): Promise<Package[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('packages')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  return (data as Package[]) ?? [];
}

export default async function PortalPage() {
  const packages = await getPackages();
  return <WelcomeClient packages={packages} />;
}
