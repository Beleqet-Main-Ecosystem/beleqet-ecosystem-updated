'use client';

import { useState } from 'react';
import AvailabilityModal from './AvailabilityModal';

interface Availability {
  id: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface Props {
  slots?: Availability[];
  onRefresh: () => void;
}

export default function AvailabilityCard({ slots, onRefresh }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold">Interview Availability</h2>

          <button
            onClick={() => setOpen(true)}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg"
          >
            Set Available Time
          </button>
        </div>

        {slots?.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500">You haven't set any available interview times yet.</p>

            <p className="text-sm text-slate-400 mt-2">
              Add your available time so employers can schedule interviews easily.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots?.map((slot) => (
              <div key={slot.id} className="border rounded-xl p-4 flex justify-between">
                <div>
                  <p className="font-medium">{new Date(slot.startTime).toLocaleDateString()}</p>

                  <p className="text-slate-600">
                    {new Date(slot.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' - '}
                    {new Date(slot.endTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AvailabilityModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false);
          onRefresh();
        }}
      />
    </>
  );
}
