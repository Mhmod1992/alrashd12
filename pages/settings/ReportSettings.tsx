
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ReportSettings, Client, Car, CarMake, CarModel, InspectionType, CustomFindingCategory, PredefinedFinding, InspectionRequest, PaymentType, RequestStatus, CustomReportTemplate, ReportFontSizes } from '../../types';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import InspectionReport from '../../components/InspectionReport';
import { uuidv4, cleanJsonString } from '../../lib/utils';
import ChevronDownIcon from '../../components/icons/ChevronDownIcon';
import Modal from '../../components/Modal';
import { GoogleGenAI, Type } from "@google/genai";
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import PlusIcon from '../../components/icons/PlusIcon';
import TrashIcon from '../../components/icons/TrashIcon';

// --- Constants & Helper Components ---
const PRESET_COLORS = ['#ffffff', '#f1f5f9', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#fef2f2', '#ef4444', '#dc2626', '#b91c1c', '#e0f2fe', '#3b82f6', '#2563eb', '#1e40af', '#f0fdfa', '#14b8a6', '#0d9488', '#134e4a', '#fefce8', '#eab308', '#ca8a04', '#a16207', '#eef2ff', '#6366f1', '#4f46e5', '#3730a3'];

const ColorInput: React.FC<{ label: string; value: string; onChange: (color: string) => void }> = ({ label, value, onChange }) => {
    const safeValue = value || '';
    return (
        <div className="bg-white dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{label}</label>
            <div className="flex items-stretch gap-2">
                <input type="color" value={safeValue} onChange={e => onChange(e.target.value)} className="w-10 h-10 p-0 border-none cursor-pointer bg-transparent rounded-lg overflow-hidden shadow-inner" />
                <input type="text" value={safeValue} onChange={e => onChange(e.target.value)} className="flex-1 px-3 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="#HEX" />
            </div>
            <div className="flex wrap gap-1 mt-3">
                {PRESET_COLORS.slice(0, 10).map(color => (
                    <button key={color} type="button" onClick={() => onChange(color)} className={`w-4 h-4 rounded-full border dark:border-slate-600 transition-transform hover:scale-125 ${safeValue.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-blue-500' : ''}`} style={{ backgroundColor: color }} />
                ))}
            </div>
        </div>
    );
};

const FONT_SIZE_OPTIONS = [
    { label: 'أصغر', value: 'text-xs' }, { label: 'صغير', value: 'text-sm' },
    { label: 'أساسي', value: 'text-base' }, { label: 'كبير', value: 'text-lg' },
    { label: 'أكبر', value: 'text-xl' }, { label: 'ضخم', value: 'text-2xl' },
    { label: 'الأضخم', value: 'text-3xl' },
];

const HEADER_FONT_SIZE_OPTIONS = [
    ...FONT_SIZE_OPTIONS,
    { label: 'ضخم جداً', value: 'text-4xl' },
    { label: 'هائل', value: 'text-5xl' },
    { label: 'عملاق', value: 'text-6xl' },
];

const FontSizeSelector: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: typeof FONT_SIZE_OPTIONS }> = ({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

type Tab = 'style' | 'branding' | 'content' | 'footer' | 'ai';

const ReportSettingsPage: React.FC = () => {
    const { settings, updateSettings, addNotification, showConfirmModal, setPage, setSettingsPage, uploadImage } = useAppContext();
    const [reportSettings, setReportSettings] = useState<ReportSettings>(settings.reportSettings);
    const [activeTab, setActiveTab] = useState<Tab>('branding');
    const [previewScale, setPreviewScale] = useState(0.8);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [showPreview, setShowPreview] = useState(true);
    const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);

    // --- Resizable and Draggable State ---
    const [previewPos, setPreviewPos] = useState(() => {
        const savedPos = localStorage.getItem('report_preview_pos');
        return savedPos ? JSON.parse(savedPos) : { x: 24, y: 150 };
    });
    const [previewSize, setPreviewSize] = useState(() => {
        const savedSize = localStorage.getItem('report_preview_size');
        return savedSize ? JSON.parse(savedSize) : { width: 450, height: 600 };
    });

    const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const resizeRef = useRef<{ isResizing: boolean; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

    useEffect(() => { setReportSettings(settings.reportSettings); }, [settings.reportSettings]);

    const handleSettingChange = (key: keyof ReportSettings, value: any) => { setReportSettings(prev => ({ ...prev, [key]: value })); };
    const handleFontSizeChange = (key: keyof ReportFontSizes, value: string) => { setReportSettings(prev => ({ ...prev, fontSizes: { ...prev.fontSizes, [key]: value } })); };

    const handleGenerateDesign = async () => {
        if (!aiPrompt.trim()) return;
        if (!settings.geminiApiKey) {
            addNotification({ title: 'مفتاح API مطلوب', message: 'يرجى إضافة مفتاح Gemini في إعدادات الـ API.', type: 'error' });
            return;
        }
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            const prompt = `Generate a color scheme for a car inspection report based on this vibe: "${aiPrompt}". Return strictly JSON: { "primaryColor": "...", "appNameColor": "...", "sectionTitleBackgroundColor": "...", "sectionTitleFontColor": "...", "findingsHeaderBackgroundColor": "...", "findingsHeaderFontColor": "...", "pageBackgroundColor": "...", "textColor": "...", "borderColor": "...", "fontFamily": "Cairo or Tajawal" }`;
            const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt, config: { responseMimeType: "application/json" } });
            const result = JSON.parse(cleanJsonString(response.text));
            setReportSettings(prev => ({ ...prev, ...result, fontFamily: result.fontFamily === 'Cairo' ? "'Cairo', sans-serif" : "'Tajawal', sans-serif" }));
            addNotification({ title: 'تم التوليد', message: 'تم تطبيق الألوان المقترحة.', type: 'success' });
            setAiPrompt('');
        } catch (e) {
            addNotification({ title: 'خطأ', message: 'فشل توليد التصميم بالذكاء الاصطناعي.', type: 'error' });
        } finally { setIsGenerating(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'workshopStampUrl' | 'reportLogoUrl') => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            try {
                const url = await uploadImage(file, 'logos');
                handleSettingChange(field, url);
                addNotification({ title: 'نجاح', message: 'تم رفع الصورة بنجاح.', type: 'success' });
            } catch (e) { addNotification({ title: 'خطأ', message: 'فشل الرفع.', type: 'error' }); }
            finally { setIsUploading(false); }
        }
    };

    const handleSave = async () => {
        try {
            await updateSettings({ reportSettings });
            addNotification({ title: 'تم الحفظ', message: 'تم تحديث إعدادات التقرير النهائي.', type: 'success' });
        } catch (e) { console.error(e); }
    };

    const handleSaveAsTemplate = async () => {
        if (!newTemplateName.trim()) return;
        const newTemplate: CustomReportTemplate = { id: uuidv4(), name: newTemplateName.trim(), settings: reportSettings };
        await updateSettings({ customReportTemplates: [...settings.customReportTemplates, newTemplate] });
        addNotification({ title: 'تم الحفظ', message: 'تمت إضافة القالب إلى قائمة القوالب.', type: 'success' });
        setIsSaveModalOpen(false);
    };

    // --- Custom Fields Logic ---
    const addCustomField = () => {
        const newField = { id: uuidv4(), label: '', value: '' };
        handleSettingChange('headerCustomFields', [...(reportSettings.headerCustomFields || []), newField]);
    };
    
    const updateCustomField = (id: string, key: 'label' | 'value', val: string) => {
        handleSettingChange('headerCustomFields', (reportSettings.headerCustomFields || []).map(f => 
            f.id === id ? { ...f, [key]: val } : f
        ));
    };

    const removeCustomField = (id: string) => {
        handleSettingChange('headerCustomFields', (reportSettings.headerCustomFields || []).filter(f => f.id !== id));
    };


    // --- Header Additional Text Handlers ---
    const addHeaderLine = () => {
        const newLine = { id: uuidv4(), text: '', bold: false };
        handleSettingChange('headerAdditionalTexts', [...(reportSettings.headerAdditionalTexts || []), newLine]);
    };

    const removeHeaderLine = (id: string) => {
        handleSettingChange('headerAdditionalTexts', (reportSettings.headerAdditionalTexts || []).filter(line => line.id !== id));
    };

    const updateHeaderLine = (id: string, text: string, bold: boolean) => {
        handleSettingChange('headerAdditionalTexts', (reportSettings.headerAdditionalTexts || []).map(line => 
            line.id === id ? { ...line, text, bold } : line
        ));
    };

    // --- Drag and Resize Logic ---
    const handleDragStart = (e: React.MouseEvent) => {
        dragRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: previewPos.x,
            startPosY: previewPos.y
        };
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
    };

    const handleDragMove = (e: MouseEvent) => {
        if (!dragRef.current?.isDragging) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const nextX = Math.max(0, Math.min(window.innerWidth - (isPreviewCollapsed ? 256 : previewSize.width), dragRef.current.startPosX + dx));
        const nextY = Math.max(0, Math.min(window.innerHeight - 48, dragRef.current.startPosY + dy));
        setPreviewPos({ x: nextX, y: nextY });
    };

    const handleDragEnd = () => {
        if (dragRef.current) {
            localStorage.setItem('report_preview_pos', JSON.stringify(previewPos));
            dragRef.current = null;
        }
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        resizeRef.current = {
            isResizing: true,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: previewSize.width,
            startHeight: previewSize.height
        };
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizeRef.current?.isResizing) return;
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        const nextWidth = Math.max(300, Math.min(window.innerWidth - previewPos.x, resizeRef.current.startWidth + dx));
        const nextHeight = Math.max(200, Math.min(window.innerHeight - previewPos.y, resizeRef.current.startHeight + dy));
        setPreviewSize({ width: nextWidth, height: nextHeight });
    };

    const handleResizeEnd = () => {
        if (resizeRef.current) {
            localStorage.setItem('report_preview_size', JSON.stringify(previewSize));
            resizeRef.current = null;
        }
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
    };

    const navItems = [
        { id: 'ai', name: 'قوالب و AI', icon: 'sparkles' },
        { id: 'branding', name: 'الهوية والترويسة', icon: 'workshop' },
        { id: 'style', name: 'النمط والألوان', icon: 'appearance' },
        { id: 'content', name: 'تنسيق المحتوى', icon: 'document-report' },
        { id: 'footer', name: 'التذييل والإخلاء', icon: 'edit' },
    ];

    const mockData = useMemo(() => ({
        request: { 
            request_number: 1024, 
            created_at: new Date().toISOString(), 
            price: 350, 
            status: RequestStatus.COMPLETE, 
            structured_findings: [
                { findingId: '1', findingName: 'الصدام الأمامي', value: 'سليم', categoryId: 'cat-1' }
            ], 
            general_notes: [
                { id: '1', text: 'ملاحظة مميزة باللون الأحمر لتوضيح تأثير الشفافية.', authorName: 'فاحص 1', highlightColor: 'red' },
                { id: '2', text: 'ملاحظة مميزة باللون الأصفر (تحذير).', authorName: 'فاحص 1', highlightColor: 'yellow' },
                { id: '3', text: 'ملاحظة تجريبية عادية بدون تلوين.', authorName: 'فاحص 1' }
            ], 
            category_notes: {}, 
            report_stamps: [] 
        },
        client: { name: 'فهد الأحمد', phone: '0501234567' },
        car: { year: 2024, plate_number: 'أ ب ج 1234' },
        carMake: { name_ar: 'تويوتا', name_en: 'Toyota', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/1200px-Toyota.svg.png' },
        inspectionType: { name: 'فحص كامل', finding_category_ids: ['cat-1'] },
        categories: [{ id: 'cat-1', name: 'البودي والبدن' }],
        predefined: [{ id: '1', name: 'الصدام الأمامي', options: ['سليم'], category_id: 'cat-1' }]
    }), []);

    return (
        <div className="flex flex-col gap-6 animate-fade-in relative">
            <div className="flex-1 min-w-0 space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 sticky top-0 z-20">
                    <nav className="flex gap-1 overflow-x-auto no-scrollbar p-1">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as Tab)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                            >
                                <Icon name={item.icon as any} className="w-3.5 h-3.5" />
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="flex items-center gap-2 px-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
                        <Button onClick={handleSave} className="flex-1 sm:flex-none shadow-lg shadow-blue-500/20 py-2 px-6 text-xs" disabled={isUploading}>حفظ الإعدادات</Button>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className="flex-1 space-y-8 min-w-0">
                        
                        {activeTab === 'branding' && (
                            <div className="space-y-8 animate-slide-in-down">
                                {/* Header Text Configuration Section */}
                                <section className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-6">
                                    <div className="flex justify-between items-center border-b dark:border-slate-700 pb-4">
                                        <div>
                                            <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                <Icon name="edit" className="w-5 h-5 text-blue-500" />
                                                نصوص ترويسة التقرير
                                            </h5>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase">إدارة العناوين والنصوص التي تظهر في أعلى الصفحة</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-tighter">العنوان الفرعي (Subtitle)</label>
                                                <input 
                                                    type="text" 
                                                    value={reportSettings.headerSubtitleText} 
                                                    onChange={e => handleSettingChange('headerSubtitleText', e.target.value)}
                                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-sm font-bold"
                                                    placeholder="مثال: تقرير فحص فني شامل"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">نمط الخط عريض؟</span>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={reportSettings.headerTitleBold} onChange={e => handleSettingChange('headerTitleBold', e.target.checked)} className="rounded text-blue-600" />
                                                        <span className="text-[10px] font-bold">اسم الورشة</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={reportSettings.headerSubtitleBold} onChange={e => handleSettingChange('headerSubtitleBold', e.target.checked)} className="rounded text-blue-600" />
                                                        <span className="text-[10px] font-bold">العنوان الفرعي</span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">عرض السعر في التقرير؟</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={reportSettings.showPriceOnReport} 
                                                        onChange={e => handleSettingChange('showPriceOnReport', e.target.checked)} 
                                                        className="sr-only peer" 
                                                    />
                                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-xs font-black text-slate-400 uppercase tracking-tighter">بيانات رسمية إضافية (سجل تجاري، ضريبي...)</label>
                                                <button onClick={addCustomField} className="text-[10px] font-bold text-green-600 flex items-center gap-1 hover:underline">
                                                    <PlusIcon className="w-3 h-3" /> إضافة حقل
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                                {(reportSettings.headerCustomFields || []).map((field) => (
                                                    <div key={field.id} className="flex items-center gap-2 group animate-fade-in">
                                                        <input 
                                                            type="text" 
                                                            value={field.label} 
                                                            onChange={e => updateCustomField(field.id, 'label', e.target.value)}
                                                            className="w-1/3 p-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300"
                                                            placeholder="العنوان (مثال: الرقم الضريبي)"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            value={field.value} 
                                                            onChange={e => updateCustomField(field.id, 'value', e.target.value)}
                                                            className="flex-1 p-2 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
                                                            placeholder="القيمة..."
                                                        />
                                                        <button 
                                                            onClick={() => removeCustomField(field.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                            title="حذف"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {(reportSettings.headerCustomFields || []).length === 0 && (
                                                    <p className="text-center py-4 text-slate-400 text-[10px] italic border-2 border-dashed rounded-lg dark:border-slate-700">لا توجد بيانات إضافية.</p>
                                                )}
                                            </div>
                                            
                                            <div className="pt-4 border-t dark:border-slate-700">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-tighter">نصوص حرة إضافية (تحت العنوان)</label>
                                                    <button onClick={addHeaderLine} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                                        <PlusIcon className="w-3 h-3" /> إضافة سطر
                                                    </button>
                                                </div>
                                                
                                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {(reportSettings.headerAdditionalTexts || []).map((line) => (
                                                        <div key={line.id} className="flex items-center gap-2 group animate-fade-in">
                                                            <input 
                                                                type="text" 
                                                                value={line.text} 
                                                                onChange={e => updateHeaderLine(line.id, e.target.value, line.bold)}
                                                                className={`flex-1 p-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-xs ${line.bold ? 'font-black' : 'font-medium'}`}
                                                                placeholder="أدخل النص هنا..."
                                                            />
                                                            <button 
                                                                onClick={() => updateHeaderLine(line.id, line.text, !line.bold)}
                                                                className={`p-2 rounded-lg border transition-colors ${line.bold ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600'}`}
                                                                title="خط عريض"
                                                            >
                                                                B
                                                            </button>
                                                            <button 
                                                                onClick={() => removeHeaderLine(line.id)}
                                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                                title="حذف"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-4">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Icon name="gallery" className="w-5 h-5 text-blue-500" />شعار التقرير</h5>
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-full h-32 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed dark:border-slate-700 flex items-center justify-center overflow-hidden relative group">
                                                {reportSettings.reportLogoUrl ? <img src={reportSettings.reportLogoUrl} className="max-h-full object-contain p-2" alt="Logo" /> : <Icon name="camera" className="w-10 h-10 text-slate-300" />}
                                                {isUploading && <div className="absolute inset-0 bg-white/60 dark:bg-slate-800/60 flex items-center justify-center"><RefreshCwIcon className="w-6 h-6 animate-spin text-blue-600" /></div>}
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                <label className="flex-1"><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'reportLogoUrl')} /><div className="w-full text-center py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg font-bold text-sm cursor-pointer hover:bg-blue-100 transition-colors">تغيير</div></label>
                                                {reportSettings.reportLogoUrl && <button onClick={() => handleSettingChange('reportLogoUrl', null)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-sm">حذف</button>}
                                            </div>
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase">الارتفاع في التقرير: {reportSettings.workshopLogoHeight}px</label>
                                                <input type="range" min="40" max="200" value={reportSettings.workshopLogoHeight} onChange={e => handleSettingChange('workshopLogoHeight', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-4">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Icon name="check-circle" className="w-5 h-5 text-emerald-500" />ختم الورشة</h5>
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-full h-32 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed dark:border-slate-700 flex items-center justify-center overflow-hidden relative">
                                                {reportSettings.workshopStampUrl ? <img src={reportSettings.workshopStampUrl} className="max-h-full object-contain p-2" alt="Stamp" /> : <span className="text-slate-300 text-xs">لا يوجد ختم</span>}
                                                {isUploading && <div className="absolute inset-0 bg-white/60 dark:bg-slate-800/60 flex items-center justify-center"><RefreshCwIcon className="w-6 h-6 animate-spin text-blue-600" /></div>}
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                <label className="flex-1"><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'workshopStampUrl')} /><div className="w-full text-center py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold text-sm cursor-pointer hover:bg-emerald-100 transition-colors">تغيير</div></label>
                                                {reportSettings.workshopStampUrl && <button onClick={() => handleSettingChange('workshopStampUrl', null)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-sm">حذف</button>}
                                            </div>
                                            <p className="text-[10px] text-slate-400 text-center">يظهر الختم تلقائياً في أسفل التقرير المطبوع.</p>
                                        </div>
                                    </div>
                                </section>
                                <section className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Icon name="scan-plate" className="w-5 h-5 text-indigo-500" />رمز الـ QR الخاص بالتقرير</h5>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={reportSettings.showQrCode} onChange={e => handleSettingChange('showQrCode', e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                    {reportSettings.showQrCode && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">محتوى الرابط</label>
                                                    <input type="text" value={reportSettings.qrCodeContent} onChange={e => handleSettingChange('qrCodeContent', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg font-mono text-xs" dir="ltr" />
                                                    <p className="text-[9px] text-slate-400 mt-1">استخدم <code className="bg-slate-100 dark:bg-slate-700 px-1">{"{request_number}"}</code> لإدراج رقم الطلب تلقائياً.</p>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">الموقع</label><select value={reportSettings.qrCodePosition} onChange={e => handleSettingChange('qrCodePosition', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-xs font-bold"><option value="left">يسار الترويسة</option><option value="right">يمين الترويسة</option></select></div>
                                                    <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">الحجم</label><input type="text" value={reportSettings.qrCodeSize} onChange={e => handleSettingChange('qrCodeSize', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-xs text-center" placeholder="96px" /></div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center border dark:border-slate-700"><div className="w-24 h-24 bg-white p-2 rounded shadow-sm flex items-center justify-center"><Icon name="scan-plate" className="w-16 h-16 text-slate-200" /></div><span className="text-[10px] text-slate-400 mt-2 font-bold uppercase">QR Preview</span></div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {activeTab === 'style' && (
                            <div className="space-y-8 animate-slide-in-down">
                                <section className="space-y-4">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">الخطوط العامة</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">عائلة الخط</label>
                                            <select value={reportSettings.fontFamily} onChange={e => handleSettingChange('fontFamily', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg outline-none font-bold">
                                                <option value="'Tajawal', sans-serif">Tajawal (عصري)</option>
                                                <option value="'Cairo', sans-serif">Cairo (رسمي)</option>
                                                <option value="'Noto Sans Arabic', sans-serif">Noto Sans</option>
                                                <option value="'Amiri', serif">Amiri (كلاسيكي)</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                                
                                <section className="space-y-4">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">الألوان والشفافية</h4>
                                    
                                    <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg"><Icon name="appearance" className="w-5 h-5 text-blue-600 dark:text-blue-300" /></div>
                                                <div>
                                                    <h5 className="font-black text-slate-800 dark:text-slate-100 text-sm">شفافية ألوان الملاحظات</h5>
                                                    <p className="text-[10px] text-slate-500">تحكم في قوة ألوان تمييز الملاحظات (أحمر، أصفر، أخضر..)</p>
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black font-numeric">{Math.round(reportSettings.noteHighlightOpacity * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0.05" 
                                            max="1.0" 
                                            step="0.05" 
                                            value={reportSettings.noteHighlightOpacity} 
                                            onChange={e => handleSettingChange('noteHighlightOpacity', parseFloat(e.target.value))} 
                                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                                        />
                                        <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                            <span>خفيف جداً (هادئ)</span>
                                            <span>لون مصمت (قوي)</span>
                                        </div>
                                    </div>

                                    <div className={`grid grid-cols-1 md:grid-cols-2 ${showPreview ? '2xl:grid-cols-3' : 'lg:grid-cols-3'} gap-4`}>
                                        <ColorInput label="اللون الرئيسي (اللمسات)" value={reportSettings.primaryColor} onChange={v => handleSettingChange('primaryColor', v)} />
                                        <ColorInput label="لون اسم الورشة" value={reportSettings.appNameColor} onChange={v => handleSettingChange('appNameColor', v)} />
                                        <ColorInput label="خلفية العناوين الرئيسية" value={reportSettings.sectionTitleBackgroundColor} onChange={v => handleSettingChange('sectionTitleBackgroundColor', v)} />
                                        <ColorInput label="خط العناوين الرئيسية" value={reportSettings.sectionTitleFontColor} onChange={v => handleSettingChange('sectionTitleFontColor', v)} />
                                        <ColorInput label="خلفية أقسام الفحص" value={reportSettings.findingsHeaderBackgroundColor} onChange={v => handleSettingChange('findingsHeaderBackgroundColor', v)} />
                                        <ColorInput label="خط أقسام الفحص" value={reportSettings.findingsHeaderFontColor} onChange={v => handleSettingChange('findingsHeaderFontColor', v)} />
                                        <ColorInput label="خلفية الصفحة العامة" value={reportSettings.pageBackgroundColor} onChange={v => handleSettingChange('pageBackgroundColor', v)} />
                                        <ColorInput label="لون النص الأساسي" value={reportSettings.textColor} onChange={v => handleSettingChange('textColor', v)} />
                                        <ColorInput label="لون الحدود والفواصل" value={reportSettings.borderColor} onChange={v => handleSettingChange('borderColor', v)} />
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'content' && (
                            <div className="space-y-8 animate-slide-in-down">
                                <section className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-6">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">أحجام النصوص في التقرير</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <FontSizeSelector label="عنوان الورشة" value={reportSettings.fontSizes.headerTitle} onChange={v => handleFontSizeChange('headerTitle', v)} options={HEADER_FONT_SIZE_OPTIONS} />
                                        <FontSizeSelector label="العنوان الفرعي" value={reportSettings.fontSizes.headerSubtitle} onChange={v => handleFontSizeChange('headerSubtitle', v)} options={FONT_SIZE_OPTIONS} />
                                        <FontSizeSelector label="اسم السيارة (EN)" value={reportSettings.fontSizes.carName} onChange={v => handleFontSizeChange('carName', v)} options={HEADER_FONT_SIZE_OPTIONS} />
                                        <FontSizeSelector label="عناوين الأقسام" value={reportSettings.fontSizes.categoryTitle} onChange={v => handleFontSizeChange('categoryTitle', v)} options={FONT_SIZE_OPTIONS} />
                                        <FontSizeSelector label="بنود الفحص" value={reportSettings.fontSizes.findingTitle} onChange={v => handleFontSizeChange('findingTitle', v)} options={FONT_SIZE_OPTIONS} />
                                        <FontSizeSelector label="نصوص الملاحظات" value={reportSettings.fontSizes.noteText} onChange={v => handleFontSizeChange('noteText', v)} options={FONT_SIZE_OPTIONS} />
                                    </div>
                                </section>
                                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-4">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200">تنسيق البطاقات</h5>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">حجم بطاقة الفحص</label><select value={reportSettings.findingCardSize} onChange={e => handleSettingChange('findingCardSize', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-sm font-bold"><option value="x-small">صغير جداً (6/سطر)</option><option value="small">صغير (5/سطر)</option><option value="medium">متوسط (3/سطر)</option><option value="large">كبير (2/سطر)</option></select></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">أبعاد صور الملاحظات</label><select value={reportSettings.noteImageSize} onChange={e => handleSettingChange('noteImageSize', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-sm font-bold"><option value="small">سينمائي (16:9)</option><option value="medium">قياسي (4:3)</option><option value="large">مربع (1:1)</option></select></div>
                                    </div>
                                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-4">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200">العلامة المائية (الملاحظات)</h5>
                                        <div className="space-y-4">
                                            <div><div className="flex justify-between text-xs font-black text-slate-400 mb-2 uppercase"><span>الشفافية</span><span>{Math.round(reportSettings.watermarkOpacity * 100)}%</span></div><input type="range" min="0.01" max="0.3" step="0.01" value={reportSettings.watermarkOpacity} onChange={e => handleSettingChange('watermarkOpacity', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" /></div>
                                            <div className="flex gap-4"><div className="flex-1"><label className="block text-[10px] font-black text-slate-400 mb-1 uppercase">الدوران</label><input type="number" value={reportSettings.watermarkRotation} onChange={e => handleSettingChange('watermarkRotation', parseInt(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-xs text-center" /></div><div className="flex-1"><label className="block text-[10px] font-black text-slate-400 mb-1 uppercase">حجم الخط</label><input type="number" value={reportSettings.watermarkSize} onChange={e => handleSettingChange('watermarkSize', parseInt(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg text-xs text-center" /></div></div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'footer' && (
                            <div className="space-y-6 animate-slide-in-down">
                                <section className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-6">
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">نصوص أسفل التقرير</h4>
                                    <div className="space-y-4">
                                        <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">نص إخلاء المسؤولية</label><textarea value={reportSettings.disclaimerText} onChange={e => handleSettingChange('disclaimerText', e.target.value)} rows={4} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-500" placeholder="أكتب نص إخلاء المسؤولية هنا..." /></div>
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700"><div className="flex-1"><h5 className="font-bold text-sm">أرقام الصفحات</h5><p className="text-[10px] text-slate-500 mt-0.5">إظهار "صفحة X من Y" في أسفل كل صفحة.</p></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={reportSettings.showPageNumbers} onChange={e => handleSettingChange('showPageNumbers', e.target.checked)} className="sr-only peer" /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div></label></div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'ai' && (
                            <div className="space-y-6 animate-slide-in-down">
                                <section className="p-4 bg-gradient-to-br from-indigo-600/90 to-blue-700/90 rounded-2xl shadow-lg text-white relative overflow-hidden border border-white/10 backdrop-blur-sm">
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
                                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-4">
                                        <div className="flex-grow">
                                            <h4 className="text-lg font-bold flex items-center gap-2">
                                                <div className="p-1.5 bg-white/20 rounded-lg"><Icon name="sparkles" className="w-5 h-5 text-yellow-300" /></div>
                                                مساعد التصميم الذكي
                                            </h4>
                                            <p className="text-blue-100 text-xs mt-1 opacity-90">صف شكل التقرير، وسيقوم الذكاء الاصطناعي بضبط النمط لك فوراً.</p>
                                        </div>
                                        <div className="w-full md:w-2/3 flex flex-col sm:flex-row gap-2">
                                            <input 
                                                type="text"
                                                value={aiPrompt} 
                                                onChange={e => setAiPrompt(e.target.value)} 
                                                className="flex-grow p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-blue-200/60 outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-md" 
                                                placeholder="مثال: تصميم رسمي هادئ، رمادي وذهبي..." 
                                                onKeyDown={e => e.key === 'Enter' && handleGenerateDesign()}
                                            />
                                            <button 
                                                onClick={() => handleGenerateDesign()} 
                                                disabled={isGenerating || !aiPrompt.trim()} 
                                                className="px-6 py-3 bg-white text-blue-700 rounded-xl font-black text-sm shadow-md hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
                                            >
                                                {isGenerating ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : 'توليد النمط'}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                <section className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm space-y-5">
                                    <div className="flex justify-between items-center border-b dark:border-slate-700 pb-4">
                                        <div>
                                            <h4 className="font-black text-slate-800 dark:text-slate-100">القوالب المخصصة</h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5">مجموعات الأنماط المحفوظة مسبقاً</p>
                                        </div>
                                        <button onClick={() => setIsSaveModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100 dark:border-blue-800">
                                            <Icon name="save" className="w-3.5 h-3.5" />
                                            حفظ الحالي
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {settings.customReportTemplates.map(template => (
                                            <div key={template.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl group hover:border-blue-400 transition-all">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg shadow-inner flex-shrink-0 border dark:border-slate-700 flex items-center justify-center overflow-hidden" style={{ backgroundColor: template.settings.pageBackgroundColor }}>
                                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: template.settings.primaryColor }}></div>
                                                    </div>
                                                    <span className="font-bold text-xs truncate text-slate-700 dark:text-slate-200">{template.name}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setReportSettings(template.settings)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg" title="تطبيق"><Icon name="check-circle" className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => { showConfirmModal({ title: 'حذف قالب', message: `هل تريد حذف قالب "${template.name}"؟`, onConfirm: async () => { await updateSettings({ customReportTemplates: settings.customReportTemplates.filter(t => t.id !== template.id) }); addNotification({ title: 'تم الحذف', message: 'تم حذف القالب المخصص.', type: 'success' }); } }); }} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg" title="حذف"><Icon name="delete" className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {settings.customReportTemplates.length === 0 && (
                                            <div className="col-span-full text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                                                <Icon name="gallery" className="w-10 h-10 mx-auto text-slate-200 dark:text-slate-700 mb-2" />
                                                <p className="text-slate-400 text-xs italic">لا توجد قوالب محفوظة حالياً.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>

                    {/* Draggable & Resizable Viewport Preview */}
                    {showPreview && (
                        <div
                            className={`fixed z-[60] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-blue-100 dark:border-slate-700 overflow-hidden transition-all duration-75`}
                            style={{ 
                                left: `${previewPos.x}px`, 
                                top: `${previewPos.y}px`,
                                width: isPreviewCollapsed ? '256px' : `${previewSize.width}px`,
                                height: isPreviewCollapsed ? '48px' : `${previewSize.height}px`,
                            }}
                        >
                            {/* Window Header - The Drag Handle */}
                            <div 
                                onMouseDown={handleDragStart}
                                className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 shrink-0 select-none cursor-move`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon name="eye" className="w-5 h-5 text-blue-500" />
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">معاينة التقرير النهائي</span>
                                </div>
                                <div className="flex items-center gap-1.5" onMouseDown={e => e.stopPropagation()}>
                                    {!isPreviewCollapsed && (
                                        <div className="flex items-center gap-1.5 mr-2">
                                            <span className="text-[9px] font-mono text-slate-400 w-6">{Math.round(previewScale * 100)}%</span>
                                            <input type="range" min="0.3" max="1.5" step="0.05" value={previewScale} onChange={e => setPreviewScale(parseFloat(e.target.value))} className="w-14 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                                    >
                                        <Icon name={isPreviewCollapsed ? 'chevron-up' : 'chevron-down'} className="w-3.5 h-3.5 text-slate-500" />
                                    </button>
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                                    >
                                        <Icon name="delete" className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Viewport - Content remains fixed relative to its own scale, box clips it */}
                            {!isPreviewCollapsed && (
                                <div className="flex-1 bg-slate-100 dark:bg-slate-900 overflow-auto custom-scrollbar relative group">
                                    <div className="p-8 flex justify-center min-w-max min-h-max">
                                        <div
                                            className="origin-top transition-transform duration-200 shadow-2xl bg-white"
                                            style={{ 
                                                transform: `scale(${previewScale})`,
                                                width: '210mm',
                                                minHeight: '297mm'
                                            }}
                                        >
                                            <InspectionReport
                                                request={mockData.request as any}
                                                client={mockData.client as any}
                                                car={mockData.car as any}
                                                carMake={mockData.carMake as any}
                                                inspectionType={mockData.inspectionType as any}
                                                customFindingCategories={mockData.categories as any}
                                                predefinedFindings={mockData.predefined as any}
                                                settings={{ ...settings, reportSettings: reportSettings }}
                                                isPrintView={true}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Resize Handle - Corner */}
                                    <div 
                                        onMouseDown={handleResizeStart}
                                        className="absolute bottom-0 left-0 w-6 h-6 cursor-nwse-resize flex items-end justify-start p-0.5 z-[70] hover:bg-blue-500/10 rounded-tr-xl transition-colors"
                                    >
                                        <div className="w-3 h-3 border-l-2 border-b-2 border-slate-400 rounded-bl-sm"></div>
                                    </div>

                                    {/* Overlay Helper */}
                                    <div className="sticky bottom-4 left-0 right-0 flex justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="bg-slate-800/80 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">محتوى ثابت | إطار مرن</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!showPreview && (
                        <button
                            onClick={() => setShowPreview(true)}
                            className="fixed bottom-6 left-6 bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-50 flex items-center gap-2"
                        >
                            <Icon name="eye" className="w-6 h-6" />
                            <span className="text-sm font-bold">فتح المعاينة</span>
                        </button>
                    )}
                </div>
            </div>

            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="حفظ التصميم كقالب" size="sm">
                <div className="space-y-4">
                    <p className="text-xs text-slate-500">سيتم حفظ كافة الألوان والخطوط الحالية تحت هذا الاسم لاستخدامها لاحقاً.</p>
                    <input type="text" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl" placeholder="أدخل اسم القالب..." autoFocus />
                    <div className="flex gap-2"><Button variant="secondary" onClick={() => setIsSaveModalOpen(false)} className="flex-1">إلغاء</Button><Button onClick={handleSaveAsTemplate} className="flex-1">حفظ</Button></div>
                </div>
            </Modal>
        </div>
    );
};

export default ReportSettingsPage;
