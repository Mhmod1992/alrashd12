
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Icon from './Icon';
import Button from './Button';

interface WhatsAppSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    phone: string;
}

const WhatsAppSuccessModal: React.FC<WhatsAppSuccessModalProps> = ({ isOpen, onClose, clientName, phone }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-center"
                    >
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                            >
                                <Icon name="check-circle" className="w-12 h-12 text-green-600 dark:text-green-400" />
                            </motion.div>
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">تم الإرسال بنجاح!</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            تم إرسال التقرير إلى العميل عبر الواتساب بنجاح.
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 mb-8 border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-slate-500">العميل:</span>
                                <span className="font-bold text-slate-800 dark:text-white">{clientName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">رقم الهاتف:</span>
                                <span className="font-mono text-slate-800 dark:text-white dir-ltr">{phone}</span>
                            </div>
                        </div>

                        <Button
                            onClick={onClose}
                            className="w-full py-3 text-lg font-bold"
                            variant="primary"
                        >
                            موافق
                        </Button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default WhatsAppSuccessModal;
