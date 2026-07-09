'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
interface Slot {
  id: string;
  startTime: string;
  endTime: string;
}

interface Props {
  open: boolean;
  slot?: Slot | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AvailabilityModal({ open, slot, onClose, onSuccess }: Props) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);

  const timezones = Intl.supportedValuesOf('timeZone');

  useEffect(() => {
    if (!slot) {
      setDate('');
      setStartTime('');
      setEndTime('');
      return;
    }

    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    setDate(start.toISOString().split('T')[0]);

    setStartTime(
      start.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    );

    setEndTime(
      end.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    );
  }, [slot, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${date}T${endTime}`);

      const token = localStorage.getItem('beleqet_token');

      const url = slot
        ? `${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability/${slot.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability`;

      const method = slot ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timezone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Something went wrong.');
        return;
      }

      toast.success(data.message);

      onSuccess();
    } catch (error) {
      console.error(error);

      toast.error('Unable to save availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-5 text-xl font-bold">
          {slot ? 'Edit Interview Availability' : 'Find Your Best Interview Time'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Date</label>

            <input
              type="date"
              className="w-full rounded-lg border p-3"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Start Time</label>

            <input
              type="time"
              className="w-full rounded-lg border p-3"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">End Time</label>

            <input
              type="time"
              className="w-full rounded-lg border p-3"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Timezone</label>

            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border p-3 focus:ring-2 focus:ring-green-600"
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2">
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-green-700 px-4 py-2 text-white"
          >
            {loading
              ? slot
                ? 'Updating...'
                : 'Saving...'
              : slot
                ? 'Update Availability'
                : 'Save Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
