import { useState } from 'react';
import { Calendar, MoreVertical, Edit2, Trash2, Users } from 'lucide-react';
import AvailabilityModal from './AvailabilityModal';

/**
 * Represents a single interview availability time slot.
 */
interface Slot {
  /** Unique identifier of the availability slot. */
  id: string;

  /** Start date and time in ISO-8601 format. */
  startTime: string;

  /** End date and time in ISO-8601 format. */
  endTime: string;
}

/**
 * Props for the AvailabilityCard component.
 */
interface Props {
  /**
   * Collection of interview availability slots belonging to the current user.
   */
  slots: Slot[];

  /**
   * Callback invoked after a successful create, update, or delete
   * operation to refresh the availability list.
   */
  onRefresh: () => void;

  /**
   * Optional callback triggered when the user edits
   * an availability slot.
   */
  onEdit?: (slot: Slot) => void;

  /**
   * Optional callback triggered when the user deletes
   * an availability slot.
   */
  onDelete?: (id: string) => void;
}

/**
 * Displays and manages a user's interview availability schedule.
 *
 * This component renders a list of availability slots, allows users
 * to add new availability through a modal, and optionally edit or
 * delete existing slots. When no availability exists, an empty state
 * is displayed to encourage users to create their first time slot.
 *
 * @param props Component properties.
 * @returns The interview availability management card.
 */
export default function AvailabilityCard({ slots, onRefresh, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  /**
   * Formats an ISO date string into a long, human-readable date.
   *
   * Example:
   * Monday, July 13, 2026
   *
   * @param dateString ISO date string.
   * @returns Formatted date.
   */
  const formatLongDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  /**
   * Formats an ISO date string into a localized time.
   *
   * Example:
   * 09:30 AM
   *
   * @param dateString ISO date string.
   * @returns Formatted time.
   */

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Interview Availability</h2>
        </div>

        {slots?.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-slate-500 font-medium">
              You haven't set any available interview times yet.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Add your available time so our platform can schedule interviews easily.
            </p>
          </div>
        ) : (
          <div
            className="max-h-[310px] overflow-y-auto pr-2 space-y-3"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 transparent',
            }}
          >
            {slots?.map((slot) => (
              <div
                key={slot.id}
                className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 transition-colors bg-white shadow-xs"
              >
                {/* Left Side: Date and Time Display */}
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-500 border border-slate-100 hidden sm:block">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{formatLongDate(slot.startTime)}</p>
                    <p className="text-sm text-slate-500 mt-0.5 font-medium">
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </p>
                  </div>
                </div>
                {/* Right Side: Three-Dot Dropdown Actions */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdownId(activeDropdownId === slot.id ? null : slot.id);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    title="More options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {activeDropdownId === slot.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActiveDropdownId(null)}
                      />

                      <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                        <button
                          onClick={() => {
                            console.log('View applicants');
                            setActiveDropdownId(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                        >
                          <Users className="w-4 h-4 text-slate-400" />
                          View Bookings
                        </button>

                        <button
                          onClick={() => {
                            setEditingSlot(slot);
                            setOpen(true);
                            setActiveDropdownId(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-emerald-600" />
                          Edit Slot
                        </button>

                        <hr className="my-1 border-slate-100" />

                        <button
                          onClick={() => {
                            onDelete?.(slot.id);
                            setActiveDropdownId(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          Delete Slot
                        </button>
                      </div>
                    </>
                  )}
                </div>{' '}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => {
              setEditingSlot(null);
              setOpen(true);
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 px-6 rounded-xl transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            Set Available Time
          </button>
        </div>
      </div>

      <AvailabilityModal
        open={open}
        slot={editingSlot}
        onClose={() => {
          setOpen(false);
          setEditingSlot(null);
        }}
        onSuccess={() => {
          setOpen(false);
          setEditingSlot(null);
          onRefresh();
        }}
      />
    </>
  );
}
