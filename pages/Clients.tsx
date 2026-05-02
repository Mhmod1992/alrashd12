
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { Client, PaymentType, InspectionRequest, RequestStatus, LoyaltyTier, AgedDebt } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import CustomDatePicker from '../components/CustomDatePicker';
import SearchIcon from '../components/icons/SearchIcon';
import UsersIcon from '../components/icons/UsersIcon';
import PhoneIcon from '../components/icons/PhoneIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import FilterIcon from '../components/icons/FilterIcon';
import CalendarIcon from '../components/icons/HistoryIcon';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import { uuidv4 } from '../lib/utils';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import HistoryIcon from '../components/icons/HistoryIcon';

const Clients: React.FC = () => {
    const { 
        searchClientsPage, cars, carMakes, carModels, requests, 
        addClient, updateClient, deleteClient, showConfirmModal, 
        addNotification, setPage, setSelectedRequestId, settings, 
        selectedClientId, setSelectedClientId, clients: contextClients,
        fetchClientRequestsFiltered, sendWhatsAppMessage, fetchClientsWithDebtIds,
        getClientFinancialSummary, fetchClientsCount
    } = useAppContext();
    const design = settings.design || 'aero';
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentClient, setCurrentClient] = useState<Partial<Client>>({});
    const [requestSearchTerm, setRequestSearchTerm] = useState('');
    
    // Local state for clients management
    const [clientsList, setClientsList] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 20;
    const debounceRef = useRef<number | null>(null);

    // Local state for selected client's requests (on-demand fetch)
    const [clientRequests, setClientRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingClientRequests, setIsLoadingClientRequests] = useState(false);
    const [clientSummary, setClientSummary] = useState<{
        unpaidRequests: InspectionRequest[];
        totalRevenue: number;
        totalPaid: number;
        lastRequest: InspectionRequest | null;
    } | null>(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    // New filter state for Request History
    const [historyFilterType, setHistoryFilterType] = useState<'all' | 'today' | 'yesterday' | 'month' | 'custom' | 'latest'>('latest');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'unpaid'>('all');
    const [debtAgeStatusFilter, setDebtAgeStatusFilter] = useState<'all' | 'current' | 'late' | 'critical'>('all');

    const [totalClientsAmount, setTotalClientsAmount] = useState<number>(0);

    // New filter state for Clients List
    const [debtFilter, setDebtFilter] = useState(false);
    const [debtClientIds, setDebtClientIds] = useState<Set<string>>(new Set());

    const [growthData, setGrowthData] = useState<{
        total: number;
        today: number;
        week: number;
        month: number;
        dailyTrend: { date: string; count: number }[];
    }>({ total: 0, today: 0, week: 0, month: 0, dailyTrend: [] });
    const [isLoadingGrowth, setIsLoadingGrowth] = useState(false);

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
    const searchInputClasses = "block w-full p-3 pl-10 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    const loadDebtStatus = async () => {
        const ids = await fetchClientsWithDebtIds();
        setDebtClientIds(new Set(ids));
    };

    const loadClients = async (page: number, search: string, append: boolean, onlyDebts?: boolean) => {
        setIsLoadingClients(true);
        try {
            let ids: string[] | undefined = undefined;
            if (onlyDebts) {
                ids = Array.from(debtClientIds);
                // If there are no debts at all, we can skip the request or handle it
                if (ids.length === 0) {
                    if (append) {
                         // do nothing
                    } else {
                        setClientsList([]);
                        setHasMore(false);
                    }
                    setIsLoadingClients(false);
                    return;
                }
            }

            const { data, count } = await searchClientsPage(page, pageSize, search, ids);
            if (append) {
                setClientsList(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    const next = data.filter(c => !existingIds.has(c.id));
                    return [...prev, ...next];
                });
            } else {
                setClientsList(data);
            }
            setHasMore(data.length === pageSize);
        } catch (error) {
            console.error("Failed to load clients:", error);
        } finally {
            setIsLoadingClients(false);
        }
    };

    useEffect(() => {
        // Only trigger load once debt status is known if debtFilter is active
        if (debtFilter && debtClientIds.size === 0) {
             // wait for debt status? 
             // actually, loadClients handles empty ids.
        }
        setPageNumber(1);
        loadClients(1, searchTerm, false, debtFilter);
    }, [debtFilter]);

    const loadGrowthAnalytics = async () => {
        setIsLoadingGrowth(true);
        try {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const [total, today, week, month] = await Promise.all([
                fetchClientsCount(),
                fetchClientsCount(startOfToday),
                fetchClientsCount(startOfWeek),
                fetchClientsCount(startOfMonth)
            ]);

            // Faster trend calculation using parallel queries
            const trendPromises = [];
            const dates = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                dates.push(date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }));
                const s = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
                const e = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString();
                trendPromises.push(fetchClientsCount(s, e));
            }

            const trendCounts = await Promise.all(trendPromises);
            const trend = trendCounts.map((count, index) => ({
                date: dates[index],
                count: count
            }));

            setGrowthData({ total, today, week, month, dailyTrend: trend });
        } catch (error) {
            console.error("Failed to load growth analytics:", error);
        } finally {
            setIsLoadingGrowth(false);
        }
    };

    useEffect(() => {
        // Initial load
        loadClients(1, '', false, false);
        loadDebtStatus();
        loadGrowthAnalytics();
        fetchClientsCount().then(res => setTotalClientsAmount(res)).catch(console.error);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        setPageNumber(1);
        
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            loadClients(1, val, false, debtFilter);
        }, 500);
    };

    const handleLoadMore = () => {
        if (!isLoadingClients && hasMore) {
            const nextPage = pageNumber + 1;
            setPageNumber(nextPage);
            loadClients(nextPage, searchTerm, true, debtFilter);
        }
    };

    const getCarInfo = (carId: string) => {
        const car = cars.find(c => c.id === carId);
        if (!car) return { name: 'Unknown', plate: '' };
        const make = carMakes.find(m => m.id === car.make_id)?.name_en;
        const model = carModels.find(m => m.id === car.model_id)?.name_en;
        return { name: `${make || ''} ${model || ''}`, plate: car.plate_number };
    };
    
    const allVisibleClients = useMemo(() => {
        const clientMap = new Map();
        clientsList.forEach(c => clientMap.set(c.id, c));
        if (selectedClientId) {
            const selectedInContext = contextClients.find(c => c.id === selectedClientId);
            if (selectedInContext && !clientMap.has(selectedClientId)) {
                clientMap.set(selectedClientId, selectedInContext);
            }
        }
        let finalClients = Array.from(clientMap.values());
        if (debtFilter) {
            finalClients = finalClients.filter(client => debtClientIds.has(client.id));
        }
        return finalClients;
    }, [clientsList, contextClients, selectedClientId, debtFilter, debtClientIds]);


    const selectedClient = useMemo(() => {
        return allVisibleClients.find(c => c.id === selectedClientId);
    }, [allVisibleClients, selectedClientId]);

    const loadFilteredRequests = async () => {
        if (!selectedClientId) {
             setClientRequests([]);
             return;
        }

        setIsLoadingClientRequests(true);
        try {
            let start: string | undefined;
            let end: string | undefined;
            let limit: number | undefined;
            const now = new Date();

            switch (historyFilterType) {
                case 'latest':
                    limit = 10;
                    break;
                case 'today':
                    start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                    end = new Date(now.setHours(23, 59, 59, 999)).toISOString();
                    break;
                case 'yesterday':
                    const yest = new Date(now);
                    yest.setDate(yest.getDate() - 1);
                    start = new Date(yest.setHours(0, 0, 0, 0)).toISOString();
                    end = new Date(yest.setHours(23, 59, 59, 999)).toISOString();
                    break;
                case 'month':
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    start = firstDay.toISOString();
                    end = new Date().toISOString(); // Up to now
                    break;
                case 'custom':
                    if (historyStartDate && historyEndDate) {
                         const s = new Date(historyStartDate); s.setHours(0,0,0,0);
                         const e = new Date(historyEndDate); e.setHours(23,59,59,999);
                         start = s.toISOString();
                         end = e.toISOString();
                    }
                    break;
                case 'all':
                default:
                    // Leave undefined to fetch latest page without date restriction
                    break;
            }
            
            const onlyUnpaid = paymentStatusFilter === 'unpaid';

            const fetchedRequests = await fetchClientRequestsFiltered(selectedClientId, start, end, onlyUnpaid, limit);
            setClientRequests(fetchedRequests);
        } catch (error) {
            console.error("Error fetching filtered requests:", error);
            addNotification({ title: 'خطأ', message: 'فشل تحميل سجل الطلبات.', type: 'error' });
        } finally {
            setIsLoadingClientRequests(false);
        }
    };

    const loadClientSummary = async () => {
        if (!selectedClientId) {
            setClientSummary(null);
            return;
        }
        setIsLoadingSummary(true);
        try {
            const summary = await getClientFinancialSummary(selectedClientId);
            setClientSummary(summary);
        } catch (error) {
            console.error("Error loading summary:", error);
        } finally {
            setIsLoadingSummary(false);
        }
    };

    useEffect(() => {
        setDebtAgeStatusFilter('all');
        setPaymentStatusFilter('all');
        setHistoryFilterType('latest');
        loadClientSummary();
        loadFilteredRequests();
    }, [selectedClientId]);

    useEffect(() => {
        loadFilteredRequests();
    }, [historyFilterType, historyStartDate, historyEndDate, paymentStatusFilter]);
    
    const lastVisit = useMemo(() => {
        const lastReq = clientSummary?.lastRequest;
        if (!lastReq) return null;

        const visitDate = new Date(lastReq.created_at);
        const today = new Date();
        
        const visitDateDay = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
        const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const diffTime = todayDay.getTime() - visitDateDay.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        const formattedDate = `${visitDate.getFullYear()}/${visitDate.getMonth() + 1}/${visitDate.getDate()}`;
        const dayOfWeek = visitDate.toLocaleDateString('ar-SA', { weekday: 'long' });

        let daysAgoText = '';
        if (diffDays === 0) {
            daysAgoText = 'اليوم';
        } else if (diffDays === 1) {
            daysAgoText = 'منذ يوم';
        } else if (diffDays === 2) {
            daysAgoText = 'منذ يومين';
        } else if (diffDays >= 3 && diffDays <= 10) {
            daysAgoText = `منذ ${diffDays} أيام`;
        } else {
            daysAgoText = `منذ ${diffDays} يوم`;
        }

        return {
            date: formattedDate,
            dayOfWeek,
            daysAgo: daysAgoText
        };
    }, [clientSummary]);

    const clientFinancials = useMemo(() => {
        if (!selectedClient || !clientSummary) return { totalRevenue: 0, totalPaid: 0, totalRemaining: 0, loyaltyPoints: 0, tier: LoyaltyTier.BRONZE, agedDebt: { current: 0, late: 0, critical: 0, total: 0 } as AgedDebt };
    
        const { totalRevenue, totalPaid, unpaidRequests } = clientSummary;
        const totalRemaining = totalRevenue - totalPaid;

        // Loyalty Logic
        const loyaltyPoints = Math.floor(totalPaid / 100);
        let tier = LoyaltyTier.BRONZE;
        if (loyaltyPoints > 5000) tier = LoyaltyTier.PLATINUM;
        else if (loyaltyPoints > 1500) tier = LoyaltyTier.GOLD;
        else if (loyaltyPoints > 500) tier = LoyaltyTier.SILVER;

        // Aged Debt Logic
        const agedDebt: AgedDebt = { current: 0, late: 0, critical: 0, total: totalRemaining };
        const now = new Date();
        
        unpaidRequests.forEach(req => {
            const reqDate = new Date(req.created_at);
            const diffDays = Math.floor((now.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 15) agedDebt.current += req.price;
            else if (diffDays <= 45) agedDebt.late += req.price;
            else agedDebt.critical += req.price;
        });
    
        return { totalRevenue, totalPaid, totalRemaining, loyaltyPoints, tier, agedDebt };
    }, [clientSummary, selectedClient]);


    const filteredClientRequests = useMemo(() => {
        if (!selectedClient) return [];
        
        let reqs = clientRequests;

        const lowercasedTerm = requestSearchTerm.toLowerCase();
        if (lowercasedTerm) {
            reqs = reqs.filter(req => {
                const carInfo = getCarInfo(req.car_id);
                const carName = req.car_snapshot ? `${req.car_snapshot.make_ar} ${req.car_snapshot.model_ar}` : carInfo.name;
                return carName.toLowerCase().includes(lowercasedTerm) ||
                       (carInfo.plate && carInfo.plate.toLowerCase().includes(lowercasedTerm)) || 
                       String(req.request_number).includes(lowercasedTerm);
            });
        }

        if (debtAgeStatusFilter !== 'all') {
            const now = new Date();
            reqs = reqs.filter(req => {
                const isUnpaid = req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT;
                if (!isUnpaid) return false;

                const reqDate = new Date(req.created_at);
                const diffDays = Math.floor((now.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (debtAgeStatusFilter === 'current') return diffDays <= 15;
                if (debtAgeStatusFilter === 'late') return diffDays > 15 && diffDays <= 45;
                if (debtAgeStatusFilter === 'critical') return diffDays > 45;
                return true;
            });
        }

        return reqs;
    }, [clientRequests, selectedClient, requestSearchTerm, cars, carMakes, carModels, debtAgeStatusFilter]);


    const handleToggleDebtAgeFilter = (status: 'current' | 'late' | 'critical') => {
        if (debtAgeStatusFilter === status) {
            setDebtAgeStatusFilter('all');
        } else {
            setDebtAgeStatusFilter(status);
            setPaymentStatusFilter('unpaid');
            setHistoryFilterType('all'); // Usually aged debt covers multiple months
        }
    };

    const handleAddClient = () => {
        setCurrentClient({ name: '', phone: '', is_vip: false });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEditClient = (client: Client) => {
        setCurrentClient(client);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDeleteClient = async (client: Client) => {
        showConfirmModal({
            title: `حذف العميل ${client.name}`,
            message: 'هل أنت متأكد من حذف هذا العميل؟ لا يمكن حذف عميل لديه طلبات فحص مسجلة.',
            onConfirm: async () => {
                try {
                    await deleteClient(client.id);
                    addNotification({ title: 'نجاح', message: 'تم حذف العميل بنجاح.', type: 'success' });
                    setSelectedClientId(null);
                    // Refresh list
                    loadClients(1, searchTerm, false);
                } catch (error: any) {
                    addNotification({ title: 'خطأ', message: error.message || 'فشل حذف العميل.', type: 'error' });
                }
            }
        });
    };

    const handleSaveClient = async () => {
        if (!currentClient.name?.trim() || !currentClient.phone?.trim()) {
            addNotification({ title: 'بيانات ناقصة', message: 'الرجاء إدخال الاسم ورقم الهاتف.', type: 'error' });
            return;
        }
        if (currentClient.phone.length !== 10) {
            addNotification({ title: 'خطأ', message: 'رقم الهاتف يجب أن يتكون من 10 أرقام.', type: 'error' });
            return;
        }
        try {
            if (isEditing) {
                await updateClient(currentClient as Client);
                addNotification({ title: 'نجاح', message: 'تم تحديث بيانات العميل.', type: 'success' });
                 // Update local list
                 setClientsList(prev => prev.map(c => c.id === currentClient.id ? { ...c, ...currentClient } as Client : c));
            } else {
                const newClient = { ...currentClient, id: uuidv4(), is_vip: currentClient.is_vip || false } as Client;
                await addClient(newClient);
                addNotification({ title: 'نجاح', message: 'تمت إضافة العميل بنجاح.', type: 'success' });
                setClientsList(prev => [newClient, ...prev]);
            }
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Save Client Error:", error);
            addNotification({ title: 'خطأ', message: error.message || 'فشلت عملية الحفظ. تحقق من البيانات.', type: 'error' });
        }
    };
    
    const handleToggleVip = async () => {
        if (!selectedClient) return;
        const newStatus = !selectedClient.is_vip;
        try {
            await updateClient({ ...selectedClient, is_vip: newStatus });
            setClientsList(prev => prev.map(c => c.id === selectedClient.id ? { ...c, is_vip: newStatus } : c));
            addNotification({ title: 'نجاح', message: newStatus ? `تم تمييز ${selectedClient.name} كعميل مميز.` : 'تم إزالة تمييز العميل.', type: 'success' });
        } catch (error: any) {
            console.error("Toggle VIP Error:", error);
            addNotification({ title: 'خطأ', message: error.message || 'فشل تحديث حالة العميل. تأكد من إعداد قاعدة البيانات.', type: 'error' });
        }
    };

    const handleSendWhatsAppReminder = async () => {
        if (!selectedClient || clientFinancials.totalRemaining <= 0) return;
        
        const message = `عزيزي العميل *${selectedClient.name}*، نود تذكيركم بوجود مبالغ مستحقة فحص سيارات طرفنا بقيمة *${clientFinancials.totalRemaining}* ريال. يرجى التكرم بالسداد في أقرب وقت. شكراً لتعاملكم معنا.`;
        
        let phone = selectedClient.phone.replace(/\D/g, '');
        if (phone.startsWith('05')) {
            phone = '966' + phone.substring(1);
        } else if (phone.length === 9 && phone.startsWith('5')) {
            phone = '966' + phone;
        }
        
        await sendWhatsAppMessage(phone, message);
    };
    
    const handleOpenWhatsappChat = async () => {
        if (!selectedClient) return;
        let phone = selectedClient.phone.replace(/\D/g, '');
        if (phone.startsWith('05')) {
            phone = '966' + phone.substring(1);
        } else if (phone.length === 9 && phone.startsWith('5')) {
            phone = '966' + phone;
        }
        await sendWhatsAppMessage(phone, '');
    };

    return (
        <div className="container mx-auto max-w-7xl h-full px-2 sm:px-6">
            {/* Growth Analytics Header - Made more compact for mobile */}
            <div className="pt-4 pb-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
                    {/* Total Clients Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/20 dark:border-slate-700 shadow-lg relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl -z-10 rounded-full translate-x-1/2 -translate-y-1/2"></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1 font-sans">إجمالي العملاء</p>
                                <h2 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white font-numeric">
                                    {isLoadingGrowth ? '...' : growthData.total.toLocaleString()}
                                </h2>
                            </div>
                            <div className="p-1.5 sm:p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
                                <UsersIcon className="w-4 h-4 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </motion.div>

                    {/* New Today Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-emerald-100/50 dark:border-emerald-900/30 shadow-lg relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl -z-10 rounded-full translate-x-1/2 -translate-y-1/2"></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-0.5 sm:mb-1 font-sans">سجلوا اليوم</p>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <h2 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white font-numeric">
                                        {isLoadingGrowth ? '...' : growthData.today}
                                    </h2>
                                    {growthData.today > 0 && <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>}
                                </div>
                            </div>
                            <div className="p-1.5 sm:p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
                                <TrendingUpIcon className="w-4 h-4 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Growth Chart/Trend Card - Hidden on very small screens, 3rd column on md+ */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="hidden md:flex bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-4 rounded-3xl border border-white/20 dark:border-slate-700 shadow-lg flex-col"
                    >
                        <div className="flex justify-between items-center mb-2 px-1">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans">تطور الأسبوع</p>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500 font-bold">+{growthData.week}</span>
                        </div>
                        <div className="h-12 w-full">
                            {isLoadingGrowth ? (
                                <div className="h-full w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-pulse" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={growthData.dailyTrend}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <Area 
                                            type="monotone" 
                                            dataKey="count" 
                                            stroke="#10b981" 
                                            fillOpacity={1} 
                                            fill="url(#colorCount)" 
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Layout Fix: Use flex-1 with min-h-0 to prevent squashing and ensure container takes available space */}
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 h-full min-h-0 pb-4">
                {/* Stage 1: Left List (Client Navigator) */}
                <div className={`md:w-80 lg:w-96 flex flex-col gap-4 min-h-0 ${selectedClientId ? 'hidden md:flex' : 'flex-1 md:flex-none md:h-full'}`}>
                    <div className="flex flex-col gap-4 p-4 sm:p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700 shadow-xl overflow-hidden h-full">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 font-sans">العملاء</h3>
                            </div>
                            <Button onClick={handleAddClient} size="sm" className="rounded-full px-4" leftIcon={<Icon name="add"/>}>جديد</Button>
                        </div>

                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none group-focus-within:text-blue-500 transition-colors">
                                <SearchIcon className="h-5 w-5 text-slate-400"/>
                            </span>
                            <input 
                                type="text" 
                                placeholder="ابحث باسم العميل أو جواله..." 
                                value={searchTerm} 
                                onChange={handleSearchChange} 
                                className="w-full pl-10 pr-4 py-3 bg-slate-100/50 dark:bg-slate-700/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-slate-700 transition-all outline-none text-sm font-sans"
                            />
                        </div>

                        <div className="flex gap-2">
                             <button 
                                onClick={() => setDebtFilter(!debtFilter)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition-all font-sans ${debtFilter 
                                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800' 
                                    : 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                             >
                                <DollarSignIcon className="w-3.5 h-3.5" />
                                <span>فقط المديونات</span>
                             </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mt-2 -mx-2 px-2" onScroll={(e) => {
                            const target = e.currentTarget;
                            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) handleLoadMore();
                        }}>
                            <AnimatePresence mode="popLayout">
                                {allVisibleClients.map((client, idx) => {
                                    const hasDebt = debtClientIds.has(client.id);
                                    return (
                                        <motion.button
                                            key={client.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                                            onClick={() => setSelectedClientId(client.id)}
                                            className={`w-full group relative p-4 rounded-2xl text-right transition-all border-2 ${selectedClientId === client.id 
                                                ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500 shadow-md' 
                                                : 'bg-white/40 dark:bg-slate-800/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                        >
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className={`font-bold truncate text-sm sm:text-base font-sans ${selectedClientId === client.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                                            {client.name}
                                                        </h4>
                                                        {client.is_vip && <Icon name="sparkles" className="w-3.5 h-3.5 text-yellow-500" />}
                                                        {client.is_system_default && <span className="text-[10px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 px-1.5 rounded-md">✨ عام</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{client.phone}</p>
                                                </div>
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm shadow-black/5 ${selectedClientId === client.id ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                                    {client.name.charAt(0)}
                                                </div>
                                            </div>
                                            {hasDebt && (
                                                <div className="absolute left-2 bottom-2">
                                                    <div className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[9px] font-bold border border-red-200 dark:border-red-800 font-sans">دين</div>
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </AnimatePresence>
                            {isLoadingClients && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl w-full" />)}
                        </div>
                    </div>
                </div>

                {/* Stage 1: Right Dashboard (Client Experience) */}
                <div className={`flex-1 flex flex-col gap-6 overflow-hidden ${selectedClientId ? 'flex' : 'hidden md:flex'}`}>
                    <AnimatePresence mode="wait">
                        {selectedClient ? (
                            <motion.div 
                                key={selectedClient.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar pr-1 pt-6"
                            >
                                {/* Dashboard Top Header */}
                                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white/20 dark:border-slate-700 shadow-2xl relative overflow-visible mt-2">
                                     <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-400/5 blur-3xl -z-10 rounded-full translate-x-1/2 -translate-y-1/2"></div>
                                     <button onClick={() => setSelectedClientId(null)} className="md:hidden absolute top-4 left-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-full"><Icon name="back" className="w-4 h-4 transform scale-x-[-1]" /></button>

                                     <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                                          <div className="flex items-center gap-6">
                                              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-xl shrink-0 font-sans">
                                                  {selectedClient.name.charAt(0)}
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-3">
                                                      <h3 className="text-3xl font-black text-slate-800 dark:text-white font-sans">{selectedClient.name}</h3>
                                                      {selectedClient.is_system_default && (
                                                          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-black rounded-full shadow-sm font-sans">
                                                              <span>✨</span>
                                                              <span>عميل عام</span>
                                                          </div>
                                                      )}
                                                      {selectedClient.is_vip && <div className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-black rounded-full shadow-sm font-sans">VIP</div>}
                                                  </div>
                                                  <div className="flex items-center gap-4 mt-3">
                                                      <div className="flex items-center gap-2 group cursor-pointer">
                                                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-blue-500 group-hover:text-white transition-all"><PhoneIcon className="w-4 h-4"/></div>
                                                          <span className="text-slate-600 dark:text-slate-400 font-mono text-sm">{selectedClient.phone}</span>
                                                      </div>
                                                      <button onClick={handleOpenWhatsappChat} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all rounded-full text-xs font-bold border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 font-sans">
                                                          <WhatsappIcon className="w-4 h-4"/>
                                                          واتساب
                                                      </button>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="flex gap-2 shrink-0">
                                               <Button variant="secondary" onClick={() => handleEditClient(selectedClient)} className="rounded-2xl"><Icon name="edit" className="w-4 h-4"/></Button>
                                               <Button variant="danger" onClick={() => handleDeleteClient(selectedClient)} className="rounded-2xl"><Icon name="delete" className="w-4 h-4"/></Button>
                                          </div>
                                     </div>
                                </div>

                                {/* Stages 2 & 4: Analytical Cards */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Loyalty & Tier Card */}
                                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 dark:border-slate-700 shadow-xl flex flex-col justify-between min-h-[220px]">
                                        {isLoadingSummary ? (
                                            <div className="space-y-4">
                                                <Skeleton className="h-6 w-1/2 rounded-lg" />
                                                <Skeleton className="h-12 w-3/4 rounded-xl" />
                                                <Skeleton className="h-4 w-full rounded-full" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-center mb-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg"><Icon name="sparkles" className="w-5 h-5" /></div>
                                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 font-sans">نظام الولاء</h4>
                                                    </div>
                                                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black rounded-lg uppercase tracking-wider font-sans">{clientFinancials.tier}</div>
                                                </div>
                                                
                                                <div className="flex items-end justify-between gap-4 mb-2">
                                                    <div className="text-4xl font-black text-blue-600 dark:text-blue-400 font-numeric">{clientFinancials.loyaltyPoints} <span className="text-xs text-slate-500 font-bold font-sans">نقطة رصيد</span></div>
                                                    <div className="text-xs text-slate-400 font-bold font-sans">الإنفاق الكلي: <span className="font-mono">{clientFinancials.totalPaid}</span></div>
                                                </div>
 
                                                <div className="mt-4 space-y-2 font-sans">
                                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                                        <span>التقدم للمستوى التالي</span>
                                                        <span>{Math.min(100, (clientFinancials.loyaltyPoints / (clientFinancials.tier === LoyaltyTier.BRONZE ? 500 : clientFinancials.tier === LoyaltyTier.SILVER ? 1500 : 5000) * 100)).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, (clientFinancials.loyaltyPoints / (clientFinancials.tier === LoyaltyTier.BRONZE ? 500 : clientFinancials.tier === LoyaltyTier.SILVER ? 1500 : 5000) * 100))}%` }}
                                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Aged Debt Insight Card */}
                                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 dark:border-slate-700 shadow-xl min-h-[220px]">
                                        {isLoadingSummary ? (
                                             <div className="space-y-4">
                                                <Skeleton className="h-6 w-1/2 rounded-lg" />
                                                <Skeleton className="h-12 w-full rounded-xl" />
                                                <Skeleton className="h-10 w-full rounded-xl" />
                                             </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-center mb-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"><DollarSignIcon className="w-5 h-5" /></div>
                                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 font-sans">سجل المديونيات المعتق</h4>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <div className="text-lg font-black text-red-600 font-mono">{clientFinancials.totalRemaining} <span className="text-[10px] font-bold font-sans">ريال</span></div>
                                                        {clientFinancials.totalRemaining > 0 && (
                                                            <button onClick={handleSendWhatsAppReminder} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline">إرسال تذكير بالسداد</button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-1 h-14 w-full rounded-2xl overflow-hidden mb-4 bg-slate-100 dark:bg-slate-900/40">
                                                    {clientFinancials.totalRevenue === 0 ? (
                                                        <div className="h-full w-full bg-slate-200/50 dark:bg-slate-700/30 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest font-sans">
                                                            لا يوجد سجل مالي
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="h-full bg-green-500/80 relative group cursor-help transition-all hover:opacity-80" style={{ flex: clientFinancials.totalPaid }}>
                                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded whitespace-nowrap z-50 transition-opacity font-sans">مدفوع: {clientFinancials.totalPaid}</div>
                                                            </div>
                                                            {clientFinancials.agedDebt.current > 0 && (
                                                                <div 
                                                                    onClick={() => handleToggleDebtAgeFilter('current')}
                                                                    className={`h-full bg-amber-400/80 relative group cursor-pointer transition-all hover:opacity-100 ${debtAgeStatusFilter === 'current' ? 'ring-2 ring-white ring-inset shadow-lg opacity-100 scale-y-110' : 'opacity-80'}`} 
                                                                    style={{ flex: clientFinancials.agedDebt.current }}
                                                                >
                                                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded whitespace-nowrap z-50 transition-opacity font-sans">حديثة ({clientFinancials.agedDebt.current})</div>
                                                                </div>
                                                            )}
                                                            {clientFinancials.agedDebt.late > 0 && (
                                                                <div 
                                                                    onClick={() => handleToggleDebtAgeFilter('late')}
                                                                    className={`h-full bg-orange-500/80 relative group cursor-pointer transition-all hover:opacity-100 ${debtAgeStatusFilter === 'late' ? 'ring-2 ring-white ring-inset shadow-lg opacity-100 scale-y-110' : 'opacity-80'}`} 
                                                                    style={{ flex: clientFinancials.agedDebt.late }}
                                                                >
                                                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded whitespace-nowrap z-50 transition-opacity font-sans">متأخرة ({clientFinancials.agedDebt.late})</div>
                                                                </div>
                                                            )}
                                                            {clientFinancials.agedDebt.critical > 0 && (
                                                                <div 
                                                                    onClick={() => handleToggleDebtAgeFilter('critical')}
                                                                    className={`h-full bg-red-600 relative group cursor-pointer transition-all hover:opacity-100 ${debtAgeStatusFilter === 'critical' ? 'ring-2 ring-white ring-inset shadow-lg opacity-100 scale-y-110' : 'opacity-100'}`} 
                                                                    style={{ flex: clientFinancials.agedDebt.critical }}
                                                                >
                                                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded whitespace-nowrap z-50 transition-opacity font-sans">حرجة ({clientFinancials.agedDebt.critical})</div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                        <div className="grid grid-cols-3 gap-2 font-sans">
                                            <button 
                                                onClick={() => handleToggleDebtAgeFilter('current')}
                                                className={`text-center p-1 rounded-lg transition-all ${debtAgeStatusFilter === 'current' ? 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                            >
                                                <p className="text-[9px] uppercase tracking-tighter text-slate-400 font-bold mb-1">حديثة</p>
                                                <p className="text-xs font-black font-mono text-amber-600">{clientFinancials.agedDebt.current}</p>
                                            </button>
                                            <button 
                                                onClick={() => handleToggleDebtAgeFilter('late')}
                                                className={`text-center p-1 rounded-lg border-x dark:border-slate-700 transition-all ${debtAgeStatusFilter === 'late' ? 'bg-orange-100 dark:bg-orange-900/40 ring-1 ring-orange-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                            >
                                                <p className="text-[9px] uppercase tracking-tighter text-slate-400 font-bold mb-1">متأخرة</p>
                                                <p className="text-xs font-black font-mono text-orange-600">{clientFinancials.agedDebt.late}</p>
                                            </button>
                                            <button 
                                                onClick={() => handleToggleDebtAgeFilter('critical')}
                                                className={`text-center p-1 rounded-lg transition-all ${debtAgeStatusFilter === 'critical' ? 'bg-red-100 dark:bg-red-900/40 ring-1 ring-red-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                            >
                                                <p className="text-[9px] uppercase tracking-tighter text-slate-400 font-bold mb-1">حرجة</p>
                                                <p className="text-xs font-black font-mono text-red-600">{clientFinancials.agedDebt.critical}</p>
                                            </button>
                                        </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Request History Section */}
                                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/20 dark:border-slate-700 shadow-xl mb-6 flex flex-col shrink-0 min-h-[400px]">
                                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                          <div className="flex items-center gap-3">
                                               <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500"><Icon name="history" className="w-5 h-5"/></div>
                                                <div>
                                                     <div className="flex items-center gap-2">
                                                         <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 font-sans">سجل الطلبات</h4>
                                                         <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-black font-sans">{clientRequests.length}</span>
                                                     </div>
                                                     {debtAgeStatusFilter !== 'all' && (
                                                         <div className="flex items-center gap-2 mt-1">
                                                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                                 debtAgeStatusFilter === 'current' ? 'bg-amber-100 text-amber-700' :
                                                                 debtAgeStatusFilter === 'late' ? 'bg-orange-100 text-orange-700' :
                                                                 'bg-red-100 text-red-700'
                                                             }`}>
                                                                 تصفية: {debtAgeStatusFilter === 'current' ? 'مديونية حديثة' : debtAgeStatusFilter === 'late' ? 'مديونية متأخرة' : 'مديونية حرجة'}
                                                             </span>
                                                             <button 
                                                                 onClick={() => setDebtAgeStatusFilter('all')}
                                                                 className="text-[10px] text-blue-600 hover:text-blue-800 underline font-bold"
                                                             >
                                                                 إلغاء التصفية
                                                             </button>
                                                         </div>
                                                     )}
                                                </div>
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-2 items-center p-1 bg-slate-100 dark:bg-slate-700/50 rounded-2xl font-sans">
                                                <button onClick={() => setHistoryFilterType('latest')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${historyFilterType === 'latest' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>الأحدث</button>
                                                <button onClick={() => setHistoryFilterType('month')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${historyFilterType === 'month' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>هذا الشهر</button>
                                                <button onClick={() => setHistoryFilterType('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${historyFilterType === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>الكل</button>
                                                <button onClick={() => setHistoryFilterType('custom')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${historyFilterType === 'custom' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>مخصص</button>
                                          </div>
                                     </div>

                                     {historyFilterType === 'custom' && (
                                         <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex items-center gap-3 mb-6 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                                              <CustomDatePicker 
                                                  value={historyStartDate} 
                                                  onChange={setHistoryStartDate} 
                                                  className="bg-transparent border-none outline-none text-xs font-bold font-mono w-full" 
                                                  placeholder="من تاريخ"
                                                  maxDate={historyEndDate ? new Date(historyEndDate) : undefined}
                                              />
                                              <span className="text-slate-400">→</span>
                                              <CustomDatePicker 
                                                  value={historyEndDate} 
                                                  onChange={setHistoryEndDate} 
                                                  className="bg-transparent border-none outline-none text-xs font-bold font-mono w-full" 
                                                  placeholder="إلى تاريخ"
                                                  minDate={historyStartDate ? new Date(historyStartDate) : undefined}
                                              />
                                         </motion.div>
                                     )}

                                     <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-3xl overflow-hidden">
                                          {isLoadingClientRequests ? (
                                              <SkeletonTable rows={5} />
                                          ) : filteredClientRequests.length > 0 ? (
                                              <table className="w-full text-sm font-sans">
                                                  <thead className="bg-slate-50/50 dark:bg-slate-700/50 sticky top-0 z-10 backdrop-blur-md">
                                                      <tr>
                                                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 font-sans">الطلب</th>
                                                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 font-sans">السيارة</th>
                                                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 font-sans">التاريخ</th>
                                                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 font-sans">المبلغ</th>
                                                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 font-sans">الحالة</th>
                                                          <th className="px-6 py-4"></th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white/40 dark:bg-slate-800/20">
                                                      {filteredClientRequests.map((req, idx) => {
                                                          const carInfo = getCarInfo(req.car_id);
                                                          const carName = req.car_snapshot ? `${req.car_snapshot.make_ar} ${req.car_snapshot.model_ar}` : carInfo.name;
                                                          const isUnpaid = req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT;
                                                          return (
                                                              <motion.tr 
                                                                  key={req.id} 
                                                                  initial={{ opacity: 0, y: 10 }}
                                                                  animate={{ opacity: 1, y: 0 }}
                                                                  transition={{ delay: idx * 0.05 }}
                                                                  className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                                                              >
                                                                  <td className="px-6 py-5 font-black text-blue-600 dark:text-blue-400 font-numeric">#{req.request_number}</td>
                                                                  <td className="px-6 py-5 font-bold text-slate-700 dark:text-slate-300">{carName}</td>
                                                                  <td className="px-6 py-5 text-xs text-slate-400 font-mono">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                                                  <td className={`px-6 py-5 font-black font-mono ${isUnpaid ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                      {req.price} 
                                                                      {isUnpaid && <span className="mr-2 text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-sans">آجل</span>}
                                                                  </td>
                                                                  <td className="px-6 py-5">
                                                                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black font-sans ${
                                                                          req.status === RequestStatus.COMPLETE ? 'bg-green-100 text-green-700' :
                                                                          req.status === RequestStatus.WAITING_PAYMENT ? 'bg-purple-100 text-purple-700' :
                                                                          'bg-blue-100 text-blue-700'
                                                                      }`}>
                                                                          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
                                                                          {req.status}
                                                                      </div>
                                                                  </td>
                                                                  <td className="px-6 py-5 text-left">
                                                                      <button 
                                                                          onClick={() => { setSelectedRequestId(req.id); setPage('print-report'); }}
                                                                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                                                                      >
                                                                          <Icon name="report" className="w-5 h-5" />
                                                                      </button>
                                                                  </td>
                                                              </motion.tr>
                                                          );
                                                      })}
                                                  </tbody>
                                              </table>
                                          ) : (
                                              <div className="p-20 text-center text-slate-400 font-sans">
                                                  لا يوجد طلبات بهذا الفلتر
                                              </div>
                                          )}
                                     </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm border border-white/10 rounded-[3rem]"
                            >
                                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-400 shadow-inner mb-6">
                                    <UsersIcon className="w-12 h-12 opacity-50"/>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 font-sans">اختر عميلاً من القائمة</h3>
                                <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-xs font-sans">استعرض بيانات الولاء، سجل المدفوعات، والزيارات السابقة للعميل بلمسة واحدة.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}>
                <div className="space-y-4 font-sans">
                    <div>
                        <label className="block text-sm font-medium">اسم العميل</label>
                        <input type="text" value={currentClient.name || ''} onChange={e => setCurrentClient(p => ({...p, name: e.target.value}))} className={formInputClasses} required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">رقم الهاتف</label>
                        <input type="tel" value={currentClient.phone || ''} onChange={e => setCurrentClient(p => ({...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10)}))} className={formInputClasses} required placeholder="05xxxxxxxx" style={{ direction: 'ltr', textAlign: 'right' }}/>
                    </div>
                    <div>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={!!currentClient.is_vip} onChange={e => setCurrentClient(p => ({...p, is_vip: e.target.checked}))} className="rounded text-yellow-500 focus:ring-yellow-400" />
                            <span className="font-semibold text-yellow-500">عميل مميز (VIP)</span>
                        </label>
                    </div>
                    {!currentClient.is_system_default && (
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!currentClient.is_system_default} onChange={e => setCurrentClient(p => ({...p, is_system_default: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <div className="flex flex-col">
                                    <span className="font-semibold text-indigo-600">تعيين كعميل عام نظامي ✨</span>
                                    <span className="text-[10px] text-slate-500">سيتم استخدامه لتعبئة الطلبات السريعة تلقائياً.</span>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSaveClient}>حفظ</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Clients;
