
import React, { useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import Icon from './Icon';
import Button from './Button';

const IncomingRequestNotifier: React.FC = () => {
    const { 
        incomingRequest, 
        setIncomingRequest, 
        clients, 
        cars, 
        carMakes, 
        carModels, 
        setPage, 
        setSelectedRequestId,
        triggerHighlight
    } = useAppContext();

    useEffect(() => {
        if (incomingRequest) {
            const timer = setTimeout(() => {
                setIncomingRequest(null);
            }, 10000); // Disappears after 10 seconds

            return () => clearTimeout(timer);
        }
    }, [incomingRequest, setIncomingRequest]);

    const requestData = useMemo(() => {
        if (!incomingRequest) return null;

        const client = clients.find(c => c.id === incomingRequest.client_id);
        const car = cars.find(c => c.id === incomingRequest.car_id);
        
        let carName = 'سيارة غير معروفة';
        if (incomingRequest.car_snapshot) {
            carName = `${incomingRequest.car_snapshot.make_ar} ${incomingRequest.car_snapshot.model_ar}`;
        } else if (car) {
            const make = carMakes.find(m => m.id === car.make_id);
            const model = carModels.find(m => m.id === car.model_id);
            carName = `${make?.name_ar || ''} ${model?.name_ar || ''}`;
        }

        return {
            requestNumber: incomingRequest.request_number,
            clientName: client?.name || 'عميل غير معروف',
            carName: carName,
        };
    }, [incomingRequest, clients, cars, carMakes, carModels]);

    const handleView = () => {
        if (incomingRequest) {
            setSelectedRequestId(incomingRequest.id);
            setPage('fill-request');
            triggerHighlight(incomingRequest.id);
            setIncomingRequest(null);
        }
    };

    if (!incomingRequest || !requestData) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-6 left-6 z-[105] w-full max-w-sm animate-slide-in-from-left"
            role="alert"
            aria-live="assertive"
        >
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600 dark:text-blue-400">
                            <Icon name="document-report" className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                طلب فحص جديد (#{requestData.requestNumber})
                            </h3>
                            <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                <p className="flex items-center gap-2 truncate">
                                    <Icon name="employee" className="w-4 h-4 text-slate-400" /> 
                                    <span>{requestData.clientName}</span>
                                </p>
                                <p className="flex items-center gap-2 truncate">
                                    <Icon name="cars" className="w-4 h-4 text-slate-400" />
                                    <span>{requestData.carName}</span>
                                </p>
                            </div>
                        </div>
                         <button 
                            onClick={() => setIncomingRequest(null)}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md"
                            aria-label="إغلاق"
                        >
                            <Icon name="close" className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="mt-4">
                        <Button onClick={handleView} className="w-full justify-center py-2.5">
                            عرض الطلب
                        </Button>
                    </div>
                </div>
                 {/* Progress Bar Timer */}
                <div className="h-1 bg-blue-200/50 dark:bg-blue-800/50">
                    <div className="h-full bg-blue-500 animate-progress-bar"></div>
                </div>
            </div>
        </div>
    );
};

export default IncomingRequestNotifier;
