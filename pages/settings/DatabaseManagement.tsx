import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { InspectionRequest, CarMake, CarModel, InspectionType, CustomFindingCategory, PredefinedFinding, DraftSettings } from '../../types';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import CustomDatePicker from '../../components/CustomDatePicker';
import { formatBytes, uuidv4 } from '../../lib/utils';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import DownloadIcon from '../../components/icons/DownloadIcon';


const CircularProgress: React.FC<{ percentage: number, size?: number, strokeWidth?: number }> = ({ percentage, size = 160, strokeWidth = 12 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    let color = 'stroke-blue-500';
    if (percentage > 90) color = 'stroke-red-500';
    else if (percentage > 75) color = 'stroke-yellow-500';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="w-full h-full" viewBox={`0 0 ${size} ${size}`}>
                <circle
                    className="text-slate-200 dark:text-slate-700"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`transition-all duration-500 ease-in-out ${color}`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">{Math.round(percentage)}%</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">مستخدم</span>
            </div>
        </div>
    );
};

const DangerZone: React.FC = () => {
    const { factoryResetOperations, factoryResetFull, authUser } = useAppContext();
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [resetType, setResetType] = useState<'ops' | 'full' | null>(null);
    const [confirmText, setConfirmText] = useState('');

    if (authUser?.role !== 'general_manager') return null;

    const handleResetClick = (type: 'ops' | 'full') => {
        setResetType(type);
        setConfirmText('');
        setIsConfirmModalOpen(true);
    };

    const handleConfirmReset = async () => {
        if (confirmText !== 'تصفير') return;
        if (resetType === 'ops') await factoryResetOperations();
        else if (resetType === 'full') await factoryResetFull();
        setIsConfirmModalOpen(false);
    };

    return (
        <div className="mt-12 p-6 border-2 border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 rounded-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-4">
                <Icon name="delete" className="w-6 h-6" />
                منطقة الخطر (إدارة البيانات الحساسة)
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400/80 mb-6">
                هذه الإجراءات نهائية ولا يمكن التراجع عنها. استخدمها فقط لتصفير بيانات التجارب والبدء من جديد.
                سيتم مسح البيانات مباشرة من السيرفر.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={() => handleResetClick('ops')}
                    className="flex-1 p-4 bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/50 rounded-xl text-right hover:border-red-500 transition-all group"
                >
                    <div className="font-bold text-red-600 mb-1 group-hover:text-red-500">تصفير العمليات فقط</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">يمسح جميع الطلبات، المصروفات، الإشعارات. يبقي على الموظفين والإعدادات. يحل مشكلة "السيارة زارتنا من قبل" للطلبات التجريبية.</div>
                </button>
                
                <button 
                    onClick={() => handleResetClick('full')}
                    className="flex-1 p-4 bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/50 rounded-xl text-right hover:border-red-500 transition-all group"
                >
                    <div className="font-bold text-red-600 mb-1 group-hover:text-red-500">تصفير شامل (Requests + Cars)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">يمسح كل شيء ما عدا الموظفين والإعدادات. يحذف قاعدة العملاء والسيارات أيضاً.</div>
                </button>
            </div>

            <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="تأكيد التصفير النهائي" size="md">
                <div className="text-center space-y-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-red-600">
                        <Icon name="delete" className="w-8 h-8" />
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 font-bold">
                        أنت على وشك مسح جميع بيانات {resetType === 'ops' ? 'العمليات والطلبات' : 'العمليات والعملاء والسيارات'}.
                    </p>
                    <p className="text-sm text-red-500">هذا الإجراء سيقوم بحذف السجلات من السيرفر نهائياً.</p>
                    <div className="pt-4">
                        <label className="block text-xs font-bold text-slate-500 mb-2">اكتب كلمة "تصفير" للمتابعة:</label>
                        <input 
                            type="text" 
                            value={confirmText} 
                            onChange={e => setConfirmText(e.target.value)} 
                            className="w-full p-3 text-center border-2 border-red-200 dark:border-red-900 rounded-lg focus:ring-red-500 bg-white dark:bg-slate-900 text-red-600 font-bold" 
                            placeholder="تصفير"
                        />
                    </div>
                    <div className="flex gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)} className="flex-1">إلغاء</Button>
                        <Button 
                            variant="danger" 
                            onClick={handleConfirmReset} 
                            disabled={confirmText !== 'تصفير'}
                            className="flex-1"
                        >
                            تأكيد المسح النهائي
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const DatabaseManagement: React.FC = () => {
    const { 
        requests, clients, cars, carMakes, carModels, deleteRequestsBatch, 
        showConfirmModal, addNotification, settings, updateSettings, currentDbUsage,
        inspectionTypes, addInspectionType, customFindingCategories, addFindingCategory,
        predefinedFindings, addPredefinedFinding, uploadImage, addCarMakesBulk, addCarModelsBulk,
        authUser, addRequest, addCarMake, addCarModel
    } = useAppContext();

    // State for filters and selection
    const [filterType, setFilterType] = useState<'month' | 'range'>('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
    const [capacityInput, setCapacityInput] = useState<number>(settings.databaseCapacity || 500);
    
    // Import/Export States
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState<string | null>(null);
    const [importProgress, setImportProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importType, setImportType] = useState<'requests' | null>(null);

    useEffect(() => {
        setCapacityInput(settings.databaseCapacity || 500);
    }, [settings.databaseCapacity]);

    const urlToBase64 = async (url: string): Promise<string | null> => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        try {
            const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
            if (!response.ok) return null;
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to convert image to base64:', url, error);
            return null;
        }
    };

    const base64ToFile = (base64String: string, filename: string): File => {
        const arr = base64String.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const handleImportRequests = async (data: any) => {
        if (!Array.isArray(data.data)) throw new Error('بيانات غير صالحة.');
        setImportProgress(`جاري استيراد ${data.data.length} طلب...`);

        try {
            for (const req of data.data) {
                // 1. Process general_notes images
                const processedGeneralNotes = req.general_notes ? await Promise.all(req.general_notes.map(async (note: any) => {
                    let newImageUrl = note.image;
                    if (note.imageBase64) {
                        const imageFile = base64ToFile(note.imageBase64, `note_${Date.now()}.png`);
                        newImageUrl = await uploadImage(imageFile, 'note_images');
                    }
                    return { ...note, image: newImageUrl, authorId: authUser?.id, authorName: authUser?.name };
                })) : [];

                // 2. Process category_notes images
                const processedCategoryNotes: Record<string, any[]> = {};
                if (req.category_notes) {
                    for (const [catId, notes] of Object.entries(req.category_notes)) {
                        processedCategoryNotes[catId] = await Promise.all((notes as any[]).map(async (note) => {
                            let newImageUrl = note.image;
                            if (note.imageBase64) {
                                const imageFile = base64ToFile(note.imageBase64, `note_${Date.now()}.png`);
                                newImageUrl = await uploadImage(imageFile, 'note_images');
                            }
                            return { ...note, image: newImageUrl, authorId: authUser?.id, authorName: authUser?.name };
                        }));
                    }
                }

                // 3. Prepare request for insertion
                const { id, request_number, ...requestData } = req;
                
                await addRequest({
                    ...requestData,
                    general_notes: processedGeneralNotes,
                    category_notes: processedCategoryNotes,
                    employee_id: authUser?.id || null,
                    status: req.status || 'جديد',
                    created_at: new Date().toISOString()
                } as any);
            }
        } catch (error) {
            console.error('Import requests error:', error);
            throw error;
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !importType) return;

        setIsImporting(importType);
        setImportProgress('جاري قراءة الملف...');

        try {
            const fileContent = await file.text();
            const importedData = JSON.parse(fileContent);

            if (importType === 'requests') {
                await handleImportRequests(importedData);
            }

            addNotification({ title: 'تم الاستيراد', message: 'تم استيراد البيانات بنجاح.', type: 'success' });
        } catch (error: any) {
            console.error('Import error:', error);
            addNotification({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء الاستيراد.', type: 'error' });
        } finally {
            setIsImporting(null);
            setImportProgress('');
            setImportType(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const triggerImport = (type: 'requests') => {
        setImportType(type);
        fileInputRef.current?.click();
    };

    const formInputClasses = "block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    const availableYears = useMemo(() => {
        const years = new Set(requests.map(r => new Date(r.created_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [requests]);

    const months = [
        { value: 1, name: 'يناير' }, { value: 2, name: 'فبراير' }, { value: 3, name: 'مارس' },
        { value: 4, name: 'أبريل' }, { value: 5, name: 'مايو' }, { value: 6, name: 'يونيو' },
        { value: 7, name: 'يوليو' }, { value: 8, name: 'أغسطس' }, { value: 9, name: 'سبتمبر' },
        { value: 10, name: 'أكتوبر' }, { value: 11, name: 'نوفمبر' }, { value: 12, name: 'ديسمبر' },
    ];

    const filteredRequests = useMemo(() => {
        return requests.filter(request => {
            const requestDate = new Date(request.created_at);
            if (filterType === 'month') {
                if(!selectedYear || !selectedMonth) return false;
                return requestDate.getFullYear() === selectedYear && requestDate.getMonth() + 1 === selectedMonth;
            }
            if (filterType === 'range') {
                if (!startDate || !endDate) return false;
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                return requestDate >= start && requestDate <= end;
            }
            return true;
        });
    }, [requests, filterType, selectedYear, selectedMonth, startDate, endDate]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRequestIds(new Set(filteredRequests.map(r => r.id)));
        } else {
            setSelectedRequestIds(new Set());
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedRequestIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectedRequests = useMemo(() => {
        return requests.filter(r => selectedRequestIds.has(r.id));
    }, [requests, selectedRequestIds]);

    const totalSelectedSize = useMemo(() => {
        const estimateObjectSize = (obj: any) => new Blob([JSON.stringify(obj)]).size;
        return selectedRequests.reduce((acc, req) => acc + estimateObjectSize(req), 0);
    }, [selectedRequests]);

    const handleDeleteSelected = () => {
        if (selectedRequestIds.size === 0) return;
        showConfirmModal({
            title: `حذف ${selectedRequestIds.size} طلب`,
            message: 'هل أنت متأكد من حذف الطلبات المحددة بشكل نهائي؟ سيتم حذف جميع الصور والملفات الصوتية المرتبطة بها أيضاً. لا يمكن التراجع عن هذا الإجراء.',
            onConfirm: async () => {
                try {
                    await deleteRequestsBatch(Array.from(selectedRequestIds));
                    addNotification({ title: 'نجاح', message: 'تم حذف الطلبات المحددة بنجاح.', type: 'success' });
                    setSelectedRequestIds(new Set());
                } catch (error) {
                    addNotification({ title: 'خطأ', message: 'فشل حذف الطلبات.', type: 'error' });
                }
            }
        });
    };

    const handleExportSelected = async () => {
        if (selectedRequests.length === 0) return;
        setIsExporting('requests');
        try {
            addNotification({ title: 'جاري التصدير', message: 'يتم الآن تجهيز بيانات الطلبات والصور، قد يستغرق هذا وقتاً طويلاً...', type: 'info' });

            const processedRequests = await Promise.all(selectedRequests.map(async (req) => {
                // 1. Process general_notes
                const processedGeneralNotes = req.general_notes ? await Promise.all(req.general_notes.map(async (note) => {
                    let imageBase64 = null;
                    if (note.image) {
                        imageBase64 = await urlToBase64(note.image);
                    }
                    return { ...note, imageBase64, authorId: undefined, authorName: undefined };
                })) : [];

                // 2. Process category_notes
                const processedCategoryNotes: Record<string, any[]> = {};
                if (req.category_notes) {
                    for (const [catId, notes] of Object.entries(req.category_notes)) {
                        processedCategoryNotes[catId] = await Promise.all((notes as any[]).map(async (note) => {
                            let imageBase64 = null;
                            if (note.image) {
                                imageBase64 = await urlToBase64(note.image);
                            }
                            return { ...note, imageBase64, authorId: undefined, authorName: undefined };
                        }));
                    }
                }

                // 3. Process attached_files (they might already be base64 or URLs)
                // In our schema, attached_files are stored as JSONB. 
                // Let's assume they might need conversion if they are URLs.

                // 4. Remove creator info
                const { employee_id, ...rest } = req;

                return {
                    ...rest,
                    general_notes: processedGeneralNotes,
                    category_notes: processedCategoryNotes,
                    // We should also include client and car info if possible, 
                    // but car_snapshot already has the basics.
                };
            }));

            const exportData = {
                version: '1.0',
                type: 'inspection_requests',
                timestamp: new Date().toISOString(),
                data: processedRequests
            };

            const dataStr = JSON.stringify(exportData);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            link.download = `requests-export-${date}.json`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({ title: 'تم التصدير', message: `تم تصدير ${selectedRequests.length} طلب بنجاح.`, type: 'success' });
        } catch (error) {
            console.error('Export error:', error);
            addNotification({ title: 'خطأ', message: 'حدث خطأ أثناء التصدير.', type: 'error' });
        } finally {
            setIsExporting(null);
        }
    };

    const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'غير معروف';
    const getCarInfo = (carId: string) => {
        const car = cars.find(c => c.id === carId);
        if (!car) return 'غير معروف';
        const make = carMakes.find(m => m.id === car.make_id)?.name_ar;
        const model = carModels.find(m => m.id === car.model_id)?.name_ar;
        return `${make} ${model}`;
    };
    
    const isAllSelected = filteredRequests.length > 0 && selectedRequestIds.size === filteredRequests.length;
    
    // DB Calculations
    // Note: In Local-First mode, files (base64 images) are included in the DB usage.
    const totalDbCapacityBytes = (settings.databaseCapacity || 500) * 1024 * 1024;
    const dbUsagePercentage = Math.min((currentDbUsage / totalDbCapacityBytes) * 100, 100);
    const remainingDbBytes = Math.max(0, totalDbCapacityBytes - currentDbUsage);

    const handleSaveCapacity = async () => {
        if (capacityInput > 0) {
            try {
                await updateSettings({ databaseCapacity: capacityInput });
                addNotification({ title: 'نجاح', message: 'تم تحديث سعة قاعدة البيانات.', type: 'success' });
            } catch (error) { /* handled in context */ }
        } else {
            addNotification({ title: 'خطأ', message: 'السعة يجب أن تكون أكبر من صفر.', type: 'error' });
        }
    };

    return (
        <div className="space-y-4 animate-fade-in max-w-5xl">
            <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Database Usage Card */}
                <div className="lg:col-span-1 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 w-full">استخدام البيانات</h4>
                    <CircularProgress percentage={dbUsagePercentage} size={120} strokeWidth={10} />
                    <div className="w-full mt-4 space-y-3">
                         <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">السعة الإجمالية (MB)</label>
                            <div className="flex gap-2">
                                <input type="number" value={capacityInput} onChange={e => setCapacityInput(Number(e.target.value))} className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                                <Button onClick={handleSaveCapacity} size="sm" className="rounded-xl px-4">حفظ</Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-[9px] text-center">
                            <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="block text-slate-400 mb-0.5">المستخدم</span>
                                <span className="font-bold text-slate-700 dark:text-white">{formatBytes(currentDbUsage)}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="block text-slate-400 mb-0.5">المتبقي</span>
                                <span className="font-bold text-slate-700 dark:text-white">{formatBytes(remainingDbBytes)}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="block text-slate-400 mb-0.5">الإجمالي</span>
                                <span className="font-bold text-slate-700 dark:text-white">{formatBytes(totalDbCapacityBytes)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Archive & Cleanup Section */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">أرشيف الطلبات والتنظيف</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">نوع الفلترة</label>
                                 <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <label className={`flex-1 text-center text-[10px] py-1 rounded-lg cursor-pointer transition-all ${filterType === 'month' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-blue-600' : 'text-slate-500'}`}>
                                        <input type="radio" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} className="sr-only"/>
                                        بالشهر
                                    </label>
                                    <label className={`flex-1 text-center text-[10px] py-1 rounded-lg cursor-pointer transition-all ${filterType === 'range' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-blue-600' : 'text-slate-500'}`}>
                                        <input type="radio" name="filterType" value="range" checked={filterType === 'range'} onChange={() => setFilterType('range')} className="sr-only"/>
                                        نطاق زمني
                                    </label>
                                </div>
                            </div>
                            {filterType === 'month' ? (
                                <div className="grid grid-cols-2 gap-2">
                                     <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5">السنة</label>
                                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none">
                                            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                                        </select>
                                    </div>
                                     <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5">الشهر</label>
                                        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none">
                                            {months.map(month => <option key={month.value} value={month.value}>{month.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                 <div className="grid grid-cols-2 gap-2">
                                    <div className="w-full">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5">من</label>
                                        <CustomDatePicker 
                                            value={startDate} 
                                            onChange={setStartDate} 
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none" 
                                            placeholder="من تاريخ"
                                            maxDate={endDate ? new Date(endDate) : undefined}
                                        />
                                    </div>
                                    <div className="w-full">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5">إلى</label>
                                        <CustomDatePicker 
                                            value={endDate} 
                                            onChange={setEndDate} 
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none" 
                                            placeholder="إلى تاريخ"
                                            minDate={startDate ? new Date(startDate) : undefined}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="font-bold text-slate-800 dark:text-white">{filteredRequests.length}</span> طلب مطابق &bull; 
                                <span className="font-bold text-blue-600 mx-1">{selectedRequestIds.size}</span> محدد
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => triggerImport('requests')} variant="secondary" size="sm" disabled={!!isImporting || !!isExporting} className="rounded-xl text-[10px]"><Icon name="upload" className="w-3.5 h-3.5"/>استيراد</Button>
                                <Button onClick={handleExportSelected} variant="secondary" size="sm" disabled={selectedRequestIds.size === 0 || !!isExporting} className="rounded-xl text-[10px]"><Icon name="download" className="w-3.5 h-3.5"/>تصدير</Button>
                                <Button onClick={handleDeleteSelected} variant="danger" size="sm" disabled={selectedRequestIds.size === 0 || !!isImporting} className="rounded-xl text-[10px]"><Icon name="delete" className="w-3.5 h-3.5"/>حذف</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                 <div className="overflow-x-auto">
                     <table className="w-full text-[11px] text-right">
                        <thead className="text-[10px] text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded cursor-pointer" />
                                </th>
                                <th className="px-4 py-3 font-bold uppercase tracking-wider">رقم الطلب</th>
                                <th className="px-4 py-3 font-bold uppercase tracking-wider">العميل</th>
                                <th className="px-4 py-3 font-bold uppercase tracking-wider">السيارة</th>
                                <th className="px-4 py-3 font-bold uppercase tracking-wider">التاريخ</th>
                                <th className="px-4 py-3 font-bold uppercase tracking-wider">الحجم</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredRequests.map(request => (
                                <tr key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <input type="checkbox" checked={selectedRequestIds.has(request.id)} onChange={() => handleSelectOne(request.id)} className="rounded cursor-pointer" />
                                    </td>
                                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-white">#{request.request_number}</td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{getClientName(request.client_id)}</td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{getCarInfo(request.car_id)}</td>
                                    <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{new Date(request.created_at).toLocaleDateString('ar-SA')}</td>
                                    <td className="px-4 py-2.5 text-[10px] text-slate-400 font-mono">{formatBytes(new Blob([JSON.stringify(request)]).size)}</td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                 </div>
                 {filteredRequests.length === 0 && (
                     <div className="text-center p-12 text-slate-400 dark:text-slate-500 text-xs italic">
                        لا توجد طلبات تطابق معايير البحث المحددة.
                     </div>
                 )}
            </div>

            {/* Danger Zone */}
            <DangerZone />
        </div>
    );
};

export default DatabaseManagement;