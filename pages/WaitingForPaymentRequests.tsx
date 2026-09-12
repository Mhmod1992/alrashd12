
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { InspectionRequest, RequestStatus, PaymentType } from '../types';
import Button from '../components/Button';
import PlusIcon from '../components/icons/PlusIcon';
import Modal from '../components/Modal';
import NewRequestForm from '../components/NewRequestForm';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import SearchIcon from '../components/icons/SearchIcon';
import RequestTable from '../components/RequestTable';

const WaitingForPaymentRequests: React.FC = () => {
    const {
        requests,
        clients,
        cars,
        carMakes,
        carModels,
        inspectionTypes,
        can,
        setInitialRequestModalState,
        initialRequestModalState,
        isRefreshing,
        addNotification,
        updateRequest,
        employees,
        brokers,
        sendWhatsAppMessage,
        whatsappApiStatus,
        checkWhatsAppStatus,
        settings,
        showNewRequestSuccessModal,
        createActivityLog,
    } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [plateDisplayLanguage, setPlateDisplayLanguage] = useState<'ar' | 'en'>('ar');
    
    // History Modal State
    const [historyModalCar, setHistoryModalCar] = useState<{ carId: string, carName: string } | null>(null);
    const [carHistoryRequests, setCarHistoryRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [serverCarsWithHistory, setServerCarsWithHistory] = useState<Set<string>>(new Set());

    const { fetchRequestsByCarId, triggerHighlight, setSelectedRequestId, setPage: navigateToPage } = useAppContext();

    // Handle search from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const searchParam = params.get('search');
        if (searchParam) {
            setSearchTerm(searchParam);
        }
    }, []);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [paymentRequest, setPaymentRequest] = useState<InspectionRequest | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentType | ''>('');
    const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
    const [splitCardAmount, setSplitCardAmount] = useState<number>(0);
    const [sendWhatsAppStartNotify, setSendWhatsAppStartNotify] = useState<boolean>(true);

    useEffect(() => {
        if (initialRequestModalState === 'new' && can('create_requests')) {
            setIsModalOpen(true);
            setInitialRequestModalState(null);
        }
    }, [initialRequestModalState, setInitialRequestModalState, can]);

    const { dataToDisplay, carsWithHistory } = useMemo(() => {
        const waiting = requests.filter(r => r.status === RequestStatus.WAITING_PAYMENT);
        let sourceData = waiting;
        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase().replace(/\s/g, '');
            const termNum = term.replace(/^w-?/, '');
            sourceData = waiting.filter(r => {
                const wNum = String(r.waiting_number || (r.payment_note?.match(/\[W-(\d+)\]/i)?.[1]) || '');
                return String(r.request_number).includes(term) || wNum.includes(termNum) || `w-${wNum}`.includes(term);
            });
        }

        const identityToRequestCount = new Map<string, number>();
        const carIdToIdentity = new Map<string, string>();

        requests.forEach(req => {
            const car = cars.find(c => c.id === req.car_id);
            if (car) {
                const identity = (car.vin || car.plate_number || car.plate_number_en || car.id).replace(/\s/g, '').toLowerCase();
                identityToRequestCount.set(identity, (identityToRequestCount.get(identity) || 0) + 1);
                carIdToIdentity.set(req.car_id, identity);
            }
        });

        const carsWithHistorySet = new Set<string>();
        sourceData.forEach(req => {
            const identity = carIdToIdentity.get(req.car_id);
            if (identity && (identityToRequestCount.get(identity) || 0) > 1) {
                carsWithHistorySet.add(req.car_id);
            }
        });

        return { dataToDisplay: sourceData, carsWithHistory: carsWithHistorySet };
    }, [requests, searchTerm, cars]);

    useEffect(() => {
        const fetchHistory = async () => {
             const uniqueCarIds = Array.from(new Set(dataToDisplay.map(r => r.car_id))).filter(Boolean);
             if (uniqueCarIds.length === 0) return;

             const chunks = [];
             const chunkSize = 15;
             for (let i = 0; i < uniqueCarIds.length; i += chunkSize) {
                 chunks.push(uniqueCarIds.slice(i, i + chunkSize));
             }

             const newHistorySet = new Set<string>();

             for (const chunk of chunks) {
                 const chunkCars = cars.filter(c => chunk.includes(c.id));
                 
                 for (const car of chunkCars) {
                     const plate = car.plate_number?.replace(/\s/g, '').toLowerCase();
                     const plateEn = car.plate_number_en?.replace(/\s/g, '').toLowerCase();
                     const vin = car.vin?.replace(/\s/g, '').toLowerCase();

                     if (!plate && !plateEn && !vin) {
                         const { count } = await supabase
                            .from('inspection_requests')
                            .select('*', { count: 'exact', head: true })
                            .eq('car_id', car.id);
                         if (count && count > 1) newHistorySet.add(car.id);
                         continue;
                     }

                     let queryParts = [];
                     if (plate) queryParts.push(`plate_number.ilike.${plate}`); // Using exact lowercase matching
                     if (plateEn) queryParts.push(`plate_number_en.ilike.${plateEn}`);
                     if (vin) queryParts.push(`vin.ilike.${vin}`);

                     const { data: matchingCars } = await supabase
                        .from('cars')
                        .select('id')
                        .or(queryParts.join(','));
                     
                     if (matchingCars && matchingCars.length > 0) {
                         const matchingCarIds = matchingCars.map((c: any) => c.id);
                         const { count } = await supabase
                            .from('inspection_requests')
                            .select('*', { count: 'exact', head: true })
                            .in('car_id', matchingCarIds);
                         
                         if (count && count > 1) {
                             newHistorySet.add(car.id);
                         }
                     }
                 }
             }
             
             setServerCarsWithHistory(prev => {
                 const next = new Set(prev);
                 newHistorySet.forEach(id => next.add(id));
                 return next;
             });
        };

        const timeoutId = setTimeout(fetchHistory, 1500);
        return () => clearTimeout(timeoutId);
    }, [dataToDisplay, cars, supabase]);

    const combinedCarsWithHistory = useMemo(() => {
        const combined = new Set(carsWithHistory);
        serverCarsWithHistory.forEach(id => combined.add(id));
        return combined;
    }, [carsWithHistory, serverCarsWithHistory]);

    const handleOpenHistoryModal = async (event: React.MouseEvent, carId: string, carName: string) => {
        event.stopPropagation();
        setHistoryModalCar({ carId, carName });
        setIsLoadingHistory(true);
        try {
            const history = await fetchRequestsByCarId(carId);
            setCarHistoryRequests(history);
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل سجل السيارة.', type: 'error' });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleResendWhatsApp = async (request: InspectionRequest) => {
        const client = clients.find(c => c.id === request.client_id);
        if (!client || !client.phone) {
            addNotification({ title: 'خطأ', message: 'رقم هاتف العميل غير موجود.', type: 'error' });
            return;
        }
    
        let phone = client.phone.replace(/\D/g, '');
        if (phone.startsWith('05')) {
            phone = '966' + phone.substring(1);
        } else if (phone.length === 9 && phone.startsWith('5')) {
            phone = '966' + phone;
        }
    
        let carInfo = '';
        if (request.car_snapshot) {
            carInfo = `🚙 *السيارة: ${request.car_snapshot.make_en || ''} ${request.car_snapshot.model_en || ''} ${request.car_snapshot.year || ''}*\n`;
        }

        const inspectionType = inspectionTypes.find(t => t.id === request.inspection_type_id);
        const typeInfo = inspectionType?.name ? `📋 *نوع الفحص: ${inspectionType.name}*\n` : '';

        const waitingNum = request.waiting_number || (request.payment_note?.match(/\[W-(\d+)\]/i)?.[1]) || (request.status === RequestStatus.WAITING_PAYMENT ? 100 : request.request_number);
        const reqLabel = request.status === RequestStatus.WAITING_PAYMENT ? `w - ${waitingNum} (بانتظار الدفع)` : `#${request.request_number}`;

        const message = `أهلاً *${client.name}*، نود تذكيركم بالطلب رقم *${reqLabel}*.\n\n${carInfo}${typeInfo}💳 *المبلغ المطلوب: ${request.price} ريال*\n\nالرجاء إتمام الدفع لدى الكاشير لبدء الفحص.\nشكراً لكم.`;
        
        await sendWhatsAppMessage(phone, message, client.name);
    };

    const handleProcessPaymentClick = (request: InspectionRequest) => {
      setPaymentRequest(request);
      setPaymentMethod(''); 
      setSplitCashAmount(0);
      setSplitCardAmount(request.price);
      setSendWhatsAppStartNotify(true);
      if (checkWhatsAppStatus) {
          checkWhatsAppStatus();
      }
      setIsPaymentModalOpen(true);
    };

    const handleSplitCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setSplitCashAmount(val);
        if (paymentRequest) {
            setSplitCardAmount(paymentRequest.price - val);
        }
    };

    const confirmPayment = async () => {
        if (!paymentRequest || isSubmittingPayment) return;
        
        if (!paymentMethod) {
            addNotification({ title: 'تنبيه', message: 'يرجى تحديد طريقة دفع المبلغ أولاً.', type: 'warning' });
            return;
        }

        if (paymentMethod === PaymentType.Split) {
             if (splitCashAmount + splitCardAmount !== paymentRequest.price) {
                 addNotification({ title: 'خطأ', message: 'مجموع المبالغ لا يساوي قيمة الطلب.', type: 'error' });
                 return;
             }
        }

        setIsSubmittingPayment(true);
        try {
            const now = new Date().toISOString();
            const currentReq = requests.find(r => r.id === paymentRequest.id) || paymentRequest;

            // Calculate next official serial number reliably
            const maxLocal = requests
                .filter(r => r.status !== RequestStatus.WAITING_PAYMENT && r.id !== paymentRequest.id)
                .reduce((max, r) => Math.max(max, Number(r.request_number) || 0), 0);
            
            let nextOfficialNumber = Math.max(maxLocal, Number(currentReq.request_number) || 0);

            try {
                const { data: maxData, error: maxError } = await supabase
                    .from('inspection_requests')
                    .select('request_number')
                    .neq('status', RequestStatus.WAITING_PAYMENT)
                    .neq('id', paymentRequest.id)
                    .order('request_number', { ascending: false })
                    .limit(1);

                if (!maxError && maxData && maxData.length > 0 && maxData[0].request_number) {
                    const dbMax = Number(maxData[0].request_number);
                    if (dbMax >= nextOfficialNumber) {
                        nextOfficialNumber = dbMax + 1;
                    }
                }
            } catch (e) {
                console.warn('Could not fetch max request_number from DB, using calculated number:', e);
            }

            if (nextOfficialNumber <= 0) {
                nextOfficialNumber = Number(currentReq.request_number) || 1;
            }

            const cleanPaymentNote = (currentReq.payment_note || '').replace(/\[W-\d+\]\s*/gi, '').trim();
            const prevWaitingNum = paymentRequest.waiting_number || (paymentRequest.payment_note?.match(/\[W-(\d+)\]/i)?.[1] ? parseInt(paymentRequest.payment_note.match(/\[W-(\d+)\]/i)![1], 10) : undefined);

            const newLog = createActivityLog ? createActivityLog(
                'تحصيل وتفعيل الطلب', 
                `تم تحصيل المبلغ (${paymentRequest.price} ريال - ${paymentMethod}) وتحديث وقت الطلب إلى وقت التحصيل الفعلي${prevWaitingNum ? ` (طلب انتظار w - ${prevWaitingNum})` : ''}`
            ) : null;
            const updatedLog = newLog ? [newLog, ...(currentReq.activity_log || [])] : (currentReq.activity_log || []);

            await updateRequest({
                id: paymentRequest.id,
                request_number: nextOfficialNumber,
                status: RequestStatus.NEW,
                payment_type: paymentMethod,
                split_payment_details: paymentMethod === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined,
                payment_note: cleanPaymentNote || null,
                waiting_number: prevWaitingNum,
                inspection_data: prevWaitingNum ? { ...(currentReq.inspection_data || {}), waiting_number: prevWaitingNum } : currentReq.inspection_data,
                created_at: now,
                activity_log: updatedLog
            });

            if (sendWhatsAppStartNotify && paymentMethod !== PaymentType.Unpaid) {
                const client = clients.find(c => c.id === paymentRequest.client_id);
                if (client && client.phone) {
                    const message = `حياكم الله *${client.name || ''}*،
#${nextOfficialNumber}
تم تأكيد استلام مركبتكم *${paymentRequest.car_snapshot?.make_en || ''} ${paymentRequest.car_snapshot?.model_en || ''} ${paymentRequest.car_snapshot?.year || ''}*
وبدء إجراءات الفحص الفني في مركزنا.

نعمل حالياً على إتمام الفحص وتجهيز التقرير بأعلى معايير الدقة والجودة، وسيتم إشعاركم فور الجاهزية.

شكراً لاختياركم مركزنا.
*ادارة مركز الراشد*`;
                    await sendWhatsAppMessage(client.phone, message, client.name, { suppressModal: true });
                }
            }

            addNotification({ title: 'نجاح', message: `تم استلام الدفعة وتفعيل الطلب برقم #${nextOfficialNumber}.`, type: 'success' });
            
            const paidRequestId = paymentRequest.id;
            setIsPaymentModalOpen(false);
            setPaymentRequest(null);

            // Open success modal explicitly with isWaiting = false
            setTimeout(() => {
                showNewRequestSuccessModal(paidRequestId, nextOfficialNumber, false, false);
            }, 100);
        } catch (error) {
            console.error('Payment confirmation error:', error);
            addNotification({ title: 'خطأ', message: 'فشل معالجة الدفع وتفعيل الطلب.', type: 'error' });
        } finally {
            setIsSubmittingPayment(false);
        }
    };
    
    const creatorEmployee = useMemo(() => {
        if (!paymentRequest || !employees) return null;
        return employees.find(e => e.id === paymentRequest.employee_id);
    }, [paymentRequest, employees]);

    return (
        <div className="container mx-auto animate-fade-in">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">الطلبات بانتظار الدفع</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        هذه القائمة تعرض الطلبات التي تم إنشاؤها وبانتظار تحصيل المبلغ من قبل الكاشير.
                    </p>
                </div>
                {can('create_requests') && (
                    <Button onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon className="w-5 h-5" />} className="py-3 px-6 text-lg">
                        إنشاء طلب جديد
                    </Button>
                )}
            </div>
            
            <div className="mb-6 relative">
                 <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-slate-400" />
                </span>
                <input 
                    type="text" 
                    placeholder="ابحث برقم الطلب..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="block w-full p-3 pl-10 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200"
                />
            </div>

            {dataToDisplay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-full mb-4">
                        <RefreshCwIcon className="w-10 h-10 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                        {searchTerm ? 'لا توجد نتائج بحث' : 'لا توجد طلبات معلقة'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                        {searchTerm ? 'لم يتم العثور على طلبات تطابق رقم البحث.' : 'جميع الطلبات تم دفعها. اضغط على "إنشاء طلب جديد" لبدء معاملة جديدة.'}
                    </p>
                    {can('create_requests') && (
                        <Button onClick={() => setIsModalOpen(true)} className="mt-6" variant="secondary">
                            إنشاء طلب
                        </Button>
                    )}
                </div>
            ) : (
                <RequestTable
                    requests={dataToDisplay}
                    clients={clients}
                    cars={cars}
                    carMakes={carMakes}
                    carModels={carModels}
                    inspectionTypes={inspectionTypes}
                    employees={employees}
                    title="قائمة الانتظار"
                    plateDisplayLanguage={plateDisplayLanguage}
                    setPlateDisplayLanguage={setPlateDisplayLanguage}
                    isRefreshing={isRefreshing}
                    isLive={true}
                    onProcessPayment={can('process_payment') ? handleProcessPaymentClick : undefined}
                    onResendWhatsApp={handleResendWhatsApp}
                    onHistoryClick={handleOpenHistoryModal}
                    carsWithHistory={combinedCarsWithHistory}
                />
            )}

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إنشاء طلب جديد" size="4xl">
                    <NewRequestForm
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        onCancel={() => setIsModalOpen(false)}
                        onSuccess={() => setIsModalOpen(false)}
                        forceWhatsApp={true}
                    />
                </Modal>
            )}

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="تحصيل المبلغ وتفعيل الطلب" size="md">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        سيتم تحويل حالة الطلب <strong className="font-mono text-purple-600 dark:text-purple-400">w - {paymentRequest?.waiting_number || (paymentRequest?.payment_note?.match(/\[W-(\d+)\]/i)?.[1]) || 100}</strong> إلى "جديد" وسيتم تعيين الرقم التسلسلي الرسمي للطلب تلقائياً.
                    </p>

                    <div className="space-y-2 text-sm bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border dark:border-slate-600">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">وقت حجز الطلب المعلق:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {paymentRequest ? `${new Date(paymentRequest.created_at).toLocaleDateString('en-GB')} ${new Date(paymentRequest.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">تم الإنشاء بواسطة:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {creatorEmployee?.name || 'غير معروف'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                            <span>⏱️ سيتم تحديث وقت الطلب إلى وقت التحصيل الفعلي فور التأكيد</span>
                        </div>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg border dark:border-slate-600 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">المبلغ المطلوب</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">{paymentRequest?.price.toLocaleString('en-US')} ريال</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            طريقة الدفع <span className="text-red-500">*</span>
                        </label>
                        <select 
                            value={paymentMethod} 
                            onChange={(e) => {
                                const newMethod = e.target.value as PaymentType | '';
                                setPaymentMethod(newMethod);
                                if (newMethod === PaymentType.Split && paymentRequest) {
                                    setSplitCashAmount(0);
                                    setSplitCardAmount(paymentRequest.price);
                                }
                            }}
                            className={`w-full p-2.5 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-colors ${
                                !paymentMethod 
                                    ? 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50' 
                                    : 'border-slate-300 dark:border-slate-600'
                            }`}
                        >
                            <option value="" disabled>-- اختر طريقة التحصيل --</option>
                            <option value={PaymentType.Cash}>نقدي</option>
                            <option value={PaymentType.Card}>بطاقة</option>
                            <option value={PaymentType.Transfer}>تحويل بنكي</option>
                            <option value={PaymentType.Split}>نقدي - بطاقة</option>
                            <option value={PaymentType.Unpaid}>غير مدفوع (آجل)</option>
                        </select>
                        {!paymentMethod && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                                * يرجى تحديد طريقة الدفع لتفعيل الطلب
                            </p>
                        )}
                    </div>

                    {paymentMethod === PaymentType.Split && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 animate-fade-in">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">نقدي</label>
                                <input 
                                    type="number" 
                                    value={splitCashAmount} 
                                    onChange={handleSplitCashChange}
                                    className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">بطاقة (تلقائي)</label>
                                <input 
                                    type="number" 
                                    value={splitCardAmount} 
                                    readOnly
                                    className="w-full p-2 text-sm border rounded bg-slate-100 dark:bg-slate-600 dark:border-slate-500 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}

                    {paymentMethod !== PaymentType.Unpaid && (
                        <div className="pt-2 border-t dark:border-slate-700">
                            <label className="flex items-center justify-between gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={sendWhatsAppStartNotify}
                                        onChange={(e) => setSendWhatsAppStartNotify(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        إرسال رسالة واتساب للعميل ببدء الفحص
                                    </span>
                                </div>
                                {settings.whatsappMode === 'api' ? (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        whatsappApiStatus === 'connected' 
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : whatsappApiStatus === 'checking'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {whatsappApiStatus === 'connected' ? '🟢 متصل' : whatsappApiStatus === 'checking' ? '🟡 جاري التحقق...' : '🔴 غير متصل'}
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        💬 واتساب يدوي
                                    </span>
                                )}
                            </label>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-2 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmittingPayment}>إلغاء</Button>
                    <Button onClick={confirmPayment} disabled={isSubmittingPayment || !paymentMethod}>
                        {isSubmittingPayment ? 'جاري التأكيد...' : 'تأكيد الاستلام'}
                    </Button>
                </div>
            </Modal>

            {historyModalCar && (
                <Modal 
                    isOpen={!!historyModalCar} 
                    onClose={() => setHistoryModalCar(null)} 
                    title={`سجل فحص سيارة: ${historyModalCar.carName}`}
                    size="4xl"
                >
                    <div className="p-1">
                        <RequestTable 
                            requests={carHistoryRequests}
                            clients={clients}
                            cars={cars}
                            carMakes={carMakes}
                            carModels={carModels}
                            inspectionTypes={inspectionTypes}
                            employees={employees}
                            title="الطلبات السابقة"
                            isLoading={isLoadingHistory}
                            onRowClick={(id) => {
                                setHistoryModalCar(null);
                                setSelectedRequestId(id);
                                navigateToPage('request-draft');
                            }}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default WaitingForPaymentRequests;
