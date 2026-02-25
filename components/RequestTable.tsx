
import React from 'react';
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
}

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

const RequestTable: React.FC<RequestTableProps> = ({ 
  requests, clients, cars, carMakes, carModels, inspectionTypes, employees,
  title, onOpenUpdateModal, plateDisplayLanguage = 'ar', setPlateDisplayLanguage, isRefreshing, isLive,
  onRowClick, onHistoryClick, carsWithHistory, onProcessPayment, onResendWhatsApp, onDeleteSuccess
}) => {
  const { 
    settings, setPage, setSelectedRequestId, showConfirmModal, 
    deleteRequest, addNotification, can, updateRequest, createActivityLog,
    highlightedRequestId
  } = useAppContext();
  const design = settings.design || 'aero';
  const isWaitingTable = title === 'طلبات بانتظار الدفع';


  const getClientInfo = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return {
      name: client?.name || 'غير معروف',
      phone: client?.phone || '',
    };
  };
  
  const getCarInfo = (carId: string) => {
    const car = cars.find(c => c.id === carId);
    if (!car) return { name: 'غير معروف', plate: '' };
    const make = carMakes.find(m => m.id === car.make_id)?.name_en;
    const model = carModels.find(m => m.id === car.model_id)?.name_en;

    // VIN Display Logic
    if (car.vin) {
        return {
          name: `${make || ''} ${model || ''} (${car.year})`,
          plate: `شاصي: ${car.vin}`,
        };
    }

    if (!car.plate_number) {
         return {
          name: `${make || ''} ${model || ''} (${car.year})`,
          plate: 'بدون لوحة',
        };
    }

    // Support legacy "شاصي" in plate_number just in case
    if (car.plate_number.startsWith('شاصي')) {
        return {
          name: `${make || ''} ${model || ''} (${car.year})`,
          plate: car.plate_number,
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
      name: `${make || ''} ${model || ''} (${car.year})`,
      plate: plateDisplay,
    };
  };
  
  const handlePrint = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?page=print-report&requestId=${requestId}`;
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
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-100 dark:border-green-900/30" title="تحديثات مباشرة">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span>مباشر</span>
                </div>
            );
        }
        return null;
    };
    
    // Helper to determine row background class based on payment status
    const getRowClasses = (req: InspectionRequest) => {
        const baseClasses = "group border-b align-middle transition-colors duration-150 last:border-0";
        // REMOVED: cursor-pointer class logic to disable row clicking
        const cursorClass = ''; 
        const highlightClass = req.id === highlightedRequestId ? 'animate-highlight' : '';
        
        // Highlight Unpaid (Debt) Requests
        if (req.payment_type === PaymentType.Unpaid) {
             return `${baseClasses} bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/20 ${cursorClass} ${highlightClass}`;
        }
        
        // Highlight Transfer Requests (Often need verification)
        if (req.payment_type === PaymentType.Transfer) {
             return `${baseClasses} bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/20 ${cursorClass} ${highlightClass}`;
        }

        // Default styling
        return `${baseClasses} bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${cursorClass} ${highlightClass}`;
    };


  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden ${isWaitingTable ? 'border-purple-200 dark:border-purple-800 shadow-purple-100 dark:shadow-none' : ''}`}>
      <div className={`flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700/50 ${isWaitingTable ? 'bg-purple-50/50 dark:bg-purple-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
        <div className="flex items-center gap-3">
            <h3 className={`text-lg font-bold ${isWaitingTable ? 'text-purple-800 dark:text-purple-200' : 'text-slate-800 dark:text-slate-100'}`}>{title}</h3>
            {getStatusIndicator()}
        </div>
        {setPlateDisplayLanguage && (
          <label htmlFor="plate-lang-toggle" className="flex items-center cursor-pointer group">
            <span className="mr-3 text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
              عرض الأحرف الإنجليزية
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
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar relative">
            <table className="w-full text-sm text-right rtl:text-right text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50/90 dark:bg-slate-800/90 dark:text-slate-400 sticky top-0 backdrop-blur-md z-20 shadow-sm">
                    <tr>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">رقم الطلب</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">العميل</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700 sticky right-0 bg-slate-50/95 dark:bg-slate-800/95 md:static md:bg-transparent z-10 shadow-sm md:shadow-none backdrop-blur-md">السيارة</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">نوع الفحص</th>
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">الحالة</th>
                        {!isWaitingTable && <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">التاريخ</th>}
                        {!isWaitingTable && <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700">السعر</th>}
                        <th scope="col" className="px-6 py-4 font-bold border-b dark:border-slate-700 text-left">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((request) => {
                        const clientInfo = getClientInfo(request.client_id);
                        const carInfo = getCarInfo(request.car_id);
                        const creator = employees.find(e => e.id === request.employee_id);
                        const carDisplayName = request.car_snapshot
                            ? `${request.car_snapshot.make_en} ${request.car_snapshot.model_en} (${request.car_snapshot.year})`
                            : carInfo.name;
                        const isWaitingPayment = request.status === RequestStatus.WAITING_PAYMENT;
                        const inspectionType = inspectionTypes.find(t => t.id === request.inspection_type_id);
                        
                        // Row styling based on payment
                        const rowClass = getRowClasses(request);

                        // Price column extras
                        let priceSuffix = null;
                        if (request.payment_type === PaymentType.Unpaid) {
                            priceSuffix = <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded mr-1">(آجل)</span>;
                        } else if (request.payment_type === PaymentType.Transfer) {
                            priceSuffix = <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded mr-1">(تحويل)</span>;
                        }

                        return (
                            <tr 
                                key={request.id} 
                                id={`request-row-${request.id}`} 
                                // REMOVED: onClick={...} to disable row click
                                className={rowClass}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600/50">
                                        #{request.request_number}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{clientInfo.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{clientInfo.phone}</div>
                                    {creator && (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                            بواسطة: {creator.name}
                                        </div>
                                    )}
                                </td>
                                <td className={`px-6 py-4 sticky right-0 md:static z-10 shadow-sm md:shadow-none transition-colors duration-150 ${request.payment_type === PaymentType.Unpaid ? 'bg-rose-50 dark:bg-rose-900/20' : request.payment_type === PaymentType.Transfer ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30'}`}>
                                    <div className="flex items-center gap-2">
                                        {carsWithHistory && onHistoryClick && carsWithHistory.has(request.car_id) && (
                                            <button
                                                onClick={(e) => onHistoryClick(e, request.car_id, carDisplayName)}
                                                className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 transition-all hover:scale-110 shadow-sm border border-amber-200 dark:border-amber-800"
                                                title="عرض سجل الفحص لهذه السيارة"
                                            >
                                                <HistoryIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                <span>{carDisplayName}</span>
                                                {request.report_stamps?.includes('CUSTOMER_REQUEST_INCOMPLETE') && (
                                                    <div className="relative group">
                                                        <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-black/80 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                                                            لم يكمل الفحص
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono dir-ltr">{carInfo.plate}</div>
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
                                        <div className="text-slate-700 dark:text-slate-300">{new Date(request.created_at).toLocaleDateString('en-GB')}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            {new Date(request.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </div>
                                    </td>
                                }
                                {!isWaitingTable &&
                                     <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                            {request.price.toLocaleString('en-US')} 
                                            <span className="text-xs font-normal text-slate-500">ريال</span>
                                            {priceSuffix}
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
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      ) : (
         <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                <FileTextIcon className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-medium">لا توجد طلبات لعرضها.</p>
         </div>
      )}
    </div>
  );
};

export default RequestTable;
