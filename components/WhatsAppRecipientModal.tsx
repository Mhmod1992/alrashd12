import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import WhatsappIcon from './icons/WhatsappIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import UserXIcon from './icons/UserXIcon';
import SendIcon from './icons/SendIcon';
import { Employee, Technician } from '../types';

interface WhatsAppRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: { name: string; phone: string } | null;
    employees: Employee[];
    technicians: Technician[];
    onSelect: (phone: string, name: string) => void;
}

const WhatsAppRecipientModal: React.FC<WhatsAppRecipientModalProps> = ({
    isOpen,
    onClose,
    client,
    employees,
    technicians,
    onSelect
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const availableEmployees = employees.filter(emp => emp.phone && emp.is_active);
    const availableTechnicians = technicians.filter(tech => tech.phone && tech.is_active);

    const filteredEmployees = availableEmployees.filter(emp => 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        emp.phone!.includes(searchQuery)
    );
    
    const filteredTechnicians = availableTechnicians.filter(tech => 
        tech.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        tech.phone!.includes(searchQuery)
    );

    const handleSend = (phone: string, name: string) => {
        onSelect(phone, name);
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    className="bg-white dark:bg-slate-800 rounded-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="flex flex-col">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <WhatsappIcon className="w-5 h-5 text-[#25D366]" />
                                مشاركة التقرير
                            </h3>
                            <p className="text-xs text-slate-500 font-bold mt-1">اختر جهة الاتصال لإرسال التقرير</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500"
                        >
                            <Icon name="close" className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="relative">
                            <Icon name="search" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="بحث عن اسم أو رقم موبايل..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-10 pl-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#25D366] transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {/* Client Section */}
                        {(!searchQuery || (client?.name.includes(searchQuery) || client?.phone.includes(searchQuery))) && client?.phone && (
                            <div className="mb-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-3">العميل</h4>
                                <button
                                    onClick={() => handleSend(client.phone, client.name || 'عميل')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-[#25D366]/10 dark:from-blue-900/20 dark:to-[#25D366]/20 hover:from-blue-100 hover:to-[#25D366]/20 transition-all group focus:ring-2 focus:ring-[#25D366] outline-none border border-blue-100 dark:border-blue-900/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                            <UserCircleIcon className="w-6 h-6" />
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{client.name || 'العميل'}</span>
                                                <span className="text-[9px] font-bold bg-[#25D366] text-white px-2 py-0.5 rounded-full">أساسي</span>
                                            </div>
                                            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5 text-right" dir="ltr">{client.phone}</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-md group-hover:bg-[#1ebd5c] transition-colors">
                                        <SendIcon className="w-5 h-5 rtl:-scale-x-100" />
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Team Section (Combined) */}
                        {(filteredEmployees.length > 0 || filteredTechnicians.length > 0) && (
                            <div className="mb-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-3">الفنيين</h4>
                                <div className="space-y-1">
                                    {filteredEmployees.map(emp => (
                                        <button
                                            key={`emp-${emp.id}`}
                                            onClick={() => handleSend(emp.phone!, emp.name)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-right focus:ring-2 focus:ring-[#25D366] outline-none border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                                                    <UserCircleIcon className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col max-w-[200px] sm:max-w-[250px]">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{emp.name}</span>
                                                    <span className="text-[10px] text-slate-400 truncate mb-0.5">{emp.title || 'فني'}</span>
                                                    <span className="text-xs text-slate-500 font-mono text-left" dir="ltr">{emp.phone}</span>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <SendIcon className="w-4 h-4 rtl:-scale-x-100" />
                                            </div>
                                        </button>
                                    ))}
                                    {filteredTechnicians.map(tech => (
                                        <button
                                            key={`tech-${tech.id}`}
                                            onClick={() => handleSend(tech.phone!, tech.name)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-right focus:ring-2 focus:ring-[#25D366] outline-none border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                                    <BriefcaseIcon className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col max-w-[200px] sm:max-w-[250px]">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{tech.name}</span>
                                                    <span className="text-[10px] text-slate-400 truncate mb-0.5">{tech.title || 'فني'}</span>
                                                    <span className="text-xs text-slate-500 font-mono text-left" dir="ltr">{tech.phone}</span>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <SendIcon className="w-4 h-4 rtl:-scale-x-100" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!client?.phone && filteredEmployees.length === 0 && filteredTechnicians.length === 0 && (
                            <div className="p-8 text-center text-slate-400">
                                <UserXIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-bold text-sm">لا يوجد جهات اتصال بأرقام هواتف مسجلة</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default WhatsAppRecipientModal;
