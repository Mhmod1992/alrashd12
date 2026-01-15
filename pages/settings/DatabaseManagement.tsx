import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { InspectionRequest } from '../../types';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { formatBytes } from '../../lib/utils';


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
    const { requests, clients, cars, carMakes, carModels, deleteRequestsBatch, showConfirmModal, addNotification, settings, updateSettings, currentDbUsage } = useAppContext();

    // State for filters and selection
    const [filterType, setFilterType] = useState<'month' | 'range'>('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
    const [capacityInput, setCapacityInput] = useState<number>(settings.databaseCapacity || 500);
    
    useEffect(() => {
        setCapacityInput(settings.databaseCapacity || 500);
    }, [settings.databaseCapacity]);

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

    const handleExportSelected = () => {
        if (selectedRequests.length === 0) return;
        const dataStr = JSON.stringify(selectedRequests, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.download = `requests-backup-${date}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addNotification({ title: 'نجاح', message: `تم تجهيز ملف النسخ الاحتياطي للتحميل.`, type: 'success' });
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
        <div className="space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">استخدام البيانات</h3>
                <div className="grid grid-cols-1 gap-8 mt-4">
                    {/* Database Usage Card */}
                    <div className="p-6 border rounded-xl dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col items-center shadow-sm">
                        <h4 className="font-bold text-lg text-slate-700 dark:text-slate-200 mb-6">سعة النظام المستهلكة</h4>
                        <CircularProgress percentage={dbUsagePercentage} />
                        <div className="w-full max-w-md mt-6 space-y-4">
                             <div>
                                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">السعة الإجمالية المخصصة (MB)</label>
                                <div className="flex gap-2">
                                    <input type="number" value={capacityInput} onChange={e => setCapacityInput(Number(e.target.value))} className={formInputClasses} />
                                    <Button onClick={handleSaveCapacity}>حفظ</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-center">
                                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                    <span className="block text-slate-500">المستخدم</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{formatBytes(currentDbUsage)}</span>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                    <span className="block text-slate-500">المتبقي</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{formatBytes(remainingDbBytes)}</span>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                    <span className="block text-slate-500">الإجمالي</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{formatBytes(totalDbCapacityBytes)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t dark:border-slate-700 pt-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">أرشيف الطلبات والتنظيف</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">يمكنك هنا تصدير أو حذف الطلبات القديمة لتوفير مساحة.</p>
                
                <div className="mt-4 p-4 border rounded-xl dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">نوع الفلترة</label>
                             <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                <label className={`flex-1 text-center text-sm px-2 py-1.5 rounded-md cursor-pointer transition-colors ${filterType === 'month' ? 'bg-white dark:bg-slate-600 shadow font-bold text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                    <input type="radio" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} className="sr-only"/>
                                    بالشهر والسنة
                                </label>
                                <label className={`flex-1 text-center text-sm px-2 py-1.5 rounded-md cursor-pointer transition-colors ${filterType === 'range' ? 'bg-white dark:bg-slate-600 shadow font-bold text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                    <input type="radio" name="filterType" value="range" checked={filterType === 'range'} onChange={() => setFilterType('range')} className="sr-only"/>
                                    نطاق زمني
                                </label>
                            </div>
                        </div>
                        {filterType === 'month' ? (
                            <div className="grid grid-cols-2 gap-2">
                                 <div>
                                    <label className="block text-sm font-medium mb-1">السنة</label>
                                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={formInputClasses}>
                                        {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium mb-1">الشهر</label>
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className={formInputClasses}>
                                        {months.map(month => <option key={month.value} value={month.value}>{month.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                             <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium mb-1">من تاريخ</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={formInputClasses} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">إلى تاريخ</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={formInputClasses} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 p-4 border rounded-xl dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-300 bg-slate-50 dark:bg-slate-700/50 px-4 py-2 rounded-lg">
                        <span className="font-bold text-slate-800 dark:text-white">{filteredRequests.length}</span> طلب مطابق &bull; 
                        <span className="font-bold text-blue-600 dark:text-blue-400 mx-1">{selectedRequestIds.size}</span> محدد &bull;
                        <span className="text-xs text-slate-500 mx-1">({formatBytes(totalSelectedSize)})</span>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleExportSelected} variant="secondary" disabled={selectedRequestIds.size === 0} leftIcon={<Icon name="download" className="w-4 h-4"/>}>تصدير</Button>
                        <Button onClick={handleDeleteSelected} variant="danger" disabled={selectedRequestIds.size === 0} leftIcon={<Icon name="delete" className="w-4 h-4"/>}>حذف المحدد</Button>
                    </div>
                </div>

                <div className="mt-4 overflow-hidden border rounded-xl dark:border-slate-700 bg-white dark:bg-slate-800">
                     <table className="w-full text-sm text-right">
                        <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-slate-900/50 dark:text-gray-400 border-b dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded cursor-pointer" />
                                </th>
                                <th className="px-6 py-3">رقم الطلب</th>
                                <th className="px-6 py-3">العميل</th>
                                <th className="px-6 py-3">السيارة</th>
                                <th className="px-6 py-3">التاريخ</th>
                                <th className="px-6 py-3">الحجم</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {filteredRequests.map(request => (
                                <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <input type="checkbox" checked={selectedRequestIds.has(request.id)} onChange={() => handleSelectOne(request.id)} className="rounded cursor-pointer" />
                                    </td>
                                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">#{request.request_number}</td>
                                    <td className="px-6 py-3">{getClientName(request.client_id)}</td>
                                    <td className="px-6 py-3">{getCarInfo(request.car_id)}</td>
                                    <td className="px-6 py-3 font-mono text-xs">{new Date(request.created_at).toLocaleDateString('ar-SA')}</td>
                                    <td className="px-6 py-3 text-xs text-slate-500 font-mono">{formatBytes(new Blob([JSON.stringify(request)]).size)}</td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                     {filteredRequests.length === 0 && (
                         <div className="text-center p-12 text-gray-400 dark:text-gray-500 text-sm">
                            لا توجد طلبات تطابق معايير البحث المحددة.
                         </div>
                     )}
                </div>
            </div>

            {/* Danger Zone */}
            <DangerZone />
        </div>
    );
};

export default DatabaseManagement;