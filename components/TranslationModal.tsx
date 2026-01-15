import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Modal from './Modal';
import Button from './Button';
import { Note, HighlightColor, Notification } from '../types';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import ArrowRightIcon from './icons/ArrowRightIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import XIcon from './icons/XIcon';
import { cleanJsonString } from '../lib/utils';

// Define the available translation languages
export const TRANSLATION_LANGUAGES = {
  en: 'الإنجليزية',
  hi: 'الهندية',
  ur: 'الأوردو',
};

// Internal type for managing translation suggestions in the UI
interface TranslationSuggestion {
  langCode: keyof typeof TRANSLATION_LANGUAGES;
  originalText: string;
  translatedText: string;
  approved: boolean;
}

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  categoryId: string | 'general';
  apiKey: string | null;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  onSave: (updatedNote: Note, categoryId: string | 'general') => void;
}

const TranslationModal: React.FC<TranslationModalProps> = ({
  isOpen,
  onClose,
  note,
  categoryId,
  apiKey,
  addNotification,
  onSave,
}) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Formalize, 2: Translate
  const [formalizedArabicText, setFormalizedArabicText] = useState('');
  const [originalArabicForFormalization, setOriginalArabicForFormalization] = useState('');
  const [isFormalizing, setIsFormalizing] = useState(false);
  const [selectedTranslateLanguages, setSelectedTranslateLanguages] = useState<Set<keyof typeof TRANSLATION_LANGUAGES>>(new Set());
  const [translationSuggestions, setTranslationSuggestions] = useState<TranslationSuggestion[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // Initialize state when modal opens or note changes
  useEffect(() => {
    if (isOpen && note) {
      setCurrentStep(1); // Always start with formalization
      setOriginalArabicForFormalization(note.originalText || note.text);
      setFormalizedArabicText(note.text); // Pre-fill with current note.text
      setSelectedTranslateLanguages(new Set()); // Clear selected languages
      setTranslationSuggestions([]); // Clear previous suggestions
    }
  }, [isOpen, note]);

  // Handle auto-formalization on step 1 entry
  useEffect(() => {
    if (isOpen && currentStep === 1 && !isFormalizing && formalizedArabicText === (note.originalText || note.text)) {
      // Only auto-formalize if the text hasn't been formalized/edited yet in this session
      handleFormalizeArabic();
    }
  }, [isOpen, currentStep, isFormalizing, formalizedArabicText, note.originalText, note.text]);

  const handleFormalizeArabic = async () => {
    if (!apiKey || !originalArabicForFormalization.trim()) {
      addNotification({ title: 'خطأ', message: 'النص الأصلي فارغ ولا يمكن صياغته.', type: 'error' });
      return;
    }
    setIsFormalizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `أعد صياغة نص تقرير فحص السيارة التالي ليكون احترافياً وموجزاً باللغة العربية الفصحى. لا تضف أي مقدمات أو خاتمة. النص: "${originalArabicForFormalization}"`;
      const response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt });
      const formalText = response.text?.trim();
      if (formalText) {
        setFormalizedArabicText(formalText);
        addNotification({ title: 'صياغة عربية', message: 'تم اقتراح صياغة احترافية للنص العربي.', type: 'info' });
      } else {
        addNotification({ title: 'تنبيه', message: 'لم يستطع الذكاء الاصطناعي تحويل النص إلى صيغة فصحى. يرجى التعديل يدوياً.', type: 'warning' });
      }
    } catch (error) {
      console.error('Formalization Error', error);
      addNotification({
        title: 'خطأ',
        message: 'فشل صياغة النص العربي آلياً. يمكنك تعديله يدوياً.',
        type: 'error',
      });
    } finally {
      setIsFormalizing(false);
    }
  };

  const handleTranslate = async () => {
    if (!apiKey || !formalizedArabicText.trim()) {
      addNotification({ title: 'خطأ', message: 'النص العربي فارغ ولا يمكن ترجمته.', type: 'error' });
      return;
    }
    if (selectedTranslateLanguages.size === 0) {
      addNotification({ title: 'تنبيه', message: 'الرجاء اختيار لغة واحدة على الأقل للترجمة.', type: 'warning' });
      return;
    }
    setIsTranslating(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const newSuggestions: TranslationSuggestion[] = [];

      for (const langCode of Array.from(selectedTranslateLanguages) as Array<keyof typeof TRANSLATION_LANGUAGES>) {
        const targetLanguageName = TRANSLATION_LANGUAGES[langCode];
        const prompt = `Translate the following formal Arabic car inspection report text into ${targetLanguageName}. Provide only the translated text, without any additional comments or formatting. Text: "${formalizedArabicText}"`;

        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: { parts: [{ text: prompt }] },
        });

        newSuggestions.push({
          langCode,
          originalText: formalizedArabicText, // Reference for this translation
          translatedText: response.text?.trim() || '',
          approved: true, // Default to approved
        });
      }
      setTranslationSuggestions(newSuggestions);
      addNotification({ title: 'ترجمة مكتملة', message: 'تم توليد الترجمات المقترحة.', type: 'success' });
    } catch (error) {
      console.error('Translation Error', error);
      addNotification({
        title: 'خطأ',
        message: 'فشل ترجمة النص آلياً. يرجى المحاولة مرة أخرى.',
        type: 'error',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveTranslations = () => {
    const updatedNote: Note = { ...note };

    // 1. Save formalized Arabic text (if different from original)
    if (formalizedArabicText !== note.text || !note.originalText) {
      updatedNote.originalText = note.originalText || note.text; // Preserve original if not already set
      updatedNote.text = formalizedArabicText;
    }

    // 2. Apply approved translations
    const newTranslations = { ...note.translations };
    translationSuggestions
      .filter((s) => s.approved)
      .forEach((s) => {
        newTranslations[s.langCode] = s.translatedText;
      });
    updatedNote.translations = newTranslations;

    // 3. Set display defaults if no translation was active before
    if (!updatedNote.displayTranslation) {
        updatedNote.displayTranslation = { lang: 'ar', isActive: false };
    }

    onSave(updatedNote, categoryId);
    onClose();
  };

  const handleToggleLanguageSelection = (langCode: keyof typeof TRANSLATION_LANGUAGES) => {
    setSelectedTranslateLanguages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(langCode)) {
        newSet.delete(langCode);
      } else {
        newSet.add(langCode);
      }
      return newSet;
    });
  };

  const currentNoteText = note.text; // Current formalized text (if any) or original
  const isArabicFormalized = formalizedArabicText !== originalArabicForFormalization;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="الترجمة الذكية للملاحظة" size="4xl">
      <div className="flex flex-col h-[70vh]">
        {/* STEPPER HEADER */}
        <div className="flex justify-around items-center border-b pb-4 mb-4 dark:border-slate-700">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white transition-colors duration-300 ${
                currentStep >= 1 ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              {currentStep > 1 ? <CheckCircleIcon className="w-5 h-5" /> : '1'}
            </div>
            <span className="text-xs mt-2 font-semibold text-slate-700 dark:text-slate-300">صياغة عربية</span>
          </div>
          <div className="flex-1 h-px mx-2 bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white transition-colors duration-300 ${
                currentStep >= 2 ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              {currentStep > 2 ? <CheckCircleIcon className="w-5 h-5" /> : '2'}
            </div>
            <span className="text-xs mt-2 font-semibold text-slate-700 dark:text-slate-300">ترجمة</span>
          </div>
        </div>

        {/* STEP 1: FORMALIZE ARABIC */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col space-y-4 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">صياغة النص العربي آلياً</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              يقوم الذكاء الاصطناعي بتحويل النص العادي إلى صياغة عربية فصحى وموجزة ومناسبة للتقارير.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Original Arabic */}
              <div className="flex flex-col bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700">
                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 uppercase">النص الأصلي</h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <p className="text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {originalArabicForFormalization}
                  </p>
                </div>
              </div>

              {/* Formalized Arabic */}
              <div className="flex flex-col bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg border dark:border-blue-700">
                <h4 className="text-xs font-bold text-green-600 dark:text-green-400 mb-2 uppercase flex items-center gap-2">
                  النص المقترح <span className="text-xs text-slate-400 normal-case">(قابل للتعديل)</span>
                </h4>
                <textarea
                  value={formalizedArabicText}
                  onChange={(e) => setFormalizedArabicText(e.target.value)}
                  className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap custom-scrollbar"
                  disabled={isFormalizing}
                />
                {isFormalizing && (
                  <div className="flex items-center gap-2 mt-2 text-blue-600 dark:text-blue-400">
                    <RefreshCwIcon className="w-4 h-4 animate-spin" />
                    <span>جاري الصياغة...</span>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setFormalizedArabicText(originalArabicForFormalization)}
                    disabled={isFormalizing || formalizedArabicText === originalArabicForFormalization}
                  >
                    إعادة للأصلي
                  </Button>
                  <Button onClick={handleFormalizeArabic} disabled={isFormalizing}>
                    {isFormalizing ? 'جاري الصياغة...' : 'إعادة الصياغة'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-slate-700">
              <Button onClick={() => setCurrentStep(2)} disabled={isFormalizing || !formalizedArabicText.trim()}>
                التالي: اختيار اللغات
                <ArrowRightIcon className="w-5 h-5 me-2 rotate-180" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: TRANSLATE */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col space-y-4 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">ترجمة النص إلى لغات أخرى</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              اختر اللغات التي تريد الترجمة إليها من النص العربي الفصيح.
            </p>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">النص العربي المعتمد للترجمة:</h4>
              <p className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded-md border dark:border-slate-700">
                {formalizedArabicText}
              </p>
            </div>

            {/* Language Selection */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">اختر لغات الترجمة:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.keys(TRANSLATION_LANGUAGES) as Array<keyof typeof TRANSLATION_LANGUAGES>).map(
                  (langCode) => (
                    <label
                      key={langCode}
                      className="flex items-center gap-3 p-3 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTranslateLanguages.has(langCode)}
                        onChange={() => handleToggleLanguageSelection(langCode)}
                        className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {TRANSLATION_LANGUAGES[langCode]}
                      </span>
                    </label>
                  ),
                )}
              </div>
              <Button onClick={handleTranslate} disabled={isTranslating || selectedTranslateLanguages.size === 0} className="mt-4 w-full">
                {isTranslating ? (
                  <RefreshCwIcon className="w-5 h-5 me-2 animate-spin" />
                ) : (
                  <Icon name="sparkles" className="w-5 h-5 me-2" />
                )}
                {isTranslating ? 'جاري الترجمة...' : 'ترجمة الآن'}
              </Button>
            </div>

            {/* Translation Suggestions */}
            {translationSuggestions.length > 0 && (
              <div className="flex flex-col space-y-3 animate-fade-in">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-4">اقتراحات الترجمة:</h4>
                {translationSuggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.langCode}
                    className="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={suggestion.approved}
                          onChange={() =>
                            setTranslationSuggestions((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, approved: !s.approved } : s,
                              ),
                            )
                          }
                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {TRANSLATION_LANGUAGES[suggestion.langCode]}
                        </span>
                      </label>
                      <button
                        onClick={() =>
                          setTranslationSuggestions((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, translatedText: '' } : s)),
                          )
                        }
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        حذف النص
                      </button>
                    </div>
                    <textarea
                      value={suggestion.translatedText}
                      onChange={(e) =>
                        setTranslationSuggestions((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, translatedText: e.target.value } : s,
                          ),
                        )
                      }
                      rows={3}
                      className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-600 rounded-md resize-none focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
              <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                <ArrowRightIcon className="w-5 h-5 me-2" />
                السابق
              </Button>
              <Button onClick={handleSaveTranslations} disabled={isTranslating}>
                حفظ الترجمات
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TranslationModal;