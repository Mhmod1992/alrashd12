
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import Icon from '../components/Icon';
import SearchIcon from '../components/icons/SearchIcon';
import ArchiveIcon from '../components/icons/ArchiveIcon';
import { SkeletonTable } from '../components/Skeleton';
import { InspectionRequest, ArchiveResult } from '../types';

const Archive: React.FC = () => {
    const { 
        fetchArchiveData, 
        setSelectedRequestId, 
        setPage, 
        addNotification, 
        fetchRequestsByCarId,
        inspectionTypes,
        employees,
        expandedArchiveCarId,
        setExpandedArchiveCarId
    } = useAppContext();
    
    // State
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1); // Start from one year ago
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<ArchiveResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [detailedRequests, setDetailedRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [plateDisplayLanguage, setPlateDisplayLanguage] = useState<'ar' | 'en'>('ar');

    const handleSearch = async () => {
        if (!startDate || !endDate) {
            addNotification({ title: 'تنبيه', message: 'الرجاء تحديد نطاق التاريخ.', type: 'warning' });
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setExpandedArchiveCarId(null); // Collapse any open accordions on new search
        try {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            // Use the new server-side fetching function
            const data = await fetchArchiveData(
                new Date(startDate).toISOString(),
                end.toISOString(),
                searchQuery.trim() || undefined
            );
            
            setResults(data);

        } catch (error) {
            console.error(error);
            addNotification({ title: 'خطأ', message: 'فشل في جلب البيانات من الأرشيف.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleDetails = async (carId: string) => {
        if (expandedArchiveCarId === carId) {
            setExpandedArchiveCarId(null);
            return;
        }

        setIsLoadingDetails(true);
        setExpandedArchiveCarId(carId);
        try {
            // Fetch fresh details for this specific car from server
            const carRequests = await fetchRequestsByCarId(carId);
            setDetailedRequests(carRequests);
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل في جلب تفاصيل الزيارات.', type: 'error' });
        } finally {
            setIsLoadingDetails(false);
        }
    };
    
    // Automatically perform a search when the component mounts if an accordion was previously open.
    useEffect(() => {
        handleSearch();
    }, []);

    const formInputClasses = "block w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200 text-sm";

    return (
        <div className="container mx-auto animate-fade-in p-4 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-400">
                        <ArchiveIcon className="w-8 h-8" />
                    </div>
                    أرشيف الفحص الزمني للسيارات
                </h2>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">من تاريخ</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={formInputClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">إلى تاريخ</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={formInputClasses} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">بحث (رقم طلب، لوحة، شاصي)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-slate-400" />
                                </span>
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    placeholder="ابحث هنا..." 
                                    className={`${formInputClasses} pl-10`} 
                                />
                            </div>
                            <Button onClick={handleSearch} disabled={isLoading}>
                                {isLoading ? 'جاري البحث...' : 'بحث'}
                            </Button>
                             <label className="flex items-center cursor-pointer group p-2 rounded-lg bg-slate-100 dark:bg-slate-900/50">
                                <span className="text-xs font-semibold text-slate-500">EN</span>
                                <div className="relative mx-2">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={plateDisplayLanguage === 'ar'}
                                        onChange={(e) => setPlateDisplayLanguage(e.target.checked ? 'ar' : 'en')}
                                    />
                                    <div className={`w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600`}></div>
                                </div>
                                <span className="text-xs font-semibold text-slate-500">AR</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="p-6">
                        <SkeletonTable rows={8} />
                    </div>
                ) : hasSearched && results.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400 border-b dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 font-bold">السيارة</th>
                                    <th className="px-6 py-4 font-bold">رقم اللوحة / الشاصي</th>
                                    <th className="px-6 py-4 font-bold">آخر عميل</th>
                                    <th className="px-6 py-4 font-bold">آخر زيارة</th>
                                    <th className="px-6 py-4 font-bold text-center">عدد الزيارات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((item) => {
                                    const car = item.car;
                                    const plateNumber = car.plate_number;
                                    const plateNumberEn = car.plate_number_en;
                                    const vin = car.vin;

                                    let plateContent;
                                    if (vin) {
                                        plateContent = `شاصي: ${vin}`;
                                    } else if (!plateNumber) {
                                        plateContent = 'بدون لوحة';
                                    } else {
                                        if (plateDisplayLanguage === 'en' && plateNumberEn) {
                                            const enParts = plateNumberEn.split(' ');
                                            const enLetters = enParts.filter(part => !/^\d+$/.test(part)).join(' ');
                                            const numbers = enParts.find(part => /^\d+$/.test(part)) || '';
                                            plateContent = `${enLetters} ${numbers}`;
                                        } else {
                                            const plateParts = plateNumber.split(' ');
                                            const plateLettersString = plateParts.filter(part => !/^\d+$/.test(part)).join('');
                                            const plateNumbers = plateParts.find(part => /^\d+$/.test(part)) || '';
                                            const finalPlateLetters = plateLettersString.split('').join(' ');
                                            plateContent = [finalPlateLetters, plateNumbers].filter(Boolean).join('  ');
                                        }
                                    }

                                    return (
                                        <React.Fragment key={item.car.id}>
                                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b dark:border-slate-700 last:border-b-0">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                                                       {`${item.car.make?.name_en || ''} ${item.car.model?.name_en || ''}`}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{item.car.year}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-sm text-slate-600 dark:text-slate-300" dir={plateDisplayLanguage === 'en' && !vin ? 'ltr' : 'rtl'}>
                                                        {plateContent}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{item.client?.name || 'غير معروف'}</div>
                                                    <div className="text-xs text-slate-500">{item.client?.phone}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {new Date(item.lastVisit).toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button 
                                                        onClick={() => handleToggleDetails(item.car.id)}
                                                        className="font-bold text-xl text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 rounded-full h-10 w-10 flex items-center justify-center mx-auto transition-transform hover:scale-110"
                                                    >
                                                        {item.visitCount}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedArchiveCarId === item.car.id && (
                                                <tr className="bg-slate-50 dark:bg-slate-900/50">
                                                    <td colSpan={5} className="p-0 sm:p-2">
                                                        {isLoadingDetails ? (
                                                            <div className="flex justify-center items-center p-4 text-slate-500 dark:text-slate-400">
                                                                <Icon name="refresh-cw" className="w-6 h-6 animate-spin"/>
                                                                <span className="ms-2">جاري تحميل السجل...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-inner m-2">
                                                                <h4 className="font-bold mb-3 text-slate-700 dark:text-slate-200">سجل زيارات السيارة</h4>
                                                                {detailedRequests.length > 0 ? (
                                                                    <table className="w-full text-xs text-right">
                                                                        <thead className="text-[10px] text-slate-500 uppercase">
                                                                            <tr>
                                                                                <th className="px-4 py-2">رقم الطلب</th>
                                                                                <th className="px-4 py-2">التاريخ</th>
                                                                                <th className="px-4 py-2">نوع الفحص</th>
                                                                                <th className="px-4 py-2">المنشئ</th>
                                                                                <th className="px-4 py-2">السعر</th>
                                                                                <th className="px-4 py-2"></th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                                            {detailedRequests.map(req => {
                                                                                const typeName = inspectionTypes.find(t => t.id === req.inspection_type_id)?.name || 'غير معروف';
                                                                                const creator = employees.find(e => e.id === req.employee_id);
                                                                                return (
                                                                                    <tr key={req.id}>
                                                                                        <td className="px-4 py-2 font-mono text-slate-800 dark:text-slate-100">#{req.request_number}</td>
                                                                                        <td className="px-4 py-2">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                                                                        <td className="px-4 py-2">{typeName}</td>
                                                                                        <td className="px-4 py-2">{creator ? creator.name : 'غير معروف'}</td>
                                                                                        <td className="px-4 py-2">{req.price} ريال</td>
                                                                                        <td className="px-4 py-2 text-left">
                                                                                            <Button size="sm" variant="secondary" onClick={() => {
                                                                                                setSelectedRequestId(req.id);
                                                                                                setPage('print-report');
                                                                                            }}>
                                                                                                عرض التقرير
                                                                                            </Button>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                ) : (
                                                                    <p className="text-center text-xs py-4 text-slate-400">لا توجد تفاصيل لعرضها.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
                        <ArchiveIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">{hasSearched ? 'لا توجد سجلات مطابقة.' : 'ابدأ البحث لعرض النتائج'}</p>
                        <p className="text-sm mt-1">{hasSearched ? 'جرب تعديل الفلاتر أو توسيع نطاق التاريخ.' : 'حدد نطاق التاريخ واضغط على زر البحث.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Archive;
