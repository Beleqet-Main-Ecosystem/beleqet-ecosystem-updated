import { ChatMessage } from "@/types/chat";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const senderName = message.sender
    ? `${message.sender.firstName} ${message.sender.lastName}`
    : message.senderId;

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="mb-4 flex justify-start">
      <div className="max-w-xs rounded-2xl bg-white px-4 py-3 shadow">
        <p className="mb-1 text-xs font-semibold">
          {senderName}
        </p>

        <p>{message.content}</p>

        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-500">
          <span>🔒</span>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}