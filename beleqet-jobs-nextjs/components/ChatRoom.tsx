"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, ShieldCheck, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  getOrCreateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  deleteKeyPair,
  computeFingerprint,
} from "@/lib/crypto";

// ─── i18n strings (Amharic + English) ─────────────────────────────────────────
const LABELS = {
  en: {
    tunnelActive: "Secure Tunnel Active",
    tunnelDesc: "Messages are end-to-end encrypted. Only you and the other person can read them.",
    tunnelWarning: "If you clear browser data, you will lose the ability to decrypt old messages.",
    placeholder: "Type an encrypted message…",
    send: "Send",
    connecting: "Establishing Secure Tunnel…",
    keyError: "Could not establish secure tunnel. Please refresh.",
    decryptError: "[Could not decrypt this message]",
    keyReset: "Erase Keys (GDPR)",
    keyResetSuccess: "Keys deleted successfully. Reloading...",
  },
  am: {
    tunnelActive: "ደህንነቱ የተጠበቀ ዋሻ ንቁ ነው",
    tunnelDesc: "መልእክቶቹ ከጫፍ እስከ ጫፍ ተጠብቀዋል። እርስዎ እና ሌላው ሰው ብቻ ሊያነቡ ይችላሉ።",
    tunnelWarning: "የቅድሚያ ውሂብዎን ካጸዱ፣ አሮጌ መልእክቶችን ማዳነቅ አይችሉም።",
    placeholder: "የተጠበቀ መልእክት ይጻፉ…",
    send: "ላክ",
    connecting: "ደህንነቱ የተጠበቀ ዋሻ በማዘጋጀት ላይ…",
    keyError: "ደህንነቱ የተጠበቀ ዋሻ ሊቋቋም አልቻለም። እባክዎ ያድሱ።",
    decryptError: "[ይህን መልእክት ማዳነቅ አልተቻለም]",
    keyReset: "ቁልፎችን አጥፋ (GDPR)",
    keyResetSuccess: "ቁልፎች በተሳካ ሁኔታ ተሰርዘዋል። በመጫን ላይ...",
  },
} as const;

type Lang = keyof typeof LABELS;
type RawMessage = {
  id: string;
  senderId: string;
  content: string;
  metadata?: {
    encrypted?: boolean;
    iv?: string;
    type?: string;
    amount?: number;
    currency?: string;
    url?: string;
    name?: string;
    link?: string;
  };
  createdAt: string;
  sender?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
};
type DecryptedMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  sender?: RawMessage["sender"];
  metadata?: RawMessage["metadata"];
};

interface ChatRoomProps {
  roomId: string;
  currentUserId: string;
  recipientUserId: string;
  accessToken: string;
  lang?: Lang;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const WS_URL = API_URL.replace("/api/v1", "");

export default function ChatRoom({
  roomId,
  currentUserId,
  recipientUserId,
  accessToken,
  lang = "en",
}: ChatRoomProps) {
  const t = LABELS[lang];
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [sending, setSending] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /** Decrypt a single raw message using the shared AES-GCM key */
  const decryptOne = useCallback(
    async (msg: RawMessage): Promise<DecryptedMessage> => {
      if (msg.metadata?.encrypted && msg.metadata.iv && sharedKeyRef.current) {
        try {
          const text = await decryptMessage(sharedKeyRef.current, msg.content, msg.metadata.iv);
          return { id: msg.id, senderId: msg.senderId, text, createdAt: msg.createdAt, sender: msg.sender, metadata: msg.metadata };
        } catch {
          return { id: msg.id, senderId: msg.senderId, text: t.decryptError, createdAt: msg.createdAt, sender: msg.sender, metadata: msg.metadata };
        }
      }
      // Non-encrypted system messages (video calls, file links, etc.)
      return { id: msg.id, senderId: msg.senderId, text: msg.content, createdAt: msg.createdAt, sender: msg.sender, metadata: msg.metadata };
    },
    [t.decryptError]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 1. Get / generate local ECDH key pair
        const keyPair = await getOrCreateKeyPair();
        const myPublicKeyBase64 = await exportPublicKey(keyPair.publicKey);

        // 2. Upload public key to backend
        await fetch(`${API_URL}/chat/keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ publicKey: myPublicKeyBase64 }),
        });

        // 3. Fetch recipient's public key
        const keyRes = await fetch(`${API_URL}/chat/keys/${recipientUserId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!keyRes.ok) throw new Error("Could not fetch recipient public key");
        const { publicKey: recipientKeyBase64 } = await keyRes.json();

        // 4. Derive the shared AES-GCM key (ECDH)
        const recipientPublicKey = await importPublicKey(recipientKeyBase64);
        const sharedKey = await deriveSharedKey(keyPair.privateKey, recipientPublicKey);
        sharedKeyRef.current = sharedKey;

        // Compute E2EE Safety Number/Fingerprint
        const fp = await computeFingerprint(myPublicKeyBase64, recipientKeyBase64);
        if (mounted) setFingerprint(fp);

        // 5. Connect to WebSocket
        const socket = io(`${WS_URL}/chat`, {
          auth: { token: `Bearer ${accessToken}` },
          transports: ["websocket"],
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join_room", { roomId });
        });

        // 6. Decrypt and display history
        socket.on("room_history", async (history: RawMessage[]) => {
          if (!mounted) return;
          const decrypted = await Promise.all(history.map(decryptOne));
          setMessages(decrypted);
          if (mounted) setStatus("ready");
        });

        // 7. Handle incoming encrypted messages in real-time
        socket.on("new_message", async (msg: RawMessage) => {
          if (!mounted) return;
          const decrypted = await decryptOne(msg);
          setMessages((prev) => [...prev, decrypted]);
        });

        socket.on("error", () => {
          if (mounted) setStatus("error");
        });

        socket.on("connect_error", () => {
          if (mounted) setStatus("error");
        });
      } catch {
        if (mounted) setStatus("error");
      }
    }

    init();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
    };
  }, [roomId, recipientUserId, accessToken, decryptOne]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Encrypt and send a message */
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !sharedKeyRef.current || !socketRef.current || sending) return;

    setSending(true);
    try {
      const { ciphertext, iv } = await encryptMessage(sharedKeyRef.current, text);
      socketRef.current.emit("send_message", { roomId, content: ciphertext, iv });
      setInput("");
    } finally {
      setSending(false);
    }
  }

  /** Erase E2EE keys locally and on the server (GDPR Erasure) */
  async function handleResetKeys() {
    const confirmMsg = lang === "en" 
      ? "Are you sure you want to erase all your chat encryption keys? You will lose access to decrypting all old messages." 
      : "የምስጠራ ቁልፎችዎን በቋሚነት ማጥፋት ይፈልጋሉ? ሁሉንም የድሮ መልእክቶች ማንበብ አይችሉም።";
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Delete on server
      await fetch(`${API_URL}/chat/keys`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // 2. Delete locally in IndexedDB
      await deleteKeyPair();
      alert(t.keyResetSuccess);
      window.location.reload();
    } catch {
      alert("Failed to reset keys. Please try again.");
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      {/* ── Header with E2EE status bar ─────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 px-5 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span className="text-white font-semibold text-sm">{t.tunnelActive}</span>
            {status === "connecting" && (
              <Loader2 className="h-4 w-4 text-white/70 animate-spin ml-1" />
            )}
            {status === "ready" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white font-bold ml-1">
                <Lock className="h-2.5 w-2.5" /> E2EE
              </span>
            )}
            {status === "error" && (
              <AlertTriangle className="h-4 w-4 text-yellow-300 ml-1" />
            )}
          </div>
          <p className="text-white/70 text-[10px] mt-0.5 leading-tight">{t.tunnelDesc}</p>
        </div>
        <button
          onClick={handleResetKeys}
          className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors text-[10px] font-medium px-2.5 py-1 rounded-md border border-white/20 shrink-0"
        >
          {t.keyReset}
        </button>
      </div>

      {/* ── GDPR / UX warning banner ─────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-1.5 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <p className="text-[10px] text-amber-700">{t.tunnelWarning}</p>
      </div>

      {/* ── Cryptographic Fingerprint banner ─────────────────── */}
      {status === "ready" && fingerprint && (
        <div className="bg-emerald-50/50 border-b border-emerald-100 px-5 py-1 flex items-center justify-between">
          <span className="text-[9px] text-emerald-800 font-medium flex items-center gap-1">
            <Lock className="h-2.5 w-2.5 text-emerald-600" />
            E2EE Verification Hash:
          </span>
          <span className="text-[9px] text-emerald-900 font-mono font-bold tracking-wider">{fingerprint}</span>
        </div>
      )}

      {/* ── Status overlay ────────────────────────────────────── */}
      {status === "connecting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium">{t.connecting}</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <p className="text-sm font-medium text-red-500">{t.keyError}</p>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────── */}
      {status === "ready" && (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
              >
                {!isMine && msg.sender && (
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold shrink-0">
                    {msg.sender.firstName[0]}
                  </div>
                )}
                <div
                  className={`relative max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    isMine
                      ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-br-md"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                  }`}
                >
                  {msg.text}
                  {/* Small lock icon to confirm E2EE */}
                  <Lock className={`absolute bottom-1 right-2 h-2 w-2 ${isMine ? "text-white/40" : "text-gray-300"}`} />
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────── */}
      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-2"
      >
        <div className="flex-1 flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 ring-1 ring-transparent focus-within:ring-emerald-400 transition-all">
          <Lock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={status === "ready" ? t.placeholder : t.connecting}
            disabled={status !== "ready"}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            aria-label={t.placeholder}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || status !== "ready" || sending}
          aria-label={t.send}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
