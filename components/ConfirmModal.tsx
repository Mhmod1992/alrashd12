import React from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from './Modal';
import Button from './Button';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import InfoIcon from './icons/InfoIcon';

const ConfirmModal: React.FC = () => {
  const { confirmModalState, hideConfirmModal } = useAppContext();
  const { isOpen, title, message, onConfirm, icon } = confirmModalState;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    hideConfirmModal();
  };

  const renderIcon = () => {
    if (!icon) return null;
    let IconComponent;
    let colorClass;
    switch (icon) {
        case 'success':
            IconComponent = CheckCircleIcon;
            colorClass = 'text-green-500';
            break;
        case 'warning':
            IconComponent = AlertTriangleIcon;
            colorClass = 'text-yellow-500';
            break;
        case 'info':
        default:
            IconComponent = InfoIcon;
            colorClass = 'text-blue-500';
            break;
    }
    return <IconComponent className={`w-12 h-12 mx-auto mb-4 ${colorClass}`} />;
  };

  return (
    <Modal isOpen={isOpen} onClose={hideConfirmModal} title={title} size="md">
      <div className="py-4 text-center">
        {renderIcon()}
        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">{message}</p>
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-2 border-t dark:border-slate-700">
        {onConfirm ? (
          <>
            <Button onClick={hideConfirmModal} variant="secondary">
              إلغاء
            </Button>
            <Button onClick={handleConfirm} variant="danger">
              تأكيد
            </Button>
          </>
        ) : (
          <Button onClick={hideConfirmModal} className="w-full">
            حسنًا
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmModal;
