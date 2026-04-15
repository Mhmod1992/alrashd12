
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import WhatsappIcon from './icons/WhatsappIcon';
import XIcon from './icons/XIcon';

const parseWhatsAppMessage = (rawMessage: string) => {
  if (!rawMessage) return { cleanMessage: '', source: null, replyTo: null };

  let cleanMessage = rawMessage;
  let source = null;
  let replyTo = null;

  const sourceRegex = /📌\s*\[المصدر:\s*(.*?)\]/;
  const sourceMatch = rawMessage.match(sourceRegex);
  if (sourceMatch) {
    source = sourceMatch[1].trim();
    cleanMessage = cleanMessage.replace(sourceMatch[0], '');
  }

  const replyRegex = /💬\s*\[رداً\s*على:\s*(.*?)\]/;
  const replyMatch = rawMessage.match(replyRegex);
  if (replyMatch) {
    replyTo = replyMatch[1].trim();
    cleanMessage = cleanMessage.replace(replyMatch[0], '');
  }

  return {
    cleanMessage: cleanMessage.trim(),
    source: source?.replace(/"/g, ''),
    replyTo
  };
};

const WhatsAppTicker: React.FC = () => {
  const { whatsappMessages, markWhatsAppAsRead } = useAppContext();
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Only show UNREAD incoming messages that haven't been dismissed
  // Note: some integrations might send direction as null, treat null as incoming
  const unreadMessages = whatsappMessages.filter(
    m => (m.direction === 'incoming' || !m.direction) && !m.is_read && !dismissedIds.has(m.id)
  );

  // Cycle through messages every 6 seconds if there are multiple
  useEffect(() => {
    if (unreadMessages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % unreadMessages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [unreadMessages.length]);

  // Reset index if it goes out of bounds (e.g., after marking one as read)
  useEffect(() => {
    if (currentIndex >= unreadMessages.length) {
      setCurrentIndex(Math.max(0, unreadMessages.length - 1));
    }
  }, [unreadMessages.length, currentIndex]);

  return (
    <AnimatePresence>
      {unreadMessages.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-4 bg-black/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-emerald-500/30 p-6 max-w-sm w-full pointer-events-auto flex flex-col gap-4 relative overflow-hidden"
          >
            {/* Decorative top border */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full">
                  <WhatsappIcon className="w-6 h-6" />
                </div>
                <span className="font-bold text-lg">رسالة واتساب جديدة</span>
                <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
              </div>
              <button 
                onClick={() => setDismissedIds(prev => new Set([...prev, ...unreadMessages.map(m => m.id)]))}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                title="إغلاق"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 min-h-[100px] flex items-center justify-center relative mt-2">
              <AnimatePresence mode="wait">
                {unreadMessages[currentIndex] && (() => {
                  const msg = unreadMessages[currentIndex];
                  const { cleanMessage, source, replyTo } = parseWhatsAppMessage(msg.message);
                  
                  return (
                  <motion.div 
                    key={msg.id}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-slate-800 dark:text-white text-xl">
                        {msg.name || msg.phone}
                      </div>
                      {source && (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 ${
                          source.includes('مجموعة') 
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {source.includes('مجموعة') ? '👥' : '🔒'} {source}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-base leading-relaxed flex flex-col gap-3">
                      {replyTo && (
                        <div className="bg-slate-200/50 dark:bg-slate-800/80 border-r-4 border-emerald-500 p-3 rounded-l-lg text-sm text-slate-500 dark:text-slate-400 italic">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">رداً على:</span>
                          {replyTo}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{cleanMessage}</div>
                    </div>
                    <button 
                      onClick={() => markWhatsAppAsRead(msg.id)}
                      className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors shadow-md shadow-emerald-500/20"
                    >
                      تحديد كمقروء
                    </button>
                  </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            {unreadMessages.length > 1 && (
              <div className="text-center text-xs text-slate-400 font-mono mt-2 bg-slate-50 dark:bg-slate-900/50 py-1 rounded-full w-fit mx-auto px-4">
                رسالة {currentIndex + 1} من {unreadMessages.length}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppTicker;
