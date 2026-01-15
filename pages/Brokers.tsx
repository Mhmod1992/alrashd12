
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Broker, InspectionRequest } from '../types';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabaseClient';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SearchIcon from '../components/icons/SearchIcon';
import EyeIcon from '../components/icons/EyeIcon';

// Helper for Stats Cards
const StatCard: React.FC<{ title: string, value: string, icon: any, color: string, subValue?: string }> = ({ title, value, icon, color, subValue }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4 transition-transform hover:-translate-y-1 duration-300">
        <div className={`p-3 rounded-xl ${color}`}>
            <Icon name={icon} className="w-6 h-6" />
        </div>
        <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-numeric">{value}</h3>
            {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
        </div>
    </div>
);

const Brokers: React.FC = () => {
    const { brokers, addBroker, updateBroker, deleteBroker, showConfirmModal, addNotification } = useAppContext();

    // UI States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBroker, setCurrentBroker] = useState<Partial<Broker>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Stats Data State
    const [brokerStats, setBrokerStats] = useState<{ [key: string]: { requestCount: number; totalRevenue: number; totalCommission: number } }>({});
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Detail View State
    const [selectedBrokerForDetails, setSelectedBrokerForDetails] = useState<Broker | null>(null);
    const [brokerRequests, setBrokerRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // New Filter State for the Modal
    const [detailFilter, setDetailFilter] = useState<'all' | 'today' | 'month'>('all');

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    // --- 1. Fetch Aggregate Stats ---
    const fetchBrokerStats = async () => {
        setIsLoadingStats(true);
        try {
            const { data, error } = await supabase
                .from('inspection_requests')
                .select('price, broker')
                .not('broker', 'is', null);

            if (error) throw error;

            const stats: { [key: string]: { requestCount: number; totalRevenue: number; totalCommission: number } } = {};

            brokers.forEach(b => {
                stats[b.id] = { requestCount: 0, totalRevenue: 0, totalCommission: 0 };
            });

            if (data) {
                data.forEach((req: any) => {
                    const brokerId = req.broker?.id;
                    const commission = Number(req.broker?.commission) || 0;
                    const price = Number(req.price) || 0;

                    if (brokerId) {
                        if (!stats[brokerId]) {
                            stats[brokerId] = { requestCount: 0, totalRevenue: 0, totalCommission: 0 };
                        }
                        stats[brokerId].requestCount += 1;
                        stats[brokerId].totalRevenue += price;
                        stats[brokerId].totalCommission += commission;
                    }
                });
            }
            setBrokerStats(stats);
        } catch (error) {
            console.error("Error fetching broker stats:", error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    useEffect(() => {
        fetchBrokerStats();
    }, [brokers]);

    // --- 2. Fetch Specific Broker Requests (Drill-down) ---
    const fetchBrokerRequests = async (brokerId: string) => {
        setIsLoadingDetails(true);
        try {
            const { data, error } = await supabase
                .from('inspection_requests')
                .select('*')
                .not('broker', 'is', null)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Client-side filtering to be safe with JSON structures
            const filtered = (data || []).filter((r: any) => r.broker?.id === brokerId);
            setBrokerRequests(filtered);

        } catch (error) {
            console.error("Error fetching details:", error);
            addNotification({ title: 'خطأ', message: 'فشل جلب تفاصيل الطلبات.', type: 'error' });
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleViewDetails = (broker: Broker) => {
        setSelectedBrokerForDetails(broker);
        setBrokerRequests([]);
        setDetailFilter('all'); // Reset filter when opening new broker
        fetchBrokerRequests(broker.id);
    };

    // --- UI Logic ---
    const globalStats = useMemo(() => {
        let totalRev = 0;
        let totalComm = 0;
        let totalReqs = 0;
        Object.values(brokerStats).forEach((s: { totalRevenue: number; totalCommission: number; requestCount: number }) => {
            totalRev += s.totalRevenue;
            totalComm += s.totalCommission;
            totalReqs += s.requestCount;
        });
        return { totalRev, totalComm, totalReqs };
    }, [brokerStats]);

    const filteredBrokers = useMemo(() => {
        return brokers.filter(b => {
            const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all'
                ? true
                : statusFilter === 'active' ? b.is_active : !b.is_active;
            return matchesSearch && matchesStatus;
        });
    }, [brokers, searchTerm, statusFilter]);

    // --- Detail Modal Filtering Logic ---
    const filteredDetailRequests = useMemo(() => {
        if (detailFilter === 'all') return brokerRequests;

        const now = new Date();
        const todayStr = now.toDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return brokerRequests.filter(req => {
            const reqDate = new Date(req.created_at);
            if (detailFilter === 'today') {
                return reqDate.toDateString() === todayStr;
            }
            if (detailFilter === 'month') {
                return reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear;
            }
            return true;
        });
    }, [brokerRequests, detailFilter]);

    const detailStats = useMemo(() => {
        return {
            count: filteredDetailRequests.length,
            revenue: filteredDetailRequests.reduce((sum, r) => sum + r.price, 0),
            commission: filteredDetailRequests.reduce((sum, r: any) => sum + (r.broker?.commission || 0), 0)
        };
    }, [filteredDetailRequests]);


    const handleAdd = () => {
        setCurrentBroker({ name: '', phone: '', default_commission: 0, is_active: true });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (broker: Broker) => {
        setCurrentBroker(broker);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = (broker: Broker) => {
        showConfirmModal({
            title: `حذف ${broker.name}`,
            message: 'هل أنت متأكد من حذف هذا السمسار؟',
            onConfirm: async () => {
                await deleteBroker(broker.id);
                addNotification({ title: 'نجاح', message: 'تم حذف السمسار.', type: 'success' });
            }
        });
    };

    const handleSave = async () => {
        if (!currentBroker.name?.trim()) {
            addNotification({ title: 'خطأ', message: 'الرجاء إدخال اسم السمسار.', type: 'error' });
            return;
        }
        if (isEditing) {
            await updateBroker(currentBroker as Broker);
            addNotification({ title: 'نجاح', message: 'تم تعديل السمسار.', type: 'success' });
        } else {
            await addBroker(currentBroker as Omit<Broker, 'id'>);
            addNotification({ title: 'نجاح', message: 'تمت إضافة السمسار.', type: 'success' });
        }
        setIsModalOpen(false);
        fetchBrokerStats();
    };

    return (
        <div className="container mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">إدارة السماسرة</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">متابعة الأداء المالي والعمولات وتفاصيل الطلبات</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={fetchBrokerStats} variant="secondary" leftIcon={<RefreshCwIcon className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} />}>تحديث</Button>
                    <Button onClick={handleAdd} leftIcon={<Icon name="add" />}>إضافة سمسار</Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    title="عدد السماسرة"
                    value={brokers.length.toString()}
                    icon="broker"
                    color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    subValue={`${brokers.filter(b => b.is_active).length} نشط حالياً`}
                />
                <StatCard
                    title="إجمالي الإيرادات منهم"
                    value={isLoadingStats ? '...' : globalStats.totalRev.toLocaleString('en-US')}
                    icon="dollar-sign"
                    color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                    subValue={`من ${globalStats.totalReqs} طلب فحص`}
                />
                <StatCard
                    title="إجمالي العمولات المستحقة"
                    value={isLoadingStats ? '...' : globalStats.totalComm.toLocaleString('en-US')}
                    icon="credit-card"
                    color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                    subValue="مبالغ للسداد"
                />
            </div>

            {/* Filters & Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="relative w-full sm:w-72">
                        <SearchIcon className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="بحث باسم السمسار..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-9 pl-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setStatusFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>الكل</button>
                        <button onClick={() => setStatusFilter('active')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'active' ? 'bg-white dark:bg-slate-600 shadow-sm text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>نشط</button>
                        <button onClick={() => setStatusFilter('inactive')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'inactive' ? 'bg-white dark:bg-slate-600 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>غير نشط</button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase border-b dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">السمسار</th>
                                <th className="px-6 py-4">رقم الهاتف</th>
                                <th className="px-6 py-4">الحالة</th>
                                <th className="px-6 py-4">العمولة الافتراضية</th>
                                <th className="px-6 py-4">عدد الطلبات</th>
                                <th className="px-6 py-4">إيرادات جلبها</th>
                                <th className="px-6 py-4">إجمالي عمولاته</th>
                                <th className="px-6 py-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredBrokers.map(broker => {
                                const stats = brokerStats[broker.id] || { requestCount: 0, totalRevenue: 0, totalCommission: 0 };
                                return (
                                    <tr key={broker.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${broker.is_active ? 'bg-blue-500' : 'bg-slate-400'}`}>
                                                    {broker.name.charAt(0)}
                                                </div>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{broker.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-600 dark:text-slate-400 font-numeric">{broker.phone || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${broker.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                                {broker.is_active ? 'نشط' : 'غير نشط'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-numeric text-slate-600 dark:text-slate-400">
                                            {broker.default_commission} ريال
                                        </td>
                                        <td className="px-6 py-4 font-bold font-numeric">
                                            {isLoadingStats ? '...' : stats.requestCount}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400 font-numeric">
                                            {isLoadingStats ? '...' : stats.totalRevenue.toLocaleString('en-US')}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400 font-numeric">
                                            {isLoadingStats ? '...' : stats.totalCommission.toLocaleString('en-US')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleViewDetails(broker)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="عرض التفاصيل والطلبات">
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEdit(broker)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="تعديل">
                                                    <Icon name="edit" className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(broker)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="حذف">
                                                    <Icon name="delete" className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredBrokers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <Icon name="broker" className="w-12 h-12 mb-3 opacity-20" />
                                            <p>لا يوجد سماسرة مطابقين للبحث.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل سمسار' : 'إضافة سمسار'} size="md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">الاسم</label>
                        <input type="text" value={currentBroker.name || ''} onChange={e => setCurrentBroker(p => ({ ...p, name: e.target.value }))} className={formInputClasses} placeholder="اسم السمسار أو المعرض" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">رقم الهاتف</label>
                        <input type="text" value={currentBroker.phone || ''} onChange={e => setCurrentBroker(p => ({ ...p, phone: e.target.value }))} className={formInputClasses} placeholder="05xxxxxxxx" dir="ltr" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">العمولة الافتراضية (ريال)</label>
                        <input type="number" value={currentBroker.default_commission || 0} onChange={e => setCurrentBroker(p => ({ ...p, default_commission: Number(e.target.value) }))} className={formInputClasses} />
                        <p className="text-xs text-slate-500 mt-1">سيتم تطبيق هذه العمولة تلقائياً عند اختيار السمسار، ويمكن تعديلها لكل طلب.</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border dark:border-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={currentBroker.is_active} onChange={e => setCurrentBroker(p => ({ ...p, is_active: e.target.checked }))} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                            <div>
                                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">حساب نشط</span>
                                <span className="block text-xs text-slate-500">عند إلغاء التنشيط، لن يظهر السمسار في قائمة إنشاء الطلبات الجديدة.</span>
                            </div>
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-6 mt-2 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSave}>حفظ البيانات</Button>
                </div>
            </Modal>

            {/* Drill-down Modal (Broker Requests) */}
            <Modal isOpen={!!selectedBrokerForDetails} onClose={() => setSelectedBrokerForDetails(null)} title={`سجل طلبات: ${selectedBrokerForDetails?.name}`} size="4xl">
                <div className="space-y-4 max-h-[70vh] flex flex-col">

                    {/* Filters & Header Stats */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border dark:border-slate-700 flex-shrink-0 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-slate-500 uppercase">ملخص الفترة المحددة</h4>
                            <div className="flex bg-white dark:bg-slate-700 rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-600">
                                <button onClick={() => setDetailFilter('today')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${detailFilter === 'today' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>اليوم</button>
                                <button onClick={() => setDetailFilter('month')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${detailFilter === 'month' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>الشهر</button>
                                <button onClick={() => setDetailFilter('all')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${detailFilter === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>الكل</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-bold mb-1">الطلبات</p>
                                <p className="text-xl font-black text-slate-800 dark:text-slate-200 font-numeric">{isLoadingDetails ? '...' : detailStats.count}</p>
                            </div>
                            <div className="text-center bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-bold mb-1">الدخل</p>
                                <p className="text-xl font-black text-green-600 font-numeric">{isLoadingDetails ? '...' : detailStats.revenue.toLocaleString('en-US')}</p>
                            </div>
                            <div className="text-center bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-bold mb-1">العمولة</p>
                                <p className="text-xl font-black text-rose-600 font-numeric">{isLoadingDetails ? '...' : detailStats.commission.toLocaleString('en-US')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border rounded-xl dark:border-slate-700 custom-scrollbar">
                        {isLoadingDetails ? (
                            <div className="flex items-center justify-center h-48">
                                <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500 opacity-50" />
                            </div>
                        ) : filteredDetailRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <Icon name="filter" className="w-8 h-8 mb-2 opacity-50" />
                                <p>لا توجد طلبات في الفترة المحددة.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 uppercase sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3">رقم الطلب</th>
                                        <th className="px-4 py-3">التاريخ</th>
                                        <th className="px-4 py-3">السيارة</th>
                                        <th className="px-4 py-3">قيمة الفحص</th>
                                        <th className="px-4 py-3">العمولة</th>
                                        <th className="px-4 py-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800/50">
                                    {filteredDetailRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">#{req.request_number}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-numeric">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                            <td className="px-4 py-3 text-xs truncate max-w-[150px]">
                                                {req.car_snapshot
                                                    ? `${req.car_snapshot.make_ar} ${req.car_snapshot.model_ar} ${req.car_snapshot.year}`
                                                    : 'غير معروف'}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 font-numeric">{req.price}</td>
                                            <td className="px-4 py-3 font-bold text-rose-600 font-numeric">{(req as any).broker?.commission || 0}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] ${req.status === 'مكتمل' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{req.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="flex justify-end pt-2 border-t dark:border-slate-700 flex-shrink-0">
                        <Button variant="secondary" onClick={() => setSelectedBrokerForDetails(null)}>إغلاق</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Brokers;
