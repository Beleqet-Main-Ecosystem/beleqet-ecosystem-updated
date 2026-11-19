import { redirect } from 'next/navigation';

export default function ApplicationsPage() {
  redirect('/dashboard?tab=applications');
}
