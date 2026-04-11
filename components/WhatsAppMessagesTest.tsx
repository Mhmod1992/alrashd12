import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface WhatsAppMessage {
  id: number;
  whatsapp_id: string;
  phone: string;
  name: string;
  message: string;
  direction: string;
  created_at: string;
}

export const WhatsAppMessagesTest = () => {
  console.log('WhatsAppMessagesTest component mounted');
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);

  useEffect(() => {
    // 1. جلب الرسائل الموجودة مسبقاً
    const fetchMessages = async () => {
      console.log('Fetching messages...');
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching messages from Supabase:', error);
      } else if (data) {
        console.log('Messages fetched successfully:', data);
        setMessages(data);
      } else {
        console.log('No messages found.');
      }
    };

    fetchMessages();

    // 2. الاستماع للرسائل الجديدة (Realtime)
    const channel = supabase
      .channel('whatsapp_messages_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          console.log('New message received:', payload);
          setMessages((prev) => [payload.new as WhatsAppMessage, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">تجربة استقبال رسائل الواتساب</h1>
      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-blue-600">{msg.name || msg.phone}</span>
              <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleTimeString()}</span>
            </div>
            <p className="text-gray-700">{msg.message}</p>
            <span className="text-[10px] uppercase font-bold text-gray-400 mt-2 block">{msg.direction}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
