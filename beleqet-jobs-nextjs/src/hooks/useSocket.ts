'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (namespace: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // ከLocalStorage ቶክኑን ይወስዳል (ለሴኪውሪቲ)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // ከባክኤንዱ የሬዲስ/ዌብሶኬት አዳፕተር ጋር ያገናኛል
    const socketInstance = io(`${socketUrl}${namespace}`, {
      auth: { token: token ? `Bearer ${token}` : '' },
      withCredentials: true,
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      console.log(`Successfully connected to namespace: ${namespace}`);
    });

    socketInstance.on('disconnect', () => {
      console.log(`Disconnected from namespace: ${namespace}`);
    });

    setSocket(socketInstance);

    // ፔጁ ሲዘጋ ግንኙነቱን ያቋርጣል
    return () => {
      socketInstance.disconnect();
    };
  }, [namespace]);

  return socket;
};