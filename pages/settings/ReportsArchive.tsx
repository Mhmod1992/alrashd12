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
    const [page, setPage] = useState(0);
    const [pageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log('Fetching files from bucket: reports');
            
            // Supabase Storage list API
            const { data, error } = await supabase.storage
                .from('reports')
                .list('', {
                    limit: pageSize,
                    offset: page * pageSize,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                console.error('Supabase list error:', error);
                throw error;
            }

            // Filter out folders and system placeholder files
            const fileList = (data || []).filter(item => 
                item.metadata !== null && 
                item.name !== '.emptyFolderPlaceholder'
            );
            
            console.log('Files received:', fileList);
            setFiles(fileList as any);
            
            if (data && data.length === pageSize) {
                setTotalCount((page + 2) * pageSize);
            } else {
                setTotalCount((page * pageSize) + (data?.length || 0));
            }

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
    }, [page, pageSize, addNotification]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const filteredFiles = useMemo(() => {
        if (!searchQuery) return files;
        return files.filter(file => 
            file.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [files, searchQuery]);

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
                <Button 
                    onClick={fetchFiles} 
                    variant="secondary" 
                    size="sm" 
                    leftIcon={<RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
                >
                    تحديث القائمة
                </Button>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative">
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
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between">
                    <span className="text-sm text-blue-700 dark:text-blue-300">إجمالي الملفات المعروضة:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-200">{filteredFiles.length}</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 dark:text-slate-400 border-b dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">اسم الملف</th>
                                <th className="px-6 py-4">الحجم</th>
                                <th className="px-6 py-4">تاريخ الرفع</th>
                                <th className="px-6 py-4 text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
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
                                            <div className="flex items-center gap-2">
                                                <Icon name="report" className="w-4 h-4 text-red-500" />
                                                <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-xs" title={file.name}>
                                                    {file.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                            {formatBytes(file.metadata.size)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
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
                                        {searchQuery ? 'لا توجد ملفات تطابق البحث.' : 'لا توجد ملفات في هذا المجلد.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        عرض الصفحة {page + 1}
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            disabled={page === 0 || isLoading}
                            onClick={() => setPage(p => p - 1)}
                        >
                            السابق
                        </Button>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            disabled={files.length < pageSize || isLoading}
                            onClick={() => setPage(p => p + 1)}
                        >
                            التالي
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsArchive;
