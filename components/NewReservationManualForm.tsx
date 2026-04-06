
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { InspectionType, CarMake, CarModel } from '../types';
import Button from './Button';
import Icon from './Icon';
import { motion, AnimatePresence } from 'motion/react';

interface NewReservationManualFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

const NewReservationManualForm: React.FC<NewReservationManualFormProps> = ({ onCancel, onSuccess }) => {
    const { 
        carMakes, 
        carModels, 
        inspectionTypes, 
        addReservation, 
        addNotification,
        fetchCarModelsByMake
    } = useAppContext();

    // LocalStorage keys
    const STORAGE_KEY_CLIENT = 'reservation_show_client_fields';
    const STORAGE_KEY_PLATE = 'reservation_show_plate_fields';

    // Conditional UI States (Loaded from LocalStorage)
    const [showClientFields, setShowClientFields] = useState(() => {
        return localStorage.getItem(STORAGE_KEY_CLIENT) === 'true';
    });
    const [showPlateFields, setShowPlateFields] = useState(() => {
        return localStorage.getItem(STORAGE_KEY_PLATE) === 'true';
    });

    // Form States
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [carMakeId, setCarMakeId] = useState('');
    const [carModelId, setCarModelId] = useState('');
    const [carYear, setCarYear] = useState(new Date().getFullYear().toString());
    const [plateText, setPlateText] = useState('');
    const [inspectionTypeId, setInspectionTypeId] = useState('');
    const [price, setPrice] = useState<string>('');
    const [notes, setNotes] = useState('');

    const [errors, setErrors] = useState<Record<string, boolean>>({});

    // Save preferences to LocalStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_CLIENT, showClientFields.toString());
    }, [showClientFields]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_PLATE, showPlateFields.toString());
    }, [showPlateFields]);

    // Fetch models when make changes
    useEffect(() => {
        if (carMakeId) {
            fetchCarModelsByMake(carMakeId);
        }
    }, [carMakeId, fetchCarModelsByMake]);

    const handleSave = async () => {
        const newErrors: Record<string, boolean> = {};

        // Validation: Inspection Type is Mandatory
        if (!inspectionTypeId) {
            newErrors.inspectionType = true;
            addNotification({
                title: 'تنبيه',
                message: 'يرجى تحديد نوع الفحص أولاً',
                type: 'error'
            });
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            const selectedMake = carMakes.find(m => m.id === carMakeId);
            const selectedModel = carModels.find(m => m.id === carModelId);
            const selectedType = inspectionTypes.find(t => t.id === inspectionTypeId);

            const carDetails = `${selectedMake?.name_ar || ''} ${selectedModel?.name_ar || ''} ${carYear}`.trim();

            await addReservation({
                source_text: 'إدخال يدوي',
                client_name: showClientFields ? clientName.trim() : 'غير معروف',
                client_phone: showClientFields ? clientPhone.trim() : '',
                car_details: carDetails,
                plate_text: showPlateFields ? plateText.trim() : '',
                service_type: selectedType?.name || 'فحص عام',
                notes: notes.trim(),
                price: Number(price) || 0,
                car_make_id: carMakeId,
                car_model_id: carModelId
            });

            addNotification({
                title: 'نجاح',
                message: 'تم حفظ الحجز بنجاح',
                type: 'success'
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            addNotification({
                title: 'خطأ',
                message: 'فشل حفظ الحجز. يرجى المحاولة مرة أخرى.',
                type: 'error'
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Conditional Toggles */}
            <div className="flex flex-wrap gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input 
                            type="checkbox" 
                            className="peer sr-only" 
                            checked={showClientFields} 
                            onChange={(e) => setShowClientFields(e.target.checked)} 
                        />
                        <div className="w-10 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">إضافة بيانات العميل</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input 
                            type="checkbox" 
                            className="peer sr-only" 
                            checked={showPlateFields} 
                            onChange={(e) => setShowPlateFields(e.target.checked)} 
                        />
                        <div className="w-10 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 transition-colors">إضافة بيانات اللوحة</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Car Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Icon name="car" className="w-4 h-4" />
                        بيانات السيارة الأساسية
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">الشركة المصنعة</label>
                            <select 
                                value={carMakeId} 
                                onChange={(e) => setCarMakeId(e.target.value)}
                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
                            >
                                <option value="">اختر الشركة...</option>
                                {carMakes.map(m => (
                                    <option key={m.id} value={m.id}>{m.name_ar}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">الموديل</label>
                            <select 
                                value={carModelId} 
                                onChange={(e) => setCarModelId(e.target.value)}
                                disabled={!carMakeId}
                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm disabled:opacity-50"
                            >
                                <option value="">اختر الموديل...</option>
                                {carModels.filter(m => m.make_id === carMakeId).map(m => (
                                    <option key={m.id} value={m.id}>{m.name_ar}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">سنة الصنع</label>
                            <input 
                                type="number" 
                                value={carYear} 
                                onChange={(e) => setCarYear(e.target.value)}
                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
                                placeholder="مثلاً: 2024"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">السعر المتوقع</label>
                            <input 
                                type="number" 
                                value={price} 
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                {/* Inspection Details */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Icon name="settings" className="w-4 h-4" />
                        تفاصيل الحجز
                    </h3>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            نوع الفحص <span className="text-red-500">*</span>
                        </label>
                        <select 
                            value={inspectionTypeId} 
                            onChange={(e) => {
                                setInspectionTypeId(e.target.value);
                                setErrors(prev => ({ ...prev, inspectionType: false }));
                            }}
                            className={`w-full p-3 border rounded-lg bg-white dark:bg-slate-800 text-sm transition-all ${
                                errors.inspectionType 
                                ? 'border-red-500 ring-2 ring-red-500/20' 
                                : 'dark:border-slate-700'
                            }`}
                        >
                            <option value="">اختر نوع الفحص...</option>
                            {inspectionTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {errors.inspectionType && (
                            <p className="text-red-500 text-[10px] mt-1 font-bold">يرجى تحديد نوع الفحص أولاً</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات إضافية</label>
                        <textarea 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
                            rows={3}
                            placeholder="أي تفاصيل أخرى..."
                        />
                    </div>
                </div>
            </div>

            {/* Conditional Sections with Animation */}
            <AnimatePresence>
                {showClientFields && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50 space-y-4">
                            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                <Icon name="employee" className="w-4 h-4" />
                                بيانات العميل
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم العميل</label>
                                    <input 
                                        type="text" 
                                        value={clientName} 
                                        onChange={(e) => setClientName(e.target.value)}
                                        className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
                                        placeholder="الاسم الثلاثي..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">رقم الجوال</label>
                                    <input 
                                        type="text" 
                                        value={clientPhone} 
                                        onChange={(e) => setClientPhone(e.target.value)}
                                        className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm dir-ltr text-right"
                                        placeholder="05xxxxxxxx"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {showPlateFields && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-6 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/50 space-y-4">
                            <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <Icon name="scan-plate" className="w-4 h-4" />
                                بيانات اللوحة
                            </h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">نص اللوحة</label>
                                <input 
                                    type="text" 
                                    value={plateText} 
                                    onChange={(e) => setPlateText(e.target.value)}
                                    className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
                                    placeholder="مثلاً: أ ب ج 1 2 3 4"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
                <Button onClick={handleSave} className="px-8 shadow-lg shadow-blue-500/20">حفظ الحجز</Button>
            </div>
        </div>
    );
};

export default NewReservationManualForm;
