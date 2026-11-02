import { Suspense } from 'react';
import Messages from '@/features/messages/Messages';

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Messages />
    </Suspense>
  );
}
