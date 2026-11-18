"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { ChatMessage } from "@/types/chat";

export function useChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);

      socket.emit("join_room", {
        roomId,
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("room_history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on("new_message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room_history");
      socket.off("new_message");

      socket.disconnect();
    };
  }, [roomId]);

  const sendMessage = (content: string) => {
    socket.emit("send_message", {
      roomId,
      content,
    });
  };

  return {
    connected,
    messages,
    sendMessage,
  };
}