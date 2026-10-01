import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest, PaymentType, RequestStatus } from '../types';
import Modal from './Modal';
import Button from './Button';
import CustomDatePicker from './CustomDatePicker';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import DownloadIcon from './icons/DownloadIcon';

interface ExportRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ExportableRequest = InspectionRequest & {
    client?: any;
    car?: any;
    inspection_type?: any;
    employee?: any;
};

const ExportRequestsModal: React.FC<ExportRequestsModalProps> = ({ isOpen, onClose }) => {
    const { addNotification, brokers, customFindingCategories, clients, cars } = useAppContext();
    const [isExporting, setIsExporting] = useState(false);
    const [isFetching, setIsFetching] = useState(false);

    // Filters
    const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    // Start with empty set (nothing selected initially)
    const [paymentMethods, setPaymentMethods] = useState<Set<PaymentType>>(new Set());
    const [status, setStatus] = useState<string>('all');
    const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

    // Selection - Store full request objects to handle persistent totals across filter changes
    const [requestsList, setRequestsList] = useState<ExportableRequest[]>([]);
    const [selectedRequestsMap, setSelectedRequestsMap] = useState<Record<string, ExportableRequest>>({});

    const fetchRequestsList = useCallback(async () => {
        // If no payment methods selected, just clear the list and return
        if (paymentMethods.size === 0) {
            setRequestsList([]);
            return;
        }

        setIsFetching(true);
        try {
            let query = supabase.from('inspection_requests').select(`
                *,
                client:clients(*),
                car:cars(
                    *,
                    make:car_makes(*),
                    model:car_models(*)
                ),
                inspection_type:inspection_types(*),
                employee:employees(*)
            `);

            // Apply Date Filter
            const now = new Date();
            let start = new Date(now);
            let end = new Date(now);

            if (dateRange !== 'all') {
                if (dateRange === 'today') {
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                } else if (dateRange === 'yesterday') {
                    start.setDate(now.getDate() - 1);
                    start.setHours(0, 0, 0, 0);
                    end.setDate(now.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                } else if (dateRange === 'week') {
                    start.setDate(now.getDate() - 7);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                } else if (dateRange === 'month') {
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                } else if (dateRange === 'custom') {
                    if (startDate && endDate) {
                        start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                    } else {
                        setIsFetching(false);
                        return;
                    }
                }
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
            }

            // Apply Payment Filter
            query = query.in('payment_type', Array.from(paymentMethods));

            // Apply Status Filter
            if (status !== 'all') {
                query = query.eq('status', status);
            }

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            setRequestsList(data || []);
        } catch (error: any) {
            console.error('Fetch error:', error);
            addNotification({ title: 'خطأ', message: 'فشل جلب قائمة الطلبات.', type: 'error' });
        } finally {
            setIsFetching(false);
        }
    }, [dateRange, startDate, endDate, paymentMethods, status, addNotification]);

    useEffect(() => {
        if (isOpen) {
            fetchRequestsList();
        }
    }, [isOpen, dateRange, startDate, endDate, paymentMethods, status, fetchRequestsList]);

    const togglePaymentMethod = (method: PaymentType) => {
        setPaymentMethods(prev => {
            const next = new Set(prev);
            if (next.has(method)) next.delete(method);
            else next.add(method);
            return next;
        });
    };

    const toggleRequestSelection = (req: ExportableRequest) => {
        setSelectedRequestsMap(prev => {
            const next = { ...prev };
            if (next[req.id]) {
                delete next[req.id];
            } else {
                next[req.id] = req;
            }
            return next;
        });
    };

    const selectAllVisible = (checked: boolean) => {
        setSelectedRequestsMap(prev => {
            const next = { ...prev };
            if (checked) {
                requestsList.forEach(req => {
                    next[req.id] = req;
                });
            } else {
                requestsList.forEach(req => {
                    delete next[req.id];
                });
            }
            return next;
        });
    };

    const selectedTotal = useMemo(() => {
        return Object.values(selectedRequestsMap).reduce((sum, req) => sum + (req.price || 0), 0);
    }, [selectedRequestsMap]);

    const selectedCount = Object.keys(selectedRequestsMap).length;

    const selectionSummary = useMemo(() => {
        const summary: Record<string, { count: number, total: number }> = {};
        Object.values(selectedRequestsMap).forEach(req => {
            const type = req.payment_type;
            if (!summary[type]) summary[type] = { count: 0, total: 0 };
            summary[type].count += 1;
            summary[type].total += (req.price || 0);
        });
        return summary;
    }, [selectedRequestsMap]);

    const handleExport = async () => {
        const data = Object.values(selectedRequestsMap);
        if (data.length === 0) {
            addNotification({ title: 'تنبيه', message: 'يرجى تحديد طلب واحد على الأقل للتصدير.', type: 'warning' });
            return;
        }

        setIsExporting(true);
        try {
            addNotification({ title: 'جاري التصدير', message: 'يتم الآن تجميع البيانات، يرجى الانتظار...', type: 'info' });

            if (exportFormat === 'json') {
                const sanitizedData = data.map(req => {
                    const { employee_id, employee, ...rest } = req;
                    return rest;
                });

                const exportData = {
                    version: '1.0',
                    type: 'requests_database',
                    timestamp: new Date().toISOString(),
                    selectionSummary,
                    data: sanitizedData
                };

                const jsonStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", url);
                downloadAnchorNode.setAttribute("download", `requests_export_${new Date().toISOString().split('T')[0]}.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                URL.revokeObjectURL(url);
            } else {
                // CSV Export
                const headers = [
                    'رقم الطلب', 'تاريخ الطلب', 'العميل', 'رقم الجوال', 'السيارة', 'اللوحة', 'رقم الهيكل',
                    'نوع الفحص', 'طريقة الدفع', 'المبلغ', 'الحالة', 'السمسار'
                ];
                const csvRows = [headers.join(',')];

                data.forEach(req => {
                    const clientName = req.client?.name || '';
                    const clientPhone = req.client?.phone || '';
                    const carName = req.car ? `${req.car.make?.name_ar || ''} ${req.car.model?.name_ar || ''} ${req.car.year || ''}` : '';
                    const plate = req.car?.plate_number || '';
                    const vin = req.car?.vin || '';
                    const typeName = req.inspection_type?.name || '';
                    const payment = req.payment_type || '';
                    const price = req.price || 0;
                    const reqStatus = req.status || '';
                    const date = new Date(req.created_at).toLocaleString('ar-SA');

                    let brokerName = '';
                    if (req.broker && typeof req.broker === 'object' && req.broker.id) {
                        const brokerObj = brokers.find(b => b.id === req.broker.id);
                        brokerName = brokerObj ? brokerObj.name : 'غير معروف';
                    }

                    const escapeCsv = (str: any) => {
                        if (str === null || str === undefined) return '""';
                        const s = String(str).replace(/"/g, '""');
                        return `"${s}"`;
                    };

                    const row = [
                        req.request_number,
                        escapeCsv(date),
                        escapeCsv(clientName),
                        escapeCsv(clientPhone),
                        escapeCsv(carName),
                        escapeCsv(plate),
                        escapeCsv(vin),
                        escapeCsv(typeName),
                        escapeCsv(payment),
                        price,
                        escapeCsv(reqStatus),
                        escapeCsv(brokerName)
                    ];
                    csvRows.push(row.join(','));
                });

                const csvString = "\uFEFF" + csvRows.join('\n');
                const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", url);
                downloadAnchorNode.setAttribute("download", `requests_export_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                URL.revokeObjectURL(url);
            }

            addNotification({ title: 'تم التصدير', message: `تم تصدير ${data.length} طلب بنجاح.`, type: 'success' });
            onClose();
        } catch (error: any) {
            console.error('Export error:', error);
            addNotification({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء التصدير.', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const selectClasses = "w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200 text-xs font-bold";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تجهيز قائمة التصدير المتعدد" size="4xl">
            <div className="flex flex-col h-[85vh] max-h-[900px]">
                {/* Header Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 shrink-0">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">الزمن</label>
                        <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className={selectClasses}>
                            <option value="today">اليوم</option>
                            <option value="yesterday">الأمس</option>
                            <option value="week">آخر 7 أيام</option>
                            <option value="month">هذا الشهر</option>
                            <option value="all">الكل</option>
                            <option value="custom">مخصص</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">الحالة</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClasses}>
                            <option value="all">جميع الحالات</option>
                            <option value="new">جديد</option>
                            <option value="in_progress">قيد الفحص</option>
                            <option value="complete">مكتمل</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">طريقة الدفع المطلوب تحديدها</label>
                        <div className="flex flex-wrap gap-1">
                            {Object.values(PaymentType).map(type => (
                                <button
                                    key={type}
                                    onClick={() => togglePaymentMethod(type)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                                        paymentMethods.has(type)
                                        ? 'bg-blue-600 text-white border-blue-500'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">الصيغة</label>
                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className={selectClasses}>
                            <option value="json">JSON</option>
                            <option value="csv">Excel / CSV</option>
                        </select>
                    </div>

                    {dateRange === 'custom' && (
                        <div className="col-span-1 md:col-span-4 grid grid-cols-2 gap-2 mt-2 pt-2 border-t dark:border-slate-700">
                            <CustomDatePicker value={startDate} onChange={setStartDate} className={selectClasses} placeholder="من" />
                            <CustomDatePicker value={endDate} onChange={setEndDate} className={selectClasses} placeholder="إلى" />
                        </div>
                    )}
                </div>

                {/* Selection Counter & Global Summary Bar */}
                <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 border-b dark:border-slate-700 flex flex-wrap items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">السجل الإجمالي للتصدير:</span>
                    </div>
                    {Object.keys(selectionSummary).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(selectionSummary).map(([type, data]) => (
                                <div key={type} className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800/50 rounded-md shadow-sm">
                                    <span className="text-[10px] font-medium text-slate-500">{type}:</span>
                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{data.count}</span>
                                    <span className="text-[10px] text-slate-300">|</span>
                                    <span className="text-[10px] font-black text-emerald-600">{data.total} ريال</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-[10px] italic text-slate-400">لا توجد طلبات في قائمة التصدير حالياً</span>
                    )}
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/20 dark:bg-slate-900/5">
                    {paymentMethods.size === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 opacity-40">
                            <Icon name="filter" className="w-12 h-12 mb-4" />
                            <p className="text-sm font-bold">يرجى اختيار "طريقة دفع" للبدء في تحديد الطلبات</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {isFetching ? (
                                <div className="flex items-center justify-center py-10">
                                    <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between py-2 border-b dark:border-slate-700 mb-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                                checked={requestsList.length > 0 && requestsList.every(r => selectedRequestsMap[r.id])}
                                                onChange={(e) => selectAllVisible(e.target.checked)}
                                            />
                                            <span className="text-xs font-bold text-slate-500 italic">تحديد جميع الظاهرين حالياً ({requestsList.length})</span>
                                        </label>
                                    </div>
                                    
                                    {requestsList.length > 0 ? (
                                        requestsList.map((req) => {
                                            const isSelected = !!selectedRequestsMap[req.id];
                                            return (
                                                <div 
                                                    key={req.id}
                                                    onClick={() => toggleRequestSelection(req)}
                                                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer group ${
                                                        isSelected 
                                                        ? 'bg-blue-50/50 dark:bg-blue-600/10 border-blue-400 dark:border-blue-500 shadow-sm' 
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={() => {}} // Controlled by div
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 pointer-events-none"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black text-slate-900 dark:text-white">#{req.request_number}</span>
                                                            <span className="text-[10px] font-bold text-blue-600">{req.client?.name || 'عميل'}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 italic truncate">
                                                            {req.car_snapshot ? `${req.car_snapshot.make_en} ${req.car_snapshot.model_en}` : 'معلومات السيارة غير متوفرة'}
                                                        </p>
                                                    </div>
                                                    <div className="text-left shrink-0">
                                                        <p className="text-xs font-black text-emerald-600">{req.price} ريال</p>
                                                        <p className="text-[10px] text-slate-400">{new Date(req.created_at).toLocaleDateString('ar-SA')}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-10 text-slate-400 italic text-xs">لا توجد طلبات مطابقة لهذه الفلترة</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Component */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0 shadow-lg">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">إجمالي الحصيلة الجاهزة</span>
                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-black">{selectedCount} طلب</span>
                            </div>
                            <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-numeric">
                                {selectedTotal.toLocaleString('en-US')} <small className="text-sm">ريال</small>
                            </span>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="secondary" onClick={onClose} disabled={isExporting}>إلغاء</Button>
                            <Button 
                                onClick={handleExport} 
                                disabled={isExporting || selectedCount === 0} 
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-10 shadow-lg shadow-blue-500/20"
                            >
                                {isExporting ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                                <span className="font-bold">تصدير الفاتورة المجمعة</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ExportRequestsModal;
