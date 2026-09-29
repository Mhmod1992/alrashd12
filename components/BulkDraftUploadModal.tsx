import React, { useState, useRef } from 'react';
import jsQR from 'jsqr';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { compressToTargetKilobytes } from '../lib/utils';
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

const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

interface DraftHeaderPreviewProps {
    file: ProcessedFile;
    index: number;
    onRemove: () => void;
    onOpenFull: () => void;
    badgeLabel?: string;
}

const DraftHeaderPreview: React.FC<DraftHeaderPreviewProps> = ({ file, index, onRemove, onOpenFull, badgeLabel }) => {
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
        const deltaPercent = (deltaX / width) * 100;
        const newPos = Math.max(0, Math.min(100, startPanRef.current + deltaPercent));
        setPanPosition(newPos);

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
            title="اسحب بالماوس يميناً ويساراً للتنقل، أو انقر للمعاينة الكاملة"
        >
            {/* الحاوية المكبرة للصورة */}
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
            <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10.5px] font-mono px-2 py-0.5 rounded-full font-bold shadow-sm z-10 pointer-events-none flex items-center gap-1">
                <span>#{index + 1}</span>
                {badgeLabel && <span className="opacity-80 font-sans text-[9px]">{badgeLabel}</span>}
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

            {/* تلميح سحب خفيف */}
            <div className="absolute bottom-1.5 right-2 bg-black/50 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded pointer-events-none opacity-75">
                ↔ اسحب بالماوس لرؤية الهيدر
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
    const [compressProgress, setCompressProgress] = useState<{ current: number; total: number } | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{
        current: number;
        total: number;
        currentRequestNumber: number | null;
        statusText: string;
    } | null>(null);
    const [filterType, setFilterType] = useState<'original' | 'document' | 'bw' | 'magic_color' | 'natural_compressed'>('natural_compressed');
    const [selectedPreviewFile, setSelectedPreviewFile] = useState<ProcessedFile | null>(null);
    const [previewZoom, setPreviewZoom] = useState<number>(1);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (droppedFiles.length > 0) {
            await addFilesToQueue(droppedFiles);
        }
    };

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            await addFilesToQueue(selectedFiles);
            e.target.value = '';
        }
    };

    const scanQRCode = async (file: File): Promise<number | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);

                const MAX_WIDTH = 1100;
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

    // استخراج بيانات السيارة ورقم اللوحة بدقة من الطلب ومن جدول السيارات
    const fetchCarDetailsForRequest = async (req: any) => {
        let makeName = req.car_snapshot?.make_ar || req.car_snapshot?.make_en || '';
        let modelName = req.car_snapshot?.model_ar || req.car_snapshot?.model_en || '';
        let carYear = req.car_snapshot?.year ? String(req.car_snapshot.year) : '';
        let plateNumber = '';

        let car = cars?.find((c: any) => c.id === req.car_id);

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

    /**
     * معالجة الصور المختارة دفعة واحدة:
     * 1. تطبيق استراتيجية الضغط التكيفي لاستهداف نطاق 34 - 44 KB.
     * 2. قراءة الكود (QR Code) تلقائياً واستخراج بيانات الطلب فوراً.
     * 3. الفرز المباشر لمجموعتي: "فشل التعرف" و "تم التعرف على الكود".
     */
    const addFilesToQueue = async (newFiles: File[]) => {
        setIsCompressing(true);
        setCompressProgress({ current: 0, total: newFiles.length });

        const processedBatch: ProcessedFile[] = [];

        for (let i = 0; i < newFiles.length; i++) {
            const originalFile = newFiles[i];
            setCompressProgress({ current: i + 1, total: newFiles.length });

            try {
                // تطبيق استراتيجية الضغط لاستهداف نطاق 34 - 44 كيلوبايت
                const processedFile = await compressToTargetKilobytes(originalFile, {
                    filterType,
                    targetMinKB: 34,
                    targetMaxKB: 44
                });

                // محاولة التعرف التلقائي على الباركود
                const reqNum = await scanQRCode(processedFile);

                let requestData: ProcessedFile['requestData'] = undefined;
                let status: ProcessedFile['status'] = 'error';
                let errorMessage: string | undefined = undefined;

                if (reqNum) {
                    try {
                        const req = await fetchRequestByRequestNumber(reqNum);
                        if (req) {
                            const existingDraftsCount = (req.attached_files || []).filter((f: any) => f.type === 'internal_draft').length;
                            const carDetails = await fetchCarDetailsForRequest(req);
                            requestData = {
                                ...carDetails,
                                existingDraftsCount
                            };
                            status = 'ready';
                        } else {
                            errorMessage = `الطلب #${reqNum} غير مسجل بالنظام`;
                        }
                    } catch (err) {
                        console.error('Fetch request error:', err);
                        errorMessage = 'تعذر جلب بيانات الطلب';
                    }
                } else {
                    errorMessage = 'لم يتم التعرف على الكود تلقائياً';
                }

                processedBatch.push({
                    id: Math.random().toString(36).substring(7),
                    file: processedFile,
                    originalSize: originalFile.size,
                    processedSize: processedFile.size,
                    status,
                    requestNumber: reqNum || null,
                    errorMessage: status === 'error' ? errorMessage : undefined,
                    actionOnExisting: 'append',
                    previewUrl: URL.createObjectURL(processedFile),
                    requestData
                });
            } catch (err) {
                console.error("Processing failed for", originalFile.name, err);
                processedBatch.push({
                    id: Math.random().toString(36).substring(7),
                    file: originalFile,
                    originalSize: originalFile.size,
                    processedSize: originalFile.size,
                    status: 'error',
                    requestNumber: null,
                    errorMessage: 'فشل معالجة الصورة',
                    actionOnExisting: 'append',
                    previewUrl: URL.createObjectURL(originalFile)
                });
            }
        }

        setFiles(prev => [...prev, ...processedBatch]);
        setIsCompressing(false);
        setCompressProgress(null);
    };

    const updateFileStatus = (id: string, updates: Partial<ProcessedFile>) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    // إعادة فحص وقراءة الأكواد لجميع الملفات التي فشل التعرف عليها
    const prepareQueue = async () => {
        setIsProcessing(true);
        const pendingFiles = files.filter(f => f.status === 'error' || f.status === 'pending');

        for (const fileItem of pendingFiles) {
            let reqNum = fileItem.requestNumber;
            if (!reqNum) {
                updateFileStatus(fileItem.id, { status: 'scanning' });
                reqNum = await scanQRCode(fileItem.file);
            }

            if (!reqNum) {
                updateFileStatus(fileItem.id, { 
                    status: 'error', 
                    errorMessage: 'لم يتم التعرف على الكود تلقائياً. يرجى إدخال رقم الطلب يدوياً.' 
                });
                continue;
            }

            updateFileStatus(fileItem.id, { status: 'scanning', requestNumber: reqNum, errorMessage: undefined });
            try {
                const req = await fetchRequestByRequestNumber(reqNum);
                if (!req) {
                    updateFileStatus(fileItem.id, { status: 'error', errorMessage: `الطلب #${reqNum} غير موجود بالنظام.` });
                    continue;
                }

                const existingDraftsCount = (req.attached_files || []).filter(f => f.type === 'internal_draft').length;
                const carDetails = await fetchCarDetailsForRequest(req);

                updateFileStatus(fileItem.id, { 
                    status: 'ready', 
                    actionOnExisting: fileItem.actionOnExisting || 'append',
                    errorMessage: undefined,
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

    /**
     * رفع جميع المسودات الجاهزة مع إظهار المؤشر الشريطي على الشاشة
     */
    const uploadQueue = async () => {
        const readyFiles = files.filter(f => f.status === 'ready');
        if (readyFiles.length === 0) return;

        setIsProcessing(true);
        setUploadProgress({
            current: 0,
            total: readyFiles.length,
            currentRequestNumber: readyFiles[0]?.requestNumber || null,
            statusText: `بدء رفع ${readyFiles.length} مسودة إلى السيرفر...`
        });

        for (let i = 0; i < readyFiles.length; i++) {
            const fileItem = readyFiles[i];
            const reqNum = fileItem.requestNumber!;

            setUploadProgress({
                current: i,
                total: readyFiles.length,
                currentRequestNumber: reqNum,
                statusText: `جاري رفع مسودة الطلب #${reqNum}... (${i + 1} من ${readyFiles.length})`
            });

            updateFileStatus(fileItem.id, { status: 'uploading', errorMessage: undefined });

            try {
                const req = await fetchRequestByRequestNumber(reqNum);
                if (!req) {
                    updateFileStatus(fileItem.id, { status: 'error', errorMessage: `الطلب #${reqNum} غير موجود.` });
                    continue;
                }

                const timestamp = Date.now();
                const fileIndex = i + 1;
                const customFileName = `Req-${reqNum}_Draft_${timestamp}_${fileIndex}`;
                
                const publicUrl = await uploadImage(fileItem.file, 'attached_files', 'drafts', customFileName);
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
                    const nonDraftFiles = (req.attached_files || []).filter(f => f.type !== 'internal_draft');
                    updatedFiles = [...nonDraftFiles, newAttachment];
                } else {
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

            setUploadProgress({
                current: i + 1,
                total: readyFiles.length,
                currentRequestNumber: reqNum,
                statusText: `اكتمل رفع ${i + 1} من ${readyFiles.length} مسودة...`
            });
        }

        // إبقاء المؤشر للحظة عند 100% للتأكيد
        setUploadProgress(prev => prev ? { ...prev, statusText: 'تم اكتمال رفع وحفظ جميع المسودات بنجاح!' } : null);
        await new Promise(r => setTimeout(r, 600));

        setIsProcessing(false);
        setUploadProgress(null);
    };

    const handleManualRequestNumber = (id: string, value: string) => {
        const num = parseInt(value);
        if (isNaN(num)) {
            updateFileStatus(id, { requestNumber: null, requestData: undefined });
            return;
        }
        updateFileStatus(id, { requestNumber: num, requestData: undefined });
    };

    // البحث اليدوي عن الطلب عند إدخال الرقم ونقل البطاقة تلقائياً إلى "تم التعرف"
    const handleSearchRequest = async (id: string, manualNumber?: number) => {
        const fileItem = files.find(f => f.id === id);
        const reqNumberToSearch = manualNumber !== undefined ? manualNumber : fileItem?.requestNumber;
        if (!fileItem || !reqNumberToSearch) return;

        updateFileStatus(id, { status: 'scanning', requestNumber: reqNumberToSearch, errorMessage: undefined });
        try {
            const req = await fetchRequestByRequestNumber(reqNumberToSearch);
            if (req) {
                const existingDraftsCount = (req.attached_files || []).filter(f => f.type === 'internal_draft').length;
                const carDetails = await fetchCarDetailsForRequest(req);
                updateFileStatus(id, { 
                    status: 'ready', 
                    errorMessage: undefined,
                    actionOnExisting: 'append',
                    requestNumber: reqNumberToSearch,
                    requestData: {
                        ...carDetails,
                        existingDraftsCount
                    }
                });
            } else {
                updateFileStatus(id, { status: 'error', errorMessage: `الطلب #${reqNumberToSearch} غير موجود بالنظام.` });
            }
        } catch (e) {
            console.error('Manual request lookup error:', e);
            updateFileStatus(id, { status: 'error', errorMessage: 'فشل جلب بيانات الطلب.' });
        }
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    // فتح المعاينة المكبرة للصورة بعد الضغط
    const openFullPreview = (file: ProcessedFile) => {
        setSelectedPreviewFile(file);
        setPreviewZoom(1);
    };

    // تقسيم الملفات إلى المجموعتين المطلوبتين
    const failedFiles = files.filter(f => f.status === 'error' || (!f.requestData && f.status !== 'ready' && f.status !== 'success'));
    const recognizedFiles = files.filter(f => (f.status === 'ready' || f.status === 'success' || f.status === 'uploading') && f.requestData);

    const totalOriginalSize = files.reduce((acc, f) => acc + f.originalSize, 0);
    const totalProcessedSize = files.reduce((acc, f) => acc + f.processedSize, 0);

    if (!isOpen) return null;

    // دالة تقديم بطاقة المسودة
    const renderDraftCard = (file: ProcessedFile, displayIndex: number, isFailedSection: boolean) => {
        const prevRecognizedNum = recognizedFiles.length > 0 ? recognizedFiles[recognizedFiles.length - 1].requestNumber : null;

        return (
            <div 
                key={file.id} 
                className={`bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col ${
                    isFailedSection 
                        ? 'border-rose-200 dark:border-rose-900/60 ring-1 ring-rose-500/10' 
                        : 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400'
                }`}
            >
                {/* الجزء العلوي: معاينة رأس الورقة مع زووم مكبر وتحريك تفاعلي */}
                <DraftHeaderPreview 
                    file={file}
                    index={displayIndex}
                    badgeLabel={isFailedSection ? 'فشل التعرف' : 'تم التعرف'}
                    onRemove={() => removeFile(file.id)}
                    onOpenFull={() => openFullPreview(file)}
                />

                {/* الجزء السفلي: تفاصيل وبيانات الطلب أو حقل الإدخال اليدوي */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                    {/* بيانات الطلب إن وُجدت */}
                    {file.requestData && file.requestNumber ? (
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-base font-black text-slate-900 dark:text-white">
                                        طلب #{file.requestNumber}
                                    </span>
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                                        معتمد
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                                    {file.requestData.carMake} {file.requestData.carModel} {file.requestData.carYear || ''}
                                </p>
                            </div>

                            {/* شارة رقم اللوحة */}
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
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-rose-800 dark:text-rose-300">
                                        مسودة غير مرتبطة #{displayIndex + 1}
                                    </span>
                                    <span className="text-[9.5px] bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 font-bold px-1.5 py-0.2 rounded">
                                        تحتاج رقم
                                    </span>
                                </div>
                                <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-0.5 font-medium">
                                    {file.status === 'scanning' ? 'جاري الفحص والبحث...' : 'تعذر قراءة الكود تلقائياً'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* تفاصيل الحجم قبل وبعد الضغط - في نطاق 34 - 44 KB */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-[10.5px]">
                            <span className="text-slate-500 dark:text-slate-400">الحجم المعالج:</span>
                            <div className="flex items-center gap-1.5 font-mono">
                                <span className="text-slate-400 line-through">
                                    {formatBytes(file.originalSize)}
                                </span>
                                <Icon name="chevron-left" className="w-2.5 h-2.5 text-slate-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                                    {formatBytes(file.processedSize)}
                                </span>
                                <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 rounded font-sans font-bold">
                                    WebP
                                </span>
                            </div>
                        </div>
                        {file.originalSize > file.processedSize && (
                            <div className="flex items-center justify-between text-[9.5px] mt-1 pt-1 border-t border-slate-200/40 dark:border-slate-800">
                                <span className="text-slate-400">توفير المساحة:</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                    تم خفض {Math.round((1 - file.processedSize / file.originalSize) * 100)}% من الحجم ⚡
                                </span>
                            </div>
                        )}
                    </div>

                    {/* زر صريح لعرض ومعاينة الصورة بعد الضغط */}
                    <button 
                        type="button"
                        onClick={() => openFullPreview(file)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50/90 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 rounded-lg text-xs font-bold transition-all border border-blue-200/80 dark:border-blue-800/60 shadow-2xs group"
                        title="معاينة وفحص وضوح الصورة بعد تطبيق استراتيجية الضغط (34-44 KB)"
                    >
                        <Icon name="eye" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span>عرض الصورة بعد الضغط ({formatBytes(file.processedSize)})</span>
                    </button>

                    {/* شارة الحالة */}
                    <div className="flex items-center justify-between">
                        {file.status === 'scanning' && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 animate-pulse">
                                جاري البحث والربط 🔍
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

                    {/* رسالة الخطأ إن وُجدت */}
                    {file.errorMessage && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-tight bg-rose-50/60 dark:bg-rose-950/30 p-1.5 rounded border border-rose-100 dark:border-rose-900/40">
                            {file.errorMessage}
                        </p>
                    )}

                    {/* حقل إدخال رقم الطلب يدوياً لبطاقات فشل التعرف */}
                    {isFailedSection && file.status !== 'uploading' && file.status !== 'success' && (
                        <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-rose-100 dark:border-slate-700/60">
                            <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                                أدخل رقم الطلب للربط والنقل:
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input 
                                    type="number" 
                                    placeholder="مثال: 1042"
                                    value={file.requestNumber || ''}
                                    onChange={(e) => handleManualRequestNumber(file.id, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && file.requestNumber) {
                                            handleSearchRequest(file.id);
                                        }
                                    }}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                                />
                                <button 
                                    onClick={() => handleSearchRequest(file.id)}
                                    disabled={!file.requestNumber || file.status === 'scanning'}
                                    className="shrink-0 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs shadow-sm"
                                    title="بحث وتأكيد النقل"
                                >
                                    {file.status === 'scanning' ? 'جاري...' : 'ربط'}
                                </button>
                            </div>
                            
                            {/* زر الاستعانة برقم الطلب السابق المعتمد إن وجد */}
                            {prevRecognizedNum && (
                                <button 
                                    onClick={() => handleSearchRequest(file.id, prevRecognizedNum)}
                                    className="w-full justify-center text-[10.5px] text-blue-700 bg-blue-50/90 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 font-medium"
                                    title="استخدام نفس رقم آخر طلب تم التعرف عليه"
                                >
                                    <Icon name="refresh-cw" className="w-2.5 h-2.5" />
                                    <span>نفس الطلب السابق (#{prevRecognizedNum})</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const uploadPercent = uploadProgress 
        ? Math.min(100, Math.round((uploadProgress.current / Math.max(1, uploadProgress.total)) * 100))
        : 0;

    return (
        <Modal isOpen={isOpen} onClose={() => { if (!isProcessing) onClose(); }} title="رفع المسودات المجمع الذكي" size="5xl" fullScreen={true}>
            {/* أنيميشن الخطوط المائلة للمؤشر الشريطي */}
            <style>{`
                @keyframes progressBarStripes {
                    0% { background-position: 1.5rem 0; }
                    100% { background-position: 0 0; }
                }
                .animate-progress-stripes {
                    background-image: linear-gradient(
                        45deg, 
                        rgba(255, 255, 255, 0.3) 25%, 
                        transparent 25%, 
                        transparent 50%, 
                        rgba(255, 255, 255, 0.3) 50%, 
                        rgba(255, 255, 255, 0.3) 75%, 
                        transparent 75%, 
                        transparent
                    );
                    background-size: 1.5rem 1.5rem;
                    animation: progressBarStripes 1s linear infinite;
                }
            `}</style>

            <div 
                className="p-4 flex flex-col h-full relative"
                onDragOver={handleDragOver}
                onDrop={isCompressing ? undefined : handleDrop}
            >
                {/* حقل اختيار الملفات الخفي */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileInput} 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    disabled={isCompressing || isProcessing}
                />

                {/* الشريط العلوي للتحكم والخيارات */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center flex-wrap gap-2">
                        <Button 
                            variant="primary" 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isCompressing || isProcessing}
                            className="flex items-center gap-2 shadow-sm font-bold text-sm bg-blue-600 hover:bg-blue-700"
                        >
                            <Icon name="gallery" className="w-4 h-4" />
                            <span>{isCompressing ? 'جاري معالجة وضغط الصور...' : 'اختيار صور المسودات'}</span>
                        </Button>

                        {/* شارة استراتيجية الحجم */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>استراتيجية الضغط: <strong>34 - 44 KB</strong> (WebP عالية الوضوح)</span>
                        </div>

                        {files.length > 0 && !isProcessing && !isCompressing && (
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
                            فلتر الماسح:
                        </span>
                        <select 
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            disabled={isCompressing || isProcessing}
                            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                            <option value="natural_compressed">ضغط ذكي فائق الخفة (حفظ كامل الألوان) ⭐</option>
                            <option value="magic_color">ملون ذكي (تبييض الخلفية وتوضيح الحبر)</option>
                            <option value="document">ملون (مستند عالي التباين)</option>
                            <option value="bw">أبيض وأسود</option>
                            <option value="original">أصلي بدون ضغط</option>
                        </select>
                    </div>
                </div>

                {/* شريط تقدم المعالجة والضغط */}
                {isCompressing && compressProgress && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200 mb-1.5">
                            <span className="flex items-center gap-1.5">
                                <span className="animate-spin inline-block">⚙️</span>
                                جاري ضغط الصور لنطاق 34 - 44 KB وقراءة الأكواد تلقائياً...
                            </span>
                            <span>{compressProgress.current} من {compressProgress.total}</span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(compressProgress.current / compressProgress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* منطقة عرض الملفات والمجموعتين */}
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
                                اضغط على زر "اختيار صور المسودات" لاختيار صور المسودات دفعة واحدة. سيتم ضغطها بدقة لتصل إلى <strong>34 - 44 KB</strong>، وفصل الصور التي تفشل في التعرف في الأعلى والناجحة في الأسفل تلقائياً.
                            </p>
                            <Button 
                                variant="primary" 
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isCompressing}
                                className="flex items-center gap-2 text-sm font-bold bg-blue-600 hover:bg-blue-700"
                            >
                                <Icon name="gallery" className="w-4 h-4" />
                                <span>اختيار صور المسودات الآن</span>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 pb-4">
                            {/* المجموعة الأولى: فشل التعرف (تظهر في الأعلى إذا كانت موجودة) */}
                            {failedFiles.length > 0 && (
                                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-200/80 dark:border-rose-900/50 rounded-2xl">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-rose-200 dark:border-rose-900/40">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                                ⚠️
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-black text-rose-900 dark:text-rose-200">
                                                        فشل التعرف
                                                    </h3>
                                                    <span className="bg-rose-600 text-white text-[11px] px-2 py-0.2 rounded-full font-bold">
                                                        {failedFiles.length} مسودة
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 mt-0.5">
                                                    لم يتم قراءة الكود تلقائياً لهذه الصور. اسحب لمعاينة رأس الورقة واكتب رقم الطلب للربط والنقل الفوري إلى الأسفل.
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={prepareQueue}
                                            disabled={isProcessing}
                                            className="text-xs text-rose-700 dark:text-rose-300 hover:text-rose-900 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center gap-1.5 shadow-2xs"
                                        >
                                            <Icon name="refresh-cw" className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                                            <span>إعادة محاولة قراءة الأكواد</span>
                                        </button>
                                    </div>

                                    {/* شبكة بطاقات فشل التعرف */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {failedFiles.map((file, index) => renderDraftCard(file, index, true))}
                                    </div>
                                </div>
                            )}

                            {/* المجموعة الثانية: تم التعرف على الكود (تظهر في الأسفل) */}
                            {recognizedFiles.length > 0 && (
                                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-emerald-200 dark:border-emerald-900/40">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                                ✓
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                                                        تم التعرف على الكود
                                                    </h3>
                                                    <span className="bg-emerald-600 text-white text-[11px] px-2 py-0.2 rounded-full font-bold">
                                                        {recognizedFiles.length} مسودة جاهزة
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80 mt-0.5">
                                                    تم التعرف على بيانات الطلبات والمركبات بنجاح، وهي جاهزة للأرشفة والرفع مباشرة.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            <span>جاهزة للتأكيد والرفع</span>
                                        </div>
                                    </div>

                                    {/* شبكة بطاقات تم التعرف */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {recognizedFiles.map((file, index) => renderDraftCard(file, index, false))}
                                    </div>
                                </div>
                            )}

                            {/* في حالة نجاح التعرف على جميع الصور 100% */}
                            {failedFiles.length === 0 && recognizedFiles.length > 0 && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
                                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                        🎉 رائع! تم التعرف على جميع الأكواد بنجاح بنسبة 100% لجميع الصور المرفوعة.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* الشريط السفلي (Footer) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-1 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {files.length > 0 && (
                            <>
                                <span>إجمالي الصور: <strong className="text-slate-900 dark:text-white font-bold">{files.length}</strong></span>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                {failedFiles.length > 0 && (
                                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                                        فشل التعرف: {failedFiles.length}
                                    </span>
                                )}
                                {failedFiles.length > 0 && recognizedFiles.length > 0 && (
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                )}
                                {recognizedFiles.length > 0 && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        تم التعرف: {recognizedFiles.length}
                                    </span>
                                )}
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span>
                                    الحجم الإجمالي: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatBytes(totalProcessedSize)}</strong>
                                    {totalOriginalSize > totalProcessedSize && (
                                        <span className="text-slate-400 line-through mr-1">({formatBytes(totalOriginalSize)})</span>
                                    )}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                            إغلاق
                        </Button>

                        {recognizedFiles.length > 0 && (
                            <Button 
                                variant="primary" 
                                onClick={uploadQueue} 
                                disabled={isProcessing || recognizedFiles.every(f => f.status === 'success')}
                                className="font-bold text-sm bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                            >
                                <Icon name="upload" className="w-4 h-4" />
                                <span>
                                    {isProcessing 
                                        ? 'جاري الرفع...' 
                                        : recognizedFiles.every(f => f.status === 'success')
                                            ? 'تم رفع جميع المسودات بنجاح'
                                            : `تأكيد ورفع المسودات الجاهزة (${recognizedFiles.filter(f => f.status === 'ready').length})`
                                    }
                                </span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* نافذة المؤشر الشريطي عند الرفع (تظهر أثناء رفع الملفات إلى أن يتم الرفع بالكامل) */}
                {uploadProgress && (
                    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col gap-5 text-center">
                            {/* أيقونة الحالة */}
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                <Icon name="upload" className="w-8 h-8 animate-bounce" />
                            </div>

                            {/* نصوص الحالة والطلب الحالي */}
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    جاري رفع وأرشفة المسودات
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 font-medium leading-relaxed">
                                    {uploadProgress.statusText}
                                </p>
                            </div>

                            {/* المؤشر الشريطي الرئيسي */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700 dark:text-slate-300 px-1">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                        مسودة {uploadProgress.current} من {uploadProgress.total}
                                    </span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                        {uploadPercent}%
                                    </span>
                                </div>

                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 p-0.5 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                                    <div 
                                        className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 h-full rounded-full transition-all duration-300 relative animate-progress-stripes"
                                        style={{ width: `${Math.max(4, uploadPercent)}%` }}
                                    />
                                </div>
                            </div>

                            {/* تنبيه الانتظار */}
                            <div className="text-[11.5px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 py-2 px-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span>⚡</span>
                                <span>يرجى عدم إغلاق النافذة حتى اكتمال أرشفة جميع الملفات...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* نافذة المعاينة المكبرة لكامل الصورة بعد الضغط */}
            {selectedPreviewFile && (
                <div 
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 animate-fade-in"
                    onClick={() => setSelectedPreviewFile(null)}
                >
                    <div 
                        className="relative max-w-5xl w-full max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-300 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ترويسة نافذة المعاينة */}
                        <div className="p-3.5 bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-500 text-white">
                                    <Icon name="eye" className="w-4 h-4" />
                                </div>
                                <div>
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                                        معاينة الصورة بعد الضغط (نسخة الأرشفة المعالجة)
                                    </span>
                                    <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {selectedPreviewFile.requestNumber ? (
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                طلب #{selectedPreviewFile.requestNumber}
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                بدون رقم طلب
                                            </span>
                                        )}
                                        <span>•</span>
                                        <span>الحجم الأصلي: <strong className="line-through">{formatBytes(selectedPreviewFile.originalSize)}</strong></span>
                                        <span>•</span>
                                        <span>الحجم بعد الضغط: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatBytes(selectedPreviewFile.processedSize)}</strong></span>
                                        <span>•</span>
                                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                            WebP فائق الوضوح
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* أدوات التكبير والتصغير والإغلاق */}
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600 p-0.5 shadow-2xs">
                                    <button 
                                        onClick={() => setPreviewZoom(prev => Math.min(3, +(prev + 0.25).toFixed(2)))}
                                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors font-bold text-xs"
                                        title="تكبير"
                                    >
                                        +
                                    </button>
                                    <span className="px-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 min-w-[42px] text-center">
                                        {Math.round(previewZoom * 100)}%
                                    </span>
                                    <button 
                                        onClick={() => setPreviewZoom(prev => Math.max(0.5, +(prev - 0.25).toFixed(2)))}
                                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors font-bold text-xs"
                                        title="تصغير"
                                    >
                                        -
                                    </button>
                                    <button 
                                        onClick={() => setPreviewZoom(1)}
                                        className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 border-r border-slate-200 dark:border-slate-600"
                                        title="إعادة التعيين 100%"
                                    >
                                        100%
                                    </button>
                                </div>

                                <button 
                                    onClick={() => setSelectedPreviewFile(null)}
                                    className="p-1.5 rounded-lg hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 text-slate-500 transition-colors"
                                    title="إغلاق المعاينة"
                                >
                                    <Icon name="close" className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* مساحة عرض الصورة مع شريط تمرير وإمكانية الزووم */}
                        <div className="overflow-auto p-4 flex items-center justify-center max-h-[82vh] bg-slate-950/10 dark:bg-black/40 min-h-[300px]">
                            <img 
                                src={selectedPreviewFile.previewUrl} 
                                alt="المعاينة بعد الضغط" 
                                style={{ 
                                    transform: `scale(${previewZoom})`, 
                                    transformOrigin: 'top center',
                                    transition: 'transform 0.15s ease-out' 
                                }}
                                className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-lg select-none" 
                            />
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default BulkDraftUploadModal;
