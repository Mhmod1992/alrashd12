import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { formatBytes } from '../../lib/utils';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import DownloadIcon from '../../components/icons/DownloadIcon';
import SearchIcon from '../../components/icons/SearchIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import ExternalLinkIcon from '../../components/icons/ExternalLinkIcon';
import FilterIcon from '../../components/icons/FilterIcon';

interface StorageFile {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: {
        size: number;
        mimetype: string;
    };
}

const ReportsArchive: React.FC = () => {
    const { addNotification, showConfirmModal, authUser } = useAppContext();
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'this_month'>('all');
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log('Fetching files from bucket: reports');
            
            // Supabase Storage list API - fetching all to allow local filtering
            let allFiles: any[] = [];
            let currentOffset = 0;
            const limit = 100; // Increased limit
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase.storage
                    .from('reports')
                    .list('', {
                        limit: limit,
                        offset: currentOffset,
                        sortBy: { column: 'created_at', order: 'desc' }
                    });

                if (error) {
                    console.error('Supabase list error:', error);
                    throw error;
                }

                if (data && data.length > 0) {
                    allFiles = [...allFiles, ...data];
                    currentOffset += limit;
                    // If we got fewer than the limit, we're done
                    if (data.length < limit) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            // Filter out folders and system placeholder files
            const fileList = allFiles.filter(item => 
                item.metadata !== null && 
                item.name !== '.emptyFolderPlaceholder'
            );
            
            console.log('Files received:', fileList);
            setFiles(fileList as any);
        } catch (error: any) {
            console.error('Error fetching reports:', error);
            addNotification({ 
                title: 'خطأ في جلب البيانات', 
                message: `تأكد من وجود سياسة SELECT (قراءة) للحاوية reports في Supabase. الخطأ: ${error.message || 'خطأ غير معروف'}`, 
                type: 'error' 
            });
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const filteredFiles = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let filtered = files;

        if (dateFilter !== 'all') {
            filtered = filtered.filter(file => {
                const fileDate = new Date(file.created_at);
                if (dateFilter === 'today') {
                    return fileDate >= today;
                }
                if (dateFilter === 'yesterday') {
                    return fileDate >= yesterday && fileDate < today;
                }
                if (dateFilter === 'this_month') {
                    return fileDate >= startOfMonth;
                }
                return true;
            });
        }

        if (searchQuery) {
            filtered = filtered.filter(file => 
                file.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    }, [files, searchQuery, dateFilter]);

    const handleDeleteFile = (fileName: string) => {
        showConfirmModal({
            title: 'حذف التقرير',
            message: `هل أنت متأكد من حذف الملف "${fileName}" نهائياً من السيرفر؟`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.storage
                        .from('reports')
                        .remove([fileName]);

                    if (error) throw error;

                    addNotification({ title: 'نجاح', message: 'تم حذف الملف بنجاح.', type: 'success' });
                    fetchFiles();
                } catch (error: any) {
                    console.error('Delete error:', error);
                    addNotification({ title: 'خطأ', message: 'فشل حذف الملف.', type: 'error' });
                }
            }
        });
    };

    const handleDeleteAll = () => {
        showConfirmModal({
            title: 'حذف جميع الملفات الظاهرة',
            message: `هل أنت متأكد من حذف جميع الملفات المعروضة حالياً وعددها (${filteredFiles.length}) نهائياً من السيرفر؟ لا يمكن التراجع عن هذا الإجراء!`,
            onConfirm: async () => {
                setIsDeletingAll(true);
                try {
                    const fileNames = filteredFiles.map(f => f.name);
                    // Supabase supports removing multiple files
                    // We need to batch them if there are too many
                    const batchSize = 100;
                    for (let i = 0; i < fileNames.length; i += batchSize) {
                        const batch = fileNames.slice(i, i + batchSize);
                        const { error } = await supabase.storage
                            .from('reports')
                            .remove(batch);
                        if (error) throw error;
                    }

                    addNotification({ title: 'نجاح', message: 'تم حذف الملفات بنجاح.', type: 'success' });
                    fetchFiles();
                } catch (error: any) {
                    console.error('Delete all error:', error);
                    addNotification({ title: 'خطأ', message: 'فشل حذف بعض أو جميع الملفات.', type: 'error' });
                } finally {
                    setIsDeletingAll(false);
                }
            }
        });
    };

    const getPublicUrl = (fileName: string) => {
        const { data } = supabase.storage.from('reports').getPublicUrl(fileName);
        return data.publicUrl;
    };

    const handlePreview = (fileName: string) => {
        const url = getPublicUrl(fileName);
        window.open(url, '_blank');
    };

    const handleDownload = async (fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('reports')
                .download(fileName);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error: any) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل الملف.', type: 'error' });
        }
    };

    if (authUser?.role !== 'general_manager' && authUser?.role !== 'manager') {
        return (
            <div className="p-8 text-center text-red-500 font-bold">
                ليس لديك صلاحية للوصول إلى هذه الصفحة.
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">أرشيف التقارير (Storage)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">إدارة ملفات PDF المرفوعة في حاوية التقارير.</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-bold">ملاحظة: تظهر هنا فقط التقارير التي تم "مشاركتها عبر الواتساب" أو "تحميلها كـ PDF" من صفحة التقرير.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        onClick={handleDeleteAll} 
                        variant="danger" 
                        size="sm"
                        disabled={isLoading || isDeletingAll || filteredFiles.length === 0}
                        leftIcon={<TrashIcon className="w-4 h-4" />}
                    >
                        {isDeletingAll ? 'جاري الحذف...' : 'حذف الكل'}
                    </Button>
                    <Button 
                        onClick={fetchFiles} 
                        variant="secondary" 
                        size="sm" 
                        leftIcon={<RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
                    >
                        تحديث القائمة
                    </Button>
                </div>
            </div>

            {/* Search, Filter & Stats */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-grow min-w-0 w-full md:w-auto">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <SearchIcon className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="بحث باسم الملف أو رقم الطلب..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pr-10 p-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                    />
                </div>
                
                <div className="relative w-full md:w-64 shrink-0">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <FilterIcon className="w-5 h-5" />
                    </div>
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as any)}
                        className="block w-full pr-10 p-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all appearance-none"
                    >
                        <option value="all">كل الأوقات</option>
                        <option value="today">اليوم</option>
                        <option value="yesterday">أمس</option>
                        <option value="this_month">هذا الشهر</option>
                    </select>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between min-w-[200px] w-full md:w-auto shrink-0">
                    <span className="text-sm text-blue-700 dark:text-blue-300">الملفات المعروضة:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-200">{filteredFiles.length}</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 dark:text-slate-400 border-b dark:border-slate-700 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">اسم الملف</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">الحجم</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">تاريخ الرفع</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32 mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : filteredFiles.length > 0 ? (
                                filteredFiles.map((file) => (
                                    <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 max-w-[150px] sm:max-w-xs md:max-w-md lg:max-w-lg">
                                                <Icon name="report" className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={file.name} dir="ltr">
                                                    {file.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                                            {formatBytes(file.metadata.size)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap" dir="ltr">
                                            {new Date(file.created_at).toLocaleString('ar-SA')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handlePreview(file.name)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    title="معاينة"
                                                >
                                                    <ExternalLinkIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDownload(file.name)}
                                                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                                    title="تحميل"
                                                >
                                                    <DownloadIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteFile(file.name)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                                        {searchQuery || dateFilter !== 'all' ? 'لا توجد ملفات تطابق الفرز والبحث.' : 'لا توجد ملفات في هذا المجلد.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportsArchive;
