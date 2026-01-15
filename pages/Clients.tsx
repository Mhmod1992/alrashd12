
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Client, PaymentType, InspectionRequest, RequestStatus } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import UsersIcon from '../components/icons/UsersIcon';
import PhoneIcon from '../components/icons/PhoneIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import FilterIcon from '../components/icons/FilterIcon';
import CalendarIcon from '../components/icons/HistoryIcon';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import { uuidv4 } from '../lib/utils';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

const Clients: React.FC = () => {
    const { 
        searchClientsPage, cars, carMakes, carModels, requests, 
        addClient, updateClient, deleteClient, showConfirmModal, 
        addNotification, setPage, setSelectedRequestId, settings, 
        selectedClientId, setSelectedClientId, clients: contextClients,
        fetchClientRequestsFiltered // Use the filtered version
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

    // New filter state for Request History
    const [historyFilterType, setHistoryFilterType] = useState<'all' | 'today' | 'yesterday' | 'month' | 'custom'>('all');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'unpaid'>('all');

    // New filter state for Clients List
    const [debtFilter, setDebtFilter] = useState(false);

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
    const searchInputClasses = "block w-full p-3 pl-10 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    const clientsWithDebt = useMemo(() => {
        const clientIds = new Set<string>();
        requests.forEach(req => {
            if (req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT) {
                clientIds.add(req.client_id);
            }
        });
        return clientIds;
    }, [requests]);

    const loadClients = async (page: number, search: string, append: boolean) => {
        setIsLoadingClients(true);
        try {
            const { data, count } = await searchClientsPage(page, pageSize, search);
            if (append) {
                setClientsList(prev => [...prev, ...data]);
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
        // Initial load
        loadClients(1, '', false);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        setPageNumber(1);
        
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            loadClients(1, val, false);
        }, 500);
    };

    const handleLoadMore = () => {
        if (!isLoadingClients && hasMore) {
            const nextPage = pageNumber + 1;
            setPageNumber(nextPage);
            loadClients(nextPage, searchTerm, true);
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
            finalClients = finalClients.filter(client => clientsWithDebt.has(client.id));
        }
        return finalClients;
    }, [clientsList, contextClients, selectedClientId, debtFilter, clientsWithDebt]);


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
            const now = new Date();

            switch (historyFilterType) {
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

            const fetchedRequests = await fetchClientRequestsFiltered(selectedClientId, start, end, onlyUnpaid);
            setClientRequests(fetchedRequests);
        } catch (error) {
            console.error("Error fetching filtered requests:", error);
            addNotification({ title: 'خطأ', message: 'فشل تحميل سجل الطلبات.', type: 'error' });
        } finally {
            setIsLoadingClientRequests(false);
        }
    };

    // Trigger load when selection or filters change
    useEffect(() => {
        loadFilteredRequests();
    }, [selectedClientId, historyFilterType, historyStartDate, historyEndDate, paymentStatusFilter]);
    
    const lastVisit = useMemo(() => {
        if (!clientRequests || clientRequests.length === 0) {
            return null;
        }
        // Assuming sorted by date desc from backend
        const lastRequest = clientRequests[0];

        const visitDate = new Date(lastRequest.created_at);
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
    }, [clientRequests]);

    const clientFinancials = useMemo(() => {
        if (!selectedClient) return { totalRevenue: 0, totalPaid: 0, totalRemaining: 0 };
    
        const totalRevenue = clientRequests.reduce((acc, req) => acc + req.price, 0);
        const totalPaid = clientRequests
            .filter(req => req.payment_type !== PaymentType.Unpaid && req.status !== RequestStatus.WAITING_PAYMENT)
            .reduce((acc, req) => acc + req.price, 0);
        const totalRemaining = totalRevenue - totalPaid;
    
        return { totalRevenue, totalPaid, totalRemaining };
    }, [clientRequests, selectedClient]);


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

        return reqs;
    }, [clientRequests, selectedClient, requestSearchTerm, cars, carMakes, carModels]);


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
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشلت عملية الحفظ.', type: 'error' });
        }
    };
    
    const handleToggleVip = async () => {
        if (!selectedClient) return;
        const newStatus = !selectedClient.is_vip;
        try {
            await updateClient({ ...selectedClient, is_vip: newStatus });
            setClientsList(prev => prev.map(c => c.id === selectedClient.id ? { ...c, is_vip: newStatus } : c));
            addNotification({ title: 'نجاح', message: newStatus ? `تم تمييز ${selectedClient.name} كعميل مميز.` : 'تم إزالة تمييز العميل.', type: 'success' });
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحديث حالة العميل.', type: 'error' });
        }
    };

    const handleSendWhatsAppReminder = () => {
        if (!selectedClient) return;
        let phone = selectedClient.phone.replace(/\D/g, '');
        if (phone.startsWith('05')) {
            phone = '966' + phone.substring(1);
        } else if (phone.length === 9 && phone.startsWith('5')) {
            phone = '966' + phone;
        }

        const message = `مرحباً ${selectedClient.name}،\n\nنود تذكيركم بوجود مبلغ مستحق قدره ${clientFinancials.totalRemaining} ريال. يرجى المبادرة بالسداد في أقرب فرصة.\n\nشكراً لتعاملكم معنا.\n${settings.appName}`;
        
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const primaryColor = design === 'classic' ? 'teal' : design === 'glass' ? 'indigo' : 'blue';
    const selectedClasses = design === 'classic' ? 'bg-teal-100 dark:bg-teal-900/50' : design === 'glass' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-blue-100 dark:bg-blue-900/50';

    const filterButtonClass = (isActive: boolean) => isActive 
        ? `bg-${primaryColor}-600 text-white shadow-md` 
        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600';


    return (
        <div className="container mx-auto">
             <h2 className="text-3xl font-bold mb-6 text-slate-800 dark:text-slate-200">إدارة العملاء</h2>
             <div className="md:flex md:gap-6 h-[calc(100vh-150px)]">
                {/* Client List */}
                <div className={`md:w-1/3 lg:w-1/4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg flex flex-col ${selectedClientId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">قائمة العملاء</h3>
                        <Button onClick={handleAddClient} size="sm" leftIcon={<Icon name="add"/>}>إضافة</Button>
                    </div>
                    <div className="relative mb-2">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><SearchIcon className="h-5 w-5 text-slate-400"/></span>
                        <input type="text" placeholder="بحث بالاسم أو الهاتف..." value={searchTerm} onChange={handleSearchChange} className={searchInputClasses}/>
                    </div>
                    <div className="mb-4">
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 cursor-pointer border border-yellow-100 dark:border-yellow-900/30">
                            <input type="checkbox" checked={debtFilter} onChange={e => setDebtFilter(e.target.checked)} className="rounded text-yellow-500 focus:ring-yellow-500" />
                            <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300">عرض العملاء الذين عليهم مديونيات فقط</span>
                        </label>
                    </div>
                    <ul className="space-y-2 overflow-y-auto flex-grow" onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop === target.clientHeight) {
                            handleLoadMore();
                        }
                    }}>
                        {allVisibleClients.map(client => (
                            <li key={client.id}>
                                <button onClick={() => setSelectedClientId(client.id)} className={`w-full text-right p-3 rounded-md transition-colors ${selectedClientId === client.id ? selectedClasses : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                    <div className="flex items-center gap-2">
                                        {client.is_vip && <Icon name="star" className="w-4 h-4 text-yellow-400 fill-current" />}
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{client.name}</p>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{client.phone}</p>
                                </button>
                            </li>
                        ))}
                        {isLoadingClients && (
                            [...Array(3)].map((_, i) => (
                                <li key={i} className="p-3">
                                    <Skeleton className="h-4 w-3/4 mb-2" />
                                    <Skeleton className="h-3 w-1/2" />
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Client Details */}
                <div className={`w-full md:w-2/3 lg:w-3/4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg overflow-y-auto ${selectedClientId ? 'block' : 'hidden md:block'}`}>
                    <Button variant="secondary" onClick={() => setSelectedClientId(null)} className="md:hidden mb-4">
                         <Icon name="back" className="w-4 h-4 transform scale-x-[-1]" />
                         <span className="ms-2">العودة للقائمة</span>
                    </Button>
                    {selectedClient ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {selectedClient.is_vip && <Icon name="star" className="w-6 h-6 text-yellow-400 fill-current" />}
                                            <h3 className={`text-2xl font-bold text-${primaryColor}-600 dark:text-${primaryColor}-400`}>{selectedClient.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 text-slate-600 dark:text-slate-300">
                                            <PhoneIcon className="w-5 h-5"/>
                                            <span>{selectedClient.phone}</span>
                                            <a href={`tel:${selectedClient.phone}`} className="p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50" title="اتصال">
                                                <Icon name="phone" className="w-5 h-5 text-green-500"/>
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex gap-2">
                                            <Button variant="secondary" onClick={() => handleEditClient(selectedClient)}><Icon name="edit" className="w-4 h-4"/></Button>
                                            <Button variant="danger" onClick={() => handleDeleteClient(selectedClient)}><Icon name="delete" className="w-4 h-4"/></Button>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer mt-2 p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                                            <input type="checkbox" checked={!!selectedClient.is_vip} onChange={handleToggleVip} className="w-5 h-5 rounded-md text-yellow-500 focus:ring-yellow-400" />
                                            <span className="font-bold text-yellow-500">عميل مميز (VIP)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            {isLoadingClientRequests ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                                    </div>
                                    <SkeletonTable rows={5} />
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-lg font-bold">البيانات المالية</h4>
                                            {clientFinancials.totalRemaining > 0 && (
                                                <Button onClick={handleSendWhatsAppReminder} variant="whatsapp" size="sm" leftIcon={<Icon name="whatsapp" className="w-4 h-4"/>}>
                                                    إرسال مطالبة مالية
                                                </Button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                             <div className="p-4 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-center flex flex-col justify-center">
                                                <p className="text-sm text-purple-600 dark:text-purple-400">آخر زيارة</p>
                                                {lastVisit ? (
                                                    <div className="mt-1">
                                                        <p className="text-xl font-bold text-purple-800 dark:text-purple-200">{lastVisit.date}</p>
                                                        <p className="text-md text-purple-700 dark:text-purple-300">{lastVisit.dayOfWeek} ({lastVisit.daysAgo})</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-lg font-bold text-purple-800 dark:text-purple-200 mt-2">لا توجد زيارات سابقة</p>
                                                )}
                                            </div>
                                            <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg text-center">
                                                <p className="text-sm text-green-600 dark:text-green-400">إجمالي الإيرادات</p>
                                                <p className="text-2xl font-bold text-green-800 dark:text-green-200">{clientFinancials.totalRevenue.toLocaleString('en-US')} ريال</p>
                                            </div>
                                            <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-center">
                                                <p className="text-sm text-blue-600 dark:text-blue-400">المدفوع</p>
                                                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{clientFinancials.totalPaid.toLocaleString('en-US')} ريال</p>
                                            </div>
                                            <div className="p-4 bg-red-100 dark:bg-red-900/50 rounded-lg text-center">
                                                <p className="text-sm text-red-600 dark:text-red-400">المتبقي</p>
                                                <p className="text-2xl font-bold text-red-800 dark:text-red-200">{clientFinancials.totalRemaining.toLocaleString('en-US')} ريال</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
                                            سجل الطلبات
                                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs text-slate-500">{filteredClientRequests.length}</span>
                                        </h4>
                                        
                                        {/* History Filters */}
                                        <div className="mb-4 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600 space-y-3">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> التاريخ:</span>
                                                <button onClick={() => setHistoryFilterType('today')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(historyFilterType === 'today')}`}>اليوم</button>
                                                <button onClick={() => setHistoryFilterType('yesterday')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(historyFilterType === 'yesterday')}`}>أمس</button>
                                                <button onClick={() => setHistoryFilterType('month')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(historyFilterType === 'month')}`}>هذا الشهر</button>
                                                <button onClick={() => setHistoryFilterType('all')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(historyFilterType === 'all')}`}>الكل</button>
                                                <button onClick={() => setHistoryFilterType('custom')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(historyFilterType === 'custom')}`}>مخصص</button>
                                            </div>

                                            {historyFilterType === 'custom' && (
                                                <div className="flex items-center gap-2 animate-fade-in">
                                                    <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs" />
                                                    <span>-</span>
                                                    <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs" />
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 items-center pt-2 border-t dark:border-slate-600">
                                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><DollarSignIcon className="w-3 h-3"/> الدفع:</span>
                                                <button onClick={() => setPaymentStatusFilter('all')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(paymentStatusFilter === 'all')}`}>الكل</button>
                                                <button onClick={() => setPaymentStatusFilter('unpaid')} className={`px-3 py-1 rounded text-xs transition-colors ${filterButtonClass(paymentStatusFilter === 'unpaid')}`}>غير مدفوع (آجل/انتظار)</button>
                                            </div>
                                        </div>

                                         <div className="relative mb-4">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><SearchIcon className="h-5 w-5 text-slate-400"/></span>
                                            <input type="text" placeholder="بحث في الطلبات باللوحة أو اسم السيارة..." value={requestSearchTerm} onChange={e => setRequestSearchTerm(e.target.value)} className={searchInputClasses}/>
                                        </div>
                                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700 bg-white dark:bg-slate-800">
                                             <table className="w-full text-sm">
                                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-3">رقم الطلب</th>
                                                        <th className="px-4 py-3">السيارة</th>
                                                        <th className="px-4 py-3">التاريخ</th>
                                                        <th className="px-4 py-3">الحالة</th>
                                                        <th className="px-4 py-3">المبلغ</th>
                                                        <th className="px-4 py-3"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="dark:text-slate-300 divide-y dark:divide-slate-700">
                                                    {filteredClientRequests.map(req => {
                                                        const carInfo = getCarInfo(req.car_id);
                                                        const carName = req.car_snapshot ? `${req.car_snapshot.make_ar} ${req.car_snapshot.model_ar}` : carInfo.name;
                                                        const isUnpaid = req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT;

                                                        return (
                                                            <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                                <td className="px-4 py-3 font-mono">#{req.request_number}</td>
                                                                <td className="px-4 py-3">{carName}</td>
                                                                <td className="px-4 py-3 text-xs">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                        req.status === RequestStatus.COMPLETE ? 'bg-green-100 text-green-700' :
                                                                        req.status === RequestStatus.WAITING_PAYMENT ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                        {req.status}
                                                                    </span>
                                                                </td>
                                                                <td className={`px-4 py-3 font-bold font-numeric ${isUnpaid ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                    {req.price} {isUnpaid && <span className="text-[9px] bg-red-100 px-1 rounded mr-1">غير مدفوع</span>}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                     <Button variant="secondary" size="sm" onClick={() => { setSelectedRequestId(req.id); setPage('print-report'); }}>
                                                                        تقرير
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                     {filteredClientRequests.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">لا توجد طلبات لعرضها في هذه الفترة.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                             </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
                            <UsersIcon className="w-16 h-16 mb-4"/>
                            <h3 className="text-xl font-semibold">اختر عميل لعرض التفاصيل</h3>
                            <p className="mt-2">أو قم بإضافة عميل جديد للبدء.</p>
                        </div>
                    )}
                </div>
             </div>
             
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}>
                <div className="space-y-4">
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
