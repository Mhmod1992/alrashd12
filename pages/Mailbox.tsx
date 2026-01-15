
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { InternalMessage } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';

interface MailboxProps {
    isModal?: boolean;
}

const Mailbox: React.FC<MailboxProps> = ({ isModal = false }) => {
    const { 
        authUser, 
        fetchInboxMessages, 
        fetchSentMessages, 
        sendInternalMessage, 
        markMessageAsRead,
        addNotification,
        employees,
        can,
        settings
    } = useAppContext();

    const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<InternalMessage | null>(null);
    const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    // Compose State
    const [receiverId, setReceiverId] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
    const [isSending, setIsSending] = useState(false);

    const design = settings.design || 'aero';
    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    const loadMessages = async () => {
        setIsLoading(true);
        try {
            const data = activeTab === 'inbox' ? await fetchInboxMessages() : await fetchSentMessages();
            setMessages(data);
        } catch (error) {
            console.error("Error loading messages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
    }, [activeTab]);

    const handleOpenMessage = async (message: InternalMessage) => {
        setSelectedMessage(message);
        setIsViewModalOpen(true);
        if (activeTab === 'inbox' && !message.is_read) {
            await markMessageAsRead(message.id);
            // Update local state
            setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_read: true } : m));
        }
    };

    const handleSendMessage = async () => {
        if (!receiverId || !subject.trim() || !content.trim()) {
            addNotification({ title: 'خطأ', message: 'الرجاء تعبئة جميع الحقول.', type: 'error' });
            return;
        }

        const receiver = employees.find(e => e.id === receiverId);
        if (!receiver) return;

        setIsSending(true);
        try {
            await sendInternalMessage({
                receiver_id: receiverId,
                receiver_name: receiver.name,
                subject: subject.trim(),
                content: content.trim(),
                priority: priority
            });
            addNotification({ title: 'نجاح', message: 'تم إرسال الرسالة.', type: 'success' });
            setIsComposeModalOpen(false);
            setReceiverId('');
            setSubject('');
            setContent('');
            setPriority('normal');
            // If on sent tab, refresh
            if (activeTab === 'sent') loadMessages();
        } catch (error) {
            console.error("Send message error:", error);
            addNotification({ title: 'خطأ', message: 'فشل إرسال الرسالة.', type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300';
            case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300';
            default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300';
        }
    };
    
    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'عاجل';
            case 'high': return 'هام';
            default: return 'عادي';
        }
    };

    const activeTabClasses = design === 'classic' 
        ? 'border-teal-500 text-teal-600 dark:text-teal-400' 
        : design === 'glass' 
            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
            : 'border-blue-500 text-blue-600 dark:text-blue-400';

    return (
        <div className={`container mx-auto flex flex-col ${isModal ? 'h-full' : 'h-[calc(100vh-100px)]'}`}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <Icon name="mail" className="w-8 h-8 text-slate-500" />
                    البريد الداخلي
                </h2>
                {can('send_internal_messages') && (
                    <Button onClick={() => setIsComposeModalOpen(true)} leftIcon={<Icon name="add" />}>
                        رسالة جديدة
                    </Button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg flex-grow flex flex-col overflow-hidden">
                <div className="border-b dark:border-slate-700 px-4">
                    <nav className="-mb-px flex space-x-6 rtl:space-x-reverse">
                        <button
                            onClick={() => setActiveTab('inbox')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'inbox' ? activeTabClasses : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            البريد الوارد
                        </button>
                        {can('send_internal_messages') && (
                            <button
                                onClick={() => setActiveTab('sent')}
                                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'sent' ? activeTabClasses : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                البريد المرسل
                            </button>
                        )}
                    </nav>
                </div>

                <div className="flex-grow overflow-auto p-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full text-slate-500">
                            <RefreshCwIcon className="w-8 h-8 animate-spin" />
                            <span className="ms-2">جاري التحميل...</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600">
                            <Icon name="mail" className="w-16 h-16 mb-4 opacity-20" />
                            <p>لا توجد رسائل.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-right">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">{activeTab === 'inbox' ? 'المرسل' : 'المستلم'}</th>
                                    <th className="px-6 py-3">الموضوع</th>
                                    <th className="px-6 py-3">الأهمية</th>
                                    <th className="px-6 py-3">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map((msg) => (
                                    <tr 
                                        key={msg.id} 
                                        onClick={() => handleOpenMessage(msg)}
                                        className={`border-b dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!msg.is_read && activeTab === 'inbox' ? 'bg-blue-50/50 dark:bg-blue-900/10 font-bold' : ''}`}
                                    >
                                        <td className="px-6 py-4 text-slate-900 dark:text-slate-100">
                                            {activeTab === 'inbox' ? msg.sender_name : msg.receiver_name}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                            {msg.subject}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(msg.priority)}`}>
                                                {getPriorityLabel(msg.priority)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(msg.created_at).toLocaleDateString('ar-SA')} {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Compose Modal */}
            <Modal isOpen={isComposeModalOpen} onClose={() => setIsComposeModalOpen(false)} title="إنشاء رسالة جديدة" size="lg">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">إلى الموظف</label>
                        <select 
                            value={receiverId} 
                            onChange={e => setReceiverId(e.target.value)} 
                            className={formInputClasses}
                        >
                            <option value="">اختر مستلم...</option>
                            {employees.filter(e => e.id !== authUser?.id).map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الأهمية</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="priority" value="normal" checked={priority === 'normal'} onChange={() => setPriority('normal')} />
                                <span className="text-sm">عادي</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="priority" value="high" checked={priority === 'high'} onChange={() => setPriority('high')} />
                                <span className="text-sm text-orange-600 font-semibold">هام</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="priority" value="urgent" checked={priority === 'urgent'} onChange={() => setPriority('urgent')} />
                                <span className="text-sm text-red-600 font-bold">عاجل</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الموضوع</label>
                        <input 
                            type="text" 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)} 
                            className={formInputClasses} 
                            placeholder="عنوان الرسالة"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">نص الرسالة</label>
                        <textarea 
                            rows={6}
                            value={content} 
                            onChange={e => setContent(e.target.value)} 
                            className={formInputClasses} 
                            placeholder="اكتب رسالتك هنا..."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsComposeModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSendMessage} disabled={isSending} leftIcon={isSending ? <RefreshCwIcon className="w-4 h-4 animate-spin"/> : <Icon name="send" className="w-4 h-4 transform rotate-180"/>}>
                        {isSending ? 'جاري الإرسال...' : 'إرسال'}
                    </Button>
                </div>
            </Modal>

            {/* View Modal */}
            <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={selectedMessage?.subject || 'عرض الرسالة'} size="lg">
                {selectedMessage && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start border-b pb-4 dark:border-slate-700">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {activeTab === 'inbox' ? 'من:' : 'إلى:'} <span className="font-bold text-slate-800 dark:text-slate-200">{activeTab === 'inbox' ? selectedMessage.sender_name : selectedMessage.receiver_name}</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {new Date(selectedMessage.created_at).toLocaleDateString('ar-SA')}
                                </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(selectedMessage.priority)}`}>
                                {getPriorityLabel(selectedMessage.priority)}
                            </span>
                        </div>
                        <div className="min-h-[150px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {selectedMessage.content}
                        </div>
                        <div className="flex justify-end pt-4 border-t dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>إغلاق</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Mailbox;
