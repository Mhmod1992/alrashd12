
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Reservation, PaymentType, WhatsAppMessage } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import NewRequestForm from '../components/NewRequestForm';
import WhatsAppReservationModal from '../components/WhatsAppReservationModal';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import { timeAgo } from '../lib/utils';

const Reservations: React.FC = () => {
    const { 
        reservations, 
        fetchReservations, 
        fetchRequests,
        addReservation, 
        deleteReservation, 
        parseReservationText, 
        addNotification,
        showConfirmModal,
        settings,
        can,
        fetchCarModelsByMake,
        sendWhatsAppMessage,
        whatsappMessages,
        markWhatsAppAsRead,
        // Dependencies for NewRequestForm
        clients,
        carMakes,
        carModels,
        inspectionTypes,
        brokers
    } = useAppContext();

    // Ensure car models are loaded for reservations to show English names
    useEffect(() => {
        const makeIds = new Set(reservations.map(r => r.car_make_id).filter(Boolean) as string[]);
        makeIds.forEach(id => fetchCarModelsByMake(id));
    }, [reservations, fetchCarModelsByMake]);

    const [activeTab, setActiveTab] = useState<'reservations' | 'whatsapp'>('reservations');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [selectedWhatsAppMessage, setSelectedWhatsAppMessage] = useState<WhatsAppMessage | null>(null);
    const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
    
    // Add Modal State
    const [rawText, setRawText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<Partial<Reservation> | null>(null);
    
    const [isManualMode, setIsManualMode] = useState(() => {
        return localStorage.getItem('reservationInputMode') === 'manual';
    });

    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState<'today' | 'all'>('all');

    const filteredReservations = useMemo(() => {
        let result = [...reservations];

        // Time Filter
        if (timeFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            result = result.filter(r => {
                const resDate = new Date(r.created_at);
                resDate.setHours(0, 0, 0, 0);
                return resDate.getTime() === today.getTime();
            });
        }

        // Search Filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(r => {
                const carDetails = (r.car_details || '').toLowerCase();
                const clientPhone = (r.client_phone || '').toLowerCase();
                const clientName = (r.client_name || '').toLowerCase();
                const resNum = r.reservation_number ? `#RSV-${r.reservation_number}`.toLowerCase() : '';
                
                return carDetails.includes(term) || 
                       clientPhone.includes(term) || 
                       clientName.includes(term) ||
                       resNum.includes(term);
            });
        }

        return result;
    }, [reservations, searchTerm, timeFilter]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchReservations(),
                fetchRequests()
            ]);
            setIsLoading(false);
        };
        load();
    }, [fetchReservations, fetchRequests]);

    const handlePaste = async () => {
        if (!rawText.trim()) return;

        setIsParsing(true);
        try {
            const data = await parseReservationText(rawText);
            setParsedData({
                ...data,
                source_text: rawText
            });
            addNotification({ title: 'تم التحليل', message: 'تم استخراج البيانات بنجاح من النموذج.', type: 'success' });
        } catch (error) {
            console.error("Parsing failed", error);
            addNotification({ title: 'خطأ', message: 'فشل تحليل النص. تأكد من استخدام النموذج الصحيح.', type: 'error' });
        } finally {
            setIsParsing(false);
        }
    };

    const toggleInputMode = () => {
        const newMode = !isManualMode;
        setIsManualMode(newMode);
        localStorage.setItem('reservationInputMode', newMode ? 'manual' : 'auto');
    };

    const handleSaveReservation = async () => {
        if (!parsedData) return;
        try {
            await addReservation({
                source_text: parsedData.source_text || rawText,
                client_name: parsedData.client_name || 'غير معروف',
                client_phone: parsedData.client_phone || '',
                car_details: parsedData.car_details || '',
                plate_text: parsedData.plate_text || '',
                service_type: parsedData.service_type || 'فحص عام',
                notes: parsedData.notes || '',
                price: parsedData.price || 0
            });
            setIsAddModalOpen(false);
            setRawText('');
            setParsedData(null);
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل حفظ الحجز.', type: 'error' });
        }
    };

    const handleDelete = (id: string) => {
        showConfirmModal({
            title: 'حذف الحجز',
            message: 'هل أنت متأكد من حذف هذا الحجز؟',
            onConfirm: async () => {
                await deleteReservation(id);
                addNotification({ title: 'تم الحذف', message: 'تم حذف الحجز بنجاح.', type: 'success' });
            }
        });
    };

    const handleConvert = (res: Reservation) => {
        setSelectedReservation(res);
        setIsConvertModalOpen(true);
    };

    const handleEdit = (res: Reservation) => {
        setEditingReservation(res);
        setIsEditModalOpen(true);
    };

    const handleSuccessConvert = () => {
        setIsConvertModalOpen(false);
        setSelectedReservation(null);
    };

    const handleWhatsAppContact = async (res: Reservation) => {
        if (!res.client_phone) {
            addNotification({ title: 'خطأ', message: 'لا يوجد رقم هاتف لهذا الحجز.', type: 'error' });
            return;
        }
        
        // Clean phone number (remove non-digits)
        const cleanPhone = res.client_phone.replace(/\D/g, '');
        // Add country code if missing (assuming Saudi Arabia +966)
        const phoneWithCode = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`;
        
        const reservationId = res.reservation_number ? `RSV-${String(res.reservation_number).padStart(4, '0')}` : '---';
        let message = `أهلاً بك *${res.client_name}*، يسعدنا إبلاغك بتأكيد حجزك لفحص السيارة بنجاح.`;
        
        const make = carMakes.find(m => m.id === res.car_make_id);
        const model = carModels.find(m => m.id === res.car_model_id);
        const carNameEn = make && model ? `${make.name_en} ${model.name_en}` : res.car_details;

        if (carNameEn && carNameEn.trim()) {
            message += `\nالسيارة: *${carNameEn}*`;
        }
        
        message += `\nرقم الحجز الخاص بك: *${reservationId}*`;
        
        if (res.price) {
            message += `\nالسعر: *${res.price}* ريال`;
        }
        
        message += `\n\nفريقنا بانتظارك في موعدك المحدد. نتشرف بزيارتك`;
        await sendWhatsAppMessage(phoneWithCode, message);
    };

    const handleWhatsAppMessageClick = (msg: WhatsAppMessage) => {
        setSelectedWhatsAppMessage(msg);
        setIsWhatsAppModalOpen(true);
        if (!msg.is_read) {
            markWhatsAppAsRead(msg.id);
        }
    };

    if (!can('manage_reservations')) {
        return <div className="p-8 text-center text-red-500 font-bold">ليس لديك صلاحية الوصول لهذه الصفحة.</div>;
    }

    return (
        <div className="container mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        <Icon name="calendar-clock" className="w-8 h-8 text-purple-600" />
                        الحجوزات الواردة (WhatsApp)
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        إدارة طلبات الحجز المنسوخة من واتساب وتحويلها لطلبات فحص.
                    </p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Icon name="add" />}>
                    إضافة حجز جديد
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Icon name="calendar-clock" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">حجوزات اليوم</div>
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                {reservations.filter(r => {
                                    const today = new Date();
                                    const resDate = new Date(r.created_at);
                                    return resDate.toDateString() === today.toDateString();
                                }).length}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                            <Icon name="sparkles" className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">بانتظار التحويل</div>
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{reservations.filter(r => r.status === 'new').length}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                            <Icon name="check-circle" className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">تم تحويلها</div>
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{reservations.filter(r => r.status === 'converted').length}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <Icon name="archive" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">إجمالي الحجوزات</div>
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{reservations.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('reservations')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'reservations' 
                            ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <CalendarIcon className="w-4 h-4" />
                        قائمة الحجوزات
                    </button>
                    <button
                        onClick={() => setActiveTab('whatsapp')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'whatsapp' 
                            ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <WhatsappIcon className="w-4 h-4" />
                        صندوق الوارد (WhatsApp)
                        {whatsappMessages.filter(m => !m.is_read && m.direction === 'incoming').length > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                                {whatsappMessages.filter(m => !m.is_read && m.direction === 'incoming').length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block mx-2"></div>

                {activeTab === 'reservations' ? (
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                        <button
                            onClick={() => setTimeFilter('today')}
                            className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                timeFilter === 'today' 
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' 
                                : 'text-slate-500'
                            }`}
                        >
                            اليوم
                        </button>
                        <button
                            onClick={() => setTimeFilter('all')}
                            className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                timeFilter === 'all' 
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' 
                                : 'text-slate-500'
                            }`}
                        >
                            الكل
                        </button>
                    </div>
                ) : null}

                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder={activeTab === 'reservations' ? "البحث باسم السيارة، رقم الهاتف، أو اسم العميل..." : "بحث في رسائل الواتساب..."}
                        className="block w-full pr-12 pl-4 py-3 border-none rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 sm:text-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {activeTab === 'reservations' ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-700">
                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500">
                            <RefreshCwIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
                            جاري التحميل...
                        </div>
                    ) : filteredReservations.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Icon name="calendar-clock" className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">لا توجد حجوزات واردة.</p>
                            <p className="text-sm">قم بنسخ رسالة الحجز من واتساب واضغط "إضافة حجز جديد".</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px] text-right">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[11px] font-bold border-b dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-slate-400 font-bold">رقم الحجز</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">العميل</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">السيارة</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">سنة الصنع</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">السعر</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">نوع الخدمة</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">الحالة</th>
                                        <th className="px-4 py-3 text-slate-400 font-bold">التاريخ</th>
                                        <th className="px-4 py-3 text-left text-slate-400 font-bold">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {filteredReservations.map(res => (
                                        <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 font-mono">
                                                {res.reservation_number ? `RSV-${String(res.reservation_number).padStart(4, '0')}` : '---'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{res.client_name || 'غير معروف'}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                                        <Icon name="phone" className="w-3 h-3" />
                                                        {res.client_phone || '---'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-700 dark:text-slate-300 font-bold">
                                                    {(() => {
                                                        const make = carMakes.find(m => m.id === res.car_make_id);
                                                        const model = carModels.find(m => m.id === res.car_model_id);
                                                        if (make && model) {
                                                            return `${make.name_en} ${model.name_en}`;
                                                        }
                                                        return res.car_details.replace(/\b(19|20)\d{2}\b/, '').replace(/ - $/, '').trim();
                                                    })()}
                                                </div>
                                                {res.plate_text && (
                                                    <div className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 inline-block mt-1">
                                                        {res.plate_text}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold border dark:border-slate-600">
                                                    {res.car_details.match(/\b(19|20)\d{2}\b/)?.[0] || '---'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-black text-blue-600 dark:text-blue-400">
                                                    {res.price ? `${res.price} ر.س` : '---'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[11px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg font-medium border border-purple-100 dark:border-purple-800">
                                                    {res.service_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    res.status === 'new' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                                                    res.status === 'converted' ? 'bg-green-100 text-green-700 border border-green-200' : 
                                                    'bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}>
                                                    {res.status === 'new' ? 'بانتظار التحويل' : res.status === 'converted' ? 'تم التحويل' : 'ملغي'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] text-slate-400 font-bold">
                                                {new Date(res.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                                            </td>
                                            <td className="px-4 py-3 text-left">
                                                <div className="flex justify-end gap-1">
                                                    {res.status === 'new' && (
                                                        <button 
                                                            onClick={() => handleConvert(res)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                                            title="تحويل لطلب"
                                                        >
                                                            <Icon name="refresh-cw" className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleEdit(res)} 
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                                        title="تعديل"
                                                    >
                                                        <Icon name="edit" className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleWhatsAppContact(res)} 
                                                        className="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all"
                                                        title="تواصل واتساب"
                                                    >
                                                        <Icon name="whatsapp" className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(res.id)} 
                                                        className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                        title="حذف"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                    {whatsappMessages
                        .filter(m => {
                            const isIncoming = m.direction === 'incoming' || !m.direction;
                            if (!isIncoming) return false;
                            
                            if (!searchTerm.trim()) return true;
                            
                            const term = searchTerm.toLowerCase().trim();
                            const message = (m.message || '').toLowerCase();
                            const phone = (m.phone || '').toLowerCase();
                            const name = (m.name || '').toLowerCase();
                            
                            return message.includes(term) || phone.includes(term) || name.includes(term);
                        })
                        .length === 0 ? (
                            <div className="col-span-full py-20 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                <WhatsappIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>لا توجد رسائل واتساب واردة تطابق البحث.</p>
                            </div>
                        ) : (
                            whatsappMessages
                                .filter(m => {
                                    const isIncoming = m.direction === 'incoming' || !m.direction;
                                    if (!isIncoming) return false;
                                    
                                    if (!searchTerm.trim()) return true;
                                    
                                    const term = searchTerm.toLowerCase().trim();
                                    const message = (m.message || '').toLowerCase();
                                    const phone = (m.phone || '').toLowerCase();
                                    const name = (m.name || '').toLowerCase();
                                    
                                    return message.includes(term) || phone.includes(term) || name.includes(term);
                                })
                                .map(msg => (
                                    <div 
                                        key={msg.id}
                                        onClick={() => handleWhatsAppMessageClick(msg)}
                                        className={`group relative bg-white dark:bg-slate-800 p-5 rounded-2xl border transition-all hover:shadow-lg cursor-pointer hover:-translate-y-1 ${!msg.is_read ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-700/50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${!msg.is_read ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                                    {(msg.name || msg.phone).charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white text-sm">{msg.name || msg.phone}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{msg.phone}</div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">{timeAgo(msg.created_at)}</span>
                                        </div>
                                        
                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 mb-4">
                                            {msg.message}
                                        </p>

                                        <div className="flex items-center justify-between pt-3 border-t dark:border-slate-700/50">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                <Icon name="add" className="w-3 h-3" />
                                                إنشاء حجز من الرسالة
                                            </div>
                                            {!msg.is_read && (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            )}
                                        </div>
                                    </div>
                                ))
                        )}
                </div>
            )}

            {/* Add Reservation Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="إضافة حجز جديد" size="5xl">
                
                {/* Toggle Mode */}
                <div className="flex items-center justify-end mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border dark:border-slate-700">
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input type="checkbox" id="input-mode-toggle" className="sr-only" checked={isManualMode} onChange={toggleInputMode} />
                            <div className={`block w-12 h-7 rounded-full transition-colors ${isManualMode ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isManualMode ? 'transform translate-x-5' : ''}`}></div>
                        </div>
                        <span className="mr-3 text-sm font-bold text-slate-700 dark:text-slate-300">إدخال البيانات يدوياً</span>
                    </label>
                </div>

                {isManualMode ? (
                    <div className="animate-fade-in">
                        <NewRequestForm 
                            clients={clients}
                            carMakes={carMakes}
                            carModels={carModels}
                            inspectionTypes={inspectionTypes}
                            brokers={brokers}
                            isReservationMode={true}
                            onCancel={() => setIsAddModalOpen(false)}
                            onSuccess={() => {
                                setIsAddModalOpen(false);
                                fetchReservations();
                            }}
                        />
                    </div>
                ) : (
                    !parsedData ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-sm text-purple-800 dark:text-purple-200 border border-purple-100 dark:border-purple-800">
                                <p className="font-bold flex items-center gap-2 mb-1">
                                    <SparklesIcon className="w-4 h-4" />
                                    التحليل بالنموذج الثابت
                                </p>
                                <p>قم بنسخ رسالة الحجز (التي تحتوي على النموذج المعتمد) من الواتساب وألصقها هنا. سيقوم النظام باستخراج البيانات تلقائياً.</p>
                                <div className="mt-2 text-xs bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700 font-mono" dir="ltr">
                                    *اسم العميل:* ...<br/>
                                    *رقم الهاتف:* ...<br/>
                                    *الشركة:* ...<br/>
                                    *الموديل:* ...<br/>
                                    ...
                                </div>
                            </div>
                            <textarea 
                                className="w-full h-40 p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 text-sm"
                                placeholder="ألصق نص الرسالة هنا..."
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                            ></textarea>
                            <div className="flex justify-end pt-2">
                                <Button onClick={handlePaste} disabled={isParsing || !rawText.trim()} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30">
                                    {isParsing ? <RefreshCwIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
                                    <span className="ms-2">{isParsing ? 'جاري التحليل...' : 'تحليل النص واستخراج البيانات'}</span>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-3 mb-6">
                                <CheckCircleIcon className="w-6 h-6 text-green-600" />
                                <div>
                                    <h4 className="font-bold text-green-800 dark:text-green-300">تم استخراج البيانات بنجاح</h4>
                                    <p className="text-xs text-green-700 dark:text-green-400">يرجى مراجعة البيانات وتكملة النواقص قبل الحفظ.</p>
                                </div>
                            </div>

                            <NewRequestForm 
                                clients={clients}
                                carMakes={carMakes}
                                carModels={carModels}
                                inspectionTypes={inspectionTypes}
                                brokers={brokers}
                                isReservationMode={true}
                                initialReservationData={parsedData}
                                onCancel={() => setParsedData(null)}
                                onSuccess={() => {
                                    setIsAddModalOpen(false);
                                    setParsedData(null);
                                    setRawText('');
                                    fetchReservations();
                                }}
                            />
                        </div>
                    )
                )}
            </Modal>

            {/* Convert to Request Modal - Reuses NewRequestForm */}
            {isConvertModalOpen && selectedReservation && (
                <Modal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} title="تحويل الحجز إلى طلب فحص" size="5xl">
                    <NewRequestForm
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        onCancel={() => setIsConvertModalOpen(false)}
                        onSuccess={handleSuccessConvert}
                        initialReservationData={selectedReservation}
                    />
                </Modal>
            )}

            {/* Edit Reservation Modal - Reuses NewRequestForm */}
            {isEditModalOpen && editingReservation && (
                <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="تعديل بيانات الحجز" size="5xl">
                    <NewRequestForm
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        isReservationMode={true}
                        initialReservationData={editingReservation}
                        onCancel={() => {
                            setIsEditModalOpen(false);
                            setEditingReservation(null);
                        }}
                        onSuccess={() => {
                            setIsEditModalOpen(false);
                            setEditingReservation(null);
                            fetchReservations();
                        }}
                    />
                </Modal>
            )}

            {/* WhatsApp Dual-View Modal */}
            {isWhatsAppModalOpen && selectedWhatsAppMessage && (
                <WhatsAppReservationModal
                    isOpen={isWhatsAppModalOpen}
                    onClose={() => {
                        setIsWhatsAppModalOpen(false);
                        setSelectedWhatsAppMessage(null);
                    }}
                    message={selectedWhatsAppMessage}
                    clients={clients}
                    carMakes={carMakes}
                    carModels={carModels}
                    inspectionTypes={inspectionTypes}
                    brokers={brokers}
                    onSuccess={() => {
                        fetchReservations();
                        addNotification({ title: 'نجاح', message: 'تم تحويل الرسالة إلى حجز بنجاح.', type: 'success' });
                    }}
                />
            )}
        </div>
    );
};

export default Reservations;
