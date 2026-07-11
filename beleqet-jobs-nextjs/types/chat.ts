export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    role?: string;
  };

  content: string;
  createdAt: string;
}

export interface SendMessageDto {
  roomId: string;
  content: string;
}