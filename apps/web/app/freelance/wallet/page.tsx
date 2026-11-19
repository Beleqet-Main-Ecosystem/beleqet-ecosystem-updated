import { redirect } from 'next/navigation';

/** The address the "funds available" Telegram message links to. */
export default function FreelanceWalletPage() {
  redirect('/dashboard?tab=wallet');
}
