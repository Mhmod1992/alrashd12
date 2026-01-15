
import React from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from './Modal';
import Button from './Button';
import CheckCircleIcon from './icons/CheckCircleIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import Icon from './Icon';
import WhatsappIcon from './icons/WhatsappIcon';

const NewRequestSuccessModal: React.FC = () => {
    const { 
        newRequestSuccessState, 
        hideNewRequestSuccessModal, 
        setPage, 
        setSelectedRequestId,
        setShouldPrintDraft,
        triggerHighlight,
        authUser,
        requests,
        clients,
        addNotification,
        inspectionTypes
    } = useAppContext();

    if (!newRequestSuccessState.isOpen) {
        return null;
    }

    const isLoading = newRequestSuccessState.requestNumber === null;
    const isReceptionist = authUser?.role === 'receptionist';
    const request = requests.find(r => r.id === newRequestSuccessState.requestId);

    const handleGoToRequests = () => {
        if (newRequestSuccessState.requestId) {
            triggerHighlight(newRequestSuccessState.requestId);
        }
        hideNewRequestSuccessModal();
        
        // Redirect logic based on role
        if (isReceptionist) {
            setPage('waiting-requests');
        } else {
            setPage('requests');
        }
    };

    const handlePrintDraft = () => {
        if (newRequestSuccessState.requestId) {
            setSelectedRequestId(newRequestSuccessState.requestId);
            setShouldPrintDraft(true);
            setPage('request-draft');
        }
        hideNewRequestSuccessModal();
    };

    const handleSendToClient = () => {
        if (!request) return;

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

        const inspectionType = inspectionTypes.find(t => t.id === request.inspection_type_id);
        const inspectionTypeName = inspectionType ? inspectionType.name : 'فحص';

        const message = `أهلاً ${client.name}، طلبك جاهز للدفع.\n\n🧾 *الطلب: #${request.request_number}*\n📋 *نوع الفحص: ${inspectionTypeName}*\n💳 *المبلغ: ${request.price} ريال*\n\nالرجاء إتمام الدفع لدى الكاشير لبدء الفحص.`;
        
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        hideNewRequestSuccessModal();
        
        // Ensure receptionist goes to waiting list after sending message
        if (isReceptionist) {
            setPage('waiting-requests');
        }
    };

    return (
        <Modal 
            isOpen={newRequestSuccessState.isOpen} 
            onClose={isLoading ? () => {} : hideNewRequestSuccessModal} 
            title={isLoading ? 'جاري إصدار الطلب...' : 'تم إنشاء الطلب بنجاح'} 
            size="md"
        >
            <div className="text-center py-8">
                {isLoading ? (
                    <>
                        <RefreshCwIcon className="w-20 h-20 text-blue-500 mx-auto mb-4 animate-spin" />
                        <p className="text-xl text-slate-800 dark:text-slate-200">
                            يرجى الانتظار، جاري حفظ البيانات...
                        </p>
                    </>
                ) : (
                    <>
                        <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4 animate-scale-in" />
                        <p className="text-xl text-slate-800 dark:text-slate-200">
                            رقم الطلب الجديد هو:
                        </p>
                        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                            #{newRequestSuccessState.requestNumber}
                        </p>
                        {isReceptionist && (
                            <p className="mt-4 text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                                الطلب الآن في قائمة "انتظار الدفع".<br/>يرجى توجيه العميل للكاشير لإتمام العملية.
                            </p>
                        )}
                    </>
                )}
            </div>
            {!isLoading && (
                <div className="flex justify-center gap-4 pt-4 border-t dark:border-slate-700 flex-wrap">
                    <Button onClick={handleGoToRequests} variant="secondary">
                        العودة للقائمة
                    </Button>
                    
                    {isReceptionist ? (
                        <Button onClick={handleSendToClient} variant="whatsapp" leftIcon={<WhatsappIcon className="w-5 h-5" />}>
                            إرسال للعميل
                        </Button>
                    ) : (
                        <Button onClick={handlePrintDraft} leftIcon={<Icon name="print" className="w-5 h-5" />}>
                            طباعة مسودة
                        </Button>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default NewRequestSuccessModal;
