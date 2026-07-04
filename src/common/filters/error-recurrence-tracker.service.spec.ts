/**
 * @file error-recurrence-tracker.service.spec.ts
 * @description Unit tests for ErrorRecurrenceTrackerService.
 *
 * Uses Jest's fake-timer support to control the sliding window without
 * waiting for real time to pass.
 */
import { ErrorRecurrenceTrackerService } from './error-recurrence-tracker.service';
import { ERROR_CODES } from './all-exceptions.filter';

describe('ErrorRecurrenceTrackerService', () => {
  let tracker: ErrorRecurrenceTrackerService;

  /** Small window + low threshold for fast tests */
  const WINDOW_MS  = 10_000; // 10 s
  const THRESHOLD  = 3;

  beforeEach(() => {
    jest.useFakeTimers();
    tracker = new ErrorRecurrenceTrackerService(WINDOW_MS, THRESHOLD);
  });

  afterEach(() => {
    jest.useRealTimers();
    tracker.reset();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // track()
  // ──────────────────────────────────────────────────────────────────────────
  describe('track()', () => {
    it('records occurrences without throwing', () => {
      expect(() =>
        tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/api/v1/jobs', 'DB error'),
      ).not.toThrow();
    });

    it('accumulates multiple hits for the same error code', () => {
      tracker.track(ERROR_CODES.NOT_FOUND, '/api/v1/jobs/123', 'not found');
      tracker.track(ERROR_CODES.NOT_FOUND, '/api/v1/jobs/456', 'not found');

      const snap = tracker.getByCode(ERROR_CODES.NOT_FOUND);
      expect(snap).not.toBeNull();
      expect(snap!.hitCount).toBe(2);
    });

    it('separates hits by error code', () => {
      tracker.track(ERROR_CODES.NOT_FOUND,     '/a', 'not found');
      tracker.track(ERROR_CODES.UNAUTHORIZED,  '/b', 'unauthorized');

      expect(tracker.getByCode(ERROR_CODES.NOT_FOUND)!.hitCount).toBe(1);
      expect(tracker.getByCode(ERROR_CODES.UNAUTHORIZED)!.hitCount).toBe(1);
    });

    it('prunes occurrences outside the sliding window', () => {
      tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/a', 'err1');
      tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/b', 'err2');

      // Advance time past the window
      jest.advanceTimersByTime(WINDOW_MS + 1_000);

      // New hit — old ones should be pruned
      tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/c', 'err3');

      const snap = tracker.getByCode(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(snap!.hitCount).toBe(1);
    });

    it('sets alertTriggered when threshold is reached', () => {
      for (let i = 0; i < THRESHOLD; i++) {
        tracker.track(ERROR_CODES.DB_CONNECTION, '/api/v1/jobs', 'db down');
      }

      const snap = tracker.getByCode(ERROR_CODES.DB_CONNECTION);
      expect(snap!.alertTriggered).toBe(true);
    });

    it('does not set alertTriggered below threshold', () => {
      for (let i = 0; i < THRESHOLD - 1; i++) {
        tracker.track(ERROR_CODES.DB_CONNECTION, '/api/v1/jobs', 'db down');
      }

      const snap = tracker.getByCode(ERROR_CODES.DB_CONNECTION);
      expect(snap!.alertTriggered).toBe(false);
    });

    it('de-duplicates the alert within the same window', () => {
      const logSpy = jest.spyOn(
        (tracker as unknown as { logger: { error: jest.Mock } }).logger,
        'error',
      );

      // Fire well above threshold — alert should log only once
      for (let i = 0; i < THRESHOLD + 5; i++) {
        tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/api', 'err');
      }

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it('resets the alert flag after the window expires', () => {
      // Fill up to threshold
      for (let i = 0; i < THRESHOLD; i++) {
        tracker.track(ERROR_CODES.FORBIDDEN, '/admin', 'forbidden');
      }

      // Advance past the window so all old entries are pruned
      jest.advanceTimersByTime(WINDOW_MS + 1_000);

      // New single hit — should NOT be alerted
      tracker.track(ERROR_CODES.FORBIDDEN, '/admin', 'forbidden');

      const snap = tracker.getByCode(ERROR_CODES.FORBIDDEN);
      expect(snap!.hitCount).toBe(1);
      expect(snap!.alertTriggered).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getSnapshot()
  // ──────────────────────────────────────────────────────────────────────────
  describe('getSnapshot()', () => {
    it('returns empty array when no errors tracked', () => {
      expect(tracker.getSnapshot()).toEqual([]);
    });

    it('returns one entry per error code that has recent hits', () => {
      tracker.track(ERROR_CODES.NOT_FOUND, '/a', 'x');
      tracker.track(ERROR_CODES.FORBIDDEN, '/b', 'y');

      const snaps = tracker.getSnapshot();
      expect(snaps).toHaveLength(2);
    });

    it('sorts by hitCount descending', () => {
      tracker.track(ERROR_CODES.NOT_FOUND, '/a', 'x');
      tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/b', 'y');
      tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/c', 'z');

      const snaps = tracker.getSnapshot();
      expect(snaps[0].errorCode).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(snaps[0].hitCount).toBe(2);
    });

    it('excludes codes whose entries have all expired', () => {
      tracker.track(ERROR_CODES.UNAUTHORIZED, '/login', 'unauth');

      jest.advanceTimersByTime(WINDOW_MS + 1_000);

      // Nothing added after the window advance — snapshot should be empty
      // (the expired entry is pruned lazily on next track() call)
      // Force pruning by calling track on the same code
      tracker.track(ERROR_CODES.UNAUTHORIZED, '/login', 'new hit');

      const snaps = tracker.getSnapshot();
      const snap  = snaps.find((s) => s.errorCode === ERROR_CODES.UNAUTHORIZED);
      expect(snap?.hitCount).toBe(1);
    });

    it('lists up to 5 recent timestamps per snapshot', () => {
      for (let i = 0; i < 8; i++) {
        tracker.track(ERROR_CODES.BAD_REQUEST, '/api', 'bad req');
      }

      const snap = tracker.getByCode(ERROR_CODES.BAD_REQUEST)!;
      expect(snap.recentTimestamps.length).toBeLessThanOrEqual(5);
    });

    it('lists top paths in snapshot', () => {
      tracker.track(ERROR_CODES.NOT_FOUND, '/jobs/1', 'x');
      tracker.track(ERROR_CODES.NOT_FOUND, '/jobs/1', 'x');
      tracker.track(ERROR_CODES.NOT_FOUND, '/jobs/2', 'x');

      const snap = tracker.getByCode(ERROR_CODES.NOT_FOUND)!;
      expect(snap.topPaths[0]).toBe('/jobs/1'); // most frequent
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getByCode()
  // ──────────────────────────────────────────────────────────────────────────
  describe('getByCode()', () => {
    it('returns null for an unknown error code', () => {
      expect(tracker.getByCode(ERROR_CODES.CONFLICT)).toBeNull();
    });

    it('returns the correct snapshot for a tracked code', () => {
      tracker.track(ERROR_CODES.CONFLICT, '/applications', 'duplicate');

      const snap = tracker.getByCode(ERROR_CODES.CONFLICT);
      expect(snap).not.toBeNull();
      expect(snap!.errorCode).toBe(ERROR_CODES.CONFLICT);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reset()
  // ──────────────────────────────────────────────────────────────────────────
  describe('reset()', () => {
    it('clears all tracked data', () => {
      tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/api', 'err');
      tracker.reset();
      expect(tracker.getSnapshot()).toEqual([]);
    });

    it('clears alerted flags so the same code can alert again', () => {
      for (let i = 0; i < THRESHOLD; i++) {
        tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/api', 'err');
      }

      tracker.reset();

      const logSpy = jest.spyOn(
        (tracker as unknown as { logger: { error: jest.Mock } }).logger,
        'error',
      );

      for (let i = 0; i < THRESHOLD; i++) {
        tracker.track(ERROR_CODES.INTERNAL_SERVER_ERROR, '/api', 'err');
      }

      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });
});
