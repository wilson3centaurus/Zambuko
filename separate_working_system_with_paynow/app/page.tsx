import { redirect } from 'next/navigation';

export default function Home() {
  // Root redirects to the captive portal
  redirect('/portal');
}
