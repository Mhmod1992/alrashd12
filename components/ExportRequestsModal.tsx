import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAppContext } from '../context/AppContext';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import DownloadIcon from './icons/DownloadIcon';

interface ExportRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ExportRequestsModal: React.FC<ExportRequestsModalProps> = ({ isOpen, onClose }) => {
    const { addNotification, brokers, customFindingCategories } = useAppContext();
    const [isExporting, setIsExporting] = useState(false);

    const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [paymentMethod, setPaymentMethod] = useState<string>('all');
    const [status, setStatus] = useState<string>('all');
    const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

    const handleExport = async () => {
        setIsExporting(true);
        try {
            addNotification({ title: 'جاري التصدير', message: 'يتم الآن تجميع البيانات، يرجى الانتظار...', type: 'info' });

            // 1. Build Query
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
                    if (!startDate || !endDate) {
                        throw new Error('يرجى تحديد تاريخ البداية والنهاية');
                    }
                    start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                }
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
            }

            // Apply Payment Filter
            if (paymentMethod !== 'all') {
                query = query.eq('payment_type', paymentMethod);
            }

            // Apply Status Filter
            if (status !== 'all') {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (!data || data.length === 0) {
                addNotification({ title: 'تنبيه', message: 'لا توجد طلبات مطابقة للبحث.', type: 'warning' });
                setIsExporting(false);
                return;
            }

            if (exportFormat === 'json') {
                // Exclude employee info as requested
                const sanitizedData = data.map(req => {
                    const { employee_id, employee, ...rest } = req;
                    return rest;
                });

                const exportData = {
                    version: '1.0',
                    type: 'requests_database',
                    timestamp: new Date().toISOString(),
                    filters: { dateRange, paymentMethod, status },
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
                    'نوع الفحص', 'طريقة الدفع', 'المبلغ', 'الحالة', 'السمسار',
                    'الملاحظات العامة', 'ملاحظات الأقسام', 'نتائج الفحص', 'المذكرات الصوتية', 'الملفات المرفقة', 'سجل النشاط'
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

                    // Get Broker Name
                    let brokerName = '';
                    if (req.broker && typeof req.broker === 'object' && req.broker.id) {
                        const brokerObj = brokers.find(b => b.id === req.broker.id);
                        brokerName = brokerObj ? brokerObj.name : 'غير معروف';
                    }

                    // Process Notes
                    const generalNotes = Array.isArray(req.general_notes)
                        ? req.general_notes.map((n: any) => `${n.text || ''}${n.image ? ` [الصورة: ${n.image}]` : ''}`).join(' | ')
                        : '';

                    const categoryNotes = req.category_notes && typeof req.category_notes === 'object'
                        ? Object.entries(req.category_notes)
                            .map(([catId, notes]: [string, any]) => {
                                const catName = customFindingCategories?.find(c => c.id === catId)?.name || catId;
                                return `${catName}: ${Array.isArray(notes) ? notes.map(n => `${n.text || ''}${n.image ? ` [لصورة]` : ''}`).join(', ') : ''}`
                            })
                            .join(' | ')
                        : '';

                    // Process Findings
                    const findings = Array.isArray(req.structured_findings)
                        ? req.structured_findings.map((f: any) => `${f.findingName}: ${f.value}${f.image ? ` [لصورة]` : ''}`).join(' | ')
                        : '';

                    // Process Voice Memos
                    const voiceMemos = Array.isArray(req.voice_memos)
                        ? req.voice_memos.map((m: any) => m.audioData).join(' | ')
                        : '';

                    // Process Attached Files
                    const attachedFiles = Array.isArray(req.attached_files)
                        ? req.attached_files.map((f: any) => f.url).join(' | ')
                        : '';

                    // Process Activity Log
                    const activityLog = Array.isArray(req.activity_log)
                        ? req.activity_log.map((l: any) => `${l.action}: ${l.details}`).join(' | ')
                        : '';

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
                        escapeCsv(brokerName),
                        escapeCsv(generalNotes),
                        escapeCsv(categoryNotes),
                        escapeCsv(findings),
                        escapeCsv(voiceMemos),
                        escapeCsv(attachedFiles),
                        escapeCsv(activityLog)
                    ];
                    csvRows.push(row.join(','));
                });

                const csvString = "\uFEFF" + csvRows.join('\n'); // Add BOM for Arabic support in Excel
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

    const selectClasses = "w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تصدير الطلبات" size="lg">
            <div className="space-y-6 p-2">

                {/* Date Range */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">النطاق الزمني</label>
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className={selectClasses}>
                        <option value="today">اليوم</option>
                        <option value="yesterday">الأمس</option>
                        <option value="week">آخر 7 أيام</option>
                        <option value="month">هذا الشهر</option>
                        <option value="all">جميع الطلبات</option>
                        <option value="custom">تحديد تاريخ مخصص</option>
                    </select>
                </div>

                {dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">من تاريخ</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={selectClasses} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">إلى تاريخ</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={selectClasses} />
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">طريقة الدفع</label>
                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectClasses}>
                            <option value="all">الكل</option>
                            <option value="نقدي">نقدي</option>
                            <option value="بطاقة">بطاقة</option>
                            <option value="تحويل">تحويل</option>
                            <option value="دفع مجزأ (نقدي + بطاقة)">دفع مجزأ</option>
                            <option value="غير مدفوع">غير مدفوع</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">حالة الطلب</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClasses}>
                            <option value="all">الكل</option>
                            <option value="new">جديد</option>
                            <option value="in_progress">قيد الفحص</option>
                            <option value="complete">مكتمل</option>
                            <option value="cancelled">ملغي</option>
                        </select>
                    </div>
                </div>

                {/* Format */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">صيغة التصدير</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="format" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">ملف JSON (للاستيراد في نظام آخر)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="format" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">ملف CSV (للمحاسبة / Excel)</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={onClose} disabled={isExporting}>إلغاء</Button>
                    <Button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2">
                        {isExporting ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                        <span>تصدير البيانات</span>
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ExportRequestsModal;
