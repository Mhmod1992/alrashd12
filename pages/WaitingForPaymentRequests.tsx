
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { InspectionRequest, RequestStatus, PaymentType, Client } from '../types';
import Button from '../components/Button';
import PlusIcon from '../components/icons/PlusIcon';
import Modal from '../components/Modal';
import NewRequestForm from '../components/NewRequestForm';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import SearchIcon from '../components/icons/SearchIcon';
import RequestTable from '../components/RequestTable';
import { formatPendingNumber, arabicToEnglishNumerals, cleanSaudiPhoneNumber, uuidv4 } from '../lib/utils';
import { ClientSearchInput } from '../components/ClientSearchInput';
import SmartPhoneInput from '../components/SmartPhoneInput';
import LockIcon from '../components/icons/LockIcon';
import EditIcon from '../components/icons/EditIcon';

const WaitingForPaymentRequests: React.FC = () => {
    const {
        requests,
        pendingRequests,
        convertPendingToOfficialRequest,
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
        updateClient,
        addClient,
        systemDefaultClient,
        employees,
        brokers,
        sendWhatsAppMessage,
        whatsappApiStatus,
        showNewRequestSuccessModal,
        createActivityLog,
        searchClients,
        lastRemoteUpdateReq,
        setRequests
    } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [plateDisplayLanguage, setPlateDisplayLanguage] = useState<'ar' | 'en'>('ar');
    const [sendWhatsAppStartNotify, setSendWhatsAppStartNotify] = useState<boolean>(true);
    
    // History Modal State
    const [historyModalCar, setHistoryModalCar] = useState<{ carId: string, carName: string } | null>(null);
    const [carHistoryRequests, setCarHistoryRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [serverCarsWithHistory, setServerCarsWithHistory] = useState<Set<string>>(new Set());

    const { fetchRequestsByCarId, triggerHighlight, setSelectedRequestId, setPage: navigateToPage } = useAppContext();

    // Handle remote updates for requests not in the main batch
    useEffect(() => {
        if (lastRemoteUpdateReq) {
            // If the request was WAITING_PAYMENT but now it's NEW or something else,
            // we should make sure it's reflected in the global requests state so dataToDisplay updates
            setRequests(prev => {
                const exists = prev.some(r => r.id === lastRemoteUpdateReq.id);
                if (exists) {
                    return prev.map(r => r.id === lastRemoteUpdateReq.id ? { ...r, ...lastRemoteUpdateReq } : r);
                } else if (lastRemoteUpdateReq.status === RequestStatus.WAITING_PAYMENT) {
                    // If it's a "waiting payment" request that we didn't have before, add it
                    return [lastRemoteUpdateReq, ...prev];
                }
                return prev;
            });
        }
    }, [lastRemoteUpdateReq, setRequests]);

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
    const [paymentRequest, setPaymentRequest] = useState<InspectionRequest | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentType | ''>('');
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
    const [splitCardAmount, setSplitCardAmount] = useState<number>(0);
    const [editableClientName, setEditableClientName] = useState<string>('');
    const [editableClientPhone, setEditableClientPhone] = useState<string>('');
    const [selectedPaymentClientId, setSelectedPaymentClientId] = useState<string | null>(null);
    const [editablePrice, setEditablePrice] = useState<number>(0);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [requestToUpdate, setRequestToUpdate] = useState<InspectionRequest | null>(null);

    const [matchedDbClient, setMatchedDbClient] = useState<Client | null>(null);
    const [isSearchingClient, setIsSearchingClient] = useState<boolean>(false);

    const searchDbForClient = useCallback(async (rawPhone: string) => {
        const digits = (rawPhone || '').replace(/\D/g, '');
        if (digits.length < 8) {
            setMatchedDbClient(null);
            setIsSearchingClient(false);
            return null;
        }

        const searchPart = digits.slice(-8);
        setIsSearchingClient(true);

        try {
            const { data } = await supabase
                .from('clients')
                .select('*')
                .not('is_system_default', 'is', true)
                .or(`phone.ilike.%${searchPart}%,phone.ilike.%${digits}%`)
                .limit(5);

            if (data && data.length > 0) {
                const bestMatch = data.find((c: Client) => {
                    const cDigits = (c.phone || '').replace(/\D/g, '');
                    return cDigits.endsWith(searchPart) || cDigits === digits;
                }) || data[0];

                if (bestMatch) {
                    setMatchedDbClient(bestMatch);
                    setSelectedPaymentClientId(bestMatch.id);
                    setEditableClientName(prev => {
                        if (!prev || prev.trim() === '' || prev.trim() === 'عميل' || prev.trim() === 'عميل عام') {
                            return bestMatch.name;
                        }
                        return prev;
                    });
                    setIsSearchingClient(false);
                    return bestMatch;
                }
            }
            setMatchedDbClient(null);
        } catch (err) {
            console.error('Error searching client by phone:', err);
        } finally {
            setIsSearchingClient(false);
        }
        return null;
    }, [supabase]);

    useEffect(() => {
        if (!isPaymentModalOpen) return;
        const digits = editableClientPhone.replace(/\D/g, '');
        if (digits.length >= 8) {
            const searchPart = digits.slice(-8);
            const localMatch = clients.find(c => !c.is_system_default && c.phone && c.phone.replace(/\D/g, '').endsWith(searchPart));
            if (localMatch) {
                setMatchedDbClient(localMatch);
                setSelectedPaymentClientId(localMatch.id);
                setEditableClientName(prev => {
                    if (!prev || prev.trim() === '' || prev.trim() === 'عميل' || prev.trim() === 'عميل عام') {
                        return localMatch.name;
                    }
                    return prev;
                });
            }

            const timer = setTimeout(() => {
                searchDbForClient(editableClientPhone);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setMatchedDbClient(null);
            setSelectedPaymentClientId(null);
        }
    }, [editableClientPhone, isPaymentModalOpen, clients, searchDbForClient]);

    const activeMatchedClient = useMemo(() => {
        if (matchedDbClient) return matchedDbClient;
        const digits = (editableClientPhone || '').replace(/\D/g, '');
        if (digits.length < 8) return null;
        const searchPart = digits.slice(-8);
        return clients.find(c => !c.is_system_default && c.phone && c.phone.replace(/\D/g, '').endsWith(searchPart)) || null;
    }, [matchedDbClient, editableClientPhone, clients]);

    const handleOpenUpdateModal = (request: InspectionRequest) => {
        setRequestToUpdate(request);
        setIsUpdateModalOpen(true);
    };

    useEffect(() => {
        if (initialRequestModalState === 'new' && can('create_requests')) {
            setIsModalOpen(true);
            setInitialRequestModalState(null);
        }
    }, [initialRequestModalState, setInitialRequestModalState, can]);

    const { dataToDisplay, carsWithHistory } = useMemo(() => {
        // Map pendingRequests from the pending_requests table
        const formattedPending: InspectionRequest[] = (pendingRequests || []).map(p => {
            const matchingClient = clients.find(c => c.name === p.client_name || c.phone === p.client_phone);
            const clientId = matchingClient ? matchingClient.id : '';

            return {
                id: p.id,
                request_number: formatPendingNumber(p.pending_number),
                client_id: clientId,
                car_id: '',
                car_snapshot: p.car_snapshot || {
                    make_ar: '', make_en: '', model_ar: '', model_en: '', year: p.car_year || new Date().getFullYear(),
                    plate_number: p.plate_number || '', plate_number_en: p.plate_number_en || '', vin: p.vin || ''
                },
                inspection_type_id: p.inspection_type_id,
                payment_type: PaymentType.WaitingPayment,
                price: p.price,
                status: RequestStatus.WAITING_PAYMENT,
                created_at: p.created_at,
                employee_id: p.employee_id || '',
                broker: p.broker,
                payment_note: p.payment_note,
                _isPending: true,
                _rawPending: p
            } as any;
        });

        // Combine pendingRequests with any legacy WAITING_PAYMENT in requests
        const legacyWaiting = requests.filter(r => r.status === RequestStatus.WAITING_PAYMENT);
        const combined = [...formattedPending, ...legacyWaiting];

        let sourceData = combined;
        if (searchTerm.trim()) {
            sourceData = combined.filter(r => String(r.request_number).includes(searchTerm.trim()));
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
    }, [pendingRequests, requests, searchTerm, cars, clients]);

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
        const rawPending = (request as any)?._rawPending;
        let clientName = '';
        let clientPhone = '';

        if (rawPending) {
            clientName = rawPending.client_name || '';
            clientPhone = rawPending.client_phone || '';
        }

        if (!clientPhone && request.client_id) {
            const client = clients.find(c => c.id === request.client_id);
            if (client) {
                if (!clientName) clientName = client.name || '';
                clientPhone = client.phone || '';
            }
        }

        if (!clientPhone && (request as any).client) {
            clientName = clientName || (request as any).client.name || '';
            clientPhone = (request as any).client.phone || '';
        }

        if (!clientName) {
            clientName = 'العميل';
        }

        const normalizedPhone = arabicToEnglishNumerals(String(clientPhone || ''));
        let phone = normalizedPhone.replace(/\D/g, '');
        if (phone.startsWith('00966')) {
            phone = phone.substring(2);
        } else if (phone.startsWith('05')) {
            phone = '966' + phone.substring(1);
        } else if (phone.length === 9 && phone.startsWith('5')) {
            phone = '966' + phone;
        }

        if (!phone || phone.length < 9) {
            addNotification({ title: 'خطأ', message: 'رقم هاتف العميل غير موجود أو غير صحيح.', type: 'error' });
            return;
        }

        const formatShortRequestNumber = (num: string | number) => {
            const str = String(num);
            if (str.length >= 4) {
                return str.replace(/(\d)(\d{3})$/, '$1-$2');
            }
            return str;
        };

        const shortReqNum = formatShortRequestNumber(request.request_number);
        let carDetails = 'غير محدد';
        if (request.car_snapshot) {
            carDetails = [request.car_snapshot.make_en, request.car_snapshot.model_en, request.car_snapshot.year].filter(Boolean).join(' ') || 'غير محدد';
        }

        const message = `*تذكير بالدفع — مركز الراشد*\n\nالمكرم *${clientName}* ،\nنُذكّركم بأن الطلب *\u200E#${shortReqNum}\u200E* بانتظار الدفع:\n\n▪️ السيارة: ${carDetails}\n💵 المبلغ: *《 ${request.price} ريال 》*\n\nيرجى السداد لدى *المحاسب لبدء الفحص* .\n\n*إدارة مركز الراشد*`;
        
        await sendWhatsAppMessage(phone, message, clientName);
    };

    const handleProcessPaymentClick = async (request: InspectionRequest) => {
      setPaymentRequest(request);
      setPaymentMethod(''); 
      setPaymentError(null);
      setMatchedDbClient(null);

      const rawPending = (request as any)?._rawPending;
      let cName = rawPending?.client_name || (request as any)?.client_name || '';
      let cPhone = rawPending?.client_phone || (request as any)?.client_phone || '';

      if (!cPhone && request.client_id) {
          const client = clients.find(c => c.id === request.client_id);
          cName = client?.name || cName;
          cPhone = client?.phone || '';
      }

      setEditableClientName(cName);
      setEditableClientPhone(cPhone);
      setEditablePrice(request.price || 0);
      setSplitCashAmount(0);
      setSplitCardAmount(request.price || 0);
      setIsPaymentModalOpen(true);

      // Perform silent immediate search in DB and local
      const digits = (cPhone || '').replace(/\D/g, '');
      if (digits.length >= 8) {
          const searchPart = digits.slice(-8);
          const localMatch = clients.find(c => !c.is_system_default && c.phone && c.phone.replace(/\D/g, '').endsWith(searchPart));
          if (localMatch) {
              setMatchedDbClient(localMatch);
              setSelectedPaymentClientId(localMatch.id);
              if (localMatch.name) {
                  setEditableClientName(localMatch.name);
              }
          }
          
          searchDbForClient(cPhone).then(remoteMatch => {
              if (remoteMatch) {
                  setMatchedDbClient(remoteMatch);
                  setSelectedPaymentClientId(remoteMatch.id);
                  if (remoteMatch.name) {
                      setEditableClientName(remoteMatch.name);
                  }
              }
          });
      } else if (request.client_id) {
          try {
              const { data: dbClient } = await supabase.from('clients').select('*').eq('id', request.client_id).single();
              if (dbClient && !dbClient.is_system_default) {
                  setMatchedDbClient(dbClient);
                  setSelectedPaymentClientId(dbClient.id);
                  if (dbClient.name) setEditableClientName(dbClient.name);
                  if (dbClient.phone && !cPhone) setEditableClientPhone(dbClient.phone);
              }
          } catch (e) {
              console.error(e);
          }
      }
    };

    const handleSplitCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setSplitCashAmount(val);
        setSplitCardAmount(Math.max(0, editablePrice - val));
    };

    const confirmPayment = async () => {
        if (!paymentRequest || isSubmittingPayment) return;
        
        if (!paymentMethod) {
            setPaymentError('يرجى تحديد طريقة دفع المبلغ أولاً.');
            addNotification({ title: 'تنبيه', message: 'يرجى تحديد طريقة دفع المبلغ أولاً.', type: 'warning' });
            return;
        }

        if (editablePrice < 0) {
            addNotification({ title: 'خطأ', message: 'يرجى إدخال مبلغ صحيح للطلب.', type: 'error' });
            return;
        }

        if (paymentMethod === PaymentType.Split) {
             if (splitCashAmount + splitCardAmount !== editablePrice) {
                 addNotification({ title: 'خطأ', message: 'مجموع المبالغ لا يساوي قيمة الطلب.', type: 'error' });
                 return;
             }
        }

        setIsSubmittingPayment(true);

        try {
            if ((paymentRequest as any)?._isPending && (paymentRequest as any)?._rawPending) {
                const officialReq = await convertPendingToOfficialRequest(
                    (paymentRequest as any)._rawPending,
                    paymentMethod as PaymentType,
                    paymentMethod === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined,
                    {
                        client_name: editableClientName,
                        client_phone: editableClientPhone,
                        price: editablePrice
                    }
                );

                if (sendWhatsAppStartNotify && whatsappApiStatus === 'connected' && paymentMethod !== PaymentType.Unpaid) {
                    const targetPhone = editableClientPhone || (paymentRequest as any)?._rawPending?.client_phone;
                    const targetName = editableClientName || (paymentRequest as any)?._rawPending?.client_name;
                    if (targetPhone && targetPhone !== '0000000000') {
                        const carSnapshot = officialReq.car_snapshot || (paymentRequest as any)?._rawPending?.car_snapshot;
                        const carDetails = [carSnapshot?.make_en, carSnapshot?.model_en, carSnapshot?.year].filter(Boolean).join(' ') || 'غير محدد';
                        const message = `*مركز الراشد* لخدمات فحص السيارات\n\nأهلاً وسهلاً بكم *${targetName || ''}،* ويسعدنا خدمتكم دائماً.\n\nيسرنا إفادتكم بتأكيد استلام مركبتكم وبدء الفحص الفني:\n\n──────────────────\n▪️ رقم الطلب: *\u200E#${officialReq.request_number}\u200E*\n▪️ السيارة: *${carDetails}*\n──────────────────\n\nفريقنا المختص يعمل الآن على إجراء الفحص الشامل و\nإعداد التقرير بكل دقة وعناية، وسنقوم بإشعاركم فور الانتهاء مباشرة.\n\nأسعدنا اختياركم لمركزنا، ونتمنى لكم يوماً سعيداً.\n\n*إدارة مركز الراشد*`;
                        await sendWhatsAppMessage(targetPhone, message, targetName, { suppressModal: true });
                    }
                }

                addNotification({ title: 'نجاح', message: 'تم استلام الدفعة وتفعيل الطلب ورسمنة الرقم التسلسلي الجديد.', type: 'success' });
                setIsPaymentModalOpen(false);
                setPaymentRequest(null);
                setSendWhatsAppStartNotify(true);
                showNewRequestSuccessModal(officialReq.id, officialReq.request_number, false);
                return;
            }

            const now = new Date().toISOString();
            const currentReq = requests.find(r => r.id === paymentRequest.id) || paymentRequest;

            const isInitialGeneralClient = Boolean(
                paymentRequest.client_id && (
                    paymentRequest.client_id === systemDefaultClient?.id ||
                    clients.find(c => c.id === paymentRequest.client_id)?.is_system_default ||
                    clients.find(c => c.id === paymentRequest.client_id)?.phone === '0000000000'
                )
            );

            const isCurrentInputGeneral = editableClientPhone === '0000000000' || (systemDefaultClient && editableClientPhone === systemDefaultClient.phone);

            // Determine target client ID if linked
            let targetClientId = selectedPaymentClientId;
            if (!targetClientId && !isInitialGeneralClient) {
                targetClientId = paymentRequest.client_id;
            }

            if (!targetClientId && editableClientPhone && !isCurrentInputGeneral) {
                const cleaned = editableClientPhone.replace(/\D/g, '');
                if (cleaned.length >= 8) {
                    const searchPart = cleaned.slice(-8);
                    const found = clients.find(c => !c.is_system_default && c.phone && c.phone.replace(/\D/g, '').endsWith(searchPart));
                    if (found) {
                        targetClientId = found.id;
                    } else {
                        // Check DB directly
                        const existingDbClients = await searchClients(editableClientPhone);
                        const matched = existingDbClients.find(c => !c.is_system_default && c.phone && c.phone.replace(/\D/g, '').endsWith(searchPart));
                        if (matched) {
                            targetClientId = matched.id;
                        } else if (editableClientName.trim()) {
                            // Create new client record!
                            const newClient = await addClient({
                                id: uuidv4(),
                                name: editableClientName.trim(),
                                phone: editableClientPhone.trim()
                            });
                            targetClientId = newClient.id;
                        }
                    }
                }
            } else if (!targetClientId && isCurrentInputGeneral) {
                targetClientId = systemDefaultClient?.id || paymentRequest.client_id;
            }

            // If client info changed for an existing real client, update client record (NEVER update general client!)
            if (targetClientId) {
                const client = clients.find(c => c.id === targetClientId);
                const isGeneral = client?.is_system_default || client?.id === systemDefaultClient?.id || client?.phone === '0000000000';
                if (client && !isGeneral && (client.name !== editableClientName.trim() || client.phone !== editableClientPhone.trim())) {
                    await updateClient({ ...client, name: editableClientName.trim(), phone: editableClientPhone.trim() });
                }
            }

            const newLog = createActivityLog ? createActivityLog('تحصيل وتفعيل الطلب', `تم تحصيل المبلغ (${editablePrice} ريال - ${paymentMethod}) وتحديث وقت الطلب إلى وقت التحصيل الفعلي`) : null;
            const updatedLog = newLog ? [newLog, ...(currentReq.activity_log || [])] : (currentReq.activity_log || []);

            await updateRequest({
                id: paymentRequest.id,
                status: RequestStatus.NEW,
                payment_type: paymentMethod,
                price: editablePrice,
                split_payment_details: paymentMethod === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined,
                created_at: now,
                activity_log: updatedLog,
                ...(targetClientId ? { client_id: targetClientId } : {})
            });

            if (sendWhatsAppStartNotify && whatsappApiStatus === 'connected' && paymentMethod !== PaymentType.Unpaid) {
                const client = targetClientId ? clients.find(c => c.id === targetClientId) : null;
                const targetPhone = editableClientPhone || client?.phone;
                const targetName = editableClientName || client?.name;
                if (targetPhone && targetPhone !== '0000000000') {
                    const carDetails = [paymentRequest.car_snapshot?.make_en, paymentRequest.car_snapshot?.model_en, paymentRequest.car_snapshot?.year].filter(Boolean).join(' ') || 'غير محدد';
                    const message = `*مركز الراشد* لخدمات فحص السيارات\n\nأهلاً وسهلاً بكم *${targetName || ''}،* ويسعدنا خدمتكم دائماً.\n\nيسرنا إفادتكم بتأكيد استلام مركبتكم وبدء الفحص الفني:\n\n──────────────────\n▪️ رقم الطلب: *\u200E#${paymentRequest.request_number}\u200E*\n▪️ السيارة: *${carDetails}*\n──────────────────\n\nفريقنا المختص يعمل الآن على إجراء الفحص الشامل و\nإعداد التقرير بكل دقة وعناية، وسنقوم بإشعاركم فور الانتهاء مباشرة.\n\nأسعدنا اختياركم لمركزنا، ونتمنى لكم يوماً سعيداً.\n\n*إدارة مركز الراشد*`;
                    await sendWhatsAppMessage(targetPhone, message, targetName, { suppressModal: true });
                }
            }

            addNotification({ title: 'نجاح', message: 'تم استلام الدفعة وتفعيل الطلب بالوقت الجديد.', type: 'success' });
            setIsPaymentModalOpen(false);
            const paidRequestId = paymentRequest.id;
            const paidRequestNumber = paymentRequest.request_number;
            setPaymentRequest(null);
            setSendWhatsAppStartNotify(true);
            showNewRequestSuccessModal(paidRequestId, paidRequestNumber, false);
        } catch (error) {
            console.error("Payment confirmation error:", error);
            addNotification({ title: 'خطأ', message: 'فشل معالجة الدفع.', type: 'error' });
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
                    onOpenUpdateModal={handleOpenUpdateModal}
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

            {isUpdateModalOpen && requestToUpdate && (
                <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`تعديل بيانات الطلب ${(requestToUpdate as any)?._isPending ? requestToUpdate.request_number : `#${requestToUpdate.request_number}`}`} size="5xl">
                    <NewRequestForm
                        initialData={requestToUpdate}
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        onCancel={() => setIsUpdateModalOpen(false)}
                        onSuccess={() => setIsUpdateModalOpen(false)}
                    />
                </Modal>
            )}

            <Modal isOpen={isPaymentModalOpen} onClose={() => !isSubmittingPayment && setIsPaymentModalOpen(false)} title="تحصيل المبلغ وتفعيل الطلب" size="md">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        سيتم تحويل حالة الطلب <strong>{(paymentRequest as any)?._isPending ? paymentRequest?.request_number : `#${paymentRequest?.request_number}`}</strong> إلى "جديد" وسيتمكن الفنيون من رؤيته.
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

                    {/* CUSTOMER & PRICE SECTION */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span>📋</span>
                            <span>بيانات العميل والمبلغ المطلوب:</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* 1. Phone number (Always open and directly editable) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    رقم هاتف العميل
                                </label>
                                <SmartPhoneInput
                                    value={editableClientPhone}
                                    onChange={(val) => {
                                        setEditableClientPhone(val);
                                        const digits = val.replace(/\D/g, '');
                                        if (digits.length >= 8) {
                                            const searchPart = digits.slice(-8);
                                            const localMatch = clients.find(c => !c.is_system_default && c.phone && c.phone.replace(/\D/g, '').endsWith(searchPart));
                                            if (localMatch) {
                                                setMatchedDbClient(localMatch);
                                                setSelectedPaymentClientId(localMatch.id);
                                                setEditableClientName(prev => {
                                                    if (!prev || prev.trim() === '' || prev.trim() === 'عميل' || prev.trim() === 'عميل عام') {
                                                        return localMatch.name;
                                                    }
                                                    return prev;
                                                });
                                            }
                                        } else {
                                            setMatchedDbClient(null);
                                            setSelectedPaymentClientId(null);
                                        }
                                    }}
                                    disabled={isSubmittingPayment}
                                    autoFocus={false}
                                    size="sm"
                                    className="w-full !h-[42px] font-mono"
                                />
                            </div>

                            {/* 2. Client Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    اسم العميل
                                </label>
                                <input
                                    type="text"
                                    value={editableClientName}
                                    disabled={isSubmittingPayment}
                                    onChange={(e) => setEditableClientName(e.target.value)}
                                    placeholder="اسم العميل"
                                    className="w-full p-2.5 text-sm font-semibold border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Hint indicating if client is already registered or new */}
                        {isSearchingClient ? (
                            <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl text-xs text-blue-700 dark:text-blue-300 animate-pulse">
                                <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                                <span>جاري البحث في قاعدة البيانات عن العميل...</span>
                            </div>
                        ) : activeMatchedClient ? (
                            <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">✅</span>
                                    <div>
                                        <span className="font-bold">العميل مسجل لدينا مسبقاً: </span>
                                        <span className="font-semibold underline decoration-emerald-500/50 underline-offset-2">{activeMatchedClient.name}</span>
                                    </div>
                                </div>
                                {editableClientName !== activeMatchedClient.name && (
                                    <button
                                        type="button"
                                        onClick={() => setEditableClientName(activeMatchedClient.name)}
                                        className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-all flex items-center gap-1"
                                    >
                                        استخدام الاسم المسجل
                                    </button>
                                )}
                            </div>
                        ) : editableClientPhone.replace(/\D/g, '').length >= 8 ? (
                            <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                                <span>✨</span>
                                <span>عميل جديد — سيتم ربطه وحفظه بالطلب تلقائياً.</span>
                            </div>
                        ) : null}

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">المبلغ المطلوب (ريال)</label>
                            <input
                                type="number"
                                value={editablePrice || ''}
                                disabled={isSubmittingPayment}
                                onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value));
                                    setEditablePrice(val);
                                    if (paymentMethod === PaymentType.Split) {
                                        setSplitCardAmount(Math.max(0, val - splitCashAmount));
                                    }
                                }}
                                placeholder="المبلغ"
                                className="w-full p-2.5 text-base font-bold text-green-700 dark:text-green-400 border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            طريقة الدفع <span className="text-red-500">*</span>
                        </label>
                        <select 
                            value={paymentMethod} 
                            disabled={isSubmittingPayment}
                            onChange={(e) => {
                                const newMethod = e.target.value as PaymentType | '';
                                setPaymentMethod(newMethod);
                                setPaymentError(null);
                                if (newMethod === PaymentType.Split) {
                                    setSplitCashAmount(0);
                                    setSplitCardAmount(editablePrice);
                                }
                            }}
                            className={`w-full p-2.5 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                                paymentError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-600'
                            }`}
                        >
                            <option value="" disabled>-- اختر طريقة تحصيل المبلغ (إلزامي) --</option>
                            <option value={PaymentType.Cash}>نقدي</option>
                            <option value={PaymentType.Card}>بطاقة</option>
                            <option value={PaymentType.Transfer}>تحويل بنكي</option>
                            <option value={PaymentType.Split}>نقدي - بطاقة</option>
                            <option value={PaymentType.Unpaid}>غير مدفوع (آجل)</option>
                        </select>
                        {paymentError && (
                            <p className="text-xs text-red-500 mt-1 font-medium">{paymentError}</p>
                        )}
                    </div>

                    {paymentMethod === PaymentType.Split && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 animate-fade-in">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">نقدي</label>
                                <input 
                                    type="number" 
                                    value={splitCashAmount} 
                                    disabled={isSubmittingPayment}
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

                    {paymentMethod !== PaymentType.Unpaid && whatsappApiStatus === 'connected' && (
                        <div className="pt-2 border-t dark:border-slate-700">
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={sendWhatsAppStartNotify}
                                    disabled={isSubmittingPayment}
                                    onChange={(e) => setSendWhatsAppStartNotify(e.target.checked)}
                                    className="w-4 h-4 text-green-500 border-slate-300 rounded focus:ring-green-500"
                                />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    إرسال إشعار للعميل عبر واتساب (بدء الفحص)
                                </span>
                            </label>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-2 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmittingPayment}>إلغاء</Button>
                    <Button 
                        onClick={confirmPayment} 
                        disabled={!paymentMethod || isSubmittingPayment}
                        leftIcon={isSubmittingPayment ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : undefined}
                    >
                        {isSubmittingPayment ? 'جاري التحصيل...' : 'تأكيد الاستلام'}
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
