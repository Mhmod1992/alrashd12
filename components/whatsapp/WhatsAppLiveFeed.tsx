import React from 'react';
import { useWhatsAppSocket } from '../../hooks/useWhatsAppSocket';
import Icon from '../Icon';

export const WhatsAppLiveFeed: React.FC = () => {
  const url = import.meta.env.VITE_WSAPP_PRO_URL || '';
  const apiKey = import.meta.env.VITE_WSAPP_PRO_API_KEY || '';
  const { messages, isConnected } = useWhatsAppSocket(url, apiKey);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Icon name="whatsapp" className="w-6 h-6 text-green-500" />
          محادثات واتساب المباشرة
        </h3>
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isConnected ? 'متصل' : 'غير متصل'}
        </span>
      </div>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">لا توجد رسائل حالياً.</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold">{msg.chatName}</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200">{msg.messageText}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
