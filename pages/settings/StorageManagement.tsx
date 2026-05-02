import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import DatabaseIcon from '../../components/icons/DatabaseIcon';
import ImageIcon from '../../components/icons/ImageIcon';
import CustomDatePicker from '../../components/CustomDatePicker';
import { formatBytes } from '../../lib/utils';
import { supabase } from '../../lib/supabaseClient';

const StorageManagement: React.FC = () => {
    const { addNotification } = useAppContext();
    const [isCleaning, setIsCleaning] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    
    // Filters
    const [filterType, setFilterType] = useState<'all' | 'older' | 'range'>('older');
    const [daysToKeep, setDaysToKeep] = useState(30);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [showFileList, setShowFileList] = useState(false);

    const fetchFiles = async () => {
        setIsFetching(true);
        try {
            const { data, error } = await supabase.storage.from('attached_files').list('drafts', { limit: 10000 });
            if (error) throw error;
            
            // Filter out placeholder
            const validFiles = data?.filter(f => f.name !== '.emptyFolderPlaceholder') || [];
            // Sort by date descending
            validFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            setFiles(validFiles);
            setShowFileList(true);
            setSelectedFiles([]); // Reset selection on fresh fetch
            
            if (validFiles.length === 0) {
                addNotification({ title: 'تنبيه', message: 'لم يتم العثور على أي ملفات في مجلد المسودات.', type: 'info' });
            }
        } catch (error) {
            console.error("Error fetching draft files:", error);
            addNotification({ title: 'خطأ', message: 'فشل في جلب قائمة الملفات من السيرفر.', type: 'error' });
        } finally {
            setIsFetching(false);
        }
    };

    const getFilteredFiles = () => {
        if (filterType === 'all') return files;
        
        if (filterType === 'older') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            return files.filter(f => new Date(f.created_at) < cutoffDate);
        }
        
        if (filterType === 'range') {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            return files.filter(f => {
                const date = new Date(f.created_at);
                if (start && date < start) return false;
                if (end) {
                    const inclusiveEnd = new Date(end);
                    inclusiveEnd.setHours(23, 59, 59, 999);
                    if (date > inclusiveEnd) return false;
                }
                return true;
            });
        }
        
        return files;
    };

    const filtered = getFilteredFiles();
    const totalSize = filtered.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);

    const toggleSelect = (name: string) => {
        setSelectedFiles(prev => 
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const toggleSelectAll = () => {
        if (selectedFiles.length > 0 && selectedFiles.length === filtered.length) {
            setSelectedFiles([]);
        } else {
            setSelectedFiles(filtered.map(f => f.name));
        }
    };

    const handleCleanup = async () => {
        if (selectedFiles.length === 0) {
            addNotification({ title: 'تنبيه', message: 'يرجى تحديد الملفات المراد حذفها أولاً.', type: 'warning' });
            return;
        }
        
        if (!window.confirm(`هل أنت متأكد من حذف ${selectedFiles.length} ملف نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
        
        setIsCleaning(true);
        try {
            const pathsToDelete = selectedFiles.map(name => `drafts/${name}`);
            
            // Delete in batches of 100 (Supabase limitation handling)
            for (let i = 0; i < pathsToDelete.length; i += 100) {
                const batch = pathsToDelete.slice(i, i + 100);
                const { error } = await supabase.storage.from('attached_files').remove(batch);
                if (error) throw error;
            }
            
            addNotification({ title: 'نجاح', message: `تم حذف ${selectedFiles.length} ملف بنجاح وتوفير ${formatBytes(filtered.filter(f => selectedFiles.includes(f.name)).reduce((a, b) => a + (b.metadata?.size || 0), 0))}.`, type: 'success' });
            
            // Update local list
            setFiles(prev => prev.filter(f => !selectedFiles.includes(f.name)));
            setSelectedFiles([]);
        } catch (error) {
            console.error("Error cleaning up drafts:", error);
            addNotification({ title: 'خطأ', message: 'فشل حذف الملفات المحددة.', type: 'error' });
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <DatabaseIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            إدارة التخزين
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                            توفير مساحة السيرفر بإدارة وحذف المسودات المؤقتة التي تم إنشاؤها مسبقاً. هذه الأداة لا تؤثر على الصور الرسمية المرفوعة للسيارات.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 line-clamp-none">
                {/* Search & Filters Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <Icon name="filter" className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">فلاتر البحث</h3>
                        </div>

                        <div className="space-y-5">
                            {/* Filter Type Toggle */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button 
                                    onClick={() => setFilterType('all')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                                >
                                    الكل
                                </button>
                                <button 
                                    onClick={() => setFilterType('older')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${filterType === 'older' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                                >
                                    أقدم من
                                </button>
                                <button 
                                    onClick={() => setFilterType('range')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${filterType === 'range' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                                >
                                    مخصص
                                </button>
                            </div>

                            {/* Dynamic Filter Inputs */}
                            <div className="min-h-[140px] flex flex-col justify-center border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                                {filterType === 'all' && (
                                    <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
                                        <p>سيتم فحص جميع ملفات المسودات الموجودة في النظام بغض النظر عن تاريخ رفعها.</p>
                                    </div>
                                )}

                                {filterType === 'older' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 block">احتفاظ بملفات آخر:</label>
                                        <select 
                                            value={daysToKeep} 
                                            onChange={(e) => setDaysToKeep(Number(e.target.value))}
                                            className="w-full border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm text-sm p-2.5 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value={1}>يوم واحد</option>
                                            <option value={7}>7 أيام</option>
                                            <option value={15}>15 يوم</option>
                                            <option value={30}>شهر (30 يوم)</option>
                                            <option value={60}>شهران (60 يوم)</option>
                                            <option value={90}>3 أشهر (90 يوم)</option>
                                        </select>
                                        <p className="text-xs text-slate-400 mt-2">ستظهر الملفات الأقدم من هذه المدة لتحديدها.</p>
                                    </div>
                                )}

                                {filterType === 'range' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 block">من تاريخ:</label>
                                            <CustomDatePicker 
                                                value={startDate}
                                                onChange={(val) => setStartDate(val)}
                                                className="w-full"
                                                placeholder="اختر تاريخ البداية"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 block">إلى تاريخ:</label>
                                            <CustomDatePicker 
                                                value={endDate}
                                                onChange={(val) => setEndDate(val)}
                                                className="w-full"
                                                placeholder="اختر تاريخ النهاية"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button 
                                variant="primary" 
                                className="w-full shadow-lg shadow-indigo-500/20 py-2.5" 
                                onClick={fetchFiles} 
                                disabled={isFetching || isCleaning}
                            >
                                {isFetching ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : <Icon name="search" className="w-5 h-5" />}
                                بدء عملية الفحص
                            </Button>
                        </div>
                    </div>

                    {/* Quick Stats or Tips Area Could Go Here later */}
                </div>

                {/* Results Column */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col min-h-[500px]">
                        {!showFileList && !isFetching && (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full border border-dashed border-slate-200 dark:border-slate-700 mb-6">
                                    <Icon name="search" className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">في انتظار البحث</h3>
                                <p className="text-sm max-w-sm">قم باختيار الفلاتر المناسبة من القائمة الجانبية ثم اضغط على زر بدء الفحص لعرض الملفات التي يمكن تنظيفها.</p>
                            </div>
                        )}

                        {isFetching && (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-indigo-500">
                                <RefreshCwIcon className="w-12 h-12 animate-spin mb-4 text-indigo-400" />
                                <h3 className="text-lg font-bold mb-2">جاري فحص السيرفر...</h3>
                                <p className="text-sm text-slate-500">قد يستغرق هذا بضع ثوانٍ</p>
                            </div>
                        )}

                        {showFileList && !isFetching && (
                            <>
                                {/* Result Summary Header */}
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <DatabaseIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-black text-slate-800 dark:text-slate-100">{filtered.length}</span>
                                                <span className="text-sm font-bold text-slate-500">ملف</span>
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">مساحة إجمالية تقريبية: {formatBytes(totalSize)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Status text */}
                                        <div className="text-xs font-bold text-slate-500 text-left px-2">
                                            محدد: {selectedFiles.length} ({formatBytes(filtered.filter(f => selectedFiles.includes(f.name)).reduce((a, b) => a + (b.metadata?.size || 0), 0))})
                                        </div>
                                    </div>
                                </div>

                                {/* Results Table */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                    {filtered.length > 0 ? (
                                        <table className="w-full text-right border-collapse">
                                            <thead className="bg-white dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                                                <tr>
                                                    <th className="p-4 w-12 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedFiles.length === filtered.length && filtered.length > 0}
                                                            onChange={toggleSelectAll}
                                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
                                                        />
                                                    </th>
                                                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400">اسم الملف</th>
                                                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 hidden sm:table-cell">التاريخ</th>
                                                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400">الحجم</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {filtered.map((file) => (
                                                    <tr 
                                                        key={file.name} 
                                                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedFiles.includes(file.name) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                                        onClick={() => toggleSelect(file.name)}
                                                    >
                                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedFiles.includes(file.name)}
                                                                onChange={() => toggleSelect(file.name)}
                                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate max-w-[120px] sm:max-w-xs xl:max-w-md" title={file.name}>
                                                                    {file.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 whitespace-nowrap hidden sm:table-cell">
                                                            <span className="text-xs text-slate-500">
                                                                {new Date(file.created_at).toLocaleDateString('ar-SA')}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 whitespace-nowrap">
                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                                {formatBytes(file.metadata?.size || 0)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                                            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-full border border-slate-100 dark:border-slate-700 mb-4">
                                                <ImageIcon className="w-10 h-10 text-slate-300 dark:text-slate-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">لا توجد مسودات مطابقة للفلاتر</h3>
                                            <p className="text-sm">الجيد في الأمر أن المساحة نظيفة لهذه الفترة!</p>
                                        </div>
                                    )}
                                </div>

                                {/* Floating Action Bar */}
                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm sticky bottom-0 z-20 flex justify-end">
                                    <Button 
                                        variant="danger" 
                                        onClick={handleCleanup} 
                                        disabled={isCleaning || selectedFiles.length === 0}
                                        className="relative group w-full sm:w-auto shadow-lg shadow-red-500/20"
                                    >
                                        {isCleaning ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : <TrashIcon className="w-5 h-5" />}
                                        حذف الملفات المحددة نهائياً ({selectedFiles.length})
                                    </Button>
                                    
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StorageManagement;

