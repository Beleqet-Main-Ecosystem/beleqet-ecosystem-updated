'use client';

import { useEffect, useState } from 'react';

interface Availability {
  id: string;
  startTime: string;
  endTime: string;
}

export default function Availability() {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [slots, setSlots] = useState<Availability[]>([]);

  const loadAvailability = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability`, {
      credentials: 'include',
    });

    const data = await res.json();
    setSlots(data);
  };

  useEffect(() => {
    loadAvailability();
  }, []);

  const handleSubmit = async () => {
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/interview-planner/availability`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    setDate('');
    setStartTime('');
    setEndTime('');

    loadAvailability();
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Interview Availability</h1>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <input
          type="date"
          className="w-full border rounded-lg p-3"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <input
          type="time"
          className="w-full border rounded-lg p-3"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />

        <input
          type="time"
          className="w-full border rounded-lg p-3"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />

        <button onClick={handleSubmit} className="bg-green-700 text-white px-5 py-3 rounded-lg">
          Add Availability
        </button>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold text-xl mb-4">Available Slots</h2>

        <div className="space-y-3">
          {slots.map((slot) => (
            <div key={slot.id} className="bg-white border rounded-xl p-4">
              <div>{new Date(slot.startTime).toLocaleString()}</div>

              <div>{new Date(slot.endTime).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
