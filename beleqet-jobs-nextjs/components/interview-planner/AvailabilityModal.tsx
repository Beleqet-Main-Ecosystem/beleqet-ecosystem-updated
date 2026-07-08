'use client';

import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AvailabilityModal({ open, onClose, onSuccess }: Props) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);
  const timezones = Intl.supportedValuesOf('timeZone');
  if (!open) return null;

  const handleSubmit = async () => {
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    const token = localStorage.getItem('beleqet_token');
    console.log('TOKEN FROM STORAGE:', token);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timezone,
        }),
      },
    );

    if (!response.ok) {
      console.log(await response.json());
      return;
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-5">Find Your Best Interview Time</h2>

        <div className="space-y-4">
          <h1 className="text-sm font-medium text-ink">Date</h1>
          <input
            type="date"
            className="w-full border rounded-lg p-3"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <h1 className="text-sm font-medium text-ink">Start Time</h1>
          <input
            type="time"
            className="w-full border rounded-lg p-3"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <h1 className="text-sm font-medium text-ink">End Time</h1>
          <input
            type="time"
            className="w-full border rounded-lg p-3"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>

            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-green-600"
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="border px-4 py-2 rounded-lg">
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
