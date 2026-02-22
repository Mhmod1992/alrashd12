
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import FolderOpenIcon from '../components/icons/FolderOpenIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import CameraIcon from '../components/icons/CameraIcon';
import UploadIcon from '../components/icons/UploadIcon';
import TrashIcon from '../components/icons/TrashIcon';
import XIcon from '../components/icons/XIcon';
import { SkeletonTable } from '../components/Skeleton';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import { formatBytes } from '../lib/utils';
import DocumentScannerModal from '../components/DocumentScannerModal';
import CameraPage from '../components/CameraPage';

// --- Image Optimization Helper ---
const optimizeDocumentImage = async (file: File, grayscale: boolean = true): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const maxWidth = 1200; // Max width for documents
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Apply filters based on mode
            if (grayscale) {
                ctx.filter = 'grayscale(100%) contrast(120%)';
            } else {
                // Slight contrast boost for color documents, but no grayscale
                ctx.filter = 'contrast(105%)';
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Blob creation failed'));
                    return;
                }
                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
                resolve(newFile);
            }, 'image/jpeg', 0.7);
            
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            reject(err);
        };
    });
};

const PaperArchive: React.FC = () => {
    const { 
        clients, 
        cars, 
        carMakes, 
        carModels, 
        can, 
        addNotification, 
        updateRequest, 
        uploadImage, 
        deleteImage,
        fetchPaperArchiveRequests,
        fetchAllPaperArchiveRequests,
        fetchRequestByRequestNumber
    } = useAppContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'month' | 'custom' | 'all'>('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<InspectionRequest | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [filteredRequests, setFilteredRequests] = useState<InspectionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadStats, setUploadStats] = useState<{ original: string; compressed: string; savings: number } | null>(null);

    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerFile, setScannerFile] = useState<File | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activeArchiveTab, setActiveArchiveTab] = useState<'all' | 'public' | 'internal'>('all');

    const [isSourceChoiceModalOpen, setIsSourceChoiceModalOpen] = useState(false);
    const [currentUploadType, setCurrentUploadType] = useState<'manual_paper' | 'internal_draft'>('manual_paper');
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Fetch Logic
    const loadData = async () => {
        setIsLoading(true);
        try {
            if (dateFilter === 'all') {
                const data = await fetchAllPaperArchiveRequests();
                setFilteredRequests(data);
                setIsLoading(false);
                return;
            }

            const now = new Date();
            let start = new Date();
            let end = new Date();

            switch (dateFilter) {
                case 'today':
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'yesterday':
                    start.setDate(now.getDate() - 1);
                    start.setHours(0, 0, 0, 0);
                    end.setDate(now.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'custom':
                    if (customStartDate && customEndDate) {
                         start = new Date(customStartDate);
                         start.setHours(0, 0, 0, 0);
                         end = new Date(customEndDate);
                         end.setHours(23, 59, 59, 999);
                    } else {
                        setIsLoading(false);
                        setFilteredRequests([]);
                        return;
                    }
                    break;
            }

            const data = await fetchPaperArchiveRequests(start.toISOString(), end.toISOString());
            setFilteredRequests(data);

        } catch (error) {
             console.error("Failed to load archive data", error);
             addNotification({ title: 'خطأ', message: 'فشل تحميل البيانات.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger load on filter change
    useEffect(() => {
        loadData();
    }, [dateFilter, customStartDate, customEndDate]);

    useEffect(() => {
        if (!isUploadModalOpen) {
            setUploadStats(null);
            setScannerFile(null);
            setActiveArchiveTab('all');
        }
    }, [isUploadModalOpen]);

    const displayedRequests = useMemo(() => {
        let data = filteredRequests;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r => {
                const client = clients.find(c => c.id === r.client_id);
                const car = cars.find(c => c.id === r.car_id);
                const make = carMakes.find(m => m.id === car?.make_id);
                const model = carModels.find(m => m.id === car?.model_id);
                return (
                    r.request_number.toString().includes(q) ||
                    client?.name.toLowerCase().includes(q) ||
                    make?.name_ar.toLowerCase().includes(q) ||
                    make?.name_en.toLowerCase().includes(q) ||
                    model?.name_ar.toLowerCase().includes(q)
                );
            });
        }
        return data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [filteredRequests, searchQuery, clients, cars, carMakes, carModels]);

    const openUploadModal = async (request: InspectionRequest) => {
        setSelectedRequest(request);
        setIsUploadModalOpen(true);
        setIsLoadingDetails(true);
        setActiveArchiveTab('all');
        
        try {
            const freshRequest = await fetchRequestByRequestNumber(request.request_number);
            if (freshRequest) {
                setSelectedRequest(freshRequest);
                setFilteredRequests(prev => prev.map(r => r.id === freshRequest.id ? freshRequest : r));
            }
        } catch (error) {
            console.error("Failed to load request details", error);
        } finally {
            setIsLoadingDetails(false);
        }
    };
    
    const handleUploadClick = (type: 'manual_paper' | 'internal_draft') => {
        setCurrentUploadType(type);
        setIsSourceChoiceModalOpen(true);
    };
    
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !selectedRequest) return;
        const files: File[] = Array.from(e.target.files);

        // Single image goes to scanner
        if (files.length === 1 && files[0].type.startsWith('image/')) {
             setScannerFile(files[0]);
             setIsScannerOpen(true);
             e.target.value = ''; // Reset input
             return;
        }

        // Multiple files processed directly
        processFiles(files, currentUploadType);
        e.target.value = ''; // Reset input
    };
    
    const handleCameraCapture = (file: File) => {
        setScannerFile(file);
        setIsScannerOpen(true);
    };

    const handleScannerConfirm = (processedFile: File) => {
        setIsScannerOpen(false);
        setScannerFile(null);
        processFiles([processedFile], currentUploadType);
    };

    const processFiles = async (files: File[], type: string) => {
        if (!selectedRequest) return;
        setIsUploading(true);
        setUploadStats(null);
        let totalOriginalSize = 0;
        let totalOptimizedSize = 0;

        try {
            const newAttachments = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                totalOriginalSize += file.size;

                let optimizedFile = file;
                if (!file.name.startsWith('scanned_')) {
                     // Pass true for grayscale only if internal draft
                     const shouldGrayscale = type === 'internal_draft';
                     optimizedFile = await optimizeDocumentImage(file, shouldGrayscale);
                }
                
                totalOptimizedSize += optimizedFile.size;

                const publicUrl = await uploadImage(optimizedFile, 'attached_files'); 
                
                newAttachments.push({
                    name: `req_${selectedRequest.request_number}_${type}_${Date.now()}_${i}.jpg`,
                    type: type,
                    data: publicUrl
                });
            }

            const existingFiles = selectedRequest.attached_files || [];
            const updatedFiles = [...existingFiles, ...newAttachments];
            
            await updateRequest({
                id: selectedRequest.id,
                attached_files: updatedFiles
            });

            setSelectedRequest(prev => prev ? ({ ...prev, attached_files: updatedFiles }) : null);
            setFilteredRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, attached_files: updatedFiles } : r));

            const savings = totalOriginalSize > 0 ? Math.round(((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100) : 0;
            
            setUploadStats({
                original: formatBytes(totalOriginalSize),
                compressed: formatBytes(totalOptimizedSize),
                savings: savings
            });

            const msg = type === 'internal_draft' ? 'تم حفظ المسودة الداخلية.' : 'تمت الأرشفة بنجاح.';
            addNotification({ title: 'تم الحفظ', message: msg, type: 'success' });

            if (activeArchiveTab !== 'all') {
                if (type === 'internal_draft') setActiveArchiveTab('internal');
                else setActiveArchiveTab('public');
            }

        } catch (error: any) {
            console.error(error);
            addNotification({ title: 'خطأ', message: `فشل رفع الصور: ${error.message}`, type: 'error' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDeleteImage = async (fileUrl: string) => {
        if (!selectedRequest) return;
        const confirm = window.confirm("هل أنت متأكد من حذف هذه الصفحة من الأرشيف؟");
        if (!confirm) return;

        try {
            try {
                await deleteImage(fileUrl);
            } catch (storageError) {
                console.warn("Storage deletion warning:", storageError);
            }

            const updatedFiles = (selectedRequest.attached_files || []).filter(f => f.data !== fileUrl);
            
            await updateRequest({
                id: selectedRequest.id,
                attached_files: updatedFiles
            });
            
             setSelectedRequest(prev => prev ? ({ ...prev, attached_files: updatedFiles }) : null);
             setFilteredRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, attached_files: updatedFiles } : r));
             
             addNotification({ title: 'تم الحذف', message: 'تم حذف الصفحة.', type: 'info' });
        } catch (error) {
             console.error("DB update failed:", error);
             addNotification({ title: 'خطأ', message: 'فشل تحديث سجل الطلب.', type: 'error' });
        }
    };

    if (!can('manage_paper_archive')) {
        return <div className="p-8 text-center text-red-500">ليس لديك صلاحية الوصول لهذه الصفحة.</div>;
    }

    const getRequestStatus = (req: InspectionRequest) => {
        const hasPaper = req.attached_files && req.attached_files.length > 0;
        return hasPaper;
    };

    const paperImages = selectedRequest?.attached_files?.filter(f => f.type === 'manual_paper' || f.type === 'internal_draft') || [];
    const publicImages = paperImages.filter(f => f.type !== 'internal_draft');
    const internalImages = paperImages.filter(f => f.type === 'internal_draft');
    
    const displayedImages = activeArchiveTab === 'all' ? paperImages : (activeArchiveTab === 'public' ? publicImages : internalImages);

    return (
        <div className="container mx-auto animate-fade-in p-4 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <Icon name="folder-open" className="w-8 h-8 text-blue-600" />
                    أرشيف الورقيات
                </h2>
                
                <div className="flex flex-wrap gap-2 items-center bg-slate-200 dark:bg-slate-700 p-1.5 rounded-xl">
                    <button onClick={() => setDateFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'today' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>اليوم</button>
                    <button onClick={() => setDateFilter('yesterday')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'yesterday' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>أمس</button>
                    <button onClick={() => setDateFilter('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'month' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>هذا الشهر</button>
                    <button onClick={() => setDateFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>الكل</button>
                    <button onClick={() => setDateFilter('custom')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'custom' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>مخصص</button>
                </div>
            </div>

            {dateFilter === 'custom' && (
                <div className="mb-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
                        <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
                        <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 text-sm" />
                    </div>
                    <Button onClick={loadData} disabled={isLoading || !customStartDate || !customEndDate} size="sm">تطبيق</Button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                     <div className="relative flex-grow w-full md:max-w-md">
                        <Icon name="search" className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="بحث برقم الطلب أو اسم العميل..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pr-9 pl-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
                        {displayedRequests.length} طلبات
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                         <div className="p-12 text-center">
                            <RefreshCwIcon className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">جاري تحميل البيانات...</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase border-b dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-4 sticky right-0 z-20 bg-slate-50 dark:bg-slate-900 w-[100px] text-center">رقم الطلب</th>
                                    <th className="px-6 py-4 sticky right-[100px] z-20 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700">السيارة</th>
                                    <th className="px-6 py-4">العميل</th>
                                    <th className="px-6 py-4">التاريخ</th>
                                    <th className="px-6 py-4 text-center">حالة الأرشفة</th>
                                    <th className="px-6 py-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {displayedRequests.map(req => {
                                    const client = clients.find(c => c.id === req.client_id);
                                    const car = cars.find(c => c.id === req.car_id);
                                    const make = carMakes.find(m => m.id === car?.make_id);
                                    const model = carModels.find(m => m.id === car?.model_id);
                                    const isArchived = getRequestStatus(req);

                                    const makeEn = req.car_snapshot?.make_en || make?.name_en || '-';
                                    const modelEn = req.car_snapshot?.model_en || model?.name_en || '-';
                                    const year = req.car_snapshot?.year || car?.year || '-';
                                    const plate = car?.plate_number_en || car?.plate_number || '-';

                                    return (
                                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer" onClick={() => openUploadModal(req)}>
                                            <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-200 sticky right-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30 w-[100px] text-center">#{req.request_number}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs sticky right-[100px] z-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30 border-l border-slate-200 dark:border-slate-700">
                                                <div className="font-bold text-sm" dir="ltr">{makeEn} {modelEn} ({year})</div>
                                                <div className="text-slate-500 text-[10px] mt-1 font-mono bg-slate-100 dark:bg-slate-700 inline-block px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">{plate}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{client?.name || '-'}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                            <td className="px-6 py-4 text-center">
                                                {isArchived ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" /> مؤرشة ({req.attached_files?.length})
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                        <XIcon className="w-3.5 h-3.5" /> فارغ
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                 <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="فتح">
                                                    <Icon name="folder-open" className="w-4 h-4" />
                                                 </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {displayedRequests.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <Icon name="folder-open" className="w-12 h-12 mb-3 opacity-20" />
                                                <p>لا توجد طلبات للعرض في الفترة المحددة.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Same Modal Structure as PrintReport.tsx */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title={`أرشيف الطلب رقم #${selectedRequest?.request_number}`} size="4xl">
                <div className="flex flex-col h-[85vh] md:h-[70vh]">
                    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 p-4 overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center mb-3 flex-shrink-0">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Icon name="gallery" className="w-4 h-4" /> الصفحات المحفوظة ({displayedImages.length})
                            </h4>
                            {isLoadingDetails && (
                                <div className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
                                    <RefreshCwIcon className="w-3 h-3 animate-spin"/>
                                    جاري التحديث...
                                </div>
                            )}
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b dark:border-slate-700 mb-4">
                            <button
                                className={`flex-1 py-2 text-sm font-bold transition-colors ${activeArchiveTab === 'all' ? 'border-b-2 border-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setActiveArchiveTab('all')}
                            >
                                    الكل ({paperImages.length})
                            </button>
                            <button
                                className={`flex-1 py-2 text-sm font-bold transition-colors ${activeArchiveTab === 'public' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setActiveArchiveTab('public')}
                            >
                                    مرفقات التقرير ({publicImages.length})
                            </button>
                            <button
                                className={`flex-1 py-2 text-sm font-bold transition-colors ${activeArchiveTab === 'internal' ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                     onClick={() => setActiveArchiveTab('internal')}
                            >
                                    مسودات داخلية ({internalImages.length})
                            </button>
                        </div>

                        {/* Contextual Actions Toolbar */}
                        <div className="mb-4 flex flex-col gap-3">
                            {activeArchiveTab === 'public' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUploadClick('manual_paper')} disabled={isUploading} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                        <UploadIcon className="w-5 h-5" />
                                        <span className="font-bold text-sm">إضافة مرفق جديد (ملون)</span>
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleFileSelected} className="hidden" />
                                </div>
                            )}
                            
                            {activeArchiveTab === 'internal' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUploadClick('internal_draft')} disabled={isUploading} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                                        <Icon name="edit" className="w-5 h-5" />
                                        <span className="font-bold text-sm">إضافة مسودة (داخلي)</span>
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleFileSelected} className="hidden" />
                                </div>
                            )}

                            {activeArchiveTab === 'all' && (
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-slate-500 text-sm">
                                    يرجى اختيار تبويب "مرفقات التقرير" أو "مسودات داخلية" لإضافة ملفات جديدة.
                                </div>
                            )}

                            {/* Upload Stats */}
                            {uploadStats && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-fade-in shadow-sm flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <CheckCircleIcon className="w-4 h-4 text-green-600"/>
                                        <span className="text-xs font-bold text-green-700 dark:text-green-300">تم الرفع بنجاح (توفير {uploadStats.savings}%)</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {uploadStats.original} ➜ <span className="font-bold text-green-600">{uploadStats.compressed}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Gallery Grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            {displayedImages.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {displayedImages.map((file, idx) => (
                                        <div key={file.data || idx} className="relative group rounded-lg overflow-hidden border dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm aspect-[3/4]">
                                            <img src={file.data} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <a href={file.data} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-slate-800 hover:bg-blue-50 transition-colors">
                                                    <Icon name="eye" className="w-4 h-4" />
                                                </a>
                                                <button onClick={() => handleDeleteImage(file.data)} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] p-1 text-center truncate">
                                                {file.name}
                                                {file.type === 'internal_draft' && <span className="block text-[8px] text-yellow-300">(مسودة)</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Icon name="folder-open" className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm">لا توجد صفحات في هذا القسم.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end flex-shrink-0">
                        <Button variant="secondary" onClick={() => setIsUploadModalOpen(false)}>إغلاق</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isSourceChoiceModalOpen} onClose={() => setIsSourceChoiceModalOpen(false)} title="اختر مصدر الصورة" size="sm">
                <div className="p-4 flex flex-col gap-4">
                    <Button onClick={() => { setIsSourceChoiceModalOpen(false); setIsCameraOpen(true); }} className="w-full py-4 text-lg justify-center" variant="secondary" leftIcon={<CameraIcon className="w-6 h-6"/>}>
                        من الكاميرا
                    </Button>
                    <Button onClick={() => { setIsSourceChoiceModalOpen(false); fileInputRef.current?.click(); }} className="w-full py-4 text-lg justify-center" variant="secondary" leftIcon={<UploadIcon className="w-6 h-6"/>}>
                        من الجهاز
                    </Button>
                </div>
            </Modal>
            
            <DocumentScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                imageFile={scannerFile} 
                onConfirm={handleScannerConfirm}
                forceFilter={currentUploadType === 'internal_draft' ? 'bw' : undefined}
            />
            
            <CameraPage 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)} 
                onCapture={handleCameraCapture} 
            />
        </div>
    );
};

export default PaperArchive;
