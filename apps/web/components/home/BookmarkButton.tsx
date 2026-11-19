'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';

interface BookmarkButtonProps {
  label?: string;
  savedLabel?: string;
  jobId?: string;
  initialSaved?: boolean;
}

export default function BookmarkButton({
  label = 'Save job',
  savedLabel = 'Saved',
  jobId: _jobId,
  initialSaved = false,
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(initialSaved);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? savedLabel : label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved((s) => !s);
      }}
      className="relative z-10 grid size-10 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
    >
      <Bookmark
        className={`size-5 ${saved ? 'fill-brand-600 text-brand-600' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}
