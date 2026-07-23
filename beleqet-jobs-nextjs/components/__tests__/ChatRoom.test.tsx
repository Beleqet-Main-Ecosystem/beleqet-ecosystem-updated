import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ChatRoom from '../ChatRoom';
import { getOrCreateKeyPair, exportPublicKey } from '../../lib/crypto';
import '@testing-library/jest-dom';

// ── jsdom shim: scrollIntoView is not implemented in jsdom ────────────────────
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

// ── Crypto mocks ──────────────────────────────────────────────────────────────
jest.mock('../../lib/crypto', () => ({
  getOrCreateKeyPair: jest.fn(),
  exportPublicKey: jest.fn(),
  importPublicKey: jest.fn().mockResolvedValue({}),
  deriveSharedKey: jest.fn().mockResolvedValue({}),
  decryptMessage: jest.fn(),
  encryptMessage: jest.fn(),
  computeFingerprint: jest.fn().mockResolvedValue('1234-5678-abcd'),
  deleteKeyPair: jest.fn(),
}));

// ── socket.io-client mock ─────────────────────────────────────────────────────
// `mockSocket` is a module-level var so each beforeEach can replace it.
// The factory arrow fn closes over the variable by reference.
let mockSocketHandlers: Record<string, Function> = {};
let mockSocket: any;

jest.mock('socket.io-client', () => ({
  io: jest.fn((..._args: any[]) => mockSocket),
  __esModule: true,
}));

// ── Fetch helpers ─────────────────────────────────────────────────────────────
function stubFetch({
  uploadOk = true,
  recipientStatus = 200,
  recipientKey = 'recipient-key-base64',
}: {
  uploadOk?: boolean;
  recipientStatus?: number;
  recipientKey?: string;
} = {}) {
  // Use spyOn so jest can intercept the global used inside the component
  const spy = jest.spyOn(global, 'fetch' as any);
  spy
    .mockResolvedValueOnce({ ok: uploadOk, status: uploadOk ? 200 : 500 } as any)
    .mockResolvedValueOnce({
      ok: recipientStatus === 200,
      status: recipientStatus,
      json: async () => ({ publicKey: recipientKey }),
    } as any);
  return spy;
}

const defaultProps = {
  roomId: 'room-1',
  currentUserId: 'user-1',
  recipientUserId: 'user-2',
  accessToken: 'valid-token',
};

// ── Suite ─────────────────────────────────────────────────────────────────────
describe('ChatRoom component — Secure Tunnel handshake & UI states', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSocketHandlers = {};
    mockSocket = {
      on: jest.fn((event: string, cb: Function) => {
        mockSocketHandlers[event] = cb;
      }),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    (getOrCreateKeyPair as jest.Mock).mockResolvedValue({ publicKey: {}, privateKey: {} });
    (exportPublicKey as jest.Mock).mockResolvedValue('my-pub-key-base64');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ── 1. Successful handshake enables input ─────────────────────────────────
  it('enables input after successful handshake (empty room → "No messages yet")', async () => {
    stubFetch();
    render(<ChatRoom {...defaultProps} />);

    // Initially connecting — input disabled
    expect(screen.getByPlaceholderText('Establishing Secure Tunnel…')).toBeDisabled();

    // Socket connects
    await act(async () => { mockSocketHandlers['connect']?.(); });

    // Server sends empty history → status becomes "ready"
    await act(async () => { await mockSocketHandlers['room_history']?.([]); });

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Type an encrypted message…')).not.toBeDisabled()
    );

    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.queryByText('Retry Connection')).not.toBeInTheDocument();
  });

  // ── 2. 10-second timeout → specific error + Retry ─────────────────────────
  it('shows timeout error + Retry button when room_history never arrives', async () => {
    stubFetch();
    jest.useFakeTimers();

    render(<ChatRoom {...defaultProps} />);

    // Socket connects, but server never emits room_history
    act(() => { mockSocketHandlers['connect']?.(); });

    // Fire the 10-second timeout
    act(() => { jest.advanceTimersByTime(11000); });

    // Switch back to real timers so waitFor works
    jest.useRealTimers();

    expect(
      await screen.findByText(
        'Connection timeout: Server took too long to return conversation history.',
        {},
        { timeout: 3000 }
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Retry Connection' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Secure Tunnel offline — click Retry Connection')
    ).toBeDisabled();
  });

  // ── 3. Retry re-enters connecting state ──────────────────────────────────
  it('clicking Retry Connection clears the error and re-enters connecting state', async () => {
    stubFetch();
    jest.useFakeTimers();
    render(<ChatRoom {...defaultProps} />);
    act(() => { mockSocketHandlers['connect']?.(); });
    act(() => { jest.advanceTimersByTime(11000); });
    jest.useRealTimers();

    const retryBtn = await screen.findByRole('button', { name: 'Retry Connection' }, { timeout: 3000 });

    // Second attempt
    stubFetch();
    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Establishing Secure Tunnel…')).toBeDisabled()
    );
    expect(screen.queryByText('Retry Connection')).not.toBeInTheDocument();
  });

  // ── 4. connect_error → specific message + Retry ──────────────────────────
  it('shows specific WebSocket connect_error message with Retry button', async () => {
    stubFetch();
    render(<ChatRoom {...defaultProps} />);

    await act(async () => {
      mockSocketHandlers['connect_error']?.(new Error('ECONNREFUSED'));
    });

    expect(
      await screen.findByText(
        'WebSocket connection failed: Unable to connect to gateway (ECONNREFUSED).'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Retry Connection' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Secure Tunnel offline — click Retry Connection')
    ).toBeDisabled();
  });

  // ── 5. Recipient 404 → specific error + Retry ────────────────────────────
  it('shows "Recipient public key missing" when recipient has no key (404)', async () => {
    stubFetch({ recipientStatus: 404 });
    render(<ChatRoom {...defaultProps} />);

    expect(
      await screen.findByText(
        'Recipient public key missing: The user has not logged in to set up secure chat yet.'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Retry Connection' })).toBeInTheDocument();
  });

  // ── 6. Gateway error event (Redis unavailable) → specific message + Retry ─
  it('surfaces gateway socket error event (Redis unavailable) with Retry button', async () => {
    stubFetch();
    render(<ChatRoom {...defaultProps} />);

    await act(async () => { mockSocketHandlers['connect']?.(); });

    await act(async () => {
      mockSocketHandlers['error']?.({ message: 'Redis unavailable: adapter not ready' });
    });

    expect(
      await screen.findByText('Redis unavailable: adapter not ready')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Retry Connection' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Secure Tunnel offline — click Retry Connection')
    ).toBeDisabled();
  });

  // ── 7. History decrypted client-side, ciphertext never in DOM ────────────
  it('decrypts room history client-side and never exposes ciphertext in DOM', async () => {
    stubFetch();
    const { decryptMessage } = require('../../lib/crypto');
    (decryptMessage as jest.Mock).mockResolvedValue('Hello, this is decrypted!');

    render(<ChatRoom {...defaultProps} />);

    await act(async () => { mockSocketHandlers['connect']?.(); });

    await act(async () => {
      await mockSocketHandlers['room_history']?.([
        {
          id: 'msg-1',
          senderId: 'user-2',
          content: 'AES-GCM-ciphertext-base64',
          metadata: { encrypted: true, iv: 'aabbccddeeff0011' },
          createdAt: new Date().toISOString(),
          sender: { id: 'user-2', firstName: 'Bob', lastName: 'Smith' },
        },
      ]);
    });

    expect(await screen.findByText('Hello, this is decrypted!')).toBeInTheDocument();
    // Ciphertext must NOT appear anywhere in the DOM
    expect(screen.queryByText('AES-GCM-ciphertext-base64')).not.toBeInTheDocument();
  });

  // ── 8. Key upload failure → specific error ────────────────────────────────
  it('shows specific error when public key upload to server fails', async () => {
    stubFetch({ uploadOk: false });
    render(<ChatRoom {...defaultProps} />);

    expect(
      await screen.findByText(
        'Key registration failed: Could not register your encryption key on the server.',
        {},
        { timeout: 5000 }
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Retry Connection' })).toBeInTheDocument();
  });
});
