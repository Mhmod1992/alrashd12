
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { CarMake, CarModel } from '../../types';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import SearchIcon from '../../components/icons/SearchIcon';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import PlusIcon from '../../components/icons/PlusIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import EditIcon from '../../components/icons/EditIcon';
import SparklesIcon from '../../components/icons/SparklesIcon';
import CarIcon from '../../components/icons/CarIcon';
import DownloadIcon from '../../components/icons/DownloadIcon';
import CheckCircleIcon from '../../components/icons/CheckCircleIcon';
import FilterIcon from '../../components/icons/FilterIcon';
import ArrowLeftIcon from '../../components/icons/ArrowLeftIcon';
import { GoogleGenAI, Type } from "@google/genai";
import { cleanJsonString } from '../../lib/utils';
import { supabase } from '../../lib/supabaseClient';

const LOGO_SOURCES = [
    { id: 'carlogos', name: 'CarLogos.org', domain: 'carlogos.org', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: '1000logos', name: '1000Logos.net', domain: '1000logos.net', color: 'text-red-600 bg-red-50 border-red-200' },
    { id: 'worldvector', name: 'WorldVectorLogo', domain: 'worldvectorlogo.com', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { id: 'wikipedia', name: 'Wikipedia', domain: 'wikipedia.org', color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

const AI_MODELS = [
    { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite (سريع واقتصادي)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (متوازن)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (الأكثر دقة)' },
];

const CarsManagement: React.FC = () => {
    const { 
        settings,
        carMakes, addCarMake, updateCarMake, deleteCarMake, addCarMakesBulk,
        carModels, addCarModel, updateCarModel, deleteCarModel, 
        showConfirmModal, addNotification, addCarModelsBulk, uploadImage,
        fetchCarModelsByMake, fetchCarMakes
    } = useAppContext();
    
    const [selectedMakeId, setSelectedMakeId] = useState<string | null>(null);
    const [makeSearchTerm, setMakeSearchTerm] = useState('');
    const [modelSearchTerm, setModelSearchTerm] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isModelsLoading, setIsModelsLoading] = useState(false);
    const [isLoadingMakes, setIsLoadingMakes] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    const [isMakeModalOpen, setIsMakeModalOpen] = useState(false);
    const [currentMake, setCurrentMake] = useState<Partial<CarMake>>({});
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [currentModel, setCurrentModel] = useState<Partial<CarModel>>({});
    const [isGeneratingModels, setIsGeneratingModels] = useState(false);
    const [aiModelResults, setAiModelResults] = useState<{ name_ar: string; name_en: string; selected: boolean }[]>([]);
    const [isAiModelResultModalOpen, setIsAiModelResultModalOpen] = useState(false);
    const [isGeneratingMakes, setIsGeneratingMakes] = useState(false);
    const [aiMakeResults, setAiMakeResults] = useState<{ name_ar: string; name_en: string; selected: boolean }[]>([]);
    const [isAiMakeResultModalOpen, setIsAiMakeResultModalOpen] = useState(false);
    const [isBulkFilling, setIsBulkFilling] = useState(false);
    const [bulkAiResults, setBulkAiResults] = useState<{ makeId: string; makeName: string; models: { name_ar: string; name_en: string; selected: boolean }[] }[]>([]);
    const [isBulkResultModalOpen, setIsBulkResultModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [duplicateGroups, setDuplicateGroups] = useState<{ type: string, name: string, items: CarModel[] }[]>([]);
    const [isSearchingLogo, setIsSearchingLogo] = useState(false);
    const [logoCandidates, setLogoCandidates] = useState<{ url: string; source: string; valid?: boolean }[]>([]);
    const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
    const [isBulkLogoFetching, setIsBulkLogoFetching] = useState(false);
    const [bulkLogoProgress, setBulkLogoProgress] = useState({ total: 0, current: 0, success: 0, title: '' });
    const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-flash-lite-latest');
    
    const isProcessingRef = useRef(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const load = async () => {
            setIsLoadingMakes(true);
            try {
                await fetchCarMakes();
            } finally {
                setIsLoadingMakes(false);
            }
        };
        load();
    }, [fetchCarMakes]);

    const filteredMakes = useMemo(() => {
        if (!makeSearchTerm.trim()) return carMakes;
        const term = makeSearchTerm.toLowerCase();
        return carMakes.filter(m => 
            m.name_ar.toLowerCase().includes(term) || 
            m.name_en.toLowerCase().includes(term)
        );
    }, [carMakes, makeSearchTerm]);

    const filteredModels = useMemo(() => {
        if (!selectedMakeId) return [];
        let models = carModels.filter(m => m.make_id === selectedMakeId);
        if (modelSearchTerm.trim()) {
            const term = modelSearchTerm.toLowerCase();
            models = models.filter(m => 
                m.name_ar.toLowerCase().includes(term) || 
                m.name_en.toLowerCase().includes(term)
            );
        }
        return models;
    }, [carModels, selectedMakeId, modelSearchTerm]);

    const selectedMake = useMemo(() => carMakes.find(m => m.id === selectedMakeId), [carMakes, selectedMakeId]);
    const emptyMakes = useMemo(() => carMakes.filter(make => !carModels.some(model => model.make_id === make.id)), [carMakes, carModels]);
    const makesWithoutLogos = useMemo(() => carMakes.filter(make => !make.logo_url), [carMakes]);
    const makesWithExternalLogos = useMemo(() => carMakes.filter(make => make.logo_url && make.logo_url.startsWith('http') && !make.logo_url.includes('supabase.co')), [carMakes]);

    const handleSelectMake = async (makeId: string) => {
        setSelectedMakeId(makeId);
        setIsModelsLoading(true);
        try {
            await fetchCarModelsByMake(makeId);
        } finally {
            setIsModelsLoading(false);
        }
    };

    const handleCheckDuplicates = () => {
        if (!selectedMakeId) return;
        const currentModels = carModels.filter(m => m.make_id === selectedMakeId);
        const enGroups: Record<string, CarModel[]> = {};
        currentModels.forEach(m => {
            const key = m.name_en.trim().toLowerCase();
            if(key) {
                 if(!enGroups[key]) enGroups[key] = [];
                 enGroups[key].push(m);
            }
        });
        const enDuplicates = Object.values(enGroups).filter(g => g.length > 1).map(items => ({ type: 'تطابق الاسم الإنجليزي', name: items[0].name_en, items }));
        const arGroups: Record<string, CarModel[]> = {};
        currentModels.forEach(m => {
            const key = m.name_ar.trim();
            if(key) {
                if(!arGroups[key]) arGroups[key] = [];
                arGroups[key].push(m);
            }
        });
         const arDuplicates = Object.values(arGroups).filter(g => g.length > 1).map(items => ({ type: 'تطابق الاسم العربي', name: items[0].name_ar, items }));
        const allDuplicates = [...enDuplicates, ...arDuplicates];
        if (allDuplicates.length > 0) {
            setDuplicateGroups(allDuplicates);
            setIsDuplicateModalOpen(true);
        } else {
            addNotification({ title: 'ممتاز', message: 'لم يتم العثور على موديلات مكررة.', type: 'success' });
        }
    };

    const handleDeleteDuplicate = async (modelId: string) => {
        try {
            await deleteCarModel(modelId);
            setDuplicateGroups(prevGroups => prevGroups.map(group => ({ ...group, items: group.items.filter(item => item.id !== modelId) })).filter(group => group.items.length > 1));
            addNotification({ title: 'تم الحذف', message: 'تم حذف الموديل المكرر.', type: 'success' });
        } catch (error: any) {
            addNotification({ title: 'تعذر الحذف', message: 'لا يمكن حذف هذا الموديل لأنه مرتبط بسيارات مسجلة.', type: 'error' });
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            try {
                const publicUrl = await uploadImage(file, 'logos');
                setCurrentMake(prev => ({ ...prev, logo_url: publicUrl }));
                addNotification({ title: 'نجاح', message: 'تم رفع الشعار بنجاح.', type: 'success' });
            } catch (error) {
                addNotification({ title: 'خطأ', message: 'فشل رفع الشعار.', type: 'error' });
            } finally {
                setIsUploading(false);
            }
        }
    };

    const checkImageUrl = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    const uploadViaClientProxy = async (url: string): Promise<string> => {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        const blob = await res.blob();
        const file = new File([blob], `logo_${Date.now()}.png`, { type: blob.type });
        return await uploadImage(file, 'logos');
    };

    const handleSearchLogoFromSource = async (sourceId: string) => {
        if (!currentMake.name_en?.trim()) {
            addNotification({ title: 'تنبيه', message: 'الرجاء إدخال الاسم الإنجليزي للشركة.', type: 'warning' });
            return;
        }
        if (!settings.geminiApiKey) {
            addNotification({ title: 'مفتاح API مطلوب', message: 'الرجاء إضافة Gemini API Key في الإعدادات.', type: 'error' });
            return;
        }
        setIsSearchingLogo(true);
        setActiveSourceId(sourceId);
        setLogoCandidates([]);
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            const sourceInfo = LOGO_SOURCES.find(s => s.id === sourceId);
            const response = await ai.models.generateContent({
                model: 'gemini-flash-lite-latest',
                contents: `I need direct image URLs for car brand logo "${currentMake.name_en}". Focus on ${sourceInfo?.domain}. Return JSON { "urls": [] }`,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { urls: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
            });
            const result = JSON.parse(cleanJsonString(response.text));
            const validCandidates: any[] = [];
            await Promise.all((result.urls || []).map(async (url: string) => {
                if (await checkImageUrl(url)) validCandidates.push({ url, source: sourceInfo?.name || 'Web' });
            }));
            if (validCandidates.length > 0) setLogoCandidates(validCandidates);
            else addNotification({ title: 'لا توجد نتائج', message: `لم يتم العثور على شعارات في ${sourceInfo?.name}`, type: 'warning' });
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'حدث خطأ أثناء البحث.', type: 'error' });
        } finally {
            setIsSearchingLogo(false);
        }
    };

    const handleSelectLogoCandidate = async (url: string) => {
        setIsUploading(true);
        try {
            const publicUrl = await uploadViaClientProxy(url);
            setCurrentMake(prev => ({ ...prev, logo_url: publicUrl }));
            addNotification({ title: 'تم الرفع', message: 'تم حفظ الصورة بنجاح.', type: 'success' });
        } catch (e) {
            setCurrentMake(prev => ({ ...prev, logo_url: url }));
            addNotification({ title: 'تنبيه', message: 'تم استخدام الرابط الخارجي.', type: 'warning' });
        } finally {
            setIsUploading(false);
        }
    };

    // --- Bulk Logo Fetching Logic ---
    const handleBulkFetchLogos = async () => {
        if (!settings.geminiApiKey) {
            addNotification({ title: 'مفتاح API مطلوب', message: 'الرجاء إضافة Gemini API Key في الإعدادات.', type: 'warning' });
            return;
        }

        setIsBulkLogoFetching(true);
        setBulkLogoProgress({ total: makesWithoutLogos.length, current: 0, success: 0, title: 'جاري البدء...' });

        const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
        let successCount = 0;

        for (let i = 0; i < makesWithoutLogos.length; i++) {
            const make = makesWithoutLogos[i];
            setBulkLogoProgress(prev => ({ ...prev, current: i + 1, title: `بحث عن شعار: ${make.name_en}` }));

            try {
                // Short delay to be nice to APIs
                await new Promise(r => setTimeout(r, 500));

                const prompt = `Find a direct image URL for the car logo of "${make.name_en}".
                The URL must be a direct link to a PNG or SVG image.
                Prioritize Wikimedia Commons or similar open sources.
                Return JSON: { "url": "..." } or { "url": null } if not found.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-flash-lite-latest',
                    contents: prompt,
                    config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { url: { type: Type.STRING } } } }
                });

                const result = JSON.parse(cleanJsonString(response.text));

                if (result.url) {
                    const publicUrl = await uploadViaClientProxy(result.url);
                    await updateCarMake({ ...make, logo_url: publicUrl });
                    successCount++;
                    setBulkLogoProgress(prev => ({ ...prev, success: successCount }));
                }
            } catch (error) {
                console.error(`Failed for ${make.name_en}`, error);
            }
        }

        setIsBulkLogoFetching(false);
        addNotification({ title: 'تمت العملية', message: `تم تحديث ${successCount} شعار من أصل ${makesWithoutLogos.length}.`, type: 'success' });
    };

    const handleSaveMake = async () => {
        if (!currentMake.name_ar?.trim() || !currentMake.name_en?.trim()) {
             addNotification({ title: 'بيانات ناقصة', message: 'الرجاء إدخال الاسم بالعربية والإنجليزية.', type: 'error' });
             return;
        }
        try {
            if (currentMake.id) {
                await updateCarMake(currentMake as CarMake);
                addNotification({ title: 'نجاح', message: 'تم تحديث بيانات الشركة.', type: 'success' });
            } else {
                const newMake = await addCarMake({ name_ar: currentMake.name_ar, name_en: currentMake.name_en, logo_url: currentMake.logo_url });
                handleSelectMake(newMake.id);
                addNotification({ title: 'نجاح', message: 'تم إضافة الشركة بنجاح.', type: 'success' });
            }
            setIsMakeModalOpen(false);
        } catch (error: any) {
            addNotification({ title: 'خطأ', message: error.message || 'فشل الحفظ.', type: 'error' });
        }
    };

    const handleDeleteMake = (make: CarMake) => {
        showConfirmModal({
            title: `حذف ${make.name_ar}`,
            message: 'هل أنت متأكد؟ لا يمكن حذف الشركة إذا كانت مرتبطة بسيارات مسجلة.',
            onConfirm: async () => {
                try {
                    await deleteCarMake(make.id);
                    addNotification({ title: 'نجاح', message: 'تم حذف الشركة.', type: 'success' });
                    if (selectedMakeId === make.id) setSelectedMakeId(null);
                } catch (error: any) {
                    addNotification({ title: 'تعذر الحذف', message: error.message, type: 'error' });
                }
            }
        });
    };

    const handleSaveModel = async () => {
        if (!currentModel.name_ar?.trim() || !currentModel.name_en?.trim()) {
            addNotification({ title: 'بيانات ناقصة', message: 'الرجاء إدخال اسم الموديل باللغتين.', type: 'error' });
            return;
        }
        try {
            if (currentModel.id) {
                await updateCarModel(currentModel as CarModel);
                addNotification({ title: 'نجاح', message: 'تم تحديث الموديل.', type: 'success' });
            } else {
                if (!selectedMakeId) return;
                await addCarModel({ name_ar: currentModel.name_ar, name_en: currentModel.name_en, make_id: selectedMakeId });
                addNotification({ title: 'نجاح', message: 'تم إضافة الموديل.', type: 'success' });
            }
            setIsModelModalOpen(false);
        } catch (error: any) {
            addNotification({ title: 'خطأ', message: error.message || 'فشل الحفظ.', type: 'error' });
        }
    };

    const handleDeleteModel = (model: CarModel) => {
        showConfirmModal({
            title: `حذف ${model.name_ar}`,
            message: 'هل أنت متأكد من حذف هذا الموديل؟',
            onConfirm: async () => {
                try {
                    await deleteCarModel(model.id);
                    addNotification({ title: 'نجاح', message: 'تم حذف الموديل.', type: 'success' });
                } catch (error: any) {
                    addNotification({ title: 'تعذر الحذف', message: error.message, type: 'error' });
                }
            }
        });
    };

    const handleGenerateModels = async () => {
        if (!settings.geminiApiKey) {
            addNotification({ title: 'مطلوب مفتاح API', message: 'الرجاء إضافة Gemini API Key في الإعدادات.', type: 'warning' });
            return;
        }
        if (!selectedMake) return;

        setIsGeneratingModels(true);

        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            
            // Get existing models for the selected make
            const existingModels = carModels.filter(m => m.make_id === selectedMake.id);
            const existingModelNamesEn = existingModels.map(m => m.name_en).join(', ');

            const prompt = `For the car manufacturer "${selectedMake.name_en}", suggest 15 popular or commonly known car model names.
IMPORTANT: The following models are ALREADY known, DO NOT include them: [${existingModelNamesEn}].
For each model, provide only its name (e.g. "Camry", not "Toyota Camry"), ensuring the manufacturer's name is NOT included.
Provide both the Arabic and English names.
Return strictly as a JSON array of objects: [ { "name_ar": "كامري", "name_en": "Camry" }, ... ]`;

            const response = await ai.models.generateContent({
                model: selectedAiModel,
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name_ar: { type: Type.STRING }, name_en: { type: Type.STRING } } } } }
            });
            
            const models = JSON.parse(cleanJsonString(response.text));
            if (Array.isArray(models) && models.length > 0) {
                setAiModelResults(models.map(m => ({ ...m, selected: true })));
                setIsAiModelResultModalOpen(true);
            } else {
                addNotification({ title: 'لا توجد نتائج', message: 'لم يقترح الذكاء الاصطناعي أي موديلات جديدة.', type: 'info' });
            }
        } catch (error) {
            addNotification({ title: 'خطأ في AI', message: 'حدث خطأ أثناء توليد البيانات.', type: 'error' });
        } finally { 
            setIsGeneratingModels(false); 
        }
    };

    const handleConfirmAiModels = async () => {
        const selected = aiModelResults.filter(r => r.selected);
        if (selected.length === 0 || !selectedMakeId) return;
        try {
            await addCarModelsBulk(selected.map(m => ({ name_ar: m.name_ar, name_en: m.name_en, make_id: selectedMakeId })));
            addNotification({ title: 'نجاح', message: `تم إضافة ${selected.length} موديل بنجاح.`, type: 'success' });
            setIsAiModelResultModalOpen(false);
        } catch (error) { addNotification({ title: 'خطأ', message: 'فشل حفظ الموديلات.', type: 'error' }); }
    };

    const handleGenerateMakes = async () => {
        if (!settings.geminiApiKey) {
            addNotification({ title: 'مطلوب مفتاح API', message: 'الرجاء إضافة Gemini API Key في الإعدادات.', type: 'warning' });
            return;
        }
        setIsGeneratingMakes(true);
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            const existingMakesEn = carMakes.map(m => m.name_en).join(', ');
            
            const prompt = `Suggest 20 popular car manufacturers (brands) that are commonly seen in the Middle East / Saudi Arabia market.
IMPORTANT: The following manufacturers are ALREADY known, DO NOT include them: [${existingMakesEn}].
Return JSON array of objects with "name_ar" and "name_en".`;

            const response = await ai.models.generateContent({
                model: selectedAiModel,
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name_ar: { type: Type.STRING }, name_en: { type: Type.STRING } } } } }
            });
            const makes = JSON.parse(cleanJsonString(response.text));
            if (Array.isArray(makes) && makes.length > 0) {
                setAiMakeResults(makes.map(m => ({ ...m, selected: true })));
                setIsAiMakeResultModalOpen(true);
            } else addNotification({ title: 'لا توجد نتائج', message: 'لم يقترح الذكاء الاصطناعي أي شركات جديدة.', type: 'info' });
        } catch (error) { addNotification({ title: 'خطأ في AI', message: 'حدث خطأ أثناء توليد البيانات.', type: 'error' }); }
        finally { setIsGeneratingMakes(false); }
    };

    const handleConfirmAiMakes = async () => {
        const selected = aiMakeResults.filter(r => r.selected);
        if (selected.length === 0) return;
        try {
            await addCarMakesBulk(selected.map(m => ({ name_ar: m.name_ar, name_en: m.name_en })));
            addNotification({ title: 'نجاح', message: `تم إضافة ${selected.length} شركة بنجاح.`, type: 'success' });
            setIsAiMakeResultModalOpen(false);
        } catch (error) { addNotification({ title: 'خطأ', message: 'فشل حفظ الشركات.', type: 'error' }); }
    };

    const formInputClasses = "mt-1 block w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200";

    return (
        <div className="space-y-4">
            {/* AI Model Selector */}
            <div className="flex justify-end items-center gap-2 px-1">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">نموذج الذكاء الاصطناعي:</span>
                 <select 
                    value={selectedAiModel} 
                    onChange={(e) => setSelectedAiModel(e.target.value)} 
                    className="p-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                 >
                     {AI_MODELS.map(model => (
                         <option key={model.id} value={model.id}>{model.name}</option>
                     ))}
                 </select>
            </div>

            <div className="flex flex-col md:flex-row gap-6 animate-fade-in md:h-[calc(100vh-220px)] min-h-[500px]">
                
                {/* --- Manufacturers List --- */}
                <div className={`md:w-1/3 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden ${isMobile && selectedMakeId ? 'hidden' : 'flex'}`}>
                    <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">الشركات المصنعة</h3>
                            <div className="flex gap-1">
                                <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={handleGenerateMakes}
                                    disabled={isGeneratingMakes}
                                    className="px-2"
                                    title="توليد شركات بالذكاء الاصطناعي"
                                >
                                    {isGeneratingMakes ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4 text-purple-600" />}
                                </Button>
                                {makesWithoutLogos.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleBulkFetchLogos}
                                        disabled={isBulkLogoFetching}
                                        className="px-2 text-blue-600"
                                        title={`جلب شعارات تلقائي (${makesWithoutLogos.length})`}
                                    >
                                        {isBulkLogoFetching ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                                    </Button>
                                )}
                                <Button size="sm" onClick={() => { setCurrentMake({}); setIsMakeModalOpen(true); }} className="px-3">
                                    <PlusIcon className="w-4 h-4"/>
                                </Button>
                            </div>
                        </div>
                        <div className="relative">
                            <SearchIcon className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="بحث عن شركة..." 
                                value={makeSearchTerm}
                                onChange={(e) => setMakeSearchTerm(e.target.value)}
                                className="w-full pl-3 pr-9 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    
                    {isBulkLogoFetching && (
                        <div className="mx-4 mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 animate-fade-in">
                            <div className="flex justify-between text-xs text-blue-800 dark:text-blue-300 mb-1">
                                <span>{bulkLogoProgress.title}</span>
                                <span>{bulkLogoProgress.current} / {bulkLogoProgress.total}</span>
                            </div>
                            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-full transition-all duration-300"
                                    style={{ width: `${(bulkLogoProgress.current / bulkLogoProgress.total) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[300px]">
                        {isLoadingMakes ? (
                            <div className="py-20 flex flex-col items-center justify-center">
                                <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                                <p className="text-xs text-slate-500">جاري التحميل...</p>
                            </div>
                        ) : filteredMakes.length > 0 ? (
                            filteredMakes.map(make => (
                                <div 
                                    key={make.id}
                                    onClick={() => handleSelectMake(make.id)}
                                    className={`group flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                                        selectedMakeId === make.id
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {make.logo_url ? <img src={make.logo_url} alt="logo" className="w-8 h-8 object-contain rounded bg-white p-0.5" /> : <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400"><CarIcon className="w-5 h-5" /></div>}
                                        <div className="min-w-0">
                                            <p className={`font-bold truncate ${selectedMakeId === make.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{make.name_ar}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{make.name_en}</p>
                                        </div>
                                    </div>
                                    <div className={`flex gap-1 transition-opacity ${selectedMakeId === make.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <button onClick={(e) => { e.stopPropagation(); setCurrentMake(make); setIsMakeModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-600 rounded-md"><EditIcon className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMake(make); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        ) : <div className="text-center py-20 text-slate-400 text-sm">لا توجد نتائج.</div>}
                    </div>
                </div>

                {/* --- Models View --- */}
                <div className={`md:w-2/3 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden ${isMobile && !selectedMakeId ? 'hidden' : 'flex'}`}>
                    {selectedMake ? (
                        <>
                            <div className="p-4 border-b dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {isMobile && (
                                        <button onClick={() => setSelectedMakeId(null)} className="p-2 -mr-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                            <ArrowLeftIcon className="w-5 h-5 transform scale-x-[-1]" />
                                        </button>
                                    )}
                                    {selectedMake.logo_url && <img src={selectedMake.logo_url} alt="logo" className="h-10 w-auto object-contain max-w-[60px]" />}
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">موديلات {selectedMake.name_ar}</h2>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{filteredModels.length} موديل مسجل</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="relative flex-grow sm:flex-grow-0">
                                        <input 
                                            type="text" 
                                            placeholder="بحث..." 
                                            value={modelSearchTerm}
                                            onChange={(e) => setModelSearchTerm(e.target.value)}
                                            className="w-full sm:w-32 pl-2 pr-8 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg outline-none"
                                        />
                                        <SearchIcon className="absolute right-2 top-2 w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={handleGenerateModels} disabled={isGeneratingModels} title="توليد بالذكاء الاصيل">
                                        {isGeneratingModels ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4 text-purple-600" />}
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={handleCheckDuplicates} title="فحص التكرار" className="text-orange-500">
                                        <FilterIcon className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => { setCurrentModel({}); setIsModelModalOpen(true); }} size="sm" className="px-3">
                                        <PlusIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 dark:bg-slate-900/10 min-h-[300px]">
                                {isModelsLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                                        <p className="text-xs">جاري تحميل الموديلات...</p>
                                    </div>
                                ) : filteredModels.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {filteredModels.map(model => (
                                            <div key={model.id} className="bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow group relative">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate text-sm" title={model.name_ar}>{model.name_ar}</h4>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1">{model.name_en}</p>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 left-1 bg-white/90 dark:bg-slate-800/90 p-1 rounded-md shadow-sm">
                                                    <button onClick={() => { setCurrentModel(model); setIsModelModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-600 rounded-md"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteModel(model); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10"><CarIcon className="w-12 h-12 mb-2 opacity-20" /><p className="text-sm">لا توجد موديلات لهذا البحث.</p></div>}
                            </div>
                        </>
                    ) : <div className="h-full flex flex-col items-center justify-center text-slate-400"><CarIcon className="w-20 h-20 mb-4 opacity-10" /><p className="text-lg font-semibold">اختر شركة لعرض الموديلات</p></div>}
                </div>

                {/* Modals remain the same but ensure they follow responsive sizing */}
                <Modal isOpen={isMakeModalOpen} onClose={() => setIsMakeModalOpen(false)} title={currentMake.id ? 'تعديل شركة' : 'إضافة شركة جديدة'} size="md">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">الاسم (عربي)</label><input type="text" value={currentMake.name_ar || ''} onChange={e => setCurrentMake(p => ({...p, name_ar: e.target.value}))} className={formInputClasses} placeholder="مثال: تويوتا" /></div>
                            <div><label className="block text-sm font-medium mb-1">الاسم (إنجليزي)</label><input type="text" value={currentMake.name_en || ''} onChange={e => setCurrentMake(p => ({...p, name_en: e.target.value}))} className={formInputClasses} placeholder="Ex: Toyota" style={{direction: 'ltr'}} /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">شعار الشركة (اختياري)</label>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border dark:border-slate-700 space-y-4">
                                {currentMake.name_en?.trim() && (
                                    <div className="flex flex-wrap gap-2">
                                        {LOGO_SOURCES.map(source => (
                                            <button key={source.id} onClick={() => handleSearchLogoFromSource(source.id)} disabled={isSearchingLogo} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${source.color}`}>
                                                {isSearchingLogo && activeSourceId === source.id ? <RefreshCwIcon className="w-3 h-3 animate-spin inline ml-1"/> : <SearchIcon className="w-3 h-3 inline ml-1"/>}
                                                {source.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {logoCandidates.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2 mt-4 animate-fade-in">
                                        {logoCandidates.map((candidate, idx) => (
                                            <div key={idx} onClick={() => handleSelectLogoCandidate(candidate.url)} className={`relative aspect-square bg-white border rounded-lg cursor-pointer overflow-hidden group hover:border-blue-500 ${currentMake.logo_url === candidate.url ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-200'}`}>
                                                <img src={candidate.url} alt="Logo" className="w-full h-full object-contain p-1" />
                                                {currentMake.logo_url === candidate.url && <div className="absolute top-0.5 right-0.5 text-blue-600 bg-white rounded-full"><CheckCircleIcon className="w-3.5 h-3.5" /></div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <label className={`cursor-pointer bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-gray-100 transition-colors text-center w-full flex items-center justify-center gap-2 text-sm ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                                    {isUploading ? 'جاري الرفع...' : 'رفع يدوي من الجهاز'}
                                </label>
                            </div>
                            {currentMake.logo_url && <div className="relative w-full h-20 border rounded mt-3 p-2 flex items-center justify-center bg-white"><img src={currentMake.logo_url} alt="Preview" className="max-w-full max-h-full object-contain" /><button onClick={() => setCurrentMake(p => ({...p, logo_url: undefined}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5">&times;</button></div>}
                        </div>
                        <div className="flex justify-end pt-4"><Button onClick={handleSaveMake} disabled={isUploading} className="w-full sm:w-auto">حفظ الشركة</Button></div>
                    </div>
                </Modal>

                <Modal isOpen={isModelModalOpen} onClose={() => setIsModelModalOpen(false)} title={currentModel.id ? 'تعديل موديل' : `إضافة موديل لـ ${selectedMake?.name_ar}`} size="sm">
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium mb-1">الاسم (عربي)</label><input type="text" value={currentModel.name_ar || ''} onChange={e => setCurrentModel(p => ({...p, name_ar: e.target.value}))} className={formInputClasses} placeholder="مثال: كامري" /></div>
                        <div><label className="block text-sm font-medium mb-1">الاسم (إنجليزي)</label><input type="text" value={currentModel.name_en || ''} onChange={e => setCurrentModel(p => ({...p, name_en: e.target.value}))} className={formInputClasses} placeholder="Ex: Camry" style={{direction: 'ltr'}} /></div>
                        <div className="flex justify-end pt-4"><Button onClick={handleSaveModel} className="w-full sm:w-auto">حفظ الموديل</Button></div>
                    </div>
                </Modal>

                <Modal isOpen={isAiModelResultModalOpen} onClose={() => setIsAiModelResultModalOpen(false)} title="موديلات مقترحة" size="lg">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2">
                            {aiModelResults.map((model, idx) => (
                                <label key={idx} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-all ${model.selected ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'dark:border-slate-600'}`}>
                                    <input type="checkbox" checked={model.selected} onChange={(e) => { const newRes = [...aiModelResults]; newRes[idx].selected = e.target.checked; setAiModelResults(newRes); }} className="rounded text-blue-600" />
                                    <div className="text-xs">
                                        <div className="font-bold">{model.name_ar}</div>
                                        <div className="text-[10px] text-slate-500">{model.name_en}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                        <Button variant="secondary" onClick={() => setIsAiModelResultModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleConfirmAiModels}>إضافة المحددة</Button>
                    </div>
                </Modal>

                <Modal isOpen={isAiMakeResultModalOpen} onClose={() => setIsAiMakeResultModalOpen(false)} title="شركات مقترحة" size="lg">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2">
                            {aiMakeResults.map((make, idx) => (
                                <label key={idx} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-all ${make.selected ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'dark:border-slate-600'}`}>
                                    <input type="checkbox" checked={make.selected} onChange={(e) => { const newRes = [...aiMakeResults]; newRes[idx].selected = e.target.checked; setAiMakeResults(newRes); }} className="rounded text-blue-600" />
                                    <div className="text-xs">
                                        <div className="font-bold">{make.name_ar}</div>
                                        <div className="text-[10px] text-slate-500">{make.name_en}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                        <Button variant="secondary" onClick={() => setIsAiMakeResultModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleConfirmAiMakes}>إضافة المحددة</Button>
                    </div>
                </Modal>

                <Modal isOpen={isDuplicateModalOpen} onClose={() => setIsDuplicateModalOpen(false)} title="موديلات مكررة" size="lg">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        {duplicateGroups.map((group, idx) => (
                            <div key={idx} className="border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3">
                                <h4 className="font-bold text-orange-800 dark:text-orange-200 mb-2 text-sm">{group.name}</h4>
                                <div className="space-y-2">
                                    {group.items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700 text-xs">
                                            <span>{item.name_ar} | {item.name_en}</span>
                                            <button onClick={() => handleDeleteDuplicate(item.id)} className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 rounded-md"><TrashIcon className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4 border-t dark:border-slate-700"><Button onClick={() => setIsDuplicateModalOpen(false)}>إغلاق</Button></div>
                </Modal>
            </div>
        </div>
    );
};

export default CarsManagement;
