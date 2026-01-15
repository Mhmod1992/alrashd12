
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { InspectionRequest, Note, StructuredFinding, CustomFindingCategory, Notification, ReportSettings } from '../types';
import { cleanJsonString } from '../lib/utils';
import RefreshCwIcon from './icons/RefreshCwIcon';
import SparklesIcon from './icons/SparklesIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ArrowRightIcon from './icons/ArrowRightIcon';
import PrinterIcon from './icons/PrinterIcon';
import EditIcon from './icons/EditIcon';

interface ReportTranslationModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalRequest: InspectionRequest;
    originalSettings: ReportSettings;
    categories: CustomFindingCategory[];
    apiKey: string | null;
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    onTranslateComplete: (
        translatedRequest: InspectionRequest, 
        translatedSettings: ReportSettings, 
        direction: 'rtl' | 'ltr', 
        translatedCategories: CustomFindingCategory[]
    ) => void;
}

const LANGUAGES = [
    { code: 'en', name: 'English (الإنجليزية)', dir: 'ltr' },
    { code: 'hi', name: 'Hindi (الهندية)', dir: 'ltr' },
    { code: 'ur', name: 'Urdu (الأوردو)', dir: 'rtl' },
    { code: 'fil', name: 'Filipino (الفلبينية)', dir: 'ltr' },
    { code: 'bn', name: 'Bengali (البنغالية)', dir: 'ltr' },
];

const AI_MODELS = [
    { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite (سريع جداً)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (المستحسن - متوازن)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (الأكثر دقة)' },
];

const ReportTranslationModal: React.FC<ReportTranslationModalProps> = ({
    isOpen, onClose, originalRequest, originalSettings, categories, apiKey, addNotification, onTranslateComplete
}) => {
    // Wizard State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // Step 1: Config
    const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
    
    // Step 2: Formalization Data
    // We store the raw JSON structure returned by AI here to allow editing
    const [formalizedData, setFormalizedData] = useState<any>(null);
    
    // Step 3: Translation Config
    const [selectedLang, setSelectedLang] = useState('en');
    
    const [isProcessing, setIsProcessing] = useState(false);

    // Helper to build payload from request
    const buildPayload = (req: InspectionRequest, cats: CustomFindingCategory[], settings: ReportSettings) => {
        return {
            disclaimer: settings.disclaimerText,
            categories: cats.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.name }), {} as Record<string, string>),
            findings: req.structured_findings?.reduce((acc, f) => ({
                ...acc,
                [f.findingId]: { name: f.findingName, value: f.value } 
            }), {}),
            generalNotes: req.general_notes?.reduce((acc, n) => ({ ...acc, [n.id]: n.text }), {}),
            categoryNotes: Object.entries(req.category_notes || {}).reduce((acc, [catId, notes]) => {
                (notes as Note[]).forEach(n => {
                    acc[`${catId}_${n.id}`] = n.text;
                });
                return acc;
            }, {} as Record<string, string>)
        };
    };

    // Update function for editing the formalized data
    const handleUpdateData = (section: string, key: string, value: any, subKey?: string) => {
        setFormalizedData((prev: any) => {
            if (!prev) return null;
            const newData = { ...prev };
            
            if (section === 'disclaimer') {
                newData.disclaimer = value;
            } else if (section === 'findings' && subKey) {
                // Update specific part of finding (name or value)
                newData.findings = {
                    ...newData.findings,
                    [key]: { ...newData.findings[key], [subKey]: value }
                };
            } else {
                // General update for flat maps (notes, categories)
                newData[section] = {
                    ...newData[section],
                    [key]: value
                };
            }
            return newData;
        });
    };

    // Helper to apply data back to request
    const applyDataToRequest = (sourceData: any) => {
        const newRequest = JSON.parse(JSON.stringify(originalRequest));
        const newSettings = JSON.parse(JSON.stringify(originalSettings));
        
        // Apply Settings
        if (sourceData.disclaimer) newSettings.disclaimerText = sourceData.disclaimer;

        // Apply Findings
        if (sourceData.findings) {
            newRequest.structured_findings = newRequest.structured_findings.map((f: StructuredFinding) => {
                const trans = sourceData.findings[f.findingId];
                if (trans) return { ...f, findingName: trans.name, value: trans.value };
                return f;
            });
        }

        // Apply Notes
        if (sourceData.generalNotes) {
            newRequest.general_notes = newRequest.general_notes.map((n: Note) => {
                if (sourceData.generalNotes[n.id]) return { ...n, text: sourceData.generalNotes[n.id] };
                return n;
            });
        }
        if (sourceData.categoryNotes && newRequest.category_notes) {
            Object.keys(newRequest.category_notes).forEach(catId => {
                newRequest.category_notes[catId] = newRequest.category_notes[catId].map((n: Note) => {
                    const key = `${catId}_${n.id}`;
                    if (sourceData.categoryNotes[key]) return { ...n, text: sourceData.categoryNotes[key] };
                    return n;
                });
            });
        }

        // Apply Categories
        const newCategories = categories.map(c => ({
            ...c,
            name: sourceData.categories?.[c.id] || c.name
        }));

        return { newRequest, newSettings, newCategories };
    };

    // --- PHASE 1: FORMALIZE ARABIC ---
    const handleFormalize = async () => {
        if (!apiKey) {
            addNotification({ title: 'خطأ', message: 'مفتاح API غير موجود.', type: 'error' });
            return;
        }

        setIsProcessing(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const payload = buildPayload(originalRequest, categories, originalSettings);

            const prompt = `
            Act as a professional automotive report editor.
            Your task is to rewrite the values in the following JSON to be in "Modern Standard Arabic" (الفصحى).
            
            Guidelines:
            1. Correct spelling and grammar errors.
            2. Make the tone professional and technical.
            3. Keep the meaning accurate.
            4. Do NOT translate to English yet, keep it Arabic.
            5. Return ONLY valid JSON with the exact same structure and keys.
            
            JSON Payload:
            ${JSON.stringify(payload)}
            `;

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const cleanedResponse = cleanJsonString(response.text);
            const data = JSON.parse(cleanedResponse);
            setFormalizedData(data);
            setStep(2); // Move to review step
            addNotification({ title: 'تمت الصياغة', message: 'تم تحسين النص العربي. يرجى المراجعة.', type: 'success' });

        } catch (error) {
            console.error(error);
            addNotification({ title: 'خطأ', message: 'فشلت عملية الصياغة.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // --- PHASE 2: TRANSLATE TO TARGET ---
    const handleTranslate = async () => {
        if (!apiKey || !formalizedData) return;

        setIsProcessing(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const targetLangObj = LANGUAGES.find(l => l.code === selectedLang);
            const targetLangName = targetLangObj?.name || 'English';

            const prompt = `
            Act as a professional translator.
            Translate the values of the following JSON object from Arabic to ${targetLangName}.
            
            Guidelines:
            1. Use professional automotive terminology in the target language.
            2. Keep all IDs/Keys exactly the same.
            3. Return ONLY valid JSON.
            
            JSON Payload:
            ${JSON.stringify(formalizedData)}
            `;

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const translatedDataJson = JSON.parse(cleanJsonString(response.text));
            
            const { newRequest, newSettings, newCategories } = applyDataToRequest(translatedDataJson);
            const direction = targetLangObj?.dir === 'ltr' ? 'ltr' : 'rtl';

            onTranslateComplete(newRequest, newSettings, direction as any, newCategories);
            onClose();
            addNotification({ title: 'تمت الترجمة', message: `تم ترجمة التقرير إلى ${targetLangObj?.name}`, type: 'success' });

        } catch (error) {
            console.error(error);
            addNotification({ title: 'خطأ', message: 'فشلت عملية الترجمة.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Option: Use Formalized Arabic directly ---
    const handleUseFormalizedArabic = () => {
        if (!formalizedData) return;
        const { newRequest, newSettings, newCategories } = applyDataToRequest(formalizedData);
        onTranslateComplete(newRequest, newSettings, 'rtl', newCategories);
        onClose();
        addNotification({ title: 'تم', message: 'تم اعتماد الصياغة العربية الفصحى.', type: 'success' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="معالج ترجمة وتحسين التقرير" size="4xl">
            <div className="space-y-6 flex flex-col h-[75vh]">
                
                {/* Stepper Header */}
                <div className="flex justify-between items-center px-4 mb-4 border-b dark:border-slate-700 pb-4 flex-shrink-0">
                    <div className={`flex flex-col items-center ${step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 1 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>1</div>
                        <span className="text-xs font-bold">الإعداد</span>
                    </div>
                    <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <div className={`flex flex-col items-center ${step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 2 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>2</div>
                        <span className="text-xs font-bold">المراجعة</span>
                    </div>
                    <div className={`flex-1 h-0.5 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <div className={`flex flex-col items-center ${step >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= 3 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>3</div>
                        <span className="text-xs font-bold">الترجمة</span>
                    </div>
                </div>

                {/* STEP 1: CONFIG */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-6 flex-1 overflow-y-auto">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                            <p className="font-bold flex items-center gap-2 mb-2">
                                <SparklesIcon className="w-5 h-5"/>
                                تحسين ذكي للنص
                            </p>
                            <p>سيقوم النظام أولاً بتحليل التقرير وتحويله إلى <strong>لغة عربية فصحى احترافية</strong>، لتجنب الأخطاء الإملائية والعامية قبل الترجمة.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">اختر نموذج الذكاء الاصطناعي</label>
                            <div className="space-y-2">
                                {AI_MODELS.map(model => (
                                    <label key={model.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${selectedModel === model.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <input 
                                            type="radio" 
                                            name="ai_model" 
                                            value={model.id}
                                            checked={selectedModel === model.id}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="mr-3 text-sm font-medium">{model.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleFormalize} disabled={isProcessing} className="w-full sm:w-auto">
                                {isProcessing ? <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto"/> : 'بدء التحليل والصياغة'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: ARABIC REVIEW & EDIT */}
                {step === 2 && formalizedData && (
                    <div className="animate-fade-in flex flex-col h-full">
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-3 rounded-lg mb-4 flex items-center gap-3 flex-shrink-0">
                            <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full text-green-600 dark:text-green-300">
                                <CheckCircleIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-green-800 dark:text-green-200">تمت الصياغة بنجاح</h3>
                                <p className="text-xs text-green-700 dark:text-green-300">يمكنك تعديل أي نص في الحقول أدناه قبل المتابعة.</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-6">
                            
                            {/* Disclaimer */}
                            {formalizedData.disclaimer && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase">إخلاء المسؤولية</h4>
                                    <textarea 
                                        value={formalizedData.disclaimer} 
                                        onChange={(e) => handleUpdateData('disclaimer', '', e.target.value)}
                                        className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                    />
                                </div>
                            )}

                            {/* General Notes */}
                            {formalizedData.generalNotes && Object.keys(formalizedData.generalNotes).length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-700 p-2 rounded">ملاحظات عامة</h4>
                                    {Object.entries(formalizedData.generalNotes).map(([id, text]: [string, any]) => (
                                        <div key={id} className="relative">
                                            <textarea 
                                                value={text} 
                                                onChange={(e) => handleUpdateData('generalNotes', id, e.target.value)}
                                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500"
                                                rows={2}
                                            />
                                            <EditIcon className="w-4 h-4 text-slate-300 absolute left-2 bottom-2 pointer-events-none" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Category Notes */}
                            {formalizedData.categoryNotes && Object.keys(formalizedData.categoryNotes).length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-700 p-2 rounded">ملاحظات الأقسام</h4>
                                    {Object.entries(formalizedData.categoryNotes).map(([key, text]: [string, any]) => {
                                        // key format is catId_noteId. Let's try to find category name
                                        const catId = key.split('_')[0];
                                        const catName = categories.find(c => c.id === catId)?.name || 'قسم';
                                        return (
                                            <div key={key} className="relative group">
                                                <label className="block text-[10px] text-blue-600 mb-1 font-bold">{catName}</label>
                                                <textarea 
                                                    value={text} 
                                                    onChange={(e) => handleUpdateData('categoryNotes', key, e.target.value)}
                                                    className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500"
                                                    rows={2}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                             {/* Findings */}
                             {formalizedData.findings && Object.keys(formalizedData.findings).length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-700 p-2 rounded">نتائج الفحص</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(formalizedData.findings).map(([id, data]: [string, any]) => (
                                            <div key={id} className="p-3 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                                <div className="mb-2">
                                                    <label className="block text-[10px] text-slate-400">البند</label>
                                                    <input 
                                                        type="text" 
                                                        value={data.name} 
                                                        onChange={(e) => handleUpdateData('findings', id, e.target.value, 'name')}
                                                        className="w-full p-1.5 bg-white dark:bg-slate-800 border rounded text-sm font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-400">الحالة/القيمة</label>
                                                    <input 
                                                        type="text" 
                                                        value={data.value} 
                                                        onChange={(e) => handleUpdateData('findings', id, e.target.value, 'value')}
                                                        className="w-full p-1.5 bg-white dark:bg-slate-800 border rounded text-sm text-blue-600"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t dark:border-slate-700 flex-shrink-0">
                            <button 
                                onClick={handleUseFormalizedArabic}
                                className="p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all flex flex-col items-center text-center group"
                            >
                                <PrinterIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-500 mb-1" />
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">طباعة (عربي فقط)</span>
                            </button>

                            <button 
                                onClick={() => setStep(3)}
                                className="p-3 border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex flex-col items-center text-center group shadow-md"
                            >
                                <Icon name="sparkles" className="w-6 h-6 text-blue-600 mb-1" />
                                <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">اعتماد وترجمة</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: TRANSLATE */}
                {step === 3 && (
                    <div className="animate-fade-in space-y-6 flex-1 overflow-y-auto">
                        <div>
                            <label className="block text-sm font-medium mb-3">اختر اللغة المستهدفة للطباعة</label>
                            <div className="grid grid-cols-2 gap-3">
                                {LANGUAGES.map(lang => (
                                    <label key={lang.code} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${selectedLang === lang.code ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500' : 'dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <input 
                                            type="radio" 
                                            name="target_lang" 
                                            value={lang.code}
                                            checked={selectedLang === lang.code}
                                            onChange={(e) => setSelectedLang(e.target.value)}
                                            className="w-4 h-4 text-purple-600"
                                        />
                                        <div className="mr-3">
                                            <span className="block text-sm font-bold">{lang.name}</span>
                                            <span className="block text-[10px] text-slate-500">{lang.dir === 'rtl' ? 'من اليمين لليسار' : 'من اليسار لليمين'}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t dark:border-slate-700">
                            <button onClick={() => setStep(2)} className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center gap-1">
                                <ArrowRightIcon className="w-4 h-4"/> عودة للمراجعة
                            </button>
                            <Button onClick={handleTranslate} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700 text-white min-w-[150px]">
                                {isProcessing ? <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto"/> : 'ترجمة وعرض التقرير'}
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </Modal>
    );
};

export default ReportTranslationModal;
