
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Reservation, PaymentType } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import NewRequestForm from '../components/NewRequestForm';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CalendarIcon from '../components/icons/CalendarIcon';

const Reservations: React.FC = () => {
    const { 
        reservations, 
        fetchReservations, 
        addReservation, 
        deleteReservation, 
        parseReservationText, 
        addNotification,
        showConfirmModal,
        settings,
        can,
        fetchCarModelsByMake,
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

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    
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
            await fetchReservations();
            setIsLoading(false);
        };
        load();
    }, [fetchReservations]);

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

    const handleSuccessConvert = () => {
        setIsConvertModalOpen(false);
        setSelectedReservation(null);
    };

    const handleWhatsAppContact = (res: Reservation) => {
        if (!res.client_phone) {
            addNotification({ title: 'خطأ', message: 'لا يوجد رقم هاتف لهذا الحجز.', type: 'error' });
            return;
        }
        
        // Clean phone number (remove non-digits)
        const cleanPhone = res.client_phone.replace(/\D/g, '');
        // Add country code if missing (assuming Saudi Arabia +966)
        const phoneWithCode = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`;
        
        const message = encodeURIComponent(`مرحباً ${res.client_name}، نؤكد استلام حجزك لسيارة ${res.car_details} لفحص ${res.service_type}. يرجى تأكيد الموعد.`);
        window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase mb-1">حجوزات جديدة</div>
                    <div className="text-2xl font-black text-blue-800 dark:text-blue-200">{reservations.filter(r => r.status === 'new').length}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
                    <div className="text-green-600 dark:text-green-400 text-xs font-bold uppercase mb-1">تم تحويلها لطلبات</div>
                    <div className="text-2xl font-black text-green-800 dark:text-green-200">{reservations.filter(r => r.status === 'converted').length}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                    <div className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase mb-1">إجمالي الحجوزات</div>
                    <div className="text-2xl font-black text-purple-800 dark:text-purple-200">{reservations.length}</div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 shadow-sm">
                    <button
                        onClick={() => setTimeFilter('today')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
                            timeFilter === 'today' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        <CalendarIcon className="w-4 h-4" />
                        حجوزات اليوم
                    </button>
                    <button
                        onClick={() => setTimeFilter('all')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                            timeFilter === 'all' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        عرض الكل
                    </button>
                </div>

                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="البحث باسم السيارة، رقم الهاتف، أو اسم العميل..."
                        className="block w-full pr-10 pl-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                            <Icon name="close" className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-700">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500">
                        <RefreshCwIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
                        جاري التحميل...
                    </div>
                ) : reservations.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Icon name="calendar-clock" className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">لا توجد حجوزات واردة.</p>
                        <p className="text-sm">قم بنسخ رسالة الحجز من واتساب واضغط "إضافة حجز جديد".</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-xs font-bold border-b dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">رقم الحجز</th>
                                    <th className="px-6 py-4">العميل</th>
                                    <th className="px-6 py-4">السيارة</th>
                                    <th className="px-6 py-4">سعر الفحص</th>
                                    <th className="px-6 py-4">نوع الخدمة</th>
                                    <th className="px-6 py-4">ملاحظات</th>
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4">تاريخ الورود</th>
                                    <th className="px-6 py-4 text-left">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {filteredReservations.map(res => (
                                    <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400 font-mono">
                                            {res.reservation_number ? `RSV-${String(res.reservation_number).padStart(4, '0')}` : '---'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{res.client_name || 'غير معروف'}</div>
                                            <div className="text-xs text-slate-500 dir-ltr text-right font-mono">{res.client_phone || '---'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-700 dark:text-slate-300 font-medium">
                                                {(() => {
                                                    const make = carMakes.find(m => m.id === res.car_make_id);
                                                    const model = carModels.find(m => m.id === res.car_model_id);
                                                    if (make && model) {
                                                        return `${make.name_en} ${model.name_en}`;
                                                    }
                                                    return res.car_details;
                                                })()}
                                            </div>
                                            {res.plate_text && (
                                                <div className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded inline-block mt-1 border dark:border-slate-600">
                                                    {res.plate_text}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                                            {res.price ? `${res.price} ريال` : '---'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{res.service_type}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={res.notes}>
                                            {res.notes || '---'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                res.status === 'new' ? 'bg-blue-100 text-blue-700' : 
                                                res.status === 'converted' ? 'bg-green-100 text-green-700' : 
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {res.status === 'new' ? 'جديد' : res.status === 'converted' ? 'تم التحويل' : 'ملغي'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-numeric">
                                            {new Date(res.created_at).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4 text-left">
                                            <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                {res.status === 'new' && (
                                                    <Button size="sm" onClick={() => handleConvert(res)}>
                                                        إنشاء طلب
                                                    </Button>
                                                )}
                                                <button 
                                                    onClick={() => handleWhatsAppContact(res)} 
                                                    className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    title="تواصل واتساب"
                                                >
                                                    <Icon name="whatsapp" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(res.id)} 
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
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
        </div>
    );
};

export default Reservations;
