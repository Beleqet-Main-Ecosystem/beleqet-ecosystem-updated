import { io, Socket } from "socket.io-client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://api.beleqetjobs.com";

export const socket: Socket = io(`${API_URL}/chat`, {
  transports: ["websocket"],

  autoConnect: false,

  auth: {
    token: "",
  },
});

socket.on("connect", () => {
  console.log("CONNECTED:", socket.id);
});


socket.on("connect_error", (err) => {
  console.log("SOCKET ERROR:", err.message);
});