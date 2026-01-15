
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Reservation } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import NewRequestForm from '../components/NewRequestForm';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import TrashIcon from '../components/icons/TrashIcon';

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
        // Dependencies for NewRequestForm
        clients,
        carMakes,
        carModels,
        inspectionTypes,
        brokers
    } = useAppContext();

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    
    // Add Modal State
    const [rawText, setRawText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<Partial<Reservation> | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);

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
                notes: parsedData.notes || ''
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
                                    <th className="px-6 py-4">العميل</th>
                                    <th className="px-6 py-4">السيارة</th>
                                    <th className="px-6 py-4">نوع الخدمة</th>
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4">تاريخ الورود</th>
                                    <th className="px-6 py-4 text-left">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {reservations.map(res => (
                                    <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{res.client_name}</div>
                                            <div className="text-xs text-slate-500 dir-ltr text-right font-mono">{res.client_phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-700 dark:text-slate-300 font-medium">{res.car_details}</div>
                                            {res.plate_text && (
                                                <div className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded inline-block mt-1 border dark:border-slate-600">
                                                    {res.plate_text}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{res.service_type}</td>
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
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="إضافة حجز من واتساب" size="lg">
                {!parsedData ? (
                    <div className="space-y-4">
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
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-3">
                            <CheckCircleIcon className="w-6 h-6 text-green-600" />
                            <div>
                                <h4 className="font-bold text-green-800 dark:text-green-300">تم استخراج البيانات بنجاح</h4>
                                <p className="text-xs text-green-700 dark:text-green-400">يرجى مراجعة البيانات أدناه قبل الحفظ.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">اسم العميل</label>
                                <input type="text" value={parsedData.client_name || ''} onChange={e => setParsedData({...parsedData, client_name: e.target.value})} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-sm dark:border-slate-600" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">رقم الجوال</label>
                                <input type="text" value={parsedData.client_phone || ''} onChange={e => setParsedData({...parsedData, client_phone: e.target.value})} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-sm dark:border-slate-600 dir-ltr text-right" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">تفاصيل السيارة</label>
                                <input type="text" value={parsedData.car_details || ''} onChange={e => setParsedData({...parsedData, car_details: e.target.value})} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-sm dark:border-slate-600" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">نص اللوحة</label>
                                <input type="text" value={parsedData.plate_text || ''} onChange={e => setParsedData({...parsedData, plate_text: e.target.value})} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-sm dark:border-slate-600" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">نوع الخدمة المطلوبة</label>
                                <input type="text" value={parsedData.service_type || ''} onChange={e => setParsedData({...parsedData, service_type: e.target.value})} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-sm dark:border-slate-600" />
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات إضافية</label>
                                <textarea value={parsedData.notes || ''} onChange={e => setParsedData({...parsedData, notes: e.target.value})} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-sm dark:border-slate-600" rows={2} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setParsedData(null)}>إلغاء وإعادة المحاولة</Button>
                            <Button onClick={handleSaveReservation}>حفظ الحجز</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Convert to Request Modal - Reuses NewRequestForm */}
            {isConvertModalOpen && selectedReservation && (
                <Modal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} title="تحويل الحجز إلى طلب فحص" size="4xl">
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
