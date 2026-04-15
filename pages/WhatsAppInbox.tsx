
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import { timeAgo, parseWhatsAppMessage } from '../lib/utils';
import SearchIcon from '../components/icons/SearchIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Modal from '../components/Modal';

const WhatsAppInbox: React.FC = () => {
  const { whatsappMessages, markWhatsAppAsRead, fetchRequests, realtimeStatus, sendWhatsAppMessage, authUser, deleteWhatsAppMessages, can } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [debugInfo, setDebugInfo] = useState<{status: string, count?: number, error?: string} | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await (await import('../lib/supabaseClient')).supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: false })
        .limit(1);
      
      if (error) {
        setDebugInfo({ status: 'error', error: error.message });
      } else {
        setDebugInfo({ status: 'success', count: data?.length || 0 });
        // If success, try to refresh global state
        fetchRequests();
      }
    } catch (err: any) {
      setDebugInfo({ status: 'error', error: err.message });
    } finally {
      setIsChecking(false);
    }
  };

  const handleDeleteMessages = async (olderThanDays?: number) => {
    setIsDeleting(true);
    try {
      await deleteWhatsAppMessages(olderThanDays);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Failed to delete messages", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMessages = whatsappMessages.filter(m => 
    m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery) ||
    (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: typeof whatsappMessages } = {
      'اليوم': [],
      'أمس': [],
      'هذا الأسبوع': [],
      'أقدم': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    filteredMessages.forEach(msg => {
      const msgDate = new Date(msg.created_at);
      msgDate.setHours(0, 0, 0, 0);

      if (msgDate.getTime() === today.getTime()) {
        groups['اليوم'].push(msg);
      } else if (msgDate.getTime() === yesterday.getTime()) {
        groups['أمس'].push(msg);
      } else if (msgDate.getTime() >= lastWeek.getTime()) {
        groups['هذا الأسبوع'].push(msg);
      } else {
        groups['أقدم'].push(msg);
      }
    });

    return groups;
  }, [filteredMessages]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
            <WhatsappIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">صندوق وارد الواتساب</h1>
              <div 
                className={`w-2 h-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} 
                title={realtimeStatus === 'connected' ? 'متصل ومفعل للتحديث الفوري' : 'جاري الاتصال...'}
              ></div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">إدارة الرسائل الواردة من العملاء</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="بحث في الرسائل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          {(authUser?.role === 'general_manager' || can('delete_whatsapp_messages')) && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl transition-colors"
              title="مسح الرسائل"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {filteredMessages.length > 0 ? (
          Object.entries(groupedMessages).map(([groupName, messages]) => {
            if (messages.length === 0) return null;
            
            return (
              <div key={groupName} className="space-y-3">
                <div className="sticky top-0 z-10 flex justify-center">
                  <span className="bg-slate-200/80 dark:bg-slate-700/80 backdrop-blur-sm text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    {groupName}
                  </span>
                </div>
                {messages.map((msg) => {
                  const { cleanMessage, source, replyTo } = parseWhatsAppMessage(msg.message);
                  
                  return (
                  <div 
                    key={msg.id} 
                    className={`group relative bg-white dark:bg-slate-800 p-4 rounded-2xl border transition-all hover:shadow-md ${!msg.is_read && msg.direction === 'incoming' ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-700/50'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 dark:text-white">{msg.name || msg.phone}</span>
                        
                        {source && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            source.includes('مجموعة') 
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {source.includes('مجموعة') ? '👥' : '🔒'} {source}
                          </span>
                        )}

                        {msg.direction === 'outgoing' && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">صادرة</span>
                        )}
                        {!msg.is_read && (msg.direction === 'incoming' || !msg.direction) && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{timeAgo(msg.created_at)}</span>
                    </div>
                    
                    {replyTo && (
                      <div className="mb-3 bg-slate-100/50 dark:bg-slate-800/50 border-r-4 border-emerald-500 p-3 rounded-l-lg text-sm text-slate-500 dark:text-slate-400 italic">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">رداً على:</span>
                        {replyTo}
                      </div>
                    )}

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                      {cleanMessage}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">{msg.phone}</span>
                      
                      {!msg.is_read && (msg.direction === 'incoming' || !msg.direction) && (
                        <button 
                          onClick={() => markWhatsAppAsRead(msg.id)}
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          تحديد كمقروء
                        </button>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
              <WhatsappIcon className="w-12 h-12 opacity-20" />
            </div>
            <p className="font-medium">لا توجد رسائل حالياً</p>
            <p className="text-xs mt-2 opacity-50">إجمالي الرسائل في النظام: {whatsappMessages.length}</p>
            
            <div className="mt-6 flex flex-col items-center gap-3">
              <button 
                onClick={checkConnection}
                disabled={isChecking}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isChecking ? 'جاري الفحص...' : 'فحص الاتصال المباشر بقاعدة البيانات'}
              </button>

              {debugInfo && (
                <div className={`p-3 rounded-lg text-xs font-mono max-w-xs text-center ${debugInfo.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {debugInfo.status === 'success' ? (
                    `نجاح: تم العثور على ${debugInfo.count} رسالة في الجدول`
                  ) : (
                    `خطأ: ${debugInfo.error}`
                  )}
                </div>
              )}
            </div>

            {whatsappMessages.length > 0 && searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-4 text-emerald-600 text-sm font-bold"
              >
                مسح البحث
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="مسح رسائل الواتساب">
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm">
            <p className="font-bold mb-1">تحذير: هذا الإجراء لا يمكن التراجع عنه.</p>
            <p>سيتم حذف الرسائل نهائياً من قاعدة البيانات.</p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleDeleteMessages(30)}
              disabled={isDeleting}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'جاري المسح...' : 'مسح الرسائل الأقدم من 30 يوم'}
            </button>
            
            <button
              onClick={() => handleDeleteMessages()}
              disabled={isDeleting}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'جاري المسح...' : 'مسح جميع الرسائل بالكامل'}
            </button>
            
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
              className="w-full py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors mt-2"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WhatsAppInbox;
