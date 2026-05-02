import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { DraftSettings as DraftSettingsType, DraftCustomField } from '../../types';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import DownloadIcon from '../../components/icons/DownloadIcon';
import { urlToBase64, base64ToFile } from '../../lib/utils';
import { supabase } from '../../lib/supabaseClient';

const DraftPreview: React.FC<{ settings: DraftSettingsType }> = ({ settings }) => {
    // A simplified, static version of PrintablePage for preview purposes
    return (
        <div className="relative bg-white w-[210mm] min-h-[297mm] p-[15mm] text-black border border-slate-300 shadow-md text-right" dir="rtl">
            {/* Mock Header */}
            <div className="relative w-full flex justify-center items-center pb-4 border-b-2 border-black">
                <div className="absolute top-0 right-0 text-sm">
                    <div className="border border-black rounded px-2 py-1 font-semibold" style={{ backgroundColor: '#fef3c7' }}>
                        نوع الفحص: <span className="bg-yellow-200 px-1 rounded">فحص كامل</span>
                    </div>
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
                    {/* Custom Fields below image if absolute */}
                    {settings.customFields && settings.customFields.length > 0 && (
                        <>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                                {settings.customFields.map(field => (
                                    <div key={field.id} className="flex items-center gap-1">
                                        <div className="w-2.5 h-2.5 border border-black rounded-sm flex-shrink-0" />
                                        <span className="text-[8px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: field.textColor || '#000000' }}>
                                            {field.label || 'حقل مخصص'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-1 border-b border-black w-full" />
                        </>
                    )}
                    {/* Size Label for clarity */}
                    <div className="absolute -top-6 left-0 text-[10px] bg-blue-100 text-blue-700 px-1 rounded whitespace-nowrap">
                        X:{settings.imageX} Y:{settings.imageY} | {settings.imageWidth}x{settings.imageHeight}mm
                    </div>
                </div>
            )}
            
            {/* Main Content (Mock Lined Paper) */}
            <div className="absolute bottom-[15mm] left-[15mm] right-[15mm] top-[80mm] -z-0 flex flex-col">
                 <div className="flex justify-between items-end mb-2">
                     <h2 className="text-lg font-bold">ملاحظات الفحص</h2>
                     {settings.signatureFields && settings.signatureFields.length > 0 && (
                         <div className="flex gap-6 items-end text-sm">
                             {settings.signatureFields.map(field => (
                                 <div key={field.id} className="flex items-baseline gap-2">
                                     <span className="font-bold" style={{ fontSize: field.fontSize ? `${field.fontSize}px` : '14px' }}>{field.label}</span>
                                     <span className="text-gray-400">.......................</span>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
                 <div className="w-full flex-grow p-2 lined-paper border border-gray-300 rounded-md relative opacity-100">
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
                            {/* Custom Fields below image if float */}
                            {settings.customFields && settings.customFields.length > 0 && (
                                <>
                                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                        {settings.customFields.map(field => (
                                            <div key={field.id} className="flex items-center gap-1">
                                                <div className="w-3 h-3 border border-black rounded-sm flex-shrink-0" />
                                                <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: field.textColor || '#000000' }}>
                                                    {field.label || 'حقل مخصص'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 border-b border-black w-full" />
                                </>
                            )}
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
    
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Default settings to avoid issues with undefined properties
    const defaultDraftSettings: DraftSettingsType = {
        customImageUrl: null,
        imageX: 20,
        imageY: 80,
        imageWidth: 170,
        imageHeight: 90,
        showImageForInspectionTypeIds: [],
        imageStyle: 'float',
        customFields: [],
        defaultPrintAsDraft: false
    };
    
    // Local state to manage form changes
    const [localDraftSettings, setLocalDraftSettings] = useState<DraftSettingsType>(settings.draftSettings || defaultDraftSettings);

    // Sync local state if global settings change
    useEffect(() => {
        setLocalDraftSettings(prev => ({
            ...defaultDraftSettings,
            ...settings.draftSettings,
            // Ensure defaults if missing
            imageStyle: settings.draftSettings?.imageStyle || 'float',
            customFields: settings.draftSettings?.customFields || [],
            signatureFields: settings.draftSettings?.signatureFields || [],
            defaultPrintAsDraft: settings.draftSettings?.defaultPrintAsDraft ?? false
        }));
    }, [settings.draftSettings]);

    const handleAddCustomField = () => {
        const newField = {
            id: Date.now().toString(),
            label: '',
            type: 'checkbox' as const,
            textColor: '#000000'
        };
        handleSettingChange('customFields', [...(localDraftSettings.customFields || []), newField]);
    };

    const handleUpdateCustomField = (id: string, updates: Partial<DraftCustomField>) => {
        const updatedFields = (localDraftSettings.customFields || []).map(f => 
            f.id === id ? { ...f, ...updates } : f
        );
        handleSettingChange('customFields', updatedFields);
    };

    const handleRemoveCustomField = (id: string) => {
        const filteredFields = (localDraftSettings.customFields || []).filter(f => f.id !== id);
        handleSettingChange('customFields', filteredFields);
    };

    const handleAddSignatureField = () => {
        const newField = {
            id: Date.now().toString(),
            label: '',
            fontSize: 14,
            applicableInspectionTypeIds: []
        };
        handleSettingChange('signatureFields', [...(localDraftSettings.signatureFields || []), newField]);
    };

    const handleUpdateSignatureField = (id: string, updates: Partial<{ label: string; fontSize: number; applicableInspectionTypeIds: string[] }>) => {
        const updatedFields = (localDraftSettings.signatureFields || []).map(f => 
            f.id === id ? { ...f, ...updates } : f
        );
        handleSettingChange('signatureFields', updatedFields);
    };

    const handleSignatureInspectionToggle = (fieldId: string, typeId: string) => {
        const field = localDraftSettings.signatureFields?.find(f => f.id === fieldId);
        if (!field) return;

        const currentIds = field.applicableInspectionTypeIds || [];
        const newIds = currentIds.includes(typeId)
            ? currentIds.filter(id => id !== typeId)
            : [...currentIds, typeId];

        handleUpdateSignatureField(fieldId, { applicableInspectionTypeIds: newIds });
    };

    const handleRemoveSignatureField = (id: string) => {
        const filteredFields = (localDraftSettings.signatureFields || []).filter(f => f.id !== id);
        handleSettingChange('signatureFields', filteredFields);
    };
    
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

    const handleExportDraftSettings = async () => {
        setIsExporting(true);
        try {
            addNotification({ title: 'جاري التصدير', message: 'يتم الآن تجهيز إعدادات المسودة والصورة...', type: 'info' });

            let imageBase64 = null;
            if (settings.draftSettings?.customImageUrl) {
                imageBase64 = await urlToBase64(settings.draftSettings.customImageUrl);
            }

            const exportData = {
                version: '1.0',
                type: 'draft_settings',
                timestamp: new Date().toISOString(),
                data: {
                    settings: settings.draftSettings,
                    imageBase64: imageBase64
                }
            };

            const dataStr = JSON.stringify(exportData);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `draft_settings_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({ title: 'تم التصدير', message: 'تم تصدير إعدادات المسودة بنجاح.', type: 'success' });
        } catch (error) {
            console.error('Export error:', error);
            addNotification({ title: 'خطأ', message: 'حدث خطأ أثناء التصدير.', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportDraftSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const fileContent = await file.text();
            const data = JSON.parse(fileContent);

            if (data.type !== 'draft_settings') {
                throw new Error('ملف غير صالح. يرجى اختيار ملف إعدادات مسودة صحيح.');
            }

            let newImageUrl = data.data?.settings?.customImageUrl || data.settings?.customImageUrl;
            
            if (data.data?.imageBase64 || data.imageBase64) {
                const imageFile = base64ToFile(data.data?.imageBase64 || data.imageBase64, `draft_image_${Date.now()}.png`);
                newImageUrl = await uploadImage(imageFile, 'note_images');
            }

            const newSettings = {
                ...(data.data?.settings || data.settings),
                customImageUrl: newImageUrl
            };

            await updateSettings({
                draftSettings: newSettings,
            });

            addNotification({ title: 'تم الاستيراد', message: 'تم استيراد إعدادات المسودة بنجاح.', type: 'success' });
        } catch (error: any) {
            console.error('Import error:', error);
            addNotification({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء الاستيراد.', type: 'error' });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">إعدادات المسودة اليدوية</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        قم بتخصيص العناصر التي تظهر في صفحة "مسودة طلب فحص يدوي" التي يتم طباعتها للفنيين.
                    </p>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleImportDraftSettings} 
                    />
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting || isExporting}
                    >
                        {isImporting ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <Icon name="upload" className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isImporting ? 'جاري...' : 'استيراد'}</span>
                    </Button>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={handleExportDraftSettings}
                        disabled={isImporting || isExporting}
                    >
                        {isExporting ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isExporting ? 'جاري...' : 'تصدير'}</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Side: Controls */}
                <div className="space-y-6">
                    <div className="p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200">جودة الطباعة الافتراضية</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    تحديد ما إذا كان خيار "الطباعة بجودة مسودة" يكون مفعلاً تلقائياً عند الدخول لصفحة المسودة.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={localDraftSettings.defaultPrintAsDraft || false}
                                    onChange={(e) => handleSettingChange('defaultPrintAsDraft', e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200">حقول التوقيع اليدوي</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    تظهر بجانب عنوان "ملاحظات الفحص" للكتابة يدوياً (مثال: الموظف .........)
                                </p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={handleAddSignatureField}>
                                <Icon name="add" className="w-3 h-3" />
                                إضافة حقل
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {(localDraftSettings.signatureFields || []).length === 0 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2 italic">
                                    لا توجد حقول توقيع مضافة حالياً.
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(localDraftSettings.signatureFields || []).map((field) => (
                                    <div key={field.id} className="flex flex-col gap-3 p-4 border dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg group relative">
                                        <div className="flex gap-2 items-center">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">اسم الحقل</label>
                                                <input 
                                                    type="text" 
                                                    value={field.label}
                                                    onChange={(e) => handleUpdateSignatureField(field.id, { label: e.target.value })}
                                                    placeholder="مثال: فني البدي"
                                                    className="w-full p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveSignatureField(field.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100 shrink-0 self-end mb-1"
                                                title="حذف الحقل"
                                            >
                                                <Icon name="delete" className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-slate-500 whitespace-nowrap font-bold">حجم الخط:</label>
                                                <input 
                                                    type="number" 
                                                    min="8" max="48"
                                                    value={field.fontSize || 14}
                                                    onChange={(e) => handleUpdateSignatureField(field.id, { fontSize: parseInt(e.target.value) || 14 })}
                                                    className="w-16 p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                                />
                                                <span className="text-xs text-slate-400">px</span>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t dark:border-slate-700">
                                            <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase">أنواع الفحص المرتبطة</label>
                                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/50 rounded border dark:border-slate-700">
                                                {inspectionTypes.map(type => {
                                                    const isSelected = (field.applicableInspectionTypeIds || []).includes(type.id);
                                                    return (
                                                        <button
                                                            key={type.id}
                                                            onClick={() => handleSignatureInspectionToggle(field.id, type.id)}
                                                            className={`text-[10px] px-2 py-1 rounded transition-all border ${
                                                                isSelected 
                                                                ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                                                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
                                                            }`}
                                                        >
                                                            {type.name}
                                                        </button>
                                                    );
                                                })}
                                                {inspectionTypes.length === 0 && (
                                                    <p className="text-[10px] text-slate-400 italic">لا توجد أنواع فحص معرفة.</p>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-slate-400 mt-1">إذا لم يتم تحديد أي نوع، سيظهر الحقل في جميع الفحوصات.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

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

                            {/* Custom Fields Selection */}
                            <div className="pt-4 border-t dark:border-slate-600">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">حقول مخصصة أسفل الصورة (Checkboxes)</h4>
                                    <Button size="sm" variant="secondary" onClick={handleAddCustomField}>
                                        <Icon name="add" className="w-3 h-3" />
                                        إضافة حقل
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {(localDraftSettings.customFields || []).length === 0 && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2 italic">
                                            لا توجد حقول إضافية مضافة حالياً.
                                        </p>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {(localDraftSettings.customFields || []).map((field, index) => (
                                            <div key={field.id} className="p-3 border dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl space-y-3 relative group shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">نص الحقل</label>
                                                        <input 
                                                            type="text" 
                                                            value={field.label}
                                                            onChange={(e) => handleUpdateCustomField(field.id, { label: e.target.value })}
                                                            placeholder="مثال: تم فحص الهيكل"
                                                            className="w-full p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">اللون</label>
                                                        <input 
                                                            type="color" 
                                                            value={field.textColor || '#000000'}
                                                            onChange={(e) => handleUpdateCustomField(field.id, { textColor: e.target.value })}
                                                            className="w-10 h-9 p-0 border-0 bg-transparent cursor-pointer rounded-lg overflow-hidden"
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveCustomField(field.id)}
                                                    className="absolute -top-2 -right-2 p-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                    title="حذف الحقل"
                                                >
                                                    <Icon name="delete" className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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