import { useState } from "react";

export default function MessageInput({ sendMessage }: { sendMessage: (text: string) => void }) {

  const [text, setText] = useState("");

  return (
    <div className="flex gap-3 border-t bg-white p-4">

      <input
        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type a secure message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 active:scale-95"
        onClick={() => {
          if (!text.trim()) return;
          sendMessage(text);
          setText("");
        }}
      >
        Send
      </button>

    </div>
  );
}