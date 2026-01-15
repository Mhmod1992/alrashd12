
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Modal from './Modal';
import Button from './Button';
import { Note, CustomFindingCategory, Notification, ConfirmModalState } from '../types';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import ArrowRightIcon from './icons/ArrowRightIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import { cleanJsonString } from '../lib/utils';
import { TRANSLATION_LANGUAGES } from './TranslationModal'; // Re-use constants

interface BulkSuggestion {
  uniqueKey: string; // Used to identify the original note
  title: string; // Note text or brief summary
  categoryName: string;
  originalArabic: string;
  formalizedArabic: string;
  translations: {
    en?: string;
    hi?: string;
    ur?: string;
  };
  approvedFormalization: boolean;
  approvedTranslations: {
    en: boolean;
    hi: boolean;
    ur: boolean;
  };
}

interface BulkTranslationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[]; // All notes relevant to the current view (general or category)
  categories: CustomFindingCategory[];
  apiKey: string | null;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  onApplyChanges: (updatedNotes: Note[]) => void;
  showConfirmModal: (modalState: Omit<ConfirmModalState, 'isOpen'>) => void;
}

const BulkTranslationReviewModal: React.FC<BulkTranslationReviewModalProps> = ({
  isOpen,
  onClose,
  notes,
  categories,
  apiKey,
  addNotification,
  onApplyChanges,
  showConfirmModal,
}) => {
  const [suggestions, setSuggestions] = useState<BulkSuggestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);

  const selectAllFormalizationRef = useRef<HTMLInputElement>(null);
  const selectAllEnglishRef = useRef<HTMLInputElement>(null);
  const selectAllHindiRef = useRef<HTMLInputElement>(null);
  const selectAllUrduRef = useRef<HTMLInputElement>(null);

  // Memoize languages for consistent order
  const languageCodes = useMemo(
    () => Object.keys(TRANSLATION_LANGUAGES) as Array<keyof typeof TRANSLATION_LANGUAGES>,
    [],
  );

  // --- Processing Logic ---
  const processNotesInBulk = useCallback(async () => {
    if (!apiKey) {
      addNotification({ title: 'مفتاح API مطلوب', message: 'الرجاء إضافة Gemini API Key في الإعدادات.', type: 'error' });
      onClose();
      return;
    }
    if (notes.length === 0) {
      addNotification({ title: 'تنبيه', message: 'لا توجد ملاحظات للترجمة.', type: 'info' });
      onClose();
      return;
    }

    setIsProcessing(true);
    const newSuggestions: BulkSuggestion[] = [];
    const ai = new GoogleGenAI({ apiKey });

    for (let i = 0; i < notes.length; i++) {
      if (!isOpen) break; // Allow early exit if modal is closed
      const note = notes[i];
      setCurrentProcessingIndex(i);

      const originalText = note.originalText || note.text;
      if (!originalText.trim()) continue;

      let formalizedArabic = note.text; // Start with current note.text (might already be formalized)
      let currentNoteTranslations: Record<string, string> = {};

      try {
        // 1. Formalize Arabic
        const formalizationPrompt = `أعد صياغة نص تقرير فحص السيارة التالي ليكون احترافياً وموجزاً باللغة العربية الفصحى. لا تضف أي مقدمات أو خاتمة. النص: "${originalText}"`;
        const formalizationResponse = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: formalizationPrompt,
        });
        formalizedArabic = formalizationResponse.text?.trim() || originalText; // Fallback to original if AI fails

        // 2. Translate to all target languages
        for (const langCode of languageCodes) {
          const targetLanguageName = TRANSLATION_LANGUAGES[langCode];
          const translationPrompt = `Translate the following formal Arabic car inspection report text into ${targetLanguageName}. Provide only the translated text, without any additional comments or formatting. Text: "${formalizedArabic}"`;
          const translationResponse = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: translationPrompt,
          });
          currentNoteTranslations[langCode] = translationResponse.text?.trim() || '';
        }
      } catch (error) {
        console.error(`Error processing note ${note.id}:`, error);
        addNotification({ title: 'خطأ', message: `فشل معالجة الملاحظة: ${note.text.substring(0, 30)}...`, type: 'error' });
      }

      const category = categories.find((c) => c.id === note.categoryId);
      newSuggestions.push({
        uniqueKey: note.id,
        title: note.text.substring(0, 50) + '...',
        categoryName: category?.name || (note.categoryId === 'general' ? 'ملاحظات عامة' : 'غير معروف'),
        originalArabic: originalText,
        formalizedArabic: formalizedArabic,
        translations: currentNoteTranslations,
        approvedFormalization: formalizedArabic !== originalText, // Auto-approve if different
        approvedTranslations: {
          en: !!currentNoteTranslations.en,
          hi: !!currentNoteTranslations.hi,
          ur: !!currentNoteTranslations.ur,
        },
      });
    }

    if (isOpen) {
      setSuggestions(newSuggestions);
      setIsProcessing(false);
      addNotification({ title: 'تدقيق جماعي مكتمل', message: 'تم توليد جميع الاقتراحات.', type: 'success' });
    }
  }, [isOpen, notes, categories, apiKey, addNotification, languageCodes]);

  useEffect(() => {
    if (isOpen && !isProcessing && suggestions.length === 0) {
      processNotesInBulk();
    }
  }, [isOpen, isProcessing, suggestions.length, processNotesInBulk]);

  // --- Handlers for Approval Checkboxes ---
  const handleToggleFormalizationApproval = (uniqueKey: string, approved: boolean) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.uniqueKey === uniqueKey ? { ...s, approvedFormalization: approved } : s)),
    );
  };

  const handleToggleTranslationApproval = (
    uniqueKey: string,
    langCode: keyof typeof TRANSLATION_LANGUAGES,
    approved: boolean,
  ) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.uniqueKey === uniqueKey
          ? { ...s, approvedTranslations: { ...s.approvedTranslations, [langCode]: approved } }
          : s,
      ),
    );
  };

  const handleApplySelectedChanges = () => {
    showConfirmModal({
      title: 'تأكيد تطبيق التغييرات',
      message: 'هل أنت متأكد من تطبيق التغييرات المحددة على الملاحظات؟ هذا الإجراء لا يمكن التراجع عنه.',
      onConfirm: () => {
        const updatedNotes: Note[] = notes.map((originalNote) => {
          const suggestion = suggestions.find((s) => s.uniqueKey === originalNote.id);
          if (!suggestion) return originalNote;

          const newNote: Note = { ...originalNote };

          // Apply Formalization
          if (suggestion.approvedFormalization && suggestion.formalizedArabic !== originalNote.text) {
            newNote.originalText = originalNote.text; // Store original if not already
            newNote.text = suggestion.formalizedArabic;
          }

          // Apply Translations
          const newTranslations = { ...originalNote.translations };
          languageCodes.forEach((langCode) => {
            if (suggestion.approvedTranslations[langCode] && suggestion.translations[langCode]) {
              newTranslations[langCode] = suggestion.translations[langCode]!;
            }
          });
          newNote.translations = newTranslations;

          // Ensure displayTranslation exists
          if (!newNote.displayTranslation) {
            newNote.displayTranslation = { lang: 'ar', isActive: false };
          }

          return newNote;
        });

        onApplyChanges(updatedNotes); // Pass all updated notes back
        addNotification({ title: 'نجاح', message: `تم تطبيق ${updatedNotes.length} ملاحظة بنجاح.`, type: 'success' });
        onClose();
      },
    });
  };

  // --- Select All Logic ---
  const toggleAllFormalization = (checked: boolean) => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, approvedFormalization: checked })));
  };
  const toggleAllTranslations = (langCode: keyof typeof TRANSLATION_LANGUAGES, checked: boolean) => {
    setSuggestions((prev) =>
      prev.map((s) => ({ ...s, approvedTranslations: { ...s.approvedTranslations, [langCode]: checked } })),
    );
  };

  // Intermediate states for "indeterminate" checkbox visual
  const getIndeterminateState = (type: 'formalization' | keyof typeof TRANSLATION_LANGUAGES) => {
    if (suggestions.length === 0) return false;
    let allChecked: boolean;
    let anyChecked: boolean;

    if (type === 'formalization') {
      allChecked = suggestions.every((s) => s.approvedFormalization);
      anyChecked = suggestions.some((s) => s.approvedFormalization);
    } else {
      allChecked = suggestions.every((s) => s.approvedTranslations[type]);
      anyChecked = suggestions.some((s) => s.approvedTranslations[type]);
    }
    return anyChecked && !allChecked;
  };

  // Update indeterminate state of "Select All" checkboxes
  useEffect(() => {
    if (selectAllFormalizationRef.current) {
      selectAllFormalizationRef.current.indeterminate = getIndeterminateState('formalization');
    }
    if (selectAllEnglishRef.current) {
      selectAllEnglishRef.current.indeterminate = getIndeterminateState('en');
    }
    if (selectAllHindiRef.current) {
      selectAllHindiRef.current.indeterminate = getIndeterminateState('hi');
    }
    if (selectAllUrduRef.current) {
      selectAllUrduRef.current.indeterminate = getIndeterminateState('ur');
    }
  }, [suggestions]);

  const numApprovedFormalization = useMemo(() => suggestions.filter((s) => s.approvedFormalization).length, [suggestions]);
  const numApprovedTranslations = useMemo(
    () =>
      languageCodes.reduce((acc, langCode) => acc + suggestions.filter((s) => s.approvedTranslations[langCode]).length, 0),
    [suggestions, languageCodes],
  );
  const totalApproved = numApprovedFormalization + numApprovedTranslations;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="مراجعة الترجمة والصياغة الجماعية" size="4xl">
      <div className="flex flex-col h-[85vh]">
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-4 bg-purple-500/10 rounded-full flex items-center justify-center">
                <Icon name="sparkles" className="w-8 h-8 text-purple-400 animate-pulse" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mb-2">جاري التدقيق والترجمة...</h3>
            <p className="text-slate-400 font-medium">
              ملاحظة {currentProcessingIndex + 1} من {notes.length}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {suggestions.length === 0 && !isProcessing ? (
            <div className="text-center py-20 text-slate-500">
              <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">لا توجد ملاحظات أو اقتراحات للعرض.</p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl shadow-inner border dark:border-slate-700 overflow-x-auto min-w-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md z-10 border-b dark:border-slate-700">
                  <tr className="text-xs text-slate-700 dark:text-slate-400 uppercase">
                    <th className="p-3 text-right">الملاحظة</th>
                    <th className="p-3 text-right">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                          checked={suggestions.every((s) => s.approvedFormalization)}
                          ref={selectAllFormalizationRef}
                          onChange={(e) => toggleAllFormalization(e.target.checked)}
                        />
                        <span>عربي (صياغة)</span>
                      </label>
                    </th>
                    {languageCodes.map((langCode) => (
                      <th key={langCode} className="p-3 text-right">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                            checked={suggestions.every((s) => s.approvedTranslations[langCode])}
                            ref={
                              langCode === 'en'
                                ? selectAllEnglishRef
                                : langCode === 'hi'
                                  ? selectAllHindiRef
                                  : selectAllUrduRef
                            }
                            onChange={(e) => toggleAllTranslations(langCode, e.target.checked)}
                          />
                          <span>{TRANSLATION_LANGUAGES[langCode]}</span>
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.uniqueKey} className="border-b dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/30">
                      <td className="p-3 max-w-[200px] whitespace-normal">
                        <h4 className="font-bold text-slate-900 dark:text-white line-clamp-2">
                          {s.originalArabic.split(' ').slice(0, 5).join(' ')}...
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {s.categoryName}
                        </span>
                      </td>
                      <td className="p-3 max-w-[250px] whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
                            {s.formalizedArabic}
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                              checked={s.approvedFormalization}
                              onChange={(e) =>
                                handleToggleFormalizationApproval(s.uniqueKey, e.target.checked)
                              }
                            />
                            <span>اعتماد الصياغة</span>
                          </label>
                        </div>
                      </td>
                      {languageCodes.map((langCode) => (
                        <td key={langCode} className="p-3 max-w-[250px] whitespace-normal">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                              {s.translations[langCode]}
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                                checked={s.approvedTranslations[langCode]}
                                onChange={(e) =>
                                  handleToggleTranslationApproval(s.uniqueKey, langCode, e.target.checked)
                                }
                              />
                              <span>اعتماد الترجمة</span>
                            </label>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-4 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
            تم تحديد <span className="text-blue-600">{totalApproved}</span> تغييرات
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
            <Button onClick={handleApplySelectedChanges} disabled={totalApproved === 0}>
              تطبيق التغييرات المحددة
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BulkTranslationReviewModal;
