import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InspectionRequest, Note, CustomFindingCategory, PredefinedFinding, HighlightColor, Notification, ConfirmModalState } from '../types';
import Icon from './Icon';
import Button from './Button';
import XIcon from './icons/XIcon';
import EditIcon from './icons/EditIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { GoogleGenAI, Type } from "@google/genai";
import Modal from './Modal';
import ArrowRightIcon from './icons/ArrowRightIcon';


interface ReviewModeModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InspectionRequest;
    categories: CustomFindingCategory[];
    predefinedFindings: PredefinedFinding[];
    onUpdateNote: (note: Note, categoryId: string | 'general') => void;
    onUpdateFinding: (findingId: string, value: string) => void;
    onDelete: (item: ReviewItem) => void;
    apiKey: string | null;
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    showConfirmModal: (modalState: Omit<ConfirmModalState, 'isOpen'>) => void;
}

export interface ReviewItem {
    id: string;
    uniqueKey: string;
    type: 'note' | 'finding';
    categoryId: string | 'general';
    categoryName: string;
    title: string;
    content: string;
    image?: string;
    isImageRef?: boolean;
    findingOptions?: string[];
    severity: 'good' | 'bad' | 'neutral';
    highlightColor?: HighlightColor;
}

type AiSuggestion = {
    uniqueKey: string;
    title: string;
    categoryName: string;
    originalContent: string;
    correctedContent: string;
    approved: boolean;
};

const highlightColors: Record<HighlightColor, { name: string; bg: string; ring: string }> = {
    yellow: { name: 'تنبيه', bg: 'bg-yellow-400', ring: 'ring-yellow-500' },
    red: { name: 'خطر', bg: 'bg-red-500', ring: 'ring-red-600' },
    green: { name: 'تأكيد', bg: 'bg-green-500', ring: 'ring-green-600' },
    blue: { name: 'معلومات', bg: 'bg-blue-500', ring: 'ring-blue-600' },
};

const AnimatedText: React.FC<{ text: string; isActive: boolean; isTitle?: boolean }> = ({ text, isActive, isTitle = false }) => {
    if (!text) return isTitle ? null : <span className="italic opacity-50">لا يوجد محتوى...</span>;
    
    const words = useMemo(() => text.split(' ').filter(w => w.length > 0), [text]);
    const [highlightCount, setHighlightCount] = useState(0);

    useEffect(() => {
        let intervalId: number | undefined;

        if (isActive && words.length > 0) {
            setHighlightCount(0);
            
            intervalId = window.setInterval(() => {
                setHighlightCount(prevCount => {
                    if (prevCount >= words.length) {
                        clearInterval(intervalId);
                        return prevCount;
                    }
                    return prevCount + 1;
                });
            }, 150);
        } else {
            setHighlightCount(0);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isActive, words]);

    return (
        <span className={`leading-relaxed dir-rtl break-words ${isTitle ? 'block' : ''}`}>
            {words.map((word, index) => (
                <span
                    key={index}
                    className={`
                        inline-block px-0.5 rounded-[2px] transition-colors duration-300
                        ${index < highlightCount
                            ? 'bg-yellow-400 text-slate-900 shadow-[0_0_5px_rgba(250,204,21,0.5)]'
                            : 'bg-transparent text-inherit'}
                    `}
                >
                    {word}&nbsp;
                </span>
            ))}
        </span>
    );
};

const ReviewModeModal: React.FC<ReviewModeModalProps> = ({ 
    isOpen, 
    onClose, 
    request, 
    categories, 
    predefinedFindings,
    onUpdateNote,
    onUpdateFinding,
    onDelete,
    apiKey,
    addNotification,
    showConfirmModal
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editColor, setEditColor] = useState<HighlightColor | undefined>(undefined);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPolishing, setIsPolishing] = useState(false);
    const [isFullReviewing, setIsFullReviewing] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(null);
    
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const listContainerRef = useRef<HTMLDivElement>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    const getSeverity = (text: string): 'good' | 'bad' | 'neutral' => {
        const t = text.toLowerCase();
        const badKeywords = ['تالف', 'مرشوش', 'مصدوم', 'يحتاج', 'عطل', 'تهريب', 'كسر', 'خدش', 'ضعيف', 'صوت', 'تأخير', 'fail', 'bad', 'damage', 'scratch', 'يوجد'];
        const goodKeywords = ['سليم', 'وكالة', 'نظيف', 'ممتاز', 'جيدة', 'good', 'pass', 'excellent', 'clean'];
        
        if (badKeywords.some(w => t.includes(w))) return 'bad';
        if (goodKeywords.some(w => t.includes(w))) return 'good';
        return 'neutral';
    };

    const displayedItems: ReviewItem[] = useMemo(() => {
        if (!request) return [];
        const result: ReviewItem[] = [];

        (request.general_notes || []).forEach(note => {
            result.push({
                id: note.id,
                uniqueKey: `note-gen-${note.id}`,
                type: 'note',
                categoryId: 'general',
                categoryName: 'ملاحظات عامة',
                title: 'ملاحظة عامة',
                content: note.text,
                image: note.image,
                isImageRef: false,
                highlightColor: note.highlightColor,
                severity: getSeverity(note.text) === 'good' ? 'neutral' : getSeverity(note.text)
            });
        });

        categories.forEach(cat => {
            const catNotes = request.category_notes?.[cat.id] || [];
            catNotes.forEach(note => {
                result.push({
                    id: note.id,
                    uniqueKey: `note-${cat.id}-${note.id}`,
                    type: 'note',
                    categoryId: cat.id,
                    categoryName: cat.name,
                    title: 'ملاحظة',
                    content: note.text,
                    image: note.image,
                    isImageRef: false,
                    highlightColor: note.highlightColor,
                    severity: getSeverity(note.text) === 'good' ? 'neutral' : getSeverity(note.text)
                });
            });

            const catFindings = request.structured_findings?.filter(f => f.categoryId === cat.id) || [];
            catFindings.forEach(finding => {
                const predefined = predefinedFindings.find(pf => pf.id === finding.findingId);
                result.push({
                    id: finding.findingId,
                    uniqueKey: `find-${finding.findingId}`,
                    type: 'finding',
                    categoryId: cat.id,
                    categoryName: cat.name,
                    title: finding.findingName,
                    content: finding.value,
                    image: predefined?.reference_image,
                    isImageRef: true,
                    findingOptions: predefined?.options,
                    severity: getSeverity(finding.value)
                });
            });
        });

        return result;
    }, [request, categories, predefinedFindings]);

    const reviewCategories = useMemo(() => {
        const unique = new Map<string, string>();
        displayedItems.forEach(item => {
            if (!unique.has(item.categoryId)) {
                unique.set(item.categoryId, item.categoryName);
            }
        });
        return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
    }, [displayedItems]);

    useEffect(() => {
        if (isOpen) {
            setEditingId(null);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }, [isOpen]);

    const handleNext = () => setActiveIndex((prev) => Math.min(prev + 1, displayedItems.length - 1));
    const handlePrev = () => setActiveIndex((prev) => Math.max(prev - 1, 0));

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (editingId !== null || aiSuggestions) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); handleNext(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); handlePrev(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, displayedItems.length, editingId, aiSuggestions]);

    useEffect(() => {
        if (displayedItems[activeIndex]) {
            const uniqueKey = displayedItems[activeIndex].uniqueKey;
            const element = itemRefs.current.get(uniqueKey);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeIndex, displayedItems]);

    const scrollToCategory = (catId: string) => {
        const index = displayedItems.findIndex(item => item.categoryId === catId);
        if (index !== -1) {
            setActiveIndex(index);
        }
    };

    const handleStartEdit = (item: ReviewItem) => {
        setEditingId(item.uniqueKey);
        setEditValue(item.content);
        setEditColor(item.highlightColor);
        const idx = displayedItems.findIndex(i => i.uniqueKey === item.uniqueKey);
        if (idx !== -1) setActiveIndex(idx);
    };

    const handleSaveEdit = (item: ReviewItem) => {
        if (item.type === 'note') {
            const noteUpdate = { 
                id: item.id, 
                text: editValue, 
                image: item.isImageRef ? undefined : item.image,
                highlightColor: editColor
            } as Note;
            onUpdateNote(noteUpdate, item.categoryId);
        } else if (item.type === 'finding') { // Explicitly handle finding
            onUpdateFinding(item.id, editValue);
        }
        setEditingId(null);
    };

    const handleAiPolish = async () => {
        if (!apiKey || !editValue.trim()) return;
        setIsPolishing(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `أعد صياغة نص تقرير فحص السيارة التالي ليكون احترافياً وموجزاً باللغة العربية، مع تصحيح الأخطاء الإملائية. لا تضف أي مقدمات أو خاتمة. النص: "${editValue}"`;
            const response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt });
            if (response.text) setEditValue(response.text.trim());
        } catch (error) {
            console.error("AI Polish Error", error);
        } finally {
            setIsPolishing(false);
        }
    };

    const handleFullAiReview = async () => {
        if (!apiKey || displayedItems.length === 0) return;
        setIsFullReviewing(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const reportData = displayedItems.map(item => ({ uniqueKey: item.uniqueKey, content: item.content, type: item.type }));
            const prompt = `You are a technical quality auditor for car inspection reports. I have attached a list of notes and findings. Your task is to correct spelling mistakes, improve the wording to be professional and technical, and standardize the report language in Arabic. Do not change the technical meaning (e.g., if there's a fault, keep it as a fault but phrase it better). Return the result as a JSON array of objects, each containing only 'uniqueKey' and 'correctedContent'. Data: ${JSON.stringify(reportData)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                uniqueKey: { type: Type.STRING },
                                correctedContent: { type: Type.STRING }
                            },
                            required: ["uniqueKey", "correctedContent"]
                        }
                    }
                }
            });

            const corrections = JSON.parse(response.text || '[]');
            if (corrections.length === 0) {
                addNotification({ title: 'تدقيق مكتمل', message: 'لم يجد الذكاء الاصطناعي أي اقتراحات.', type: 'info' });
                return;
            }

            const suggestions: AiSuggestion[] = corrections
                .map((cor: any) => {
                    const item = displayedItems.find(i => i.uniqueKey === cor.uniqueKey);
                    if (item && cor.correctedContent.trim() !== item.content.trim()) {
                        return {
                            uniqueKey: item.uniqueKey,
                            title: item.title,
                            categoryName: item.categoryName,
                            originalContent: item.content,
                            correctedContent: cor.correctedContent.trim(),
                            approved: true, // Default to approved
                        };
                    }
                    return null;
                })
                .filter((s: AiSuggestion | null): s is AiSuggestion => s !== null);

            if (suggestions.length > 0) {
                setAiSuggestions(suggestions);
            } else {
                addNotification({ title: 'تدقيق مكتمل', message: 'لم يجد الذكاء الاصطناعي أي اقتراحات لتحسين النص.', type: 'info' });
            }

        } catch (error) {
            console.error("Full AI Review Error", error);
            addNotification({ title: 'خطأ', message: 'فشل التدقيق الذكي. قد تكون هناك مشكلة في الاتصال.', type: 'error' });
        } finally {
            setIsFullReviewing(false);
        }
    };
    
    // --- Handlers for AI Review Confirmation Modal ---
    const handleToggleSuggestionApproval = (uniqueKey: string) => {
        setAiSuggestions(prev => prev ? prev.map(s => s.uniqueKey === uniqueKey ? { ...s, approved: !s.approved } : s) : null);
    };

    const handleToggleAllSuggestions = (approveAll: boolean) => {
        setAiSuggestions(prev => prev ? prev.map(s => ({ ...s, approved: approveAll })) : null);
    };

    const handleApplySelectedSuggestions = () => {
        if (!aiSuggestions) return;
        const approvedSuggestions = aiSuggestions.filter(s => s.approved);

        if (approvedSuggestions.length === 0) {
            addNotification({ title: 'لم يتم التحديد', message: 'الرجاء تحديد الاقتراحات التي تريد تطبيقها.', type: 'info' });
            return;
        }

        approvedSuggestions.forEach(suggestion => {
            const item = displayedItems.find(i => i.uniqueKey === suggestion.uniqueKey);
            if (item) {
                if (item.type === 'note') {
                    const originalNote = (item.categoryId === 'general' ? request.general_notes : request.category_notes?.[item.categoryId])?.find(n => n.id === item.id);
                    if(originalNote) {
                        onUpdateNote({ ...originalNote, text: suggestion.correctedContent }, item.categoryId);
                    }
                } else {
                    onUpdateFinding(item.id, suggestion.correctedContent);
                }
            }
        });
        
        addNotification({ title: 'نجاح', message: `تم تطبيق ${approvedSuggestions.length} تعديلات بنجاح.`, type: 'success' });
        setAiSuggestions(null);
    };
    
    const handleCloseAiReviewModal = () => setAiSuggestions(null);

    // --- NEW: Centralized delete handler within ReviewModeModal with confirmation ---
    const handleDeleteWithConfirmation = (item: ReviewItem) => {
        showConfirmModal({
            title: `حذف ${item.type === 'note' ? 'الملاحظة' : 'البند'}: ${item.title}`,
            message: `هل أنت متأكد من حذف هذا ${item.type === 'note' ? 'الملاحظة' : 'البند'}؟ لا يمكن التراجع عن هذا الإجراء.`,
            onConfirm: () => {
                onDelete(item); // Call the prop which will perform the actual deletion
                addNotification({ title: 'نجاح', message: `تم طلب حذف ${item.type === 'note' ? 'الملاحظة' : 'البند'}.`, type: 'success' });
            }
        });
    };

    // --- Memos for Checkbox state ---
    const allSuggestionsApproved = useMemo(() => aiSuggestions?.every(s => s.approved) ?? false, [aiSuggestions]);
    const someSuggestionsApproved = useMemo(() => aiSuggestions?.some(s => s.approved) ?? false, [aiSuggestions]);
    const numApproved = useMemo(() => aiSuggestions?.filter(s => s.approved).length || 0, [aiSuggestions]);

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = someSuggestionsApproved && !allSuggestionsApproved;
        }
    }, [someSuggestionsApproved, allSuggestionsApproved]);


    if (!isOpen) return null;
    const currentItem = displayedItems[activeIndex];

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-xl flex flex-col animate-fade-in" dir="rtl">
            
            <div className="flex flex-col bg-slate-900/80 backdrop-blur-md z-20 sticky top-0 shadow-lg border-b border-white/10 flex-shrink-0">
                <div className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-500/20"><Icon name="check-circle" className="w-5 h-5"/></span>
                            مراجعة الجودة والتدقيق
                        </h2>
                        {apiKey && (
                            <button 
                                onClick={handleFullAiReview}
                                disabled={isFullReviewing || displayedItems.length === 0}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all ${isFullReviewing ? 'bg-purple-600/50 text-white animate-pulse' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95'}`}
                            >
                                {isFullReviewing ? <RefreshCwIcon className="w-4 h-4 animate-spin"/> : <SparklesIcon className="w-4 h-4"/>}
                                {isFullReviewing ? 'جاري التدقيق الشامل...' : 'تدقيق ذكي شامل (AI)'}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-white/5">
                            بند {activeIndex + 1} من {displayedItems.length}
                        </span>
                        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all transform active:scale-90">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {isFullReviewing && (
                <div className="absolute inset-x-0 top-16 bottom-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-4 bg-purple-500/10 rounded-full flex items-center justify-center">
                            <SparklesIcon className="w-8 h-8 text-purple-400 animate-pulse" />
                        </div>
                    </div>
                    <h3 className="2xl font-black text-white mb-2">جاري التدقيق الذكي...</h3>
                    <p className="text-slate-400 font-medium">يقوم Gemini بمراجعة كافة النصوص وتحسينها الآن</p>
                </div>
            )}

            <div 
                ref={listContainerRef} 
                className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar scroll-smooth bg-slate-900/50 pb-48"
            >
                <div className="max-w-3xl mx-auto space-y-10">
                    {displayedItems.length === 0 ? (
                        <div className="text-center py-20 text-slate-500"><CheckCircleIcon className="w-16 h-16 mx-auto mb-4 opacity-20" /><p className="text-lg">لا توجد بيانات للمراجعة في هذا الطلب.</p></div>
                    ) : (
                        displayedItems.map((item, index) => {
                            const isEditing = editingId === item.uniqueKey;
                            const isActive = index === activeIndex;
                            let severityColor = 'blue';
                            if (item.severity === 'bad') severityColor = 'red';
                            else if (item.severity === 'good') severityColor = 'green';
                            const noteBg = !isEditing && item.highlightColor ? `bg-${item.highlightColor}-500/10` : 'bg-slate-800/40';
                            const activeStyles = isActive ? `scale-100 z-20 opacity-100 ring-2 ring-${severityColor}-500 shadow-[0_0_40px_-10px_rgba(var(--tw-shadow-color),0.4)] shadow-${severityColor}-500` : 'scale-95 z-0 opacity-40 blur-[1px] grayscale-[50%]';

                            return (
                                <div key={item.uniqueKey} ref={(el) => { if (el) itemRefs.current.set(item.uniqueKey, el); }} onClick={() => setActiveIndex(index)} className={`relative rounded-2xl overflow-hidden border border-white/10 ${noteBg} transition-all duration-500 ease-out group cursor-pointer ${activeStyles}`}>
                                    <div className="px-6 py-5 flex justify-between items-start gap-4 bg-white/5">
                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                            {item.image ? (<img src={item.image} className="w-20 h-20 rounded-xl object-cover border border-white/10 flex-shrink-0 shadow-2xl" alt="thumbnail" />) : (<div className={`w-20 h-20 rounded-xl flex items-center justify-center bg-slate-700/50 text-${severityColor}-400`}><Icon name={item.type === 'note' ? 'document-report' : 'findings'} className="w-10 h-10" /></div>)}
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-2">
                                                    <span className={`bg-${severityColor}-500/20 text-${severityColor}-400 px-2 py-0.5 rounded-md`}>{item.categoryName}</span>
                                                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>}
                                                </p>
                                                <h3 className="text-xl font-bold text-white truncate"><AnimatedText text={item.title} isActive={isActive} isTitle={true} /></h3>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-2 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                                            <button onClick={(e) => { e.stopPropagation(); handleStartEdit(item); }} className="p-2.5 bg-slate-700 hover:bg-blue-600 text-slate-200 rounded-xl shadow-lg transition-all"><EditIcon className="w-5 h-5" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteWithConfirmation(item); }} className="p-2.5 bg-slate-700 hover:bg-red-600 text-slate-200 rounded-xl shadow-lg transition-all"><TrashIcon className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    <div className="px-6 pb-6 pt-2">
                                        {isEditing ? (
                                            <div className="animate-fade-in bg-slate-900/50 p-4 rounded-xl border border-white/10 shadow-inner">
                                                {/* MODIFIED: Always use textarea for findings as well */}
                                                <div className="space-y-4">
                                                    <div className="relative">
                                                        <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-600 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[120px] text-lg" autoFocus />
                                                        {apiKey && (<button onClick={handleAiPolish} disabled={isPolishing} className="absolute bottom-3 left-3 p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-xl transition-all disabled:opacity-50">{isPolishing ? <RefreshCwIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}</button>)}
                                                    </div>
                                                    {/* Color Picker for Notes (only applies to type='note') */}
                                                    {item.type === 'note' && (
                                                        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">تلوين الملاحظة:</span>
                                                            <div className="flex gap-2">
                                                                {(Object.keys(highlightColors) as HighlightColor[]).map(color => (<button key={color} type="button" onClick={() => setEditColor(c => c === color ? undefined : color)} className={`w-6 h-6 rounded-full transition-all ${highlightColors[color].bg} ${editColor === color ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`} title={highlightColors[color].name} />))}
                                                                <button onClick={() => setEditColor(undefined)} className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white/40 hover:text-white" title="بدون لون"><XIcon className="w-3 h-3" /></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end gap-3 mt-4">
                                                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors">إلغاء</button>
                                                    <Button onClick={() => handleSaveEdit(item)} size="sm">حفظ التغيير</Button>
                                                </div>
                                            </div>
                                        ) : (<div onClick={(e) => { e.stopPropagation(); handleStartEdit(item); }} className="py-2"><p className={`text-2xl transition-all duration-500 leading-relaxed ${isActive ? 'text-white' : 'text-slate-500'}`}><AnimatedText text={item.content} isActive={isActive} /></p></div>)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="flex-shrink-0 bg-slate-900/90 border-t border-white/10 p-4 pb-8 backdrop-blur-2xl z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase ml-2 flex-shrink-0">انتقال سريع:</span>
                        {reviewCategories.map(cat => (<button key={cat.id} onClick={() => scrollToCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${currentItem?.categoryId === cat.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>{cat.name}</button>))}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <button onClick={handlePrev} disabled={activeIndex <= 0} className="flex-1 bg-slate-800 text-white p-4 rounded-2xl disabled:opacity-20 active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/5 hover:bg-slate-700">
                            <ChevronDownIcon className="w-6 h-6 transform rotate-180" /><span className="font-bold text-lg hidden sm:inline">البند السابق</span>
                        </button>
                        <div className="px-6 py-2 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                            <span className="text-2xl font-black text-white font-numeric">{activeIndex + 1}</span><span className="text-[10px] font-bold text-slate-500 uppercase">من {displayedItems.length}</span>
                        </div>
                        <button onClick={handleNext} disabled={activeIndex >= displayedItems.length - 1} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl disabled:opacity-20 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/30 hover:bg-blue-500">
                            <span className="font-bold text-lg hidden sm:inline">البند التالي</span><ChevronDownIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* AI Review Confirmation Modal */}
            {aiSuggestions && (
                <Modal isOpen={true} onClose={handleCloseAiReviewModal} title="مراجعة الاقتراحات الذكية" size="4xl">
                    <div className="flex flex-col h-[80vh]">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200">وجد Gemini {aiSuggestions.length} اقتراحات للتحسين.</h4>
                                <p className="text-sm text-slate-500">حدد التغييرات التي تريد تطبيقها على التقرير.</p>
                            </div>
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                                    checked={allSuggestionsApproved}
                                    ref={selectAllCheckboxRef}
                                    onChange={(e) => handleToggleAllSuggestions(e.target.checked)}
                                />
                                <span className="text-xs font-bold">تحديد الكل</span>
                            </label>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {aiSuggestions.map((suggestion) => (
                                <div key={suggestion.uniqueKey} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm animate-fade-in">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex items-center justify-between">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={suggestion.approved}
                                                onChange={() => handleToggleSuggestionApproval(suggestion.uniqueKey)}
                                                className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <div>
                                                <h5 className="font-bold text-slate-900 dark:text-white">{suggestion.title}</h5>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">{suggestion.categoryName}</span>
                                            </div>
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 p-4 items-center">
                                        <div>
                                            <h6 className="text-xs font-bold text-red-600 dark:text-red-400 mb-1 uppercase">النص الحالي</h6>
                                            <p className="text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/50 leading-relaxed whitespace-pre-wrap">
                                                {suggestion.originalContent}
                                            </p>
                                        </div>
                                        <div className="hidden md:flex flex-col items-center justify-center text-center">
                                            <ArrowRightIcon className="w-8 h-8 text-slate-300 dark:text-slate-500" />
                                            <span className="text-[10px] font-bold text-slate-400 mt-1">يستبدل بـ</span>
                                        </div>
                                        <div className="md:hidden border-t dark:border-slate-700 my-2"></div>
                                        <div>
                                            <h6 className="text-xs font-bold text-green-600 dark:text-green-400 mb-1 uppercase">الاقتراح</h6>
                                            <p className="text-sm p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/50 leading-relaxed whitespace-pre-wrap">
                                                {suggestion.correctedContent}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="p-4 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center flex-shrink-0">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                تم تحديد <span className="text-blue-600">{numApproved}</span> من {aiSuggestions.length} تغييرات
                            </span>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={handleCloseAiReviewModal}>إلغاء</Button>
                                <Button onClick={handleApplySelectedSuggestions} disabled={numApproved === 0}>
                                    تطبيق التغييرات المحددة
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};

export default ReviewModeModal;