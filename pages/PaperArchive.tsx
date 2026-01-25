
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest, AttachedFile } from '../types';
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
import { formatBytes } from '../lib/utils'; // Import formatBytes

// --- Image Optimization Helper ---
const optimizeDocumentImage = async (file: File): Promise<File> => {
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

            // Draw white background (for transparent PNGs)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Apply grayscale filter for document look
            ctx.filter = 'grayscale(100%) contrast(120%)';
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Export as JPEG with lower quality (60%) for compression
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Blob creation failed'));
                    return;
                }
                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
                resolve(newFile);
            }, 'image/jpeg', 0.6);
            
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
        requests, 
        clients, 
        cars, 
        carMakes, 
        carModels, 
        can, 
        addNotification, 
        updateRequest, 
        uploadImage, 
        deleteImage,
        fetchRequestsByDateRange,
        isRefreshing
    } = useAppContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'custom'>('today');
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<InspectionRequest | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [filteredRequests, setFilteredRequests] = useState<InspectionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadStats, setUploadStats] = useState<{ original: string; compressed: string; savings: number } | null>(null);

    // Initial Fetch for "Today"
    useEffect(() => {
        const load = async () => {
            if (dateFilter === 'all') {
                // Client side filtering for 'all' based on loaded requests (limited) or search
                 setFilteredRequests(requests);
            } else {
                setIsLoading(true);
                const date = dateFilter === 'today' ? new Date() : new Date(customDate);
                const start = new Date(date); start.setHours(0,0,0,0);
                const end = new Date(date); end.setHours(23,59,59,999);
                
                // Fetch specifically for the date range to ensure we have all data
                const fetched = await fetchRequestsByDateRange(start.toISOString(), end.toISOString());
                setFilteredRequests(fetched);
                setIsLoading(false);
            }
        };
        load();
    }, [dateFilter, customDate, requests, fetchRequestsByDateRange]);

    // Reset stats when modal closes or request changes
    useEffect(() => {
        if (!isUploadModalOpen) {
            setUploadStats(null);
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

    const openUploadModal = (request: InspectionRequest) => {
        setSelectedRequest(request);
        setIsUploadModalOpen(true);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !selectedRequest) return;
        const files: File[] = Array.from(e.target.files);
        processFiles(files);
    };

    const processFiles = async (files: File[]) => {
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

                // Optimize
                const optimizedFile = await optimizeDocumentImage(file);
                totalOptimizedSize += optimizedFile.size;

                // Upload - Using 'note_images' bucket as backup, or try 'attached_files' if it exists
                // We use 'note_images' here for consistency based on previous context fix
                const publicUrl = await uploadImage(optimizedFile, 'note_images'); 
                
                newAttachments.push({
                    name: `req_${selectedRequest.request_number}_page_${Date.now()}_${i}.jpg`,
                    type: 'manual_paper',
                    data: publicUrl
                });
            }

            // Update Request
            const existingFiles = selectedRequest.attached_files || [];
            const updatedFiles = [...existingFiles, ...newAttachments];
            
            await updateRequest({
                id: selectedRequest.id,
                attached_files: updatedFiles
            });

            // Update local state immediately
            setSelectedRequest(prev => prev ? ({ ...prev, attached_files: updatedFiles }) : null);
            setFilteredRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, attached_files: updatedFiles } : r));

            const savings = totalOriginalSize > 0 ? Math.round(((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100) : 0;
            
            setUploadStats({
                original: formatBytes(totalOriginalSize),
                compressed: formatBytes(totalOptimizedSize),
                savings: savings
            });

            addNotification({ 
                title: 'تم الحفظ والأرشفة', 
                message: `تم رفع ${newAttachments.length} صفحة بنجاح.`, 
                type: 'success' 
            });

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
            // Try to delete from storage, but do not block if it fails (e.g. file already gone)
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
            
             // Update local state
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
        const hasPaper = req.attached_files?.some(f => f.type === 'manual_paper');
        return hasPaper;
    };

    const paperImages = selectedRequest?.attached_files?.filter(f => f.type === 'manual_paper') || [];

    return (
        <div className="container mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <Icon name="folder-open" className="w-8 h-8 text-blue-600" />
                    أرشيف الورقيات
                </h2>
                
                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                    <button onClick={() => setDateFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'today' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>اليوم</button>
                    <button onClick={() => setDateFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>الكل</button>
                     <div className="relative flex items-center px-2">
                        <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); setDateFilter('custom'); }} className="bg-transparent border-none text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-0 p-0" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex gap-4">
                     <div className="relative flex-grow max-w-md">
                        <Icon name="search" className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="بحث برقم الطلب أو اسم العميل..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pr-9 pl-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading || isRefreshing ? (
                         <div className="p-6">
                            <SkeletonTable rows={5} />
                        </div>
                    ) : (
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase border-b dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">رقم الطلب</th>
                                    <th className="px-6 py-4">العميل</th>
                                    <th className="px-6 py-4">السيارة</th>
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

                                    return (
                                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer" onClick={() => openUploadModal(req)}>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">#{req.request_number}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{client?.name || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">{make?.name_ar} {model?.name_ar} {car?.year}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                            <td className="px-6 py-4 text-center">
                                                {isArchived ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" /> مؤرشف
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                        <XIcon className="w-3.5 h-3.5" /> غير مؤرشف
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                 <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                                                    <Icon name="upload" className="w-4 h-4" />
                                                 </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {displayedRequests.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <Icon name="folder-open" className="w-12 h-12 mb-3 opacity-20" />
                                                <p>لا توجد طلبات للعرض.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Upload / View Modal */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title={`أرشفة الطلب رقم #${selectedRequest?.request_number}`} size="4xl">
                <div className="flex flex-col h-[70vh]">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                        {/* Right: Existing Images */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 p-4 flex flex-col overflow-hidden">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                <Icon name="gallery" className="w-4 h-4" /> الصفحات المحفوظة ({paperImages.length})
                            </h4>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                {paperImages.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {paperImages.map((file, idx) => (
                                            <div key={file.data || idx} className="relative group rounded-lg overflow-hidden border dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm">
                                                <img src={file.data} alt={`Page ${idx + 1}`} className="w-full h-40 object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <a href={file.data} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-slate-800 hover:bg-blue-50 transition-colors">
                                                        <Icon name="eye" className="w-4 h-4" />
                                                    </a>
                                                    <button onClick={() => handleDeleteImage(file.data)} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 text-center truncate">
                                                    {file.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <p>لا توجد صفحات مؤرشفة.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Left: Upload Actions */}
                        <div className="flex flex-col justify-center gap-6 p-4">
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">إضافة صفحات جديدة</h3>
                                <p className="text-sm text-slate-500">سيتم معالجة الصور تلقائياً (أبيض وأسود، ضغط الحجم) للحفاظ على مساحة التخزين.</p>
                            </div>

                            <label className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-2xl cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-md mb-3 group-hover:scale-110 transition-transform text-blue-600">
                                    {isUploading ? <RefreshCwIcon className="w-8 h-8 animate-spin" /> : <UploadIcon className="w-8 h-8" />}
                                </div>
                                <span className="font-bold text-blue-700 dark:text-blue-300">رفع ملفات (ماسح ضوئي)</span>
                                <span className="text-xs text-blue-500 mt-1">اختر صور من الجهاز</span>
                            </label>

                            <label className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 rounded-2xl cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-md mb-3 group-hover:scale-110 transition-transform text-purple-600">
                                    <CameraIcon className="w-8 h-8" />
                                </div>
                                <span className="font-bold text-purple-700 dark:text-purple-300">تصوير بالكاميرا</span>
                                <span className="text-xs text-purple-500 mt-1">التقاط صورة مباشرة للورقة</span>
                            </label>

                            {/* --- Upload Statistics Display --- */}
                            {uploadStats && (
                                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-fade-in">
                                    <h5 className="text-xs font-bold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                                        <CheckCircleIcon className="w-4 h-4"/>
                                        إحصائيات الضغط (آخر عملية)
                                    </h5>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400">الحجم الأصلي:</span>
                                            <span className="font-mono font-bold text-red-600 dark:text-red-400">{uploadStats.original}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400">بعد الضغط:</span>
                                            <span className="font-mono font-bold text-green-600 dark:text-green-400">{uploadStats.compressed}</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800/50 text-center">
                                        <span className="text-[10px] font-bold text-green-700 dark:text-green-300">تم توفير {uploadStats.savings}% من المساحة</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end">
                        <Button variant="secondary" onClick={() => setIsUploadModalOpen(false)}>إغلاق</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PaperArchive;
