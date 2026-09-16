import React, { useState, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { compressImageFile, processScannerImageFile } from '../lib/utils';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';

interface BulkDraftUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ProcessedFile {
    id: string;
    file: File;
    originalSize: number;
    processedSize: number;
    status: 'pending' | 'scanning' | 'ready' | 'uploading' | 'success' | 'error';
    requestNumber: number | null;
    errorMessage?: string;
    previewUrl: string;
    actionOnExisting?: 'append' | 'replace';
    requestData?: {
        carMake: string;
        carModel: string;
        carYear: string;
        plateNumber: string;
        existingDraftsCount: number;
    };
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

interface DraftHeaderPreviewProps {
    file: ProcessedFile;
    index: number;
    onRemove: () => void;
    onOpenFull: () => void;
}

const DraftHeaderPreview: React.FC<DraftHeaderPreviewProps> = ({ file, index, onRemove, onOpenFull }) => {
    // 0 = جهة اليمين (Right), 100 = جهة اليسار (Left)
    const [panPosition, setPanPosition] = useState<number>(0);
    // الإزاحة الرأسية 
    const [panY, setPanY] = useState<number>(-20);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const startPanRef = useRef(0);
    const startPanYRef = useRef(-20);
    const hasDraggedRef = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        startPanRef.current = panPosition;
        startPanYRef.current = panY;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;
        const deltaX = e.clientX - startXRef.current;
        const deltaY = e.clientY - startYRef.current;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            hasDraggedRef.current = true;
        }
        const width = containerRef.current.clientWidth;
        // السحب الطبيعي بالماوس: تحريك اليد لليمين ينقل الصورة لليمين، ولليسار ينقلها لليسار
        const deltaPercent = (deltaX / width) * 100;
        const newPos = Math.max(0, Math.min(100, startPanRef.current + deltaPercent));
        setPanPosition(newPos);

        // تحريك رأسي مرن حول الإزاحة الافتراضية
        const newPosY = Math.max(-150, Math.min(10, startPanYRef.current + deltaY));
        setPanY(newPosY);
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleClick = () => {
        if (!hasDraggedRef.current && onOpenFull) {
            onOpenFull();
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        isDraggingRef.current = true;
        startXRef.current = e.touches[0].clientX;
        startYRef.current = e.touches[0].clientY;
        startPanRef.current = panPosition;
        startPanYRef.current = panY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const deltaX = e.touches[0].clientX - startXRef.current;
        const deltaY = e.touches[0].clientY - startYRef.current;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            hasDraggedRef.current = true;
        }
        const deltaPercent = (deltaX / width) * 100;
        const newPos = Math.max(0, Math.min(100, startPanRef.current + deltaPercent));
        setPanPosition(newPos);

        const newPosY = Math.max(-150, Math.min(10, startPanYRef.current + deltaY));
        setPanY(newPosY);
    };

    const handleTouchEnd = () => {
        isDraggingRef.current = false;
    };

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-28 bg-slate-950 overflow-hidden border-b border-slate-200 dark:border-slate-700/60 select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            title="اسحب بالماوس يميناً ويساراً وللأعلى والأسفل للتنقل، أو انقر للتكبير الكامل"
        >
            {/* الحاوية المكبرة للصورة - تبدأ افتراضياً نازلة بمقدار 2 سم ومن اليمين */}
            <div 
                className="absolute right-0 h-full w-[220%] max-w-none transition-transform duration-75 ease-out pointer-events-none"
                style={{
                    top: `${panY}px`,
                    transform: `translateX(${(panPosition / 100) * 54.545}%)`
                }}
            >
                <img 
                    src={file.previewUrl} 
                    alt="معاينة المسودة" 
                    className="w-full h-auto object-contain object-top block" 
                />
            </div>

            {/* شارة رقم المسودة في الزاوية */}
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shadow-sm z-10 pointer-events-none">
                #{index + 1}
            </div>

            {/* زر الحذف السريع */}
            {file.status !== 'uploading' && file.status !== 'success' && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-colors shadow-sm z-10"
                    title="إزالة هذه المسودة"
                >
                    <Icon name="close" className="w-3.5 h-3.5" />
                </button>
            )}

            {/* تلميح سحب خفيف يظهر على طرف المعاينة */}
            <div className="absolute bottom-1.5 right-2 bg-black/50 backdrop-blur-sm text-white text-[9.5px] px-1.5 py-0.5 rounded pointer-events-none opacity-60">
                ↔ اسحب بالماوس
            </div>

            {/* تدرج خفيف أسفل المستطيل */}
            <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
    );
};

const BulkDraftUploadModal: React.FC<BulkDraftUploadModalProps> = ({ isOpen, onClose }) => {
    const { fetchRequestByRequestNumber, uploadImage, updateRequest, createActivityLog, authUser, cars, carMakes, carModels } = useAppContext();
    const [files, setFiles] = useState<ProcessedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [filterType, setFilterType] = useState<'original' | 'document' | 'bw' | 'magic_color' | 'natural_compressed'>('natural_compressed');
    const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        await addFilesToQueue(droppedFiles);
    };

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            await addFilesToQueue(selectedFiles);
        }
    };

    const addFilesToQueue = async (newFiles: File[]) => {
        setIsCompressing(true);
        const processedNewFiles = await Promise.all(newFiles.map(async (file) => {
            try {
                // ضبط الحجم والجودة بناءً على نوع الفلتر
                const maxDim = filterType === 'natural_compressed' 
                    ? { maxWidth: 1600, maxHeight: 2200, quality: 0.90 } 
                    : { maxWidth: 1240, maxHeight: 1754, quality: 0.85 };
                    
                const compressed = await compressImageFile(file, maxDim);
                // تطبيق الفلتر المختار
                const filtered = await processScannerImageFile(compressed, filterType);
                return { originalFile: file, processedFile: filtered };
            } catch (error) {
                console.error("Compression/Filtering failed for", file.name, error);
                return { originalFile: file, processedFile: file }; // If fails, fallback to original
            }
        }));

        const newProcessedFiles = processedNewFiles.map(({ originalFile, processedFile }) => ({
            id: Math.random().toString(36).substring(7),
            file: processedFile,
            originalSize: originalFile.size,
            processedSize: processedFile.size,
            status: 'pending' as const,
            requestNumber: null,
            previewUrl: URL.createObjectURL(processedFile)
        }));
        
        setFiles(prev => [...prev, ...newProcessedFiles]);
        setIsCompressing(false);
    };

    const scanQRCode = async (file: File): Promise<number | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);

                // Scale down if image is too large to make scanning faster
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                URL.revokeObjectURL(img.src);
                
                if (code) {
                    let requestNumberStr = code.data;
                    try {
                        const url = new URL(code.data);
                        const pathParts = url.pathname.split('/');
                        const numberPart = pathParts.pop();
                        if (numberPart && /^\d+$/.test(numberPart)) {
                            requestNumberStr = numberPart;
                        }
                    } catch (e) {
                        const match = code.data.match(/\d+$/);
                        if (match) {
                            requestNumberStr = match[0];
                        }
                    }
                    const num = parseInt(requestNumberStr);
                    resolve(isNaN(num) ? null : num);
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                resolve(null);
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const updateFileStatus = (id: string, updates: Partial<ProcessedFile>) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    // استخراج بيانات السيارة ورقم اللوحة بدقة من الطلب ومن جدول السيارات
    const fetchCarDetailsForRequest = async (req: any) => {
        let makeName = req.car_snapshot?.make_ar || req.car_snapshot?.make_en || '';
        let modelName = req.car_snapshot?.model_ar || req.car_snapshot?.model_en || '';
        let carYear = req.car_snapshot?.year ? String(req.car_snapshot.year) : '';
        let plateNumber = '';

        // 1. البحث عن السيارة في الذاكرة أولاً
        let car = cars?.find((c: any) => c.id === req.car_id);

        // 2. إذا لم تكن موجودة أو كانت بدون لوحة، نجلبها مباشرة من جدول cars
        if ((!car || (!car.plate_number && !car.plate_number_en)) && req.car_id) {
            try {
                const { data: carData } = await supabase
                    .from('cars')
                    .select('*')
                    .eq('id', req.car_id)
                    .maybeSingle();
                if (carData) {
                    car = carData;
                }
            } catch (err) {
                console.error('Error fetching car in BulkDraftUploadModal:', err);
            }
        }

        if (car) {
            plateNumber = car.plate_number || car.plate_number_en || '';
            if (!carYear && car.year) {
                carYear = String(car.year);
            }
            if (!makeName && car.make_id) {
                const makeObj = carMakes?.find((m: any) => m.id === car.make_id);
                if (makeObj) {
                    makeName = makeObj.name_ar || makeObj.name_en || '';
                } else {
                    try {
                        const { data: mData } = await supabase.from('car_makes').select('name_ar, name_en').eq('id', car.make_id).maybeSingle();
                        if (mData) makeName = mData.name_ar || mData.name_en || '';
                    } catch (_) {}
                }
            }
            if (!modelName && car.model_id) {
                const modelObj = carModels?.find((m: any) => m.id === car.model_id);
                if (modelObj) {
                    modelName = modelObj.name_ar || modelObj.name_en || '';
                } else {
                    try {
                        const { data: mdData } = await supabase.from('car_models').select('name_ar, name_en').eq('id', car.model_id).maybeSingle();
                        if (mdData) modelName = mdData.name_ar || mdData.name_en || '';
                    } catch (_) {}
                }
            }
        }

        const carMakeClean = makeName.trim();
        const carModelClean = modelName.trim();

        return {
            carMake: carMakeClean || (!carModelClean ? 'غير محدد' : ''),
            carModel: carModelClean,
            carYear: carYear.trim(),
            plateNumber: plateNumber.trim() || 'بدون لوحة'
        };
    };

    const prepareQueue = async () => {
        setIsProcessing(true);
        const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');

        for (const fileItem of pendingFiles) {
            let reqNum = fileItem.requestNumber;
            if (!reqNum) {
                updateFileStatus(fileItem.id, { status: 'scanning' });
                reqNum = await scanQRCode(fileItem.file);
            }

            if (!reqNum) {
                updateFileStatus(fileItem.id, { 
                    status: 'error', 
                    errorMessage: 'لم يتم التعرف على QR Code. يرجى إدخال رقم الطلب يدوياً.' 
                });
                continue;
            }

            updateFileStatus(fileItem.id, { status: 'scanning', requestNumber: reqNum, errorMessage: undefined });
            try {
                const req = await fetchRequestByRequestNumber(reqNum);
                if (!req) {
                    updateFileStatus(fileItem.id, { status: 'error', errorMessage: `الطلب #${reqNum} غير موجود.` });
                    continue;
                }

                const existingDraftsCount = (req.attached_files || []).filter(f => f.type === 'internal_draft').length;
                const carDetails = await fetchCarDetailsForRequest(req);

                updateFileStatus(fileItem.id, { 
                    status: 'ready', 
                    actionOnExisting: fileItem.actionOnExisting || 'append',
                    requestData: {
                        ...carDetails,
                        existingDraftsCount
                    }
                });
            } catch (error: any) {
                console.error(error);
                updateFileStatus(fileItem.id, { status: 'error', errorMessage: 'فشل جلب بيانات الطلب.' });
            }
        }
        setIsProcessing(false);
    };

    const uploadQueue = async () => {
        setIsProcessing(true);
        const readyFiles = files.filter(f => f.status === 'ready');

        for (const fileItem of readyFiles) {
            updateFileStatus(fileItem.id, { status: 'uploading', errorMessage: undefined });
            try {
                const reqNum = fileItem.requestNumber!;
                const req = await fetchRequestByRequestNumber(reqNum);
                if (!req) {
                    updateFileStatus(fileItem.id, { status: 'error', errorMessage: `الطلب #${reqNum} غير موجود.` });
                    continue;
                }

                const timestamp = Date.now();
                const fileIndex = readyFiles.indexOf(fileItem) + 1;
                const customFileName = `Req-${reqNum}_Draft_${timestamp}_${fileIndex}`;
                
                const publicUrl = await uploadImage(fileItem.file, 'attached_files', 'drafts', customFileName);
                
                // uploadImage might change extension based on file, let's get it from the file object
                const extension = fileItem.file.name.split('.').pop() || 'webp';
                
                const newAttachment = {
                    name: `${customFileName}.${extension}`,
                    type: 'internal_draft',
                    data: publicUrl,
                    archived_by_name: authUser?.name || 'مجهول',
                    archived_at: new Date().toISOString()
                };

                let updatedFiles: any[] = [];
                if (fileItem.actionOnExisting === 'replace') {
                    // الاحتفاظ بالملفات الأخرى التي ليست مسودات واستبدال المسودات بالمسودة الجديدة
                    const nonDraftFiles = (req.attached_files || []).filter(f => f.type !== 'internal_draft');
                    updatedFiles = [...nonDraftFiles, newAttachment];
                } else {
                    // إضافة المسودة إلى المسودات والمرفقات السابقة (دمج)
                    updatedFiles = [...(req.attached_files || []), newAttachment];
                }
                
                const newLog = createActivityLog(
                    fileItem.actionOnExisting === 'replace' ? 'استبدال مسودة مجمعة' : 'أرشفة مسودة مجمعة',
                    fileItem.actionOnExisting === 'replace'
                        ? `تم استبدال المسودة القديمة للطلب #${reqNum} بمسودة جديدة عبر الأرشفة المجمعة`
                        : `تم رفع مسودة للطلب #${reqNum} عبر الأرشفة المجمعة`,
                    undefined,
                    req.id,
                    'paper-archive'
                );
                const updatedLog = newLog ? [newLog, ...(req.activity_log || [])] : (req.activity_log || []);

                await updateRequest({
                    id: req.id,
                    attached_files: updatedFiles,
                    activity_log: updatedLog
                });

                updateFileStatus(fileItem.id, { status: 'success' });
            } catch (error: any) {
                console.error(error);
                updateFileStatus(fileItem.id, { status: 'error', errorMessage: 'فشل الرفع: ' + (error.message || 'خطأ مجهول') });
            }
        }
        setIsProcessing(false);
    };

    const handleManualRequestNumber = (id: string, value: string) => {
        const num = parseInt(value);
        if (isNaN(num)) {
            updateFileStatus(id, { requestNumber: null, requestData: undefined });
            return;
        }
        updateFileStatus(id, { requestNumber: num, requestData: undefined });
    };

    const handleSearchRequest = async (id: string) => {
        const fileItem = files.find(f => f.id === id);
        if (!fileItem || !fileItem.requestNumber) return;

        updateFileStatus(id, { status: 'scanning', errorMessage: undefined });
        try {
            const req = await fetchRequestByRequestNumber(fileItem.requestNumber);
            if (req) {
                const existingDraftsCount = (req.attached_files || []).filter(f => f.type === 'internal_draft').length;
                const carDetails = await fetchCarDetailsForRequest(req);
                updateFileStatus(id, { 
                    status: 'ready', 
                    errorMessage: undefined,
                    actionOnExisting: 'append',
                    requestData: {
                        ...carDetails,
                        existingDraftsCount
                    }
                });
            } else {
                updateFileStatus(id, { status: 'error', errorMessage: `الطلب #${fileItem.requestNumber} غير موجود.` });
            }
        } catch (e) {
            console.error('Manual request lookup error:', e);
            updateFileStatus(id, { status: 'error', errorMessage: 'فشل جلب بيانات الطلب.' });
        }
    };

    const handleSameAsPrevious = (currentIndex: number) => {
        const currentFile = files[currentIndex];
        const previousFile = files[currentIndex - 1];
        if (previousFile && previousFile.requestNumber) {
             updateFileStatus(currentFile.id, { 
                 requestNumber: previousFile.requestNumber,
                 status: previousFile.requestData ? 'ready' : 'pending',
                 requestData: previousFile.requestData,
                 errorMessage: undefined
             });
        }
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={() => { if (!isProcessing) onClose(); }} title="رفع المسودات المجمع" size="5xl" fullScreen={true}>
            <div 
                className="p-4 flex flex-col h-full"
                onDragOver={handleDragOver}
                onDrop={isCompressing ? undefined : handleDrop}
            >
                {/* Hidden File Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileInput} 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    disabled={isCompressing}
                />

                {/* Top Control Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="primary" 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isCompressing || isProcessing}
                            className="flex items-center gap-2 shadow-sm font-bold text-sm"
                        >
                            <Icon name="gallery" className="w-4 h-4" />
                            <span>{isCompressing ? 'جاري معالجة الصور...' : 'اختيار صور المسودات'}</span>
                        </Button>

                        {files.length > 0 && !isProcessing && (
                            <button
                                onClick={() => setFiles([])}
                                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
                                title="إفراغ القائمة"
                            >
                                مسح الكل
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            فلتر الماسح الضوئي:
                        </span>
                        <select 
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            disabled={isCompressing || isProcessing}
                            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                            <option value="natural_compressed">ضغط ذكي (حفظ كامل الألوان والخلفية) ⭐</option>
                            <option value="magic_color">ملون ذكي (تبييض الخلفية وتوضيح الحبر)</option>
                            <option value="document">ملون (مستند عالي التباين)</option>
                            <option value="bw">أبيض وأسود</option>
                            <option value="original">أصلي (الحجم الكامل بدون ضغط)</option>
                        </select>
                    </div>
                </div>

                {/* Files Queue Grid - WhatsApp PDF Card Style */}
                <div className="flex-1 overflow-y-auto pr-1">
                    {files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center mb-4 shadow-sm">
                                <Icon name="document-report" className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                                لا توجد مسودات محددة حالياً
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                                اضغط على زر "اختيار صور المسودات" لاختيار صور المسودات من جهازك دفعة واحدة، وسيتم قراءة الباركود وضغطها بالحجم المثالي تلقائياً.
                            </p>
                            <Button 
                                variant="primary" 
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isCompressing}
                                className="flex items-center gap-2 text-sm font-bold"
                            >
                                <Icon name="gallery" className="w-4 h-4" />
                                <span>اختيار صور المسودات الآن</span>
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
                            {files.map((file, index) => (
                                <div 
                                    key={file.id} 
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                                >
                                    {/* الجزء العلوي: معاينة رأس الورقة مع زووم مكبر وتحريك تفاعلي يمين - يسار */}
                                    <DraftHeaderPreview 
                                        file={file}
                                        index={index}
                                        onRemove={() => removeFile(file.id)}
                                        onOpenFull={() => setSelectedPreviewImage(file.previewUrl)}
                                    />

                                    {/* الجزء السفلي: تفاصيل وبيانات الطلب المستخرجة */}
                                    <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                                        {/* ترويسة البطاقة: بيانات الطلب أو المسودة */}
                                        {file.requestData && file.requestNumber ? (
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white block">
                                                        طلب #{file.requestNumber}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                                                        {file.requestData.carMake} {file.requestData.carModel} {file.requestData.carYear || ''}
                                                    </p>

                                                    {/* عرض الحجم قبل وبعد مع شارة WEBP والوفر */}
                                                    <div className="flex items-center gap-1.5 text-[10.5px] font-mono mt-1 text-slate-500 dark:text-slate-400">
                                                        <span className="text-slate-400 dark:text-slate-500 line-through">
                                                            {formatBytes(file.originalSize)}
                                                        </span>
                                                        <Icon name="chevron-left" className="w-2.5 h-2.5 text-slate-400" />
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                            {formatBytes(file.processedSize)}
                                                        </span>
                                                        <span className="text-[9px] bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded font-sans font-semibold">
                                                            WEBP
                                                        </span>
                                                        {file.originalSize > file.processedSize && (
                                                            <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                                                                (-{Math.round((1 - file.processedSize / file.originalSize) * 100)}%)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* شارة رقم اللوحة بتصميم واضح ومرتب */}
                                                <div className="shrink-0 bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 px-2 py-1 rounded-md text-center min-w-[70px]">
                                                    <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block leading-none mb-0.5 font-medium">اللوحة</span>
                                                    <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 tracking-wider">
                                                        {file.requestData.plateNumber}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
                                                        مسودة #{index + 1}
                                                    </span>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {file.status === 'scanning' ? 'جاري استخراج بيانات الطلب...' : 
                                                         file.status === 'error' ? 'لم يتم العثور على الباركود تلقائياً' : 
                                                         'في انتظار قراءة الباركود'}
                                                    </p>

                                                    {/* عرض الحجم قبل وبعد */}
                                                    <div className="flex items-center gap-1.5 text-[10.5px] font-mono mt-1 text-slate-500 dark:text-slate-400">
                                                        <span className="text-slate-400 dark:text-slate-500 line-through">
                                                            {formatBytes(file.originalSize)}
                                                        </span>
                                                        <Icon name="chevron-left" className="w-2.5 h-2.5 text-slate-400" />
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                            {formatBytes(file.processedSize)}
                                                        </span>
                                                        <span className="text-[9px] bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded font-sans font-semibold">
                                                            WEBP
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* شارة الحالة */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                {file.status === 'pending' && (
                                                    <span className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                                                        في الانتظار ⏳
                                                    </span>
                                                )}
                                                {file.status === 'scanning' && (
                                                    <span className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 animate-pulse">
                                                        جاري قراءة البيانات 🔍
                                                    </span>
                                                )}
                                                {file.status === 'ready' && (
                                                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-800/40">
                                                        جاهز للرفع 📄
                                                    </span>
                                                )}
                                                {file.status === 'uploading' && (
                                                    <span className="text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 animate-pulse">
                                                        جاري الرفع 📤
                                                    </span>
                                                )}
                                                {file.status === 'success' && (
                                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                                        تم الرفع والربط بنجاح ✅
                                                    </span>
                                                )}
                                                {file.status === 'error' && (
                                                    <span className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                                        بحاجة لرقم الطلب ⚠️
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* تنبيه وجود مسودة سابقة مع خيار الإضافة أو الاستبدال */}
                                        {file.requestData && file.requestData.existingDraftsCount > 0 && (
                                            <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2 rounded-lg text-amber-900 dark:text-amber-200 text-xs">
                                                <div className="flex items-center gap-1 font-bold text-[11px] text-amber-800 dark:text-amber-300 mb-1">
                                                    <span>⚠️ يحتوي مسبقاً على {file.requestData.existingDraftsCount} مسودة</span>
                                                </div>
                                                {file.status !== 'success' && file.status !== 'uploading' && (
                                                    <div className="flex flex-col gap-1 text-[10.5px] mt-1">
                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                            <input 
                                                                type="radio" 
                                                                name={`action_${file.id}`} 
                                                                checked={file.actionOnExisting !== 'replace'} 
                                                                onChange={() => updateFileStatus(file.id, { actionOnExisting: 'append' })}
                                                                className="text-blue-600 focus:ring-blue-500 w-3 h-3"
                                                            />
                                                            <span>إضافة كصفحة جديدة (دمج)</span>
                                                        </label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                            <input 
                                                                type="radio" 
                                                                name={`action_${file.id}`} 
                                                                checked={file.actionOnExisting === 'replace'} 
                                                                onChange={() => updateFileStatus(file.id, { actionOnExisting: 'replace' })}
                                                                className="text-amber-600 focus:ring-amber-500 w-3 h-3"
                                                            />
                                                            <span className="text-amber-700 dark:text-amber-400 font-bold">استبدال المسودة السابقة</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* خطأ إن وجد */}
                                        {file.errorMessage && (
                                            <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-tight">
                                                {file.errorMessage}
                                            </p>
                                        )}

                                        {/* إدخال رقم الطلب يدوياً إذا لم يتم التعرف عليه */}
                                        {(file.status === 'error' || file.status === 'pending') && (
                                            <div className="flex flex-col gap-1.5 mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
                                                <div className="flex items-center gap-1.5">
                                                    <input 
                                                        type="number" 
                                                        placeholder="رقم الطلب"
                                                        value={file.requestNumber || ''}
                                                        onChange={(e) => handleManualRequestNumber(file.id, e.target.value)}
                                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <button 
                                                        onClick={() => handleSearchRequest(file.id)}
                                                        disabled={!file.requestNumber || (file.status as string) === 'scanning'}
                                                        className="shrink-0 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-medium text-xs shadow-sm"
                                                        title="بحث وتأكيد"
                                                    >
                                                        بحث
                                                    </button>
                                                </div>
                                                {index > 0 && files[index - 1].requestNumber && (
                                                    <button 
                                                        onClick={() => handleSameAsPrevious(index)}
                                                        className="w-full justify-center text-[11px] text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 font-medium"
                                                        title="استخدام نفس رقم الطلب السابق"
                                                    >
                                                        <Icon name="refresh-cw" className="w-3 h-3" />
                                                        السابق ({files[index - 1].requestNumber})
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {files.length > 0 && (
                            <span>
                                إجمالي المسودات: <strong className="text-slate-800 dark:text-slate-200">{files.length}</strong>
                                {files.some(f => f.status === 'ready') && (
                                    <span className="text-emerald-600 dark:text-emerald-400 mr-2 font-bold">
                                        (جاهزة للرفع: {files.filter(f => f.status === 'ready').length})
                                    </span>
                                )}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                            إغلاق
                        </Button>
                        
                        {files.some(f => f.status === 'pending' || f.status === 'error') && (
                            <Button 
                                variant="secondary" 
                                onClick={prepareQueue} 
                                disabled={isProcessing || files.length === 0}
                                className="font-bold text-sm"
                            >
                                {isProcessing ? 'جاري القراءة...' : 'قراءة البيانات والمعاينة'}
                            </Button>
                        )}

                        {files.some(f => f.status === 'ready') && !files.some(f => f.status === 'pending' || f.status === 'scanning') && (
                            <Button 
                                variant="primary" 
                                onClick={uploadQueue} 
                                disabled={isProcessing}
                                className="font-bold text-sm bg-emerald-600 hover:bg-emerald-700"
                            >
                                {isProcessing ? 'جاري الرفع...' : 'تأكيد ورفع المسودات'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* نافذة المعاينة المكبرة لكامل المسودة */}
            {selectedPreviewImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in"
                    onClick={() => setSelectedPreviewImage(null)}
                >
                    <div 
                        className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                <Icon name="document-report" className="w-4 h-4 text-blue-500" />
                                معاينة المسودة بالحجم الكامل
                            </span>
                            <button 
                                onClick={() => setSelectedPreviewImage(null)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                            >
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-auto p-2 flex items-center justify-center max-h-[82vh] bg-slate-950/20">
                            <img 
                                src={selectedPreviewImage} 
                                alt="Full Preview" 
                                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-md" 
                            />
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default BulkDraftUploadModal;
