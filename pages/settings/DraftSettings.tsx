import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { DraftSettings as DraftSettingsType } from '../../types';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';


const DraftPreview: React.FC<{ settings: DraftSettingsType }> = ({ settings }) => {
    // A simplified, static version of PrintablePage for preview purposes
    return (
        <div className="relative bg-white w-[210mm] min-h-[297mm] p-[15mm] text-black border border-slate-300 shadow-md text-right" dir="rtl">
            {/* Mock Header */}
            <div className="relative w-full flex justify-center items-center pb-4 border-b-2 border-black">
                <div className="absolute top-0 right-0 text-sm">
                    <div className="border border-black rounded px-2 py-1 font-semibold">نوع الفحص: فحص كامل</div>
                </div>
                <div className="text-center">
                    <h1 className="text-3xl font-semibold text-slate-700">#1001</h1>
                </div>
                <div className="absolute top-0 left-0 text-sm">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 text-right">
                        <strong>التاريخ:</strong><span>{new Date().toLocaleDateString('en-GB')}</span>
                        <strong>الوقت:</strong><span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>
            <div className="w-full border-b-2 border-black py-2 flex justify-between items-center">
                <p className="text-lg font-bold">Toyota Camry 2023</p>
                <p className="text-sm font-mono">أ ب ج 1234</p>
            </div>

            {/* Absolute Positioning Image (Free Mode) */}
            {settings.customImageUrl && settings.imageStyle !== 'float' && (
                <div
                    className="absolute border-2 border-dashed border-blue-400/50 bg-blue-50/20 hover:border-blue-600 transition-colors cursor-move z-10"
                    title="هذا الإطار يظهر في المعاينة فقط للمساعدة في التموضع"
                    style={{
                        left: `${settings.imageX}mm`,
                        top: `${settings.imageY}mm`,
                        width: `${settings.imageWidth}mm`,
                        height: `${settings.imageHeight}mm`,
                    }}
                >
                    <img src={settings.customImageUrl} alt="Preview" className="w-full h-full object-contain" />
                    {/* Size Label for clarity */}
                    <div className="absolute -top-6 left-0 text-[10px] bg-blue-100 text-blue-700 px-1 rounded whitespace-nowrap">
                        X:{settings.imageX} Y:{settings.imageY} | {settings.imageWidth}x{settings.imageHeight}mm
                    </div>
                </div>
            )}
            
            {/* Main Content (Mock Lined Paper) */}
            <div className="absolute bottom-[15mm] left-[15mm] right-[15mm] top-[80mm] -z-0">
                 <h2 className="text-lg font-bold mb-2">ملاحظات الفحص</h2>
                 <div className="w-full h-[calc(100%-30px)] p-2 lined-paper border border-gray-300 rounded-md relative opacity-100">
                    {/* Float Positioning Image (Integrated Mode) */}
                    {settings.customImageUrl && settings.imageStyle === 'float' && (
                         <div
                            className="float-left -mt-2 -ml-2 mb-2 mr-4 border-2 border-dashed border-blue-400/50 bg-blue-50/20"
                            style={{
                                width: `${settings.imageWidth}mm`,
                                height: `${settings.imageHeight}mm`,
                            }}
                        >
                            <img src={settings.customImageUrl} alt="Preview" className="w-full h-full object-contain" />
                            <div className="absolute -bottom-6 left-0 text-[10px] bg-blue-100 text-blue-700 px-1 rounded whitespace-nowrap">
                                مدمج (Float) | {settings.imageWidth}x{settings.imageHeight}mm
                            </div>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};

const NumberInput: React.FC<{ label: string, value: number, onChange: (val: number) => void, unit: string, min?: number, max?: number, step?: number, disabled?: boolean }> = ({ label, value, onChange, unit, min, max, step=1, disabled }) => (
    <div>
        <label className={`block text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{label}</label>
        <div className="mt-1 flex items-center">
            <input 
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className={`block w-full p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-center font-mono ${disabled ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200'}`}
            />
            <span className={`ms-2 text-sm w-8 ${disabled ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{unit}</span>
        </div>
    </div>
);


const DraftSettings: React.FC = () => {
    const { settings, updateSettings, addNotification, uploadImage, inspectionTypes } = useAppContext();
    const [isUploading, setIsUploading] = useState(false);
    
    // Default settings to avoid issues with undefined properties
    const defaultDraftSettings: DraftSettingsType = {
        customImageUrl: null,
        imageX: 20,
        imageY: 80,
        imageWidth: 170,
        imageHeight: 90,
        showImageForInspectionTypeIds: [],
        imageStyle: 'float' // Default to float as per user preference
    };
    
    // Local state to manage form changes
    const [localDraftSettings, setLocalDraftSettings] = useState<DraftSettingsType>(settings.draftSettings || defaultDraftSettings);

    // Sync local state if global settings change
    useEffect(() => {
        setLocalDraftSettings(prev => ({
            ...defaultDraftSettings,
            ...settings.draftSettings,
            // Ensure defaults if missing
            imageStyle: settings.draftSettings?.imageStyle || 'float'
        }));
    }, [settings.draftSettings]);
    
    const handleSettingChange = (key: keyof DraftSettingsType, value: any) => {
        setLocalDraftSettings(prev => ({...prev, [key]: value }));
    };

    const handleInspectionTypeToggle = (typeId: string) => {
        setLocalDraftSettings(prev => {
            const currentIds = prev.showImageForInspectionTypeIds || [];
            const newIds = new Set(currentIds);
            if (newIds.has(typeId)) {
                newIds.delete(typeId);
            } else {
                newIds.add(typeId);
            }
            return { ...prev, showImageForInspectionTypeIds: Array.from(newIds) };
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            try {
                const publicUrl = await uploadImage(file, 'note_images');
                handleSettingChange('customImageUrl', publicUrl);
                addNotification({ title: 'نجاح', message: 'تم رفع الصورة بنجاح.', type: 'success' });
            } catch (error) {
                console.error("Custom image upload failed:", error);
                addNotification({ title: 'خطأ', message: 'فشل رفع الصورة.', type: 'error' });
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleSave = async () => {
        try {
            await updateSettings({
                draftSettings: localDraftSettings,
            });
            addNotification({ title: 'نجاح', message: 'تم حفظ إعدادات المسودة بنجاح!', type: 'success' });
        } catch (error) {
            console.error('Failed to save draft settings', error);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">إعدادات المسودة اليدوية</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    قم بتخصيص العناصر التي تظهر في صفحة "مسودة طلب فحص يدوي" التي يتم طباعتها للفنيين.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Side: Controls */}
                <div className="space-y-6">
                    <div className="p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h4 className="font-semibold text-lg mb-4 text-slate-800 dark:text-slate-200">صورة مخصصة (خلفية أو مخطط)</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            يمكنك رفع صورة (مثل مخطط هيكل السيارة أو شعار كبير) لتظهر خلف الملاحظات أو في مكان مخصص على الورقة.
                        </p>
                        <div className="flex items-center gap-4">
                            <label className={`cursor-pointer bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors font-semibold ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                                {isUploading ? 'جاري الرفع...' : 'رفع صورة'}
                            </label>
                             {localDraftSettings.customImageUrl && (
                                <Button variant="danger" size="sm" onClick={() => handleSettingChange('customImageUrl', null)} disabled={isUploading}>
                                    إزالة الصورة
                                </Button>
                            )}
                        </div>
                        {isUploading && <RefreshCwIcon className="w-5 h-5 animate-spin mt-2 text-blue-500" />}
                    </div>
                    
                    {localDraftSettings.customImageUrl && (
                        <div className="p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-6 animate-fade-in">
                            {/* Position Mode Selection */}
                            <div>
                                <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">نمط التموضع</h4>
                                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                                    <button 
                                        onClick={() => handleSettingChange('imageStyle', 'float')}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${localDraftSettings.imageStyle === 'float' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        مدمج (ملاصق للحاوية)
                                    </button>
                                    <button 
                                        onClick={() => handleSettingChange('imageStyle', 'absolute')}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${localDraftSettings.imageStyle !== 'float' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        موضع حر (مطلق)
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {localDraftSettings.imageStyle === 'float' 
                                        ? 'سيتم تثبيت الصورة داخل حاوية الملاحظات (أعلى اليسار) وستلتف النصوص حولها.' 
                                        : 'يمكنك تحريك الصورة بحرية في أي مكان على الصفحة باستخدام إحداثيات X و Y.'}
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-sm mb-4 text-slate-700 dark:text-slate-300">الأبعاد والموقع</h4>
                                <div className="grid grid-cols-2 gap-4">
                                   <NumberInput 
                                        label="العرض (Width)" 
                                        value={localDraftSettings.imageWidth} 
                                        onChange={v => handleSettingChange('imageWidth', v)} 
                                        unit="mm" min={10} max={210} 
                                   />
                                   <NumberInput 
                                        label="الارتفاع (Height)" 
                                        value={localDraftSettings.imageHeight} 
                                        onChange={v => handleSettingChange('imageHeight', v)} 
                                        unit="mm" min={10} max={297} 
                                   />
                                   
                                   {/* Disable Position Inputs if in Float Mode */}
                                   <div className={localDraftSettings.imageStyle === 'float' ? 'opacity-50 pointer-events-none' : ''}>
                                       <NumberInput label="الموضع الأفقي (X)" value={localDraftSettings.imageX} onChange={v => handleSettingChange('imageX', v)} unit="mm" min={0} max={210} disabled={localDraftSettings.imageStyle === 'float'} />
                                   </div>
                                   <div className={localDraftSettings.imageStyle === 'float' ? 'opacity-50 pointer-events-none' : ''}>
                                       <NumberInput label="الموضع الرأسي (Y)" value={localDraftSettings.imageY} onChange={v => handleSettingChange('imageY', v)} unit="mm" min={0} max={297} disabled={localDraftSettings.imageStyle === 'float'} />
                                   </div>
                                </div>
                            </div>
                            
                             <div className="pt-4 border-t dark:border-slate-600">
                                <h4 className="font-semibold text-sm mb-2 text-slate-700 dark:text-slate-300">شروط عرض الصورة</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    حدد أنواع الفحص التي يجب أن تظهر فيها هذه الصورة. إذا لم تحدد أي نوع، ستظهر في الجميع.
                                </p>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar border rounded p-2 dark:border-slate-600 bg-white dark:bg-slate-900">
                                    {inspectionTypes.map(type => (
                                        <label key={type.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={(localDraftSettings.showImageForInspectionTypeIds || []).includes(type.id)}
                                                onChange={() => handleInspectionTypeToggle(type.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{type.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Live Preview */}
                <div className="lg:sticky lg:top-24">
                    <h4 className="font-semibold text-lg mb-4 text-slate-800 dark:text-slate-200 text-center">معاينة حية (A4)</h4>
                     <div className="p-4 bg-slate-200 dark:bg-slate-900 rounded-lg overflow-auto flex justify-center">
                        <div className="transform origin-top scale-[0.4] sm:scale-[0.5] md:scale-[0.6] lg:scale-[0.35] xl:scale-[0.45]" style={{ width: '210mm', height: '297mm' }}>
                           <DraftPreview settings={localDraftSettings} />
                        </div>
                     </div>
                </div>
            </div>
      
            <div className="flex justify-end pt-6 border-t dark:border-gray-700">
                <Button onClick={handleSave} leftIcon={<Icon name="save" className="w-5 h-5"/>}>
                    حفظ التغييرات
                </Button>
            </div>
        </div>
    );
};

export default DraftSettings;