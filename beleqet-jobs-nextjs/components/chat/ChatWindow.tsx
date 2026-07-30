"use client";

import { useChat } from "@/hooks/useChat";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow() {
  const { messages, connected, sendMessage } = useChat("room-1");

  return (
    <div className="flex h-[700px] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-white shadow-lg">
      <ChatHeader connected={connected} />

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      <MessageInput sendMessage={sendMessage} />
    </div>
  );
}