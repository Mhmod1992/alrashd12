import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import SparklesIcon from './icons/SparklesIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import DownloadIcon from './icons/DownloadIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest, CustomFindingCategory } from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  extractBodyDamageData,
  generateCarExplodedImage,
  downloadImageFile,
  BodyExtractionResult,
  DamagedPanel,
} from '../lib/carVisualizerEngine';

interface CarVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRequest?: InspectionRequest | null;
}

// Quick testing presets for the user to try out immediately
interface TestPreset {
  id: string;
  title: string;
  carText: string;
  mockFindings?: { name: string; value: string }[];
  notesText: string;
}

const TEST_PRESETS: TestPreset[] = [
  {
    id: 'report-image-example',
    title: '📄 تقرير صورتك المرفقة (باب الشنطة + رفرف خلفي يمين + قائم يمين)',
    carText: 'تويوتا كامري 2023',
    mockFindings: [
      { name: 'باب الشنطة', value: 'رش نصف الباب + اجزاء معجون' },
      { name: 'رفرف خلفي يمين', value: 'رش وسمكرة' },
      { name: 'قائم فوق الباب يمين', value: 'رش جزء' },
    ],
    notesText: 'حكات دقات خفيفة في البدي\nترميل على الزجاج الأمامي + نقرات خفيفة\nترميل على الواجها الأمامية',
  },
  {
    id: 'right-side-full',
    title: '🚘 رش الجانب الأيمن بالكامل (جنب يمين كامل)',
    carText: 'هيونداي سوناتا 2022',
    mockFindings: [
      { name: 'جنب يمين', value: 'رش الجانب الأيمن كامل' },
    ],
    notesText: 'رش كامل الجنب الأيمن يشمل الرفارف والأبواب والقائم، باقي البدي سليم',
  },
  {
    id: 'taurus-2013',
    title: 'فورد تورس 2013 (دقات ورش في البدي)',
    carText: 'فورد تورس 2013',
    mockFindings: [
      { name: 'الرفرف الأمامي يمين', value: 'مرشوش' },
      { name: 'باب الراكب الأمامي', value: 'رش بوية' },
    ],
    notesText: 'حكات - دقات - تعديلات في البدي، تعديل بارد في الشنطة',
  },
  {
    id: 'lexus-intact',
    title: 'لكزس ES 2024 (بدي سليم وكالة بالكامل)',
    carText: 'لكزس ES 2024',
    mockFindings: [
      { name: 'الكبوت', value: 'سليم' },
      { name: 'باب السائق', value: 'سليم' },
      { name: 'الشنطة', value: 'سليم' },
    ],
    notesText: 'بدي وكالة سليم بالكامل، لا يوجد رش ولا دقات',
  },
];

const CarVisualizerModal: React.FC<CarVisualizerModalProps> = ({
  isOpen,
  onClose,
  initialRequest,
}) => {
  const { settings, requests, clients, customFindingCategories, predefinedFindings, addNotification } = useAppContext();

  // Mode selection: 'from_request' | 'preset' | 'custom'
  const [activeTab, setActiveTab] = useState<'from_request' | 'preset' | 'custom'>('from_request');

  // Selected request & full database record
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [fullDbRequest, setFullDbRequest] = useState<InspectionRequest | null>(null);
  const [isLoadingDbRequest, setIsLoadingDbRequest] = useState(false);
  
  // Selected preset (default to user's report image)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('report-image-example');

  // Custom inputs
  const [customCarName, setCustomCarName] = useState<string>('فورد تورس 2013');
  const [customNotes, setCustomNotes] = useState<string>('حكات - دقات - تعديلات في البدي ورش في الرفرف الأيمن');

  // Inspection section tabs for viewing panels
  const [panelsViewTab, setPanelsViewTab] = useState<'damaged' | 'intact'>('damaged');

  // Aspect Ratio
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '1:1' | '16:9'>('4:3');

  // Generated Result
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState<string>('');

  // Active API key resolution (prioritizes imageGeneratorApiKey, falls back to geminiApiKey)
  const activeApiKey = useMemo(() => {
    return settings.imageGeneratorApiKey?.trim() || settings.geminiApiKey?.trim() || null;
  }, [settings.imageGeneratorApiKey, settings.geminiApiKey]);

  const isUsingDedicatedKey = Boolean(settings.imageGeneratorApiKey?.trim());

  // Set initial selected request if provided
  useEffect(() => {
    if (initialRequest) {
      setSelectedRequestId(initialRequest.id);
      setActiveTab('from_request');
    } else if (requests.length > 0 && !selectedRequestId) {
      setSelectedRequestId(requests[0].id);
    }
  }, [initialRequest, requests]);

  // Real database fetch for the selected request
  useEffect(() => {
    if (activeTab === 'from_request' && selectedRequestId) {
      let isCancelled = false;
      const fetchRequestData = async () => {
        setIsLoadingDbRequest(true);
        try {
          const { data, error } = await supabase
            .from('inspection_requests')
            .select('*')
            .eq('id', selectedRequestId)
            .single();

          if (!isCancelled) {
            setIsLoadingDbRequest(false);
            if (data && !error) {
              setFullDbRequest(data as InspectionRequest);
            }
          }
        } catch (err) {
          console.error('Error fetching full request from database:', err);
          if (!isCancelled) setIsLoadingDbRequest(false);
        }
      };

      fetchRequestData();

      return () => {
        isCancelled = true;
      };
    }
  }, [activeTab, selectedRequestId]);

  // Compute extraction result based on current tab selection
  const extractionResult: BodyExtractionResult = useMemo(() => {
    if (activeTab === 'from_request') {
      const targetReq =
        fullDbRequest ||
        requests.find((r) => r.id === selectedRequestId) ||
        initialRequest ||
        {};
      return extractBodyDamageData(targetReq, customFindingCategories, predefinedFindings);
    } else if (activeTab === 'preset') {
      const preset = TEST_PRESETS.find((p) => p.id === selectedPresetId) || TEST_PRESETS[0];
      const mockReq: Partial<InspectionRequest> = {
        car_snapshot: { make_ar: preset.carText, make_en: '', model_ar: '', model_en: '', year: 2023 },
        structured_findings: (preset.mockFindings || []).map((mf, idx) => ({
          findingId: `preset-find-${idx}`,
          findingName: mf.name,
          value: mf.value,
          categoryId: 'cat-body',
        })),
        category_notes: {
          'cat-body': preset.notesText
            ? preset.notesText.split('\n').map((line, idx) => ({
                id: `pn-${idx}`,
                text: line,
                authorId: '1',
                authorName: 'الفني',
              }))
            : [],
        },
      };
      const mockCategories: CustomFindingCategory[] = [
        { id: 'cat-body', name: 'البدي' },
      ];
      return extractBodyDamageData(mockReq, mockCategories, [], {
        carText: preset.carText,
        notesText: preset.notesText,
      });
    } else {
      return extractBodyDamageData({}, customFindingCategories, predefinedFindings, {
        carText: customCarName,
        notesText: customNotes,
      });
    }
  }, [
    activeTab,
    selectedRequestId,
    fullDbRequest,
    selectedPresetId,
    customCarName,
    customNotes,
    requests,
    initialRequest,
    customFindingCategories,
    predefinedFindings,
  ]);

  // Sync editablePrompt when extractionResult changes
  useEffect(() => {
    setEditablePrompt(extractionResult.prompt);
  }, [extractionResult.prompt]);

  // Trigger Image Generation
  const handleGenerate = async () => {
    if (!activeApiKey) {
      addNotification({
        title: 'مفتاح API مفقود',
        message: 'يرجى إعداد "مفتاح مولد الصور" في الإعدادات > ربط الخدمات (API).',
        type: 'error',
      });
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const result = await generateCarExplodedImage(activeApiKey, editablePrompt, {
        aspectRatio,
      });
      setGeneratedImageUrl(result.imageUrl);
      addNotification({
        title: 'تم التوليد بنجاح',
        message: 'تم إنشاء الرسم الفني ثلاثي الأبعاد للهيكل بنجاح.',
        type: 'success',
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'حدث خطأ أثناء توليد الصورة.';
      setGenerationError(errorMsg);
      addNotification({
        title: 'خطأ في التوليد',
        message: errorMsg,
        type: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download Generated Image
  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const sanitizedCar = (extractionResult.carName || 'car').replace(/\s+/g, '-');
    const filename = `exploded-view-${sanitizedCar}-${Date.now()}.png`;
    downloadImageFile(generatedImageUrl, filename);
    addNotification({
      title: 'تم التحميل',
      message: 'تم حفظ الصورة إلى جهازك بنجاح.',
      type: 'success',
    });
  };

  // Copy Prompt to Clipboard
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(editablePrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
    addNotification({
      title: 'تم النسخ',
      message: 'تم نسخ البرومبت الهندسي إلى الحافظة.',
      type: 'info',
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مختبر الرسم الفني ثلاثي الأبعاد للهيكل (3D Exploded Visualizer)"
      size="5xl"
    >
      <div className="space-y-6">
        {/* API Key Status Notice */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeApiKey ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              حالة مفتاح التوليد:
            </span>
            {activeApiKey ? (
              <span className="px-2 py-0.5 rounded font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {isUsingDedicatedKey
                  ? 'مفتاح مولد الصور المخصص مفعّل'
                  : 'يعمل عبر مفتاح Gemini الأساسي'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold">
                غير متوفر - يرجى إدخال المفتاح في الإعدادات
              </span>
            )}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            النموذج الاقتصادي السريع:{' '}
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
              gemini-3.1-flash-lite-image
            </span>
          </div>
        </div>

        {/* Source Selection Tabs */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              مصدر بيانات الفحص للتجربة
            </h4>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('from_request')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'from_request'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                📋 من تقارير النظام الحالية ({requests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preset')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'preset'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ⚡ نماذج فحص جاهزة (Presets)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'custom'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ✏️ إدخال يدوي مخصص
              </button>
            </div>
          </div>

          {/* Tab 1: Existing System Requests */}
          {activeTab === 'from_request' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر تقرير فحص من النظام لتحليل أضرار البدي فيه:
              </label>
              {requests.length === 0 ? (
                <p className="text-xs text-amber-600 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
                  لا توجد طلبات فحص مسجلة حالياً في النظام. يمكنك استخدام "نماذج فحص جاهزة" للتجربة.
                </p>
              ) : (
                <select
                  value={selectedRequestId}
                  onChange={(e) => setSelectedRequestId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {requests.map((r) => {
                    const carInfo = r.car_snapshot
                      ? `${r.car_snapshot.make_ar || ''} ${r.car_snapshot.model_ar || ''} ${
                          r.car_snapshot.year || ''
                        }`
                      : 'سيارة بدون بيانات';
                    const plate = r.car_snapshot?.plate_number || 'بدون لوحة';
                    const clientName = clients.find(c => c.id === r.client_id)?.name || 'غير محدد';
                    return (
                      <option key={r.id} value={r.id}>
                        طلب رقم #{r.request_number || r.id.slice(0, 6)} - {carInfo} ({plate}) - العميل: {clientName}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {/* Tab 2: Presets */}
          {activeTab === 'preset' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TEST_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-3 text-right rounded-xl border transition-all text-xs ${
                    selectedPresetId === preset.id
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-bold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">{preset.title}</span>
                    {selectedPresetId === preset.id && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {preset.notesText}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Tab 3: Custom Input */}
          {activeTab === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  المركبة والموديل
                </label>
                <input
                  type="text"
                  value={customCarName}
                  onChange={(e) => setCustomCarName(e.target.value)}
                  placeholder="مثال: فورد تورس 2013"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  ملاحظات الفني / بنود البدي
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="مثال: حكات - دقات - تعديلات في البدي ورش في الرفرف الأيمن"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Analysis Output & Dynamic Camera View Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Extraction summary card */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>نتائج تحليل المحرك</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {extractionResult.damagedPanels.length} ملاحظة
              </span>
            </h4>

            {/* Car Name */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-medium">المركبة المستهدفة</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {extractionResult.carName} {extractionResult.carModelYear}
              </span>
            </div>

            {/* Dynamic Camera Angle Recommendation */}
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs font-bold">
                <SparklesIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>زاوية الكاميرا المختارة ديناميكياً:</span>
              </div>
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                {extractionResult.recommendedViewport.titleAr}
              </p>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
                {extractionResult.recommendedViewport.description}
              </p>
            </div>

            {/* Database status banner (for real requests) */}
            {activeTab === 'from_request' && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  {isLoadingDbRequest ? (
                    <>
                      <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>جاري قراءة بنود وملاحظات التقرير من قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>قراءة حية من قاعدة البيانات: {extractionResult.rawFindingsCount} بند فحص، {extractionResult.rawNotesCount} ملاحظة فنية</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Color Legend & Counts (3 Tiers) */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-slate-500 block">دليل الألوان والحالات المقروءة:</span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <div className="flex flex-col p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 flex-shrink-0" />
                    <span className="font-bold text-red-900 dark:text-red-200 text-[10px]">الرش الصريح</span>
                  </div>
                  <span className="text-[10px] text-red-700 dark:text-red-300 font-mono">
                    {extractionResult.repaintedCount} قطع
                  </span>
                </div>

                <div className="flex flex-col p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-[10px]">دقات / ملاحظات</span>
                  </div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                    {extractionResult.defectCount} ملاحظات
                  </span>
                </div>

                <div className="flex flex-col p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 text-[10px]">سليم وكالة</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">
                    {extractionResult.intactCount} قطع
                  </span>
                </div>
              </div>
            </div>

            {/* Detected Panels Badges with Damaged vs Intact toggle */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">تفاصيل الألواح:</span>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPanelsViewTab('damaged')}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      panelsViewTab === 'damaged'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    الأضرار ({extractionResult.damagedPanels.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelsViewTab('intact')}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      panelsViewTab === 'intact'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    السليم ({extractionResult.intactPanels.length})
                  </button>
                </div>
              </div>

              {panelsViewTab === 'damaged' ? (
                extractionResult.damagedPanels.length === 0 ? (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    <span>لم يتم رصد رش أو دقات في التقرير (الهيكل سليم بالكامل).</span>
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {extractionResult.damagedPanels.map((panel) => (
                      <div
                        key={panel.id}
                        className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                          panel.type === 'repainted'
                            ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                            : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold block text-slate-900 dark:text-slate-100">
                            {panel.nameAr}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {panel.descriptionAr}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            panel.type === 'repainted'
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {panel.type === 'repainted' ? 'رش' : 'دقة/ملاحظة'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                extractionResult.intactPanels.length === 0 ? (
                  <div className="text-[11px] text-slate-500 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    لم تسجل بطاقات بحالة "سليم صريح" لهذا الطلب.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {extractionResult.intactPanels.map((panel) => (
                      <div
                        key={panel.id}
                        className="p-2 rounded-lg border text-xs flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                      >
                        <div>
                          <span className="font-bold block text-slate-800 dark:text-slate-200">
                            {panel.nameAr}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {panel.descriptionAr}
                          </span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          سليم وكالة
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Canvas Preview & Generation Controls */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  معاينة المخطط ثلاثي الأبعاد
                </h4>

                {/* Aspect ratio picker */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">الأبعاد:</span>
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                    {(['4:3', '1:1', '16:9'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`px-2 py-0.5 rounded ${
                          aspectRatio === ratio
                            ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image Display Container */}
              <div className="relative min-h-[320px] max-h-[460px] bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                {isGenerating ? (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        جاري معالجة وتوليد المخطط ثلاثي الأبعاد...
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        تفكيك ألواح الهيكل • ضبط إضاءة الاستوديو • تلوين الرش والملاحظات
                      </p>
                    </div>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center p-2 group">
                    <img
                      src={generatedImageUrl}
                      alt="Car 3D Exploded Technical Diagram"
                      referrerPolicy="no-referrer"
                      className="max-h-[440px] w-auto object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-3 max-w-sm">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto">
                      <SparklesIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        جاهز لتوليد الرسم التفكيكي
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        اضغط على الزر أدناه ليقوم المحرك بإرسال البرومبت الهندسي للنموذج وتوليد صورة احترافية ثلاثية الأبعاد بدقة استوديو ناصعة.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Notice */}
              {generationError && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">فشل التوليد:</span>
                    <span>{generationError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Toolbar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !activeApiKey}
                  className="rounded-xl px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCwIcon className="w-4 h-4 animate-spin" />
                      <span>جاري التوليد...</span>
                    </>
                  ) : generatedImageUrl ? (
                    <>
                      <RefreshCwIcon className="w-4 h-4" />
                      <span>إعادة التوليد</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4" />
                      <span>توليد الرسم التفكيكي 3D</span>
                    </>
                  )}
                </Button>

                {generatedImageUrl && (
                  <Button
                    onClick={handleDownload}
                    variant="secondary"
                    className="rounded-xl px-4 text-xs font-bold flex items-center gap-1.5"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>تحميل الصورة (PNG)</span>
                  </Button>
                )}
              </div>

              {/* View/Toggle Prompt */}
              <button
                type="button"
                onClick={() => setShowPromptDetails(!showPromptDetails)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium underline underline-offset-4"
              >
                {showPromptDetails ? 'إخفاء البرومبت الهندسي' : 'معاينة البرومبت الهندسي المولد'}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Prompt Inspector */}
        {showPromptDetails && (
          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 space-y-3 animate-fade-in text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold">البرومبت الهندسي (قابل للتعديل المباشر بحرية):</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditablePrompt(extractionResult.prompt)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-sans"
                >
                  إعادة تعيين الافتراضي
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-sans flex items-center gap-1"
                >
                  <span>{copiedPrompt ? 'تم النسخ ✓' : 'نسخ النص'}</span>
                </button>
              </div>
            </div>
            <textarea
              value={editablePrompt}
              onChange={(e) => setEditablePrompt(e.target.value)}
              rows={8}
              className="w-full p-3 bg-slate-950 text-slate-100 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono leading-relaxed"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CarVisualizerModal;
