
import React from 'react';
import { useAppContext } from '../context/AppContext';
import { RequestStatus } from '../types';
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
        inspectionTypes,
        sendWhatsAppMessage
    } = useAppContext();

    if (!newRequestSuccessState.isOpen) {
        return null;
    }

    const isLoading = newRequestSuccessState.requestNumber === null;
    const request = requests.find(r => r.id === newRequestSuccessState.requestId);
    
    // Explicit isWaiting flag takes precedence.
    // Otherwise deduce from request status or showWhatsAppButton
    const isWaiting = newRequestSuccessState.isWaiting !== undefined
        ? newRequestSuccessState.isWaiting
        : (request ? request.status === RequestStatus.WAITING_PAYMENT : Boolean(newRequestSuccessState.showWhatsAppButton));

    const waitingNumber = request?.waiting_number || (request?.payment_note?.match(/\[W-(\d+)\]/i)?.[1]) || newRequestSuccessState.requestNumber || 100;

    const handleGoToRequests = () => {
        if (newRequestSuccessState.requestId) {
            triggerHighlight(newRequestSuccessState.requestId);
        }
        hideNewRequestSuccessModal();
        
        // Redirect to waiting list if it's a waiting request, or to main requests list if official/paid
        if (isWaiting) {
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

    const handleSendToClient = async () => {
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

        let carInfo = '';
        if (request.car_snapshot) {
            carInfo = `🚙 *السيارة: ${request.car_snapshot.make_en} ${request.car_snapshot.model_en} ${request.car_snapshot.year}*\n`;
        }

        const message = isWaiting
            ? `أهلاً *${client.name}*، طلبك جاهز للدفع.\n\n🧾 *الطلب: w - ${waitingNumber} (بانتظار الدفع)*\n${carInfo}📋 *نوع الفحص: ${inspectionTypeName}*\n💳 *المبلغ: ${request.price} ريال*\n\nالرجاء إتمام الدفع لدى الكاشير لبدء الفحص.`
            : `حياكم الله *${client.name}*،
#${request.request_number}
تم تأكيد استلام مركبتكم *${request.car_snapshot?.make_en || ''} ${request.car_snapshot?.model_en || ''} ${request.car_snapshot?.year || ''}*
وبدء إجراءات الفحص الفني في مركزنا.

نعمل حالياً على إتمام الفحص وتجهيز التقرير بأعلى معايير الدقة والجودة، وسيتم إشعاركم فور الجاهزية.

شكراً لاختياركم مركزنا.
*ادارة مركز الراشد*`;
        
        await sendWhatsAppMessage(phone, message, client.name);
        hideNewRequestSuccessModal();
        
        // Ensure we go to waiting list if we sent from there
        if (isWaiting) {
            setPage('waiting-requests');
        }
    };

    return (
        <Modal 
            isOpen={newRequestSuccessState.isOpen} 
            onClose={isLoading ? () => {} : hideNewRequestSuccessModal} 
            title={isLoading ? 'جاري إصدار الطلب...' : (isWaiting ? 'تم تسجيل الطلب بانتظار الدفع' : 'تم تفعيل الطلب بنجاح')} 
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
                            {isWaiting ? 'رقم الطلب بانتظار الدفع:' : 'رقم الطلب الجديد هو:'}
                        </p>
                        <p className={`text-4xl font-bold mt-2 font-mono ${isWaiting ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {isWaiting ? `w - ${waitingNumber}` : `#${newRequestSuccessState.requestNumber}`}
                        </p>
                        {isWaiting && (
                            <p className="mt-4 text-slate-600 dark:text-slate-400 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800 text-sm">
                                الطلب الآن في قائمة <strong>"انتظار الدفع"</strong> برقم مؤقت <span className="font-mono font-bold text-purple-700 dark:text-purple-300">w - {waitingNumber}</span>.<br/>
                                يرجى توجيه العميل للكاشير للتحصيل وإصدار الرقم التسلسلي الرسمي للطلب.
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
                    
                    <Button onClick={handlePrintDraft} leftIcon={<Icon name="print" className="w-5 h-5" />}>
                        طباعة مسودة
                    </Button>
                </div>
            )}
        </Modal>
    );
};

export default NewRequestSuccessModal;
