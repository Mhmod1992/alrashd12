
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
        translatedCategories: CustomFindingCategory[],
        meta?: { mode: 'bilingual' | 'full'; langName: string; langCode: string }
    ) => void;
}

const LANGUAGES = [
    { code: 'en', name: 'English (الإنجليزية)', dir: 'ltr' },
    { code: 'ur', name: 'Urdu (الأوردو)', dir: 'rtl' },
    { code: 'hi', name: 'Hindi (الهندية)', dir: 'ltr' },
    { code: 'fil', name: 'Filipino (الفلبينية)', dir: 'ltr' },
    { code: 'bn', name: 'Bengali (البنغالية)', dir: 'ltr' },
    { code: 'fr', name: 'Français (الفرنسية)', dir: 'ltr' },
    { code: 'tr', name: 'Türkçe (التركية)', dir: 'ltr' },
    { code: 'ru', name: 'Русский (الروسية)', dir: 'ltr' },
    { code: 'es', name: 'Español (الإسبانية)', dir: 'ltr' },
    { code: 'de', name: 'Deutsch (الألمانية)', dir: 'ltr' },
    { code: 'zh', name: '中文 (الصينية المبسطة)', dir: 'ltr' },
    { code: 'id', name: 'Bahasa Indonesia (الإندونيسية)', dir: 'ltr' },
    { code: 'fa', name: 'فارسی (الفارسية)', dir: 'rtl' },
    { code: 'ml', name: 'മലയാളം (الماليالامية)', dir: 'ltr' },
    { code: 'ps', name: 'پښتو (البشتو)', dir: 'rtl' },
    { code: 'so', name: 'Soomaali (الصومالية)', dir: 'ltr' },
    { code: 'it', name: 'Italiano (الإيطالية)', dir: 'ltr' },
    { code: 'pt', name: 'Português (البرتغالية)', dir: 'ltr' },
    { code: 'ne', name: 'नेपाली (النيبالية)', dir: 'ltr' },
    { code: 'sw', name: 'Kiswahili (السواحلية)', dir: 'ltr' },
    { code: 'am', name: 'አማርኛ (الأمهرية)', dir: 'ltr' },
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
    const [translationMode, setTranslationMode] = useState<'bilingual' | 'full'>('bilingual');
    const [langSearch, setLangSearch] = useState('');
    
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
            generalNotes: req.general_notes?.filter(n => n && n.text && n.text !== '__HANDWRITTEN_REPORT_TRUE__' && !n.text.includes('__REPORT_READY_NOTIF_SENT__') && !n.text.includes('إشعار جاهزية التقرير للعميل')).reduce((acc, n) => ({ ...acc, [n.id]: n.text }), {}),
            categoryNotes: Object.entries(req.category_notes || {}).reduce((acc, [catId, notes]) => {
                (notes as Note[]).filter(n => n && n.text).forEach(n => {
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
    const applyDataToRequest = (sourceData: any, mode: 'bilingual' | 'full' = translationMode) => {
        const newRequest = JSON.parse(JSON.stringify(originalRequest));
        const newSettings = JSON.parse(JSON.stringify(originalSettings));
        
        // Base Arabic data
        const arabicData = formalizedData || buildPayload(originalRequest, categories, originalSettings);

        if (mode === 'bilingual') {
            // Apply Settings & Disclaimer in Bilingual Mode: Keep original Arabic disclaimer, attach translated text beneath
            const originalDisclaimer = originalSettings.disclaimerText;
            if (originalDisclaimer && sourceData.disclaimer && sourceData.disclaimer.trim() !== originalDisclaimer.trim()) {
                newSettings.disclaimerText = `${originalDisclaimer}\n\n---\n${sourceData.disclaimer}`;
            } else if (sourceData.disclaimer) {
                newSettings.disclaimerText = sourceData.disclaimer;
            }

            // Apply Findings: Keep Original Arabic text as primary, attach translated text beneath
            if (sourceData.findings && newRequest.structured_findings) {
                newRequest.structured_findings = newRequest.structured_findings.map((f: StructuredFinding) => {
                    const trans = sourceData.findings[f.findingId];
                    // Keep original Arabic findingName and value exactly as written
                    const origFinding = originalRequest.structured_findings?.find(of => of.findingId === f.findingId);
                    const arName = origFinding?.findingName || f.findingName;
                    const arValue = origFinding?.value || f.value;
                    if (trans) {
                        return { 
                            ...f, 
                            findingName: arName,
                            translatedFindingName: (trans.name && trans.name.trim() !== arName.trim()) ? trans.name.trim() : undefined,
                            value: arValue,
                            translatedValue: (trans.value && trans.value.trim() !== arValue.trim()) ? trans.value.trim() : undefined,
                        };
                    }
                    return { ...f, findingName: arName, value: arValue };
                });
            }

            // Apply Notes: Keep Original Arabic as primary, attach translatedText beneath
            if (sourceData.generalNotes && newRequest.general_notes) {
                newRequest.general_notes = newRequest.general_notes.map((n: Note) => {
                    const transText = sourceData.generalNotes[n.id];
                    // Keep original Arabic note text exactly as written
                    const origNote = originalRequest.general_notes?.find(on => on.id === n.id);
                    const arText = origNote?.text || n.text;
                    if (transText && transText.trim() !== arText.trim()) {
                        return { 
                            ...n, 
                            text: arText, 
                            translatedText: transText.trim(),
                            translations: {
                                ...(n.translations || {}),
                                [selectedLang]: transText.trim()
                            }
                        };
                    }
                    return { ...n, text: arText };
                });
            }

            if (sourceData.categoryNotes && newRequest.category_notes) {
                Object.keys(newRequest.category_notes).forEach(catId => {
                    newRequest.category_notes[catId] = newRequest.category_notes[catId].map((n: Note) => {
                        const key = `${catId}_${n.id}`;
                        const transText = sourceData.categoryNotes[key];
                        // Keep original category note text exactly as written
                        const origCatNotes = originalRequest.category_notes?.[catId];
                        const origNote = origCatNotes?.find(on => on.id === n.id);
                        const arText = origNote?.text || n.text;
                        if (transText && transText.trim() !== arText.trim()) {
                            return { 
                                ...n, 
                                text: arText, 
                                translatedText: transText.trim(),
                                translations: {
                                    ...(n.translations || {}),
                                    [selectedLang]: transText.trim()
                                }
                            };
                        }
                        return { ...n, text: arText };
                    });
                });
            }

            // Apply Categories: Keep original category name as defined, add translatedName
            const newCategories = categories.map(c => {
                const transName = sourceData.categories?.[c.id];
                const arName = c.name; // Keep original category name as originally written
                return {
                    ...c,
                    name: arName,
                    translatedName: (transName && transName.trim() !== arName.trim()) ? transName.trim() : undefined
                };
            });

            return { newRequest, newSettings, newCategories, direction: 'rtl' as const };
        } else {
            // Full Replacement Mode
            if (sourceData.disclaimer) newSettings.disclaimerText = sourceData.disclaimer;

            if (sourceData.findings && newRequest.structured_findings) {
                newRequest.structured_findings = newRequest.structured_findings.map((f: StructuredFinding) => {
                    const trans = sourceData.findings[f.findingId];
                    if (trans) {
                        return { 
                            ...f, 
                            findingName: trans.name, 
                            value: trans.value,
                            translatedFindingName: undefined,
                            translatedValue: undefined 
                        };
                    }
                    return f;
                });
            }

            if (sourceData.generalNotes && newRequest.general_notes) {
                newRequest.general_notes = newRequest.general_notes.map((n: Note) => {
                    if (sourceData.generalNotes[n.id]) {
                        return { 
                            ...n, 
                            text: sourceData.generalNotes[n.id],
                            translatedText: undefined 
                        };
                    }
                    return n;
                });
            }

            if (sourceData.categoryNotes && newRequest.category_notes) {
                Object.keys(newRequest.category_notes).forEach(catId => {
                    newRequest.category_notes[catId] = newRequest.category_notes[catId].map((n: Note) => {
                        const key = `${catId}_${n.id}`;
                        if (sourceData.categoryNotes[key]) {
                            return { 
                                ...n, 
                                text: sourceData.categoryNotes[key],
                                translatedText: undefined 
                            };
                        }
                        return n;
                    });
                });
            }

            const newCategories = categories.map(c => ({
                ...c,
                name: sourceData.categories?.[c.id] || c.name,
                translatedName: undefined
            }));

            const targetLangObj = LANGUAGES.find(l => l.code === selectedLang);
            const direction = (targetLangObj?.dir === 'ltr' ? 'ltr' : 'rtl') as 'rtl' | 'ltr';

            return { newRequest, newSettings, newCategories, direction };
        }
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
            5. STRICT RULE FOR "categories" (Inspection Category Names):
               - Keep each category name concise and strictly matched to its original term.
               - NEVER expand, elaborate, or add extra unmentioned components to category names.
               - For example: if the category is "البدي", keep it strictly as "البدي" or "الهيكل الخارجي". DO NOT add "والبطانات" or any extra parts.
            6. Return ONLY valid JSON with the exact same structure and keys.
            
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
            Act as a professional automotive technical translator.
            Translate the text values of the following JSON object from Arabic to ${targetLangName}.
            
            Guidelines:
            1. Use professional automotive terminology in ${targetLangName}.
            2. STRICT RULE FOR "categories" (Inspection Category Names):
               - Translate each category name strictly 1-to-1 without adding, combining, or extrapolating any extra vehicle parts.
               - If the category is "البدي" or "الهيكل", translate it strictly to "Body" (or "Vehicle Body"). NEVER translate it to "Body and Liners" or add "and Liners" / "Underbody" / "Covers" or any parts not present in the input.
               - Standard mappings for common categories: "البدي" -> "Body", "المحرك" -> "Engine", "ناقل الحركة" / "القير" -> "Transmission", "الشاصي" -> "Chassis", "الكهرباء" -> "Electrical System", "المكيف" -> "A/C & Climate".
            3. Keep all IDs and object keys exactly the same.
            4. Return ONLY valid JSON matching the exact input structure.
            
            JSON Payload:
            ${JSON.stringify(formalizedData)}
            `;

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const translatedDataJson = JSON.parse(cleanJsonString(response.text));
            
            const { newRequest, newSettings, newCategories, direction } = applyDataToRequest(translatedDataJson, translationMode);

            onTranslateComplete(newRequest, newSettings, direction, newCategories, {
                mode: translationMode,
                langName: targetLangObj?.name || targetLangName,
                langCode: selectedLang
            });
            onClose();
            addNotification({ 
                title: 'تمت الترجمة', 
                message: translationMode === 'bilingual' 
                    ? `تم تطبيق العرض ثنائي اللغة (عربي + ${targetLangObj?.name}) بنجاح` 
                    : `تم ترجمة التقرير بالكامل إلى ${targetLangObj?.name}`, 
                type: 'success' 
            });

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
        const { newRequest, newSettings, newCategories, direction } = applyDataToRequest(formalizedData, 'full');
        onTranslateComplete(newRequest, newSettings, 'rtl', newCategories, {
            mode: 'full',
            langName: 'عربي فصحى',
            langCode: 'ar'
        });
        onClose();
        addNotification({ title: 'تم', message: 'تم اعتماد الصياغة العربية الفصحى.', type: 'success' });
    };

    // --- Quick Skip: Translate directly without formalization ---
    const handleSkipToTranslate = () => {
        const payload = buildPayload(originalRequest, categories, originalSettings);
        setFormalizedData(payload);
        setStep(3);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="معالج ترجمة وتحسين التقرير" size="4xl">
            <div className="space-y-6 flex flex-col h-[75vh]">
                
                {/* Stepper Header */}
                <div className="flex justify-between items-center px-4 mb-4 border-b dark:border-slate-700 pb-4 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex flex-col items-center group cursor-pointer focus:outline-none transition-all"
                        title="العودة للإعداد واختيار النموذج"
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-all ${step === 1 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 shadow-sm' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 group-hover:scale-110'}`}>1</div>
                        <span className={`text-xs font-bold transition-colors ${step === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 group-hover:text-blue-600'}`}>الإعداد</span>
                    </button>
                    <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <button
                        type="button"
                        disabled={!formalizedData}
                        onClick={() => formalizedData && setStep(2)}
                        className={`flex flex-col items-center group focus:outline-none transition-all ${formalizedData ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                        title={formalizedData ? 'الانتقال إلى المراجعة' : 'يتطلب إتمام الصياغة أولاً'}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-all ${step === 2 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 shadow-sm' : (formalizedData ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 group-hover:scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}`}>2</div>
                        <span className={`text-xs font-bold transition-colors ${step === 2 ? 'text-blue-600 dark:text-blue-400' : (formalizedData ? 'text-slate-600 dark:text-slate-300 group-hover:text-blue-600' : 'text-slate-400')}`}>المراجعة</span>
                    </button>
                    <div className={`flex-1 h-0.5 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <button
                        type="button"
                        disabled={!formalizedData}
                        onClick={() => formalizedData && setStep(3)}
                        className={`flex flex-col items-center group focus:outline-none transition-all ${formalizedData ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                        title={formalizedData ? 'الانتقال إلى الترجمة' : 'يتطلب إتمام الصياغة أولاً'}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-all ${step === 3 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 shadow-sm' : (formalizedData ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 group-hover:scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}`}>3</div>
                        <span className={`text-xs font-bold transition-colors ${step === 3 ? 'text-blue-600 dark:text-blue-400' : (formalizedData ? 'text-slate-600 dark:text-slate-300 group-hover:text-blue-600' : 'text-slate-400')}`}>الترجمة</span>
                    </button>
                </div>

                {/* STEP 1: CONFIG */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-6 flex-1 overflow-y-auto">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                            <p className="font-bold flex items-center gap-2 mb-2">
                                <SparklesIcon className="w-5 h-5"/>
                                تحسين ذكي للنص
                            </p>
                            <p>سيقوم النظام أولاً بتحليل التقرير وتحويله إلى <strong>لغة عربية فصحى احترافية</strong>، لتجنب الأخطاء الإملائية والعامية قبل الترجمة، أو يمكنك الانتقال مباشرة للترجمة.</p>
                        </div>

                        {formalizedData && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl text-sm text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                                <div>
                                    <p className="font-bold text-xs">لديك صياغة عربية سابقة محفوظة</p>
                                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">يمكنك اختيار نموذج آخر وإعادة التحليل، أو العودة مباشرة للمراجعة دون إعادة المعالجة.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0 flex items-center gap-1 shadow-sm"
                                >
                                    العودة للمراجعة ⬅
                                </button>
                            </div>
                        )}

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

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t dark:border-slate-700">
                            <button 
                                onClick={handleSkipToTranslate} 
                                className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-4"
                            >
                                تخطي الصياغة والترجمة مباشرة للنص الأصلي
                            </button>
                            <Button onClick={handleFormalize} disabled={isProcessing} className="w-full sm:w-auto">
                                {isProcessing ? (
                                    <span className="flex items-center gap-2">
                                        <RefreshCwIcon className="w-5 h-5 animate-spin mx-auto"/>
                                        جاري المعالجة...
                                    </span>
                                ) : (
                                    formalizedData ? 'إعادة الصياغة بالنموذج المختار' : 'بدء التحليل والصياغة'
                                )}
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

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t dark:border-slate-700 flex-shrink-0">
                            <button 
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm order-2 sm:order-1"
                            >
                                <ArrowRightIcon className="w-4 h-4"/>
                                العودة للخطوة 1 (تغيير النموذج / إعادة الصياغة)
                            </button>

                            <div className="flex items-center gap-2.5 order-1 sm:order-2">
                                <button 
                                    onClick={handleUseFormalizedArabic}
                                    className="flex-1 sm:flex-none px-4 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group text-sm font-bold text-slate-700 dark:text-slate-200"
                                >
                                    <PrinterIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                    <span>طباعة (عربي فقط)</span>
                                </button>

                                <button 
                                    onClick={() => setStep(3)}
                                    className="flex-1 sm:flex-none px-5 py-2.5 border-2 border-blue-500 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 group shadow-md text-sm font-bold"
                                >
                                    <SparklesIcon className="w-4 h-4 text-white" />
                                    <span>اعتماد ومتابعة للترجمة</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: TRANSLATE */}
                {step === 3 && (
                    <div className="animate-fade-in space-y-6 flex-1 overflow-y-auto custom-scrollbar p-1">
                        {/* Target Language Selection */}
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                                    1. اختر اللغة المستهدفة للترجمة ({LANGUAGES.length} لغة متاحة)
                                </label>
                                <div className="relative w-full sm:w-56">
                                    <input
                                        type="text"
                                        placeholder="بحث عن لغة..."
                                        value={langSearch}
                                        onChange={(e) => setLangSearch(e.target.value)}
                                        className="w-full text-xs py-1.5 px-3 ps-8 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-1 focus:ring-purple-500"
                                    />
                                    <Icon name="search" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1 border dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                                {LANGUAGES.filter(lang => 
                                    lang.name.toLowerCase().includes(langSearch.toLowerCase()) || 
                                    lang.code.toLowerCase().includes(langSearch.toLowerCase())
                                ).map(lang => (
                                    <label key={lang.code} className={`flex items-center p-2.5 border rounded-lg cursor-pointer transition-all ${selectedLang === lang.code ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-400 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 bg-white/70 dark:bg-slate-800/60'}`}>
                                        <input 
                                            type="radio" 
                                            name="target_lang" 
                                            value={lang.code}
                                            checked={selectedLang === lang.code}
                                            onChange={(e) => setSelectedLang(e.target.value)}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div className="mr-2 overflow-hidden">
                                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{lang.name}</span>
                                            <span className="block text-[9px] text-slate-500">{lang.dir === 'rtl' ? 'يمين لليسار' : 'يسار لليمين'}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Translation Display Mode Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">2. اختر نمط عرض التقرير</label>
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    موصى به لتسهيل التفاهم والشرح
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Option 1: Bilingual Mode (Recommended) */}
                                <div 
                                    onClick={() => setTranslationMode('bilingual')}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${translationMode === 'bilingual' ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'}`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    checked={translationMode === 'bilingual'} 
                                                    onChange={() => setTranslationMode('bilingual')} 
                                                    className="w-4 h-4 text-blue-600" 
                                                />
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                    ثنائي اللغة (عربي + الترجمة بالأسفل)
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                                                مستحسن
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                            يبقى النص العربي الأصلي كما كُتب ظاهراً، وتحته مباشرة الترجمة في الملاحظات والبنود. تم استخدام الفصحى لضبط دقة الترجمة فقط.
                                        </p>
                                    </div>
                                    
                                    {/* Visual preview box */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-[11px] space-y-1 shadow-inner">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span>
                                            تهريب زيت خفيف من صوفة القير
                                        </div>
                                        <div className="text-slate-500 dark:text-slate-400 italic text-[10px] flex items-center gap-1 ps-3" style={{ direction: 'ltr' }}>
                                            <span className="text-blue-500 font-bold not-italic">↳</span> Minor oil seep from transmission seal
                                        </div>
                                    </div>
                                </div>

                                {/* Option 2: Full Replacement Mode */}
                                <div 
                                    onClick={() => setTranslationMode('full')}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${translationMode === 'full' ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-900/20 shadow-md ring-1 ring-purple-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'}`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    checked={translationMode === 'full'} 
                                                    onChange={() => setTranslationMode('full')} 
                                                    className="w-4 h-4 text-purple-600" 
                                                />
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                    استبدال كامل (باللغة المترجمة فقط)
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                            يتم تحويل كامل التقرير إلى اللغة المختارة فقط وعكس اتجاه الصفحة. مناسب للعملاء أو الجهات التي لا تقرأ العربية إطلاقاً.
                                        </p>
                                    </div>

                                    {/* Visual preview box */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-[11px] shadow-inner">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5" style={{ direction: 'ltr' }}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>
                                            Minor oil seep from transmission seal
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setStep(1)} 
                                    className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    الخطوة 1 (النماذج)
                                </button>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <button 
                                    type="button"
                                    onClick={() => setStep(2)} 
                                    className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-bold flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <ArrowRightIcon className="w-4 h-4"/> عودة للمراجعة (الخطوة 2)
                                </button>
                            </div>
                            <Button onClick={handleTranslate} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700 text-white min-w-[170px]">
                                {isProcessing ? (
                                    <span className="flex items-center gap-2">
                                        <RefreshCwIcon className="w-4 h-4 animate-spin"/>
                                        جاري الترجمة...
                                    </span>
                                ) : (
                                    translationMode === 'bilingual' ? 'تطبيق العرض ثنائي اللغة' : 'ترجمة وعرض التقرير'
                                )}
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </Modal>
    );
};

export default ReportTranslationModal;
