
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InspectionRequest, RequestStatus, Client, Car, CarMake, CarModel, InspectionType, Employee, PaymentType } from '../types';
import { useAppContext } from '../context/AppContext';
import EditIcon from './icons/EditIcon';
import TrashIcon from './icons/TrashIcon';
import PrinterIcon from './icons/PrinterIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import FileTextIcon from './icons/FileTextIcon';
import UndoIcon from './icons/UndoIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import SparklesIcon from './icons/SparklesIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import HistoryIcon from './icons/HistoryIcon';
import DollarSignIcon from './icons/DollarSignIcon';
import WhatsappIcon from './icons/WhatsappIcon';
import InfoIcon from './icons/InfoIcon';
import Modal from './Modal';
import SearchIcon from './icons/SearchIcon';
import UserCheckIcon from './icons/UserCheckIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import XIcon from './icons/XIcon';
import UserXIcon from './icons/UserXIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import ClientHistoryModal from './ClientHistoryModal';

interface RequestTableProps {
  requests: InspectionRequest[];
  clients: Client[];
  cars: Car[];
  carMakes: CarMake[];
  carModels: CarModel[];
  inspectionTypes: InspectionType[];
  employees: Employee[];
  title: string;
  onOpenUpdateModal?: (request: InspectionRequest) => void;
  plateDisplayLanguage?: 'ar' | 'en';
  setPlateDisplayLanguage?: React.Dispatch<React.SetStateAction<'ar' | 'en'>>;
  isRefreshing?: boolean;
  isLive?: boolean;
  onRowClick?: (requestId: string) => void;
  onHistoryClick?: (event: React.MouseEvent, carId: string, carName: string) => void;
  carsWithHistory?: Set<string>;
  onProcessPayment?: (request: InspectionRequest) => void;
  onResendWhatsApp?: (request: InspectionRequest) => void;
  onDeleteSuccess?: (requestId: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  searchTokens?: string[];
  highlightedRequestId?: string | null;
  triggerHighlight?: (id: string) => void;
  paymentFilter?: PaymentType | 'الكل';
  setPaymentFilter?: (filter: PaymentType | 'الكل') => void;
  availablePaymentTypes?: PaymentType[];
}

const HighlightText: React.FC<{ text: string | number | undefined | null, tokens?: string[] }> = ({ text, tokens }) => {
    if (text === undefined || text === null) return <></>;
    const str = String(text);
    if (!tokens || tokens.length === 0) return <>{str}</>;

    // Create a regex that matches any of the tokens, case-insensitive
    const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    
    const parts = str.split(regex);
    
    return (
        <>
            {parts.map((part, i) => 
                // When splitting with a single capturing group, odd indices are the matches
                i % 2 === 1 ? (
                    <mark key={i} className="bg-yellow-300 dark:bg-yellow-600/60 text-black dark:text-white rounded-sm px-0.5">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
    switch (status) {
        case RequestStatus.COMPLETE:
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap transition-colors hover:bg-emerald-200 dark:hover:bg-emerald-500/30">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    <span>{status}</span>
                </span>
            );
        case RequestStatus.IN_PROGRESS:
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 whitespace-nowrap ring-2 ring-amber-400/20 ring-offset-1 dark:ring-offset-slate-800">
                    <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                    <span>{status}</span>
                </span>
            );
        case RequestStatus.NEW:
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 whitespace-nowrap">
                    <SparklesIcon className="w-3.5 h-3.5 animate-pulse" />
                    <span>{status}</span>
                </span>
            );
        case RequestStatus.WAITING_PAYMENT:
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 whitespace-nowrap shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                    <DollarSignIcon className="w-3.5 h-3.5 animate-bounce" />
                    <span>{status}</span>
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 whitespace-nowrap">
                    <span>{status}</span>
                </span>
            );
    }
};

const RequestTable: React.FC<RequestTableProps> = React.memo(({ 
  requests, clients, cars, carMakes, carModels, inspectionTypes, employees,
  title, onOpenUpdateModal, plateDisplayLanguage = 'ar', setPlateDisplayLanguage, isRefreshing, isLive,
  onRowClick, onHistoryClick, carsWithHistory, onProcessPayment, onResendWhatsApp, onDeleteSuccess, onRefresh,
  isLoading, onLoadMore, hasMore, isLoadingMore, searchTokens, highlightedRequestId, triggerHighlight,
  paymentFilter: externalPaymentFilter,
  setPaymentFilter: externalSetPaymentFilter,
  availablePaymentTypes: externalAvailablePaymentTypes,
}) => {
  const { 
    settings, setPage, setSelectedRequestId, showConfirmModal, 
    deleteRequest, addNotification, can, updateRequest, createActivityLog,
    brokers
  } = useAppContext();

  const [activeBrokerMenuId, setActiveBrokerMenuId] = useState<string | null>(null);
  const brokerMenuRef = useRef<HTMLDivElement>(null);
  const [brokerSearchTerm, setBrokerSearchTerm] = useState('');
  const [manualCommission, setManualCommission] = useState<number | ''>('');
  const [tempSelectedBrokerId, setTempSelectedBrokerId] = useState<string | null>(null);

  // Close broker menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (brokerMenuRef.current && !brokerMenuRef.current.contains(event.target as Node)) {
        setActiveBrokerMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeBrokerMenuId) {
      setBrokerSearchTerm('');
      setManualCommission('');
      setTempSelectedBrokerId(null);
    }
  }, [activeBrokerMenuId]);

  const filteredBrokersForMenu = useMemo(() => {
    if (!brokerSearchTerm.trim()) return brokers.filter(b => b.is_active);
    const term = brokerSearchTerm.toLowerCase();
    return brokers.filter(b => 
      b.is_active && (b.name.toLowerCase().includes(term) || (b.phone && b.phone.includes(term)))
    );
  }, [brokers, brokerSearchTerm]);

  const handleQuickAssignBroker = async (request: InspectionRequest, brokerId: string | null, commission?: number) => {
    try {
        const selectedBroker = brokers.find(b => b.id === brokerId);
        const updatedRequest = {
            ...request,
            broker: brokerId ? {
                id: brokerId,
                commission: commission ?? (selectedBroker?.default_commission || 0)
            } : null
        };
        
        await updateRequest(updatedRequest);
        addNotification({ 
            title: 'نجاح', 
            message: brokerId ? `تم ربط السمسار ${selectedBroker?.name} بنجاح` : 'تم إزالة السمسار بنجاح', 
            type: 'success' 
        });
        setActiveBrokerMenuId(null);
    } catch (error) {
        addNotification({ title: 'خطأ', message: 'فشل تحديث بيانات السمسار', type: 'error' });
    }
  };

  const [internalPaymentFilter, setInternalPaymentFilter] = useState<PaymentType | 'الكل'>('الكل');
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);

  const paymentFilter = externalPaymentFilter !== undefined ? externalPaymentFilter : internalPaymentFilter;
  const setPaymentFilter = externalSetPaymentFilter !== undefined ? externalSetPaymentFilter : setInternalPaymentFilter;
  const design = settings.design || 'aero';
  const isWaitingTable = title === 'طلبات بانتظار الدفع';
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Expand search tokens to include translations (Arabic <-> English)
  const expandedSearchTokens = useMemo(() => {
    if (!searchTokens || searchTokens.length === 0) return [];
    
    const expanded = new Set<string>();
    
    // Create maps for plate characters
    const arToEnPlate = new Map<string, string>();
    const enToArPlate = new Map<string, string>();
    if (settings?.plateCharacters) {
        settings.plateCharacters.forEach(pc => {
            const arClean = pc.ar.replace('ـ', '');
            arToEnPlate.set(arClean, pc.en.toLowerCase());
            enToArPlate.set(pc.en.toLowerCase(), arClean);
        });
    }

    searchTokens.forEach(token => {
        const lowerToken = token.toLowerCase();
        expanded.add(lowerToken);

        // 1. Check Car Makes
        const matchingMake = carMakes.find(m => m.name_ar.toLowerCase().includes(lowerToken) || m.name_en.toLowerCase().includes(lowerToken));
        if (matchingMake) {
            expanded.add(matchingMake.name_ar.toLowerCase());
            expanded.add(matchingMake.name_en.toLowerCase());
        }

        // 2. Check Car Models
        const matchingModel = carModels.find(m => m.name_ar.toLowerCase().includes(lowerToken) || m.name_en.toLowerCase().includes(lowerToken));
        if (matchingModel) {
            expanded.add(matchingModel.name_ar.toLowerCase());
            expanded.add(matchingModel.name_en.toLowerCase());
        }

        // 3. Plate Letters & Numbers extraction
        const lettersEn = lowerToken.replace(/[^a-z]/g, '');
        const lettersAr = lowerToken.replace(/[^\u0600-\u06FF]/g, '');
        const numbers = lowerToken.replace(/[^0-9]/g, '');

        if (numbers) {
            expanded.add(numbers);
        }

        if (lettersEn && lettersEn.length <= 4) {
            let isAllPlateChars = true;
            let arEquivalent = '';
            for (const char of lettersEn) {
                if (!enToArPlate.has(char)) isAllPlateChars = false;
                arEquivalent += enToArPlate.get(char) || char;
            }
            if (isAllPlateChars) {
                expanded.add(arEquivalent);
                expanded.add(arEquivalent.split('').join(' '));
                expanded.add(arEquivalent.split('').join('  '));
                expanded.add(lettersEn.split('').join(' '));
                expanded.add(lettersEn.split('').join('  '));
            }
        }

        if (lettersAr && lettersAr.length <= 4) {
            let isAllPlateChars = true;
            let enEquivalent = '';
            for (const char of lettersAr) {
                if (!arToEnPlate.has(char)) isAllPlateChars = false;
                enEquivalent += arToEnPlate.get(char) || char;
            }
            if (isAllPlateChars) {
                expanded.add(enEquivalent);
                expanded.add(enEquivalent.split('').join(' '));
                expanded.add(enEquivalent.split('').join('  '));
                expanded.add(lettersAr.split('').join(' '));
                expanded.add(lettersAr.split('').join('  '));
            }
        }
    });

    // Filter out empty strings and sort by length descending to match longer phrases first
    return Array.from(expanded).filter(t => t.trim().length > 0).sort((a, b) => b.length - a.length);
  }, [searchTokens, carMakes, carModels, settings?.plateCharacters]);

  const availablePaymentTypes = useMemo(() => {
      if (externalAvailablePaymentTypes) return externalAvailablePaymentTypes;
      const types = new Set<PaymentType>();
      requests.forEach(req => {
          if (req.payment_type) types.add(req.payment_type);
      });
      return Array.from(types);
  }, [requests, externalAvailablePaymentTypes]);

  const displayedRequests = useMemo(() => {
      return requests.filter(req => {
          if (paymentFilter === 'الكل') return true;
          return req.payment_type === paymentFilter;
      });
  }, [requests, paymentFilter]);

  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    const handleWheel = (e: WheelEvent) => {
      const { deltaY } = e;
      const isScrollingDown = deltaY > 0;
      const isScrollingUp = deltaY < 0;

      // Find the main scrollable container
      const mainContent = document.querySelector('main');
      if (!mainContent) return;

      // Check if main content is at bottom
      const isMainAtBottom = Math.abs(mainContent.scrollHeight - mainContent.scrollTop - mainContent.clientHeight) < 2;
      const isMainAtTop = mainContent.scrollTop === 0;
      
      // Check if table container is at top/bottom
      const isTableAtTop = tableContainer.scrollTop === 0;

      if (isScrollingDown) {
        if (!isMainAtBottom) {
          // Scroll main content instead of table
          mainContent.scrollTop += deltaY;
          e.preventDefault();
        }
      } else if (isScrollingUp) {
        if (isTableAtTop && !isMainAtTop) {
          // Scroll main content instead of table
          mainContent.scrollTop += deltaY;
          e.preventDefault();
        }
      }
    };

    tableContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => tableContainer.removeEventListener('wheel', handleWheel);
  }, []);

  // Scroll to highlighted row when it changes
  useEffect(() => {
    if (highlightedRequestId && tableContainerRef.current) {
      const rowElement = document.getElementById(`request-row-${highlightedRequestId}`);
      if (rowElement) {
        // Scroll the row into view smoothly
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove the highlight after a delay
        setTimeout(() => {
            if (triggerHighlight) {
                triggerHighlight(''); // Clear highlight
            }
        }, 3000);
      }
    }
  }, [highlightedRequestId, triggerHighlight]);

  // State for Car Search Modal - Removed



  const getClientInfo = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return {
      name: client?.name || 'غير معروف',
      phone: client?.phone || '',
    };
  };
  
  const getCarInfo = (carId: string) => {
    const car = cars.find(c => c.id === carId);
    if (!car) return { name: 'غير معروف', plate: '', raw: null };
    
    const makeObj = carMakes.find(m => m.id === car.make_id);
    const modelObj = carModels.find(m => m.id === car.model_id);

    const makeEn = makeObj?.name_en;
    const makeAr = makeObj?.name_ar;
    const modelEn = modelObj?.name_en;
    const modelAr = modelObj?.name_ar;

    // Prefer English for search query, fallback to Arabic
    const searchMake = makeEn || makeAr || '';
    const searchModel = modelEn || modelAr || '';

    const raw = {
        make: searchMake,
        model: searchModel,
        year: car.year
    };

    const displayName = `${makeEn || makeAr || ''} ${modelEn || modelAr || ''} (${car.year})`;

    // VIN Display Logic
    if (car.vin) {
        return {
          name: displayName,
          plate: `شاصي: ${car.vin}`,
          raw
        };
    }

    if (!car.plate_number) {
         return {
          name: displayName,
          plate: 'بدون لوحة',
          raw
        };
    }

    // Support legacy "شاصي" in plate_number just in case
    if (car.plate_number.startsWith('شاصي')) {
        return {
          name: displayName,
          plate: car.plate_number,
          raw
        };
    }

    // Normal Plate Display
    const plateParts = car.plate_number.split(' ');
    const plateLettersString = plateParts.filter(part => !/^\d+$/.test(part)).join('');
    const plateNumbers = plateParts.find(part => /^\d+$/.test(part)) || '';
    
    let finalPlateLetters = '';
    
    if (plateDisplayLanguage === 'en' && car.plate_number_en) {
        // Use the stored reversed English plate if available
        const enParts = car.plate_number_en.split(' ');
        const enLetters = enParts.filter(part => !/^\d+$/.test(part)).join(' ');
        finalPlateLetters = enLetters; // Already stored in correct visual order (e.g. R N B)
    } else {
        finalPlateLetters = plateLettersString.split('').join(' ');
    }

    const plateDisplay = [finalPlateLetters, plateNumbers].filter(Boolean).join('  ');

    return {
      name: displayName,
      plate: plateDisplay,
      raw
    };
  };
  
  const handlePrint = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?page=print-report&requestId=${requestId}&from=print`;
    window.open(url, '_blank');
  };
  
  const handleViewDraft = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    setSelectedRequestId(requestId);
    setPage('request-draft');
  };

  const handleDelete = (e: React.MouseEvent, request: InspectionRequest) => {
    e.stopPropagation();
    showConfirmModal({
        title: `حذف الطلب رقم ${request.request_number}`,
        message: 'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.',
        onConfirm: async () => {
            try {
                await deleteRequest(request.id);
                addNotification({ title: 'نجاح', message: 'تم حذف الطلب بنجاح.', type: 'success' });
                // Notify parent component to update local list
                if (onDeleteSuccess) {
                    onDeleteSuccess(request.id);
                }
            } catch (error) {
                addNotification({ title: 'خطأ', message: 'فشل حذف الطلب.', type: 'error' });
            }
        }
    });
  };

  const handleRevertStatus = (e: React.MouseEvent, request: InspectionRequest) => {
    e.stopPropagation();
    showConfirmModal({
        title: `إعادة فتح الطلب`,
        message: `هل أنت متأكد من تغيير حالة الطلب رقم ${request.request_number} إلى "قيد التنفيذ"؟`,
        onConfirm: async () => {
            try {
                const newLog = createActivityLog('غيّر حالة الطلب', `من "مكتمل" إلى "قيد التنفيذ" للطلب #${request.request_number}`);
                const updatedLog = newLog ? [newLog, ...(request.activity_log || [])] : request.activity_log;
                await updateRequest({ ...request, status: RequestStatus.IN_PROGRESS, activity_log: updatedLog });
                addNotification({ title: 'نجاح', message: 'تم إعادة فتح الطلب.', type: 'success' });
            } catch (error) {
                addNotification({ title: 'خطأ', message: 'فشل تغيير حالة الطلب.', type: 'error' });
            }
        }
    });
};

  const handleCarClick = (e: React.MouseEvent, carInfo: any) => {
      e.stopPropagation();
      if (carInfo.raw) {
          const query = `${carInfo.raw.make} ${carInfo.raw.model} ${carInfo.raw.year}`;
          const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
          
          // Open in a centered popup window
          const width = 1024;
          const height = 800;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;
          
          window.open(
              url, 
              'GoogleImageSearch', 
              `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
          );
      }
  };


  const primaryColor = design === 'classic' ? 'teal' : design === 'glass' ? 'indigo' : 'blue';
  const toggleCheckedClasses = design === 'classic' ? 'peer-checked:bg-teal-600' : design === 'glass' ? 'peer-checked:bg-indigo-600' : 'peer-checked:bg-blue-600';

  const getStatusIndicator = () => {
        if (isRefreshing) {
             return (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 animate-pulse bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-full" title="يتم التحديث">
                    <RefreshCwIcon className="w-3 h-3 animate-spin" />
                    <span>تحديث...</span>
                </div>
            );
        }
        if (isLive) {
            return (
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-100 dark:border-green-900/30" title="تحديثات مباشرة">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span>مباشر</span>
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                            title="تحديث البيانات يدوياً"
                        >
                            <RefreshCwIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            );
        }
        return null;
    };
    
    // Helper to determine row background class based on payment status
    const getRowClasses = (req: InspectionRequest) => {
        const baseClasses = "group border-b align-middle transition-colors duration-150 last:border-0";
        const highlightClass = req.id === highlightedRequestId ? 'animate-highlight' : '';
        
        // Highlight Unpaid (Debt) Requests
        if (req.payment_type === PaymentType.Unpaid) {
             return `${baseClasses} bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/20 ${highlightClass}`;
        }
        
        // Highlight Transfer Requests (Often need verification)
        if (req.payment_type === PaymentType.Transfer) {
             return `${baseClasses} bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/20 ${highlightClass}`;
        }

        // Default styling
        return `${baseClasses} bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${highlightClass}`;
    };


  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative ${isWaitingTable ? 'border-purple-200 dark:border-purple-800 shadow-purple-100 dark:shadow-none' : ''}`}>
      <div className={`flex flex-wrap justify-between items-center p-4 sm:p-5 gap-3 border-b border-slate-100 dark:border-slate-700/50 ${isWaitingTable ? 'bg-purple-50/50 dark:bg-purple-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <h3 className={`text-lg font-bold ${isWaitingTable ? 'text-purple-800 dark:text-purple-200' : 'text-slate-800 dark:text-slate-100'}`}>{title}</h3>
            {getStatusIndicator()}
        </div>
        
        {!isWaitingTable && availablePaymentTypes.length > 0 && (
            <div className="flex-1 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto hide-scrollbar w-full sm:w-auto order-3 sm:order-none pb-1 sm:pb-0">
                <button
                    onClick={() => setPaymentFilter('الكل')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                        paymentFilter === 'الكل' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                >
                    الكل
                </button>
                {availablePaymentTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => setPaymentFilter(type)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                            paymentFilter === type 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                        }`}
                    >
                        {type === PaymentType.Split ? 'مجزأ' : 
                         type === PaymentType.Unpaid ? 'آجل' : type}
                    </button>
                ))}
            </div>
        )}

        {setPlateDisplayLanguage && (
          <label htmlFor="plate-lang-toggle" className="flex items-center cursor-pointer group shrink-0">
            <span className="mr-3 text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
              <span className="hidden sm:inline">عرض الأحرف الإنجليزية</span>
              <span className="sm:hidden">لوحة ABC</span>
            </span>
            <div className="relative">
              <input 
                type="checkbox" 
                id="plate-lang-toggle" 
                className="sr-only peer"
                checked={plateDisplayLanguage === 'en'}
                onChange={(e) => setPlateDisplayLanguage(e.target.checked ? 'en' : 'ar')}
              />
              <div className={`w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 ${toggleCheckedClasses}`}></div>
            </div>
          </label>
        )}
      </div>
      
      {requests.length > 0 ? (
        <div 
            ref={tableContainerRef} 
            className="overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar relative"
            onScroll={(e) => {
                if (!onLoadMore || !hasMore || isLoadingMore) return;
                const target = e.currentTarget;
                if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
                    onLoadMore();
                }
            }}
        >
            <table className="w-full text-sm text-right rtl:text-right text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50/90 dark:bg-slate-800/90 dark:text-slate-400 sticky top-0 backdrop-blur-md z-20 shadow-sm">
                    <tr>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">رقم الطلب</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700 min-w-[180px]">العميل</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700 sticky right-0 bg-slate-50/95 dark:bg-slate-800/95 md:static md:bg-transparent z-10 shadow-sm md:shadow-none backdrop-blur-md">السيارة</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">نوع الفحص</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">الحالة</th>
                        {!isWaitingTable && <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">التاريخ</th>}
                        {!isWaitingTable && <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">السعر</th>}
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700 text-left">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    <AnimatePresence>
                    {displayedRequests.length > 0 ? (
                        displayedRequests.map((request) => {
                            const clientInfo = getClientInfo(request.client_id);
                        const carInfo = getCarInfo(request.car_id);
                        const creator = employees.find(e => e.id === request.employee_id);
                        const carDisplayName = request.car_snapshot
                            ? `${request.car_snapshot.make_en} ${request.car_snapshot.model_en} (${request.car_snapshot.year})`
                            : carInfo.name;
                        
                        // Construct search data prioritizing snapshot
                        const searchData = request.car_snapshot ? {
                            name: carDisplayName,
                            raw: {
                                make: request.car_snapshot.make_en || request.car_snapshot.make_ar || '',
                                model: request.car_snapshot.model_en || request.car_snapshot.model_ar || '',
                                year: request.car_snapshot.year
                            }
                        } : carInfo;

                        const isWaitingPayment = request.status === RequestStatus.WAITING_PAYMENT;
                        const inspectionType = inspectionTypes.find(t => t.id === request.inspection_type_id);
                        
                        // Row styling based on payment
                        const rowClass = getRowClasses(request);

                        // Check if client has multiple requests (history)
                        const client = clients.find(c => c.id === request.client_id);
                        const hasHistory = (client?.inspection_requests?.[0]?.count || 0) > 1;

                        // Check if car has history (same plate or VIN)
                        const car = cars.find(c => c.id === request.car_id);
                        const hasCarHistory = carsWithHistory && car && (
                            (car.plate_number && carsWithHistory.has(car.plate_number.trim())) ||
                            (car.plate_number_en && carsWithHistory.has(car.plate_number_en.trim())) ||
                            (car.vin && carsWithHistory.has(car.vin.trim()))
                        );

                        // Price column extras
                        let priceSuffix = null;
                        if (request.payment_type === PaymentType.Unpaid) {
                            priceSuffix = <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded mr-1">(آجل)</span>;
                        } else if (request.payment_type === PaymentType.Transfer) {
                            priceSuffix = <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded mr-1">(تحويل)</span>;
                        }

                        return (
                            <motion.tr 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                key={request.id} 
                                id={`request-row-${request.id}`} 
                                className={rowClass}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {(request.reservation_id || request.payment_note?.includes('[WA-RES]')) && (
                                            <WhatsappIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        )}
                                        <span className="font-bold text-slate-800 dark:text-slate-200 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600/50">
                                            #<HighlightText text={request.request_number} tokens={expandedSearchTokens} />
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div 
                                        className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors group/client"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (client && !client.is_system_default) {
                                                setSelectedClientForHistory(client);
                                            } else {
                                                const searchKey = client?.is_system_default ? 'عميل عام' : clientInfo.phone;
                                                const url = `${window.location.origin}${window.location.pathname}?page=requests&search=${encodeURIComponent(searchKey)}`;
                                                window.open(url, '_blank');
                                            }
                                        }}
                                        title={client?.is_system_default ? "عرض كل طلبات العميل العام" : "اضغط لعرض سجل طلبات العميل"}
                                    >
                                        {client?.is_system_default ? (
                                            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black">
                                                <span>✨</span>
                                                <span>عميل عام</span>
                                            </span>
                                        ) : (
                                            <HighlightText text={clientInfo.name} tokens={expandedSearchTokens} />
                                        )}
                                        {hasHistory && !client?.is_system_default && (
                                            <span 
                                                className="inline-flex items-center justify-center p-1 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 opacity-80 group-hover/client:opacity-100 transition-opacity"
                                                title="عميل سابق (لديه طلبات أخرى)"
                                            >
                                                <UserCheckIcon className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </div>
                                    {!client?.is_system_default && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            <HighlightText text={clientInfo.phone} tokens={expandedSearchTokens} />
                                        </div>
                                    )}
                                    {creator && (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                            بواسطة: {creator.name}
                                        </div>
                                    )}
                                </td>
                                <td className={`px-6 py-4 sticky right-0 md:static z-10 shadow-sm md:shadow-none transition-colors duration-150 ${request.payment_type === PaymentType.Unpaid ? 'bg-rose-50 dark:bg-rose-900/20' : request.payment_type === PaymentType.Transfer ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30'}`}>
                                    <div className="flex items-center gap-2">
                                        {hasCarHistory && onHistoryClick && (
                                            <button
                                                onClick={(e) => onHistoryClick(e, request.car_id, carDisplayName)}
                                                className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all hover:scale-110 shadow-sm border border-amber-200 dark:border-amber-800"
                                                title="عرض سجل الفحص لهذه السيارة"
                                            >
                                                <HistoryIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        <div>
                                            <div 
                                                className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCarClick(e, searchData);
                                                }}
                                                title="اضغط للبحث عن صور السيارة"
                                            >
                                                <span><HighlightText text={carDisplayName} tokens={expandedSearchTokens} /></span>
                                                {request.report_stamps?.includes('CUSTOMER_REQUEST_INCOMPLETE') && (
                                                    <div className="relative group">
                                                        <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-black/80 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                                                            لم يكمل الفحص
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono dir-ltr">
                                                <HighlightText text={carInfo.plate} tokens={expandedSearchTokens} />
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {inspectionType?.name || 'غير معروف'}
                                    </span>
                                </td>
                                 <td className="px-6 py-4">
                                    <StatusBadge status={request.status} />
                                </td>
                                {!isWaitingTable &&
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700 dark:text-slate-300">
                                            {new Date(request.created_at).toLocaleDateString('en-GB')}
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                                            {new Date(request.created_at).toLocaleDateString('ar-SA', { weekday: 'long' })}
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            {new Date(request.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </div>
                                    </td>
                                }
                                {!isWaitingTable &&
                                     <td className="px-6 py-4">
                                        <div className="relative">
                                            <div 
                                                className={`flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 ${can('add_broker_commission') ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50' : 'cursor-default'} p-1.5 rounded-lg transition-colors group/price`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!can('add_broker_commission')) return;
                                                    setActiveBrokerMenuId(activeBrokerMenuId === request.id ? null : request.id);
                                                }}
                                                title={can('add_broker_commission') ? "اضغط لتعيين سمسار سريع" : ""}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1">
                                                        {request.price.toLocaleString('en-US')} 
                                                        <span className="text-xs font-normal text-slate-500">ريال</span>
                                                        {priceSuffix}
                                                    </div>
                                                    {request.broker?.id && (
                                                        <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-black mt-0.5">
                                                            <UserCheckIcon className="w-2.5 h-2.5" />
                                                            <span>{brokers.find(b => b.id === request.broker?.id)?.name || 'سمسار'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="opacity-0 group-hover/price:opacity-100 transition-opacity ml-1">
                                                    <ChevronDownIcon className="w-3 h-3 text-slate-400" />
                                                </div>
                                                
                                                {request.payment_note && (
                                                    <div className="relative group/tooltip flex items-center justify-center cursor-help mx-1">
                                                        <InfoIcon className="w-4 h-4 text-slate-400 hover:text-blue-500 transition-colors" />
                                                        <div className="absolute bottom-full right-1/2 translate-x-[50%] mb-2 w-max max-w-[200px] p-2 bg-slate-900 text-white font-normal text-xs rounded shadow-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none whitespace-pre-wrap text-center leading-relaxed">
                                                            {request.payment_note}
                                                            <div className="absolute top-full right-1/2 translate-x-[50%] border-[5px] border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick Broker Menu */}
                                            <AnimatePresence>
                                                {activeBrokerMenuId === request.id && (
                                                    <motion.div
                                                        ref={brokerMenuRef}
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[100] overflow-hidden"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="p-3 border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                                                            <span className="text-xs font-black text-slate-500">إدارة السمسار</span>
                                                            <button 
                                                                onClick={() => setActiveBrokerMenuId(null)}
                                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                            >
                                                                <XIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="p-2 space-y-2">
                                                            {!tempSelectedBrokerId ? (
                                                                <>
                                                                    <div className="relative mb-2">
                                                                        <SearchIcon className="absolute right-2 top-2 w-3.5 h-3.5 text-slate-400" />
                                                                        <input 
                                                                            type="text"
                                                                            placeholder="ابحث باسم أو هاتف السمسار..."
                                                                            value={brokerSearchTerm}
                                                                            onChange={(e) => setBrokerSearchTerm(e.target.value)}
                                                                            className="w-full pr-7 pl-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 transition-all"
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                                                        {request.broker?.id && (
                                                                            <button
                                                                                onClick={() => handleQuickAssignBroker(request, null)}
                                                                                className="w-full text-right px-3 py-2 text-[11px] font-bold rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-2"
                                                                            >
                                                                                <UserXIcon className="w-3.5 h-3.5" />
                                                                                إزالة السمسار
                                                                            </button>
                                                                        )}
                                                                        {filteredBrokersForMenu.map(broker => (
                                                                            <button
                                                                                key={broker.id}
                                                                                onClick={() => {
                                                                                    setTempSelectedBrokerId(broker.id);
                                                                                    setManualCommission(broker.default_commission || '');
                                                                                }}
                                                                                className="w-full text-right px-3 py-2 text-[11px] font-bold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-between gap-2"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <UserCircleIcon className="w-3.5 h-3.5 opacity-50" />
                                                                                    <span>{broker.name}</span>
                                                                                </div>
                                                                                {request.broker?.id === broker.id && <CheckCircleIcon className="w-3.5 h-3.5 text-blue-500" />}
                                                                            </button>
                                                                        ))}
                                                                        {filteredBrokersForMenu.length === 0 && (
                                                                            <div className="p-4 text-center text-[10px] text-slate-400">لا توجد نتائج</div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <motion.div 
                                                                    initial={{ opacity: 0, x: 20 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    className="space-y-3 p-1"
                                                                >
                                                                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                                                                        <UserCheckIcon className="w-3.5 h-3.5" />
                                                                        {brokers.find(b => b.id === tempSelectedBrokerId)?.name}
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] text-slate-500 mb-1">حدد العمولة يدوياً (ريال)</label>
                                                                        <input 
                                                                            type="number"
                                                                            value={manualCommission}
                                                                            onChange={(e) => setManualCommission(e.target.value === '' ? '' : Number(e.target.value))}
                                                                            className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500"
                                                                            placeholder="0"
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button 
                                                                            onClick={() => handleQuickAssignBroker(request, tempSelectedBrokerId, manualCommission === '' ? 0 : manualCommission)}
                                                                            className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                                                        >
                                                                            تأكيد الربط
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setTempSelectedBrokerId(null)}
                                                                            className="px-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                                                        >
                                                                            رجوع
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </td>
                                }
                                <td className="px-6 py-4 text-left">
                                    <div className="flex items-center justify-end gap-1">
                                        {isWaitingPayment ? (
                                            <>
                                                {onProcessPayment && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onProcessPayment(request); }}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60 transition-all font-semibold text-xs shadow-sm border border-green-200 dark:border-green-800"
                                                        title="تحصيل المبلغ وتفعيل الطلب"
                                                    >
                                                        <DollarSignIcon className="w-4 h-4" />
                                                        تحصيل
                                                    </button>
                                                )}
                                                {onResendWhatsApp && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onResendWhatsApp(request); }}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] text-white hover:bg-[#128C7E] transition-all font-semibold text-xs shadow-sm"
                                                        title="إعادة إرسال عبر واتساب"
                                                    >
                                                        <WhatsappIcon className="w-4 h-4" />
                                                        <span>إرسال</span>
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {onOpenUpdateModal && can('update_requests_data') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onOpenUpdateModal(request); }}
                                                        className={`p-2 rounded-lg text-slate-500 hover:text-${primaryColor}-600 hover:bg-${primaryColor}-50 dark:hover:bg-${primaryColor}-900/20 transition-all`}
                                                        title="تحديث بيانات الطلب"
                                                    >
                                                        <RefreshCwIcon className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {request.status === RequestStatus.COMPLETE && can('change_request_status') && (
                                                    <button
                                                        onClick={(e) => handleRevertStatus(e, request)}
                                                        className="p-2 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                                                        title="إعادة فتح الطلب"
                                                    >
                                                        <UndoIcon className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {can('fill_requests') && onRowClick && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onRowClick(request.id); }}
                                                        className="p-2 rounded-lg text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all"
                                                        title="تعبئة بيانات الفحص"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        
                                        {!isWaitingPayment && (
                                            <button
                                                onClick={(e) => handleViewDraft(e, request.id)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                                title="عرض المسودة"
                                            >
                                                <FileTextIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {!isWaitingPayment && can('print_request') && (
                                            <button
                                                onClick={(e) => handlePrint(e, request.id)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                                                title="معاينة وطباعة"
                                            >
                                                <PrinterIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {can('delete_requests') && (
                                            <button
                                                onClick={(e) => handleDelete(e, request)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                title="حذف الطلب"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </motion.tr>
                        )
                    })) : (
                        <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <td colSpan={isWaitingTable ? 6 : 8} className="p-8 text-center text-slate-500 dark:text-slate-400">
                                لا توجد طلبات تطابق نوع الدفع المحدد.
                            </td>
                        </motion.tr>
                    )}
                    </AnimatePresence>
                </tbody>
            </table>
            {hasMore && (
                <div onClick={() => onLoadMore && onLoadMore()} className="text-center py-4 border-t border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    {isLoadingMore ? (
                        <RefreshCwIcon className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                    ) : (
                        <span className="text-sm text-blue-500 dark:text-blue-400 font-medium">اضغط هنا أو قم بالتمرير لأسفل لتحميل المزيد...</span>
                    )}
                </div>
            )}
        </div>
      ) : (
         <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                <FileTextIcon className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-medium">لا توجد طلبات لعرضها.</p>
         </div>
      )}

      {/* Car Search Modal - Removed */}
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
                <RefreshCwIcon className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">جاري البحث...</span>
            </div>
        </div>
      )}

      <ClientHistoryModal 
        isOpen={!!selectedClientForHistory} 
        client={selectedClientForHistory} 
        onClose={() => setSelectedClientForHistory(null)} 
      />
    </div>
  );
});

export default RequestTable;
