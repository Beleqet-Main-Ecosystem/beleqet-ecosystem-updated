"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ChatRoom from "@/components/ChatRoom";
import { ShieldCheck, Lock } from "lucide-react";
import Link from "next/link";

import { getToken } from "@/lib/auth";

/**
 * Secure Tunnel Chat Page
 *
 * URL: /chat?room=<roomId>&recipient=<recipientUserId>&lang=<en|am>
 *
 * All messages are End-to-End Encrypted on this page.
 * The server only ever sees ciphertext — it can never read your messages.
 *
 * GDPR compliance:
 *   - No PII is transmitted in cleartext via the WebSocket
 *   - Private keys are stored only in the browser's IndexedDB
 *   - Server stores only Base64 AES-GCM ciphertext + hex IV
 *
 * i18n: Supports English (en) and Amharic (am) via query param `lang`
 */
function ChatPageInner() {
  const searchParams = useSearchParams();
  const { user, ready } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  const roomId = searchParams.get("room") ?? "";
  const recipientUserId = searchParams.get("recipient") ?? "";
  const lang = (searchParams.get("lang") ?? "en") as "en" | "am";

  useEffect(() => {
    if (ready) {
      setToken(getToken());
    }
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Lock className="h-8 w-8 animate-pulse text-emerald-500" />
          <p className="text-sm">Loading Secure Tunnel…</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow max-w-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500 mb-4" />
          <h1 className="text-lg font-bold text-gray-800 mb-2">Authentication Required</h1>
          <p className="text-sm text-gray-500 mb-6">
            You must be signed in to use the Secure Tunnel.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!roomId || !recipientUserId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white border border-red-200 rounded-2xl p-10 text-center shadow max-w-sm">
          <p className="text-red-500 font-semibold">Invalid chat parameters.</p>
          <p className="text-sm text-gray-400 mt-2">
            Please navigate to a chat via a contract or job listing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-100 flex flex-col">
      {/* SEO meta */}
      <title>Secure Tunnel – Encrypted Chat | Beleqet</title>



      {/* Main chat area */}
      <div className="flex-1 flex items-stretch container mx-auto max-w-3xl px-4 pt-[25px] pb-6">
        <div className="flex-1">
          <ChatRoom
            roomId={roomId}
            currentUserId={user.id}
            recipientUserId={recipientUserId}
            accessToken={token}
            lang={lang}
          />
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="text-center pb-4">
        <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          End-to-end encrypted • Private keys never leave your device • GDPR compliant
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Lock className="h-8 w-8 animate-pulse text-emerald-500" /></div>}>
      <ChatPageInner />
    </Suspense>
  );
}
