import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  senderId: string;
  messageText: string;
  timestamp: number;
  isGroup: boolean;
  chatName: string;
}

export const useWhatsAppSocket = (url: string, apiKey: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 1. Initialize Socket with Bearer token
    socketRef.current = io(url, {
      auth: {
        token: `Bearer ${apiKey}`
      },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => setIsConnected(true));
    socketRef.current.on('disconnect', () => setIsConnected(false));
    socketRef.current.on('connect_error', (err) => console.error('Socket connection error:', err));

    // 2. Listen for new messages
    socketRef.current.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // 3. Fetch historical messages with Bearer token
    fetch(`${url}/api/messages`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then(data => setMessages(data))
      .catch(err => console.error('Failed to fetch historical messages', err));

    return () => {
      socketRef.current?.disconnect();
    };
  }, [url, apiKey]);

  return { messages, isConnected };
};
