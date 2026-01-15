
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HighlightColor, CustomFindingCategory, Note } from '../types';
import { useAppContext } from '../context/AppContext';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import XIcon from './icons/XIcon';
import Button from './Button';
import CameraPage from './CameraPage';
import EyeIcon from './icons/EyeIcon';
import PrinterIcon from './icons/PrinterIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import SendIcon from './icons/SendIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import Modal from './Modal';
import ClipboardListIcon from './icons/ClipboardListIcon';

interface StickyNoteInputProps {
    onAddNote: (noteData: { text: string; file: File | null; color: HighlightColor | null }) => Promise<void>;
    activeTabId: string;
    customFindingCategories: CustomFindingCategory[];
    canManageNotes: boolean;
    isLocked: boolean;
    focusRingClass: string;
    openImagePreview: (url: string) => void;
    onReview?: () => void;
    onPrint?: () => void;
    onComplete?: () => void;
    canChangeStatus?: boolean;
    canPrint?: boolean;
    allTabsInOrder?: string[];
    onNextTab?: () => void;
    onPrevTab?: () => void;
}

interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
    target?: any;
}

const compressImage = (file: File, options: { maxWidth: number; maxHeight: number; quality: number; }): Promise<File> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error('File is not an image.'));
        }
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > options.maxWidth) {
                    height = Math.round((height * options.maxWidth) / width);
                    width = options.maxWidth;
                }
            } else {
                if (height > options.maxHeight) {
                    width = Math.round((width * options.maxHeight) / height);
                    height = options.maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(img.src);
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(img.src);
            
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas to Blob conversion failed'));
                    }
                    const fileName = file.name.split('.').slice(0, -1).join('.') + '.jpg';
                    const newFile = new File([blob], fileName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                },
                'image/jpeg',
                options.quality
            );
        };
        img.onerror = (error) => {
            URL.revokeObjectURL(img.src);
            reject(error);
        }
    });
};

const highlightColors: Record<HighlightColor, { name: string; bg: string; ring: string; border: string; inputBg: string; badge: string }> = {
    yellow: { name: 'تنبيه', bg: 'bg-yellow-400', ring: 'ring-yellow-500', border: 'border-yellow-400', inputBg: 'bg-yellow-100/80 dark:bg-yellow-900/30', badge: 'bg-yellow-500 text-yellow-950 border-yellow-600' },
    red: { name: 'خطر', bg: 'bg-red-500', ring: 'ring-red-600', border: 'border-red-500', inputBg: 'bg-red-100/80 dark:bg-red-900/30', badge: 'bg-red-500 text-white border-red-600' },
    green: { name: 'تأكيد', bg: 'bg-green-500', ring: 'ring-green-600', border: 'border-green-500', inputBg: 'bg-green-100/80 dark:bg-green-900/30', badge: 'bg-green-500 text-white border-green-600' },
    blue: { name: 'معلومات', bg: 'bg-blue-500', ring: 'ring-blue-600', border: 'border-blue-500', inputBg: 'bg-blue-100/80 dark:bg-blue-900/30', badge: 'bg-blue-500 text-white border-blue-600' },
};


export const StickyNoteInput: React.FC<StickyNoteInputProps> = ({
    onAddNote,
    activeTabId,
    customFindingCategories,
    canManageNotes,
    isLocked,
    focusRingClass,
    openImagePreview,
    onReview,
    onPrint,
    onComplete,
    canChangeStatus,
    canPrint,
    allTabsInOrder,
    onNextTab,
    onPrevTab
}) => {
    const { addNotification } = useAppContext();
    const isMounted = useRef(true);

    const [note, setNote] = useState<{ text: string; image: string | null }>({ text: '', image: null });
    const [noteFile, setNoteFile] = useState<File | null>(null);
    const [highlightColor, setHighlightColor] = useState<HighlightColor | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Bulk Input State
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    
    // State for Two-Step Completion
    const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
    const completeTimeoutRef = useRef<number | null>(null);

    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const colorMenuRef = useRef<HTMLDivElement>(null); // Added ref for color menu
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const [isCameraPageOpen, setIsCameraPageOpen] = useState(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; }
    }, []);

    // NEW: Auto-focus textarea when tab changes
    useEffect(() => {
        if (!isLocked && canManageNotes && textareaRef.current) {
            const timer = setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeTabId, isLocked, canManageNotes]);

    // Close color menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside the color menu container
            if (isColorMenuOpen && colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
                setIsColorMenuOpen(false);
            }
            // Check if click is outside the dropdown container
            if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isColorMenuOpen, isDropdownOpen]);


    // Speech Recognition Setup
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            setIsSpeechRecognitionSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'ar-SA';

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setNote(prev => ({ ...prev, text: (prev.text + ' ' + finalTranscript).trim().toUpperCase() }));
                }
            };
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                addNotification({ title: 'خطأ في التعرف الصوتي', message: `حدث خطأ: ${event.error}`, type: 'error' });
                setIsListening(false);
            };
            recognitionRef.current = recognition;
        } else {
            setIsSpeechRecognitionSupported(false);
        }
        return () => recognitionRef.current?.stop();
    }, [addNotification]);

    const handleToggleListening = () => {
        if (isLocked || !canManageNotes) return;
        const recognition = recognitionRef.current;
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
            setIsListening(true);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const originalPreviewUrl = URL.createObjectURL(file);
            setNote(prev => {
                if (prev.image && prev.image.startsWith('blob:')) {
                    URL.revokeObjectURL(prev.image);
                }
                return { ...prev, image: originalPreviewUrl };
            });

            try {
                const compressedFile = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
                setNoteFile(compressedFile);
            } catch (error) {
                console.error("Image compression failed:", error);
                addNotification({ title: 'خطأ', message: 'فشل ضغط الصورة، سيتم استخدام الصورة الأصلية.', type: 'error' });
                setNoteFile(file);
            }
        }
        e.target.value = '';
    };

    const handleCaptureComplete = useCallback(async (file: File) => {
        if (!isMounted.current) return;

        const originalPreviewUrl = URL.createObjectURL(file);

        setNote(prev => {
            if (prev.image && prev.image.startsWith('blob:')) {
                URL.revokeObjectURL(prev.image);
            }
            return { ...prev, image: originalPreviewUrl };
        });

        try {
            const compressedFile = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
            if (isMounted.current) setNoteFile(compressedFile);
        } catch (error) {
            console.error("Image compression failed:", error);
            addNotification({ title: 'خطأ', message: 'فشل ضغط الصورة، سيتم استخدام الصورة الأصلية.', type: 'error' });
            if (isMounted.current) setNoteFile(file);
        }
    }, [addNotification]);


    const handleAdd = async () => {
        if (isLocked || !canManageNotes || isSubmitting || (!note.text.trim() && !noteFile)) return;

        setIsSubmitting(true);
        try {
            await onAddNote({ text: note.text.trim(), file: noteFile, color: highlightColor });
            setNote({ text: '', image: null });
            setNoteFile(null);
            setHighlightColor(null); // Reset color after send
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } finally {
            if (isMounted.current) setIsSubmitting(false);
        }
    };
    
    const handleBulkAdd = async () => {
        if (!bulkText.trim()) return;
        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length === 0) return;

        setIsSubmitting(true);
        try {
            // Process lines sequentially
            for (const line of lines) {
                await onAddNote({ text: line, file: null, color: highlightColor });
            }
            setBulkText('');
            setIsBulkModalOpen(false);
            setHighlightColor(null);
            addNotification({ title: 'تمت الإضافة', message: `تم إضافة ${lines.length} ملاحظات بنجاح.`, type: 'success' });
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل إضافة بعض الملاحظات.', type: 'error' });
        } finally {
             if (isMounted.current) setIsSubmitting(false);
        }
    };
    
    // Two-Step Completion Logic
    const handleCompleteClick = () => {
        if (!onComplete) return;

        if (isConfirmingComplete) {
            // Step 2: Actually Complete
            if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
            setIsConfirmingComplete(false);
            onComplete();
        } else {
            // Step 1: Request Confirmation
            setIsConfirmingComplete(true);
            // Reset after 3 seconds if not confirmed
            completeTimeoutRef.current = window.setTimeout(() => {
                if (isMounted.current) setIsConfirmingComplete(false);
            }, 3000);
        }
    };
    
    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
        };
    }, []);

    const isGeneral = activeTabId === 'general-notes';
    const currentCategoryName = customFindingCategories.find(c => c.id === activeTabId)?.name || (isGeneral ? 'ملاحظات عامة' : '...');
    
    // Updated Placeholder
    let placeholder = `اكتب ملاحظة...`;

    const inputStyleClass = highlightColor
        ? highlightColors[highlightColor].inputBg
        : 'bg-slate-100 dark:bg-slate-900';

    if (isLocked || activeTabId === 'gallery') return null;

    const currentTabIndex = allTabsInOrder?.indexOf(activeTabId);
    const isFirstTab = currentTabIndex === 0;
    const isLastTab = currentTabIndex === (allTabsInOrder?.length || 0) - 1;


    return (
        <>
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] transition-all duration-300 pb-safe">
                <div className="max-w-5xl mx-auto w-full flex flex-col gap-2 p-2">

                    {/* TOP BAR: Navigation & Actions */}
                    <div className="flex items-center justify-between px-1">
                         {/* Right (RTL): Navigation Group */}
                         <div className="flex items-center gap-2 sm:gap-4 flex-1">
                             <button onClick={onPrevTab} disabled={isFirstTab} className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors ${isFirstTab ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                <ChevronRightIcon className="w-6 h-6" />
                             </button>
                             {/* Enhanced Title with Glow and Animation */}
                             <h3 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 truncate max-w-[150px] sm:max-w-xs text-center flex-1 sm:flex-none drop-shadow-md animate-pulse">
                                {currentCategoryName}
                             </h3>
                             <button onClick={onNextTab} disabled={isLastTab} className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors ${isLastTab ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                <ChevronRightIcon className="w-6 h-6 transform rotate-180" />
                             </button>
                         </div>

                         {/* Center/Left (RTL): Actions Group */}
                         <div className="flex items-center gap-1 sm:gap-2">
                             {onReview && (
                                <button onClick={onReview} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors" title="مراجعة">
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                             )}
                             {onPrint && canPrint && (
                                <button onClick={onPrint} className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-full transition-colors" title="طباعة">
                                    <PrinterIcon className="w-5 h-5" />
                                </button>
                             )}
                             
                             {!isLocked && onComplete && (
                                <button 
                                    onClick={handleCompleteClick} 
                                    className={`
                                        flex items-center justify-center gap-2 rounded-full transition-all duration-300 transform shadow-md
                                        ${isConfirmingComplete 
                                            ? 'bg-green-600 text-white px-4 py-2 hover:bg-green-700 scale-105' 
                                            : 'bg-transparent text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-slate-800 p-2'
                                        }
                                    `} 
                                    title={isConfirmingComplete ? "تأكيد الإكمال؟" : "إكمال الطلب"}
                                >
                                    <CheckCircleIcon className={`w-5 h-5 ${isConfirmingComplete ? 'animate-bounce' : ''}`} />
                                    {isConfirmingComplete && <span className="font-bold text-xs whitespace-nowrap">تأكيد؟</span>}
                                </button>
                             )}
                         </div>
                    </div>

                    {/* BOTTOM BAR: Input Area */}
                    <div className="flex items-end gap-2">
                         {/* Color Palette Button */}
                         <div className="relative" ref={colorMenuRef}>
                            <button 
                              onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
                              className={`color-menu-trigger p-3 rounded-full transition-all duration-300 ${highlightColor ? highlightColors[highlightColor].bg + ' text-white ring-2 ring-offset-2 ring-' + highlightColors[highlightColor].ring.split('-')[1] : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                              title="لون الملاحظة"
                            >
                                <PaintBrushIcon className="w-5 h-5" />
                            </button>
                            {/* Popover for Colors */}
                            {isColorMenuOpen && (
                                <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-xl border dark:border-slate-700 flex flex-col gap-2 z-50 animate-scale-in origin-bottom-right min-w-[40px]">
                                    {(Object.keys(highlightColors) as HighlightColor[]).map(c => (
                                        <button key={c} onClick={() => { setHighlightColor(c); setIsColorMenuOpen(false); }} className={`w-8 h-8 rounded-full ${highlightColors[c].bg} border-2 border-white dark:border-slate-600 hover:scale-110 transition-transform`} title={highlightColors[c].name} />
                                    ))}
                                    <button onClick={() => { setHighlightColor(null); setIsColorMenuOpen(false); }} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-500" title="إلغاء اللون"><XIcon className="w-4 h-4 text-slate-500 dark:text-slate-300"/></button>
                                </div>
                            )}
                         </div>

                         {/* Text Input Wrapper */}
                         <div className={`flex-1 relative rounded-3xl transition-all duration-300 border border-transparent focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${inputStyleClass}`}>
                             {/* Color Badge/Hint */}
                             {highlightColor && (
                                <span className={`absolute top-[-12px] right-4 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm z-10 animate-scale-in border ${highlightColors[highlightColor].badge}`}>
                                    {highlightColors[highlightColor].name}
                                </span>
                             )}

                             <textarea
                                ref={textareaRef}
                                value={note.text}
                                onChange={e => {
                                    setNote(prev => ({ ...prev, text: e.target.value.toUpperCase() }));
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                }}
                                onKeyDown={(e) => {
                                    // Submit on Enter (without Shift)
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAdd();
                                        return;
                                    }
                                    
                                    // Navigation Shortcuts (Alt + Arrow)
                                    if (e.altKey) {
                                        if (e.key === 'ArrowLeft') {
                                            // In RTL, Left is "Next"
                                            e.preventDefault();
                                            if (onNextTab) onNextTab();
                                        } else if (e.key === 'ArrowRight') {
                                            // In RTL, Right is "Previous"
                                            e.preventDefault();
                                            if (onPrevTab) onPrevTab();
                                        }
                                    }
                                }}
                                className="w-full bg-transparent border-none focus:ring-0 outline-none py-3 pr-4 pl-28 min-h-[48px] max-h-[120px] resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium text-center"
                                placeholder={placeholder}
                                rows={1}
                             />
                             
                             {/* Icons Inside Input (Left Side RTL) */}
                             <div className="absolute left-2 bottom-1.5 flex items-center gap-1">
                                {/* Bulk Add */}
                                <button onClick={() => setIsBulkModalOpen(true)} className={`p-1.5 rounded-full transition-colors text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50`} title="إضافة نص متعدد">
                                    <ClipboardListIcon className="w-5 h-5" />
                                </button>
                                {/* Mic */}
                                {isSpeechRecognitionSupported && (
                                    <button onClick={handleToggleListening} className={`p-1.5 rounded-full transition-colors ${isListening ? 'text-red-500 bg-red-100 animate-pulse' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50'}`}>
                                        <Icon name="microphone" className="w-5 h-5" />
                                    </button>
                                )}
                                {/* Camera/Gallery */}
                                <div className="relative" ref={dropdownRef}>
                                    <button onClick={() => setDropdownOpen(!isDropdownOpen)} className={`p-1.5 rounded-full transition-colors ${note.image ? 'text-blue-600 bg-blue-100' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50'}`}>
                                        <Icon name="camera" className="w-5 h-5" />
                                    </button>
                                    {isDropdownOpen && (
                                        <div className="absolute bottom-full left-0 mb-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in origin-bottom-left z-50">
                                            <button type="button" onClick={() => { setIsCameraPageOpen(true); setDropdownOpen(false); }} className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold flex gap-2 text-slate-700 dark:text-slate-200"><Icon name="camera" className="w-4 h-4"/> كاميرا</button>
                                            <label className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold flex gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                                                <Icon name="gallery" className="w-4 h-4"/> معرض
                                                <input type="file" accept="image/*" onChange={(e) => { handleImageChange(e); setDropdownOpen(false); }} className="hidden" />
                                            </label>
                                        </div>
                                    )}
                                </div>
                             </div>

                             {/* Attachment Badge Floating */}
                             {note.image && (
                                <div className="absolute top-[-14px] left-4 flex items-center gap-1 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 shadow-sm z-10 animate-scale-in">
                                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">مرفق صورة</span>
                                    <button onClick={() => { if (note.image) URL.revokeObjectURL(note.image); setNote(p => ({ ...p, image: null })); setNoteFile(null); }} className="text-red-500 hover:bg-red-200 rounded-full p-0.5"><XIcon className="w-3 h-3" /></button>
                                </div>
                            )}
                         </div>

                         {/* Send Button */}
                         <button 
                            onClick={handleAdd}
                            disabled={isSubmitting || (!note.text.trim() && !noteFile)}
                            className={`p-3 rounded-full shadow-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${note.text.trim() || noteFile ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 hover:rotate-[-45deg]' : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}
                         >
                            {isSubmitting ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5 rtl:rotate-180" />}
                         </button>
                    </div>

                </div>
            </div>
            
            {/* Camera Page Component */}
            <CameraPage isOpen={isCameraPageOpen} onClose={() => setIsCameraPageOpen(false)} onCapture={handleCaptureComplete} />
            
            {/* Bulk Add Modal */}
            <Modal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} title="إضافة ملاحظات متعددة" size="lg">
                <div className="flex flex-col h-[50vh]">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-sm text-blue-800 dark:text-blue-300">
                        <p>قم بلصق النص هنا. سيتم تحويل كل سطر جديد إلى ملاحظة منفصلة.</p>
                    </div>
                    <textarea 
                        className="flex-1 w-full p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="اكتب أو الصق الملاحظات هنا..."
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700 mt-4">
                        <Button variant="secondary" onClick={() => setIsBulkModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleBulkAdd} disabled={isSubmitting || !bulkText.trim()}>
                            {isSubmitting ? 'جاري الإضافة...' : 'إضافة الملاحظات'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
