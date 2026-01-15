


import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = '2xl' }) => {
  const { settings } = useAppContext();
  const design = settings.design || 'aero';
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl', '5xl': 'max-w-5xl'
  };
  
  const getModalDesignClasses = () => {
      if (design === 'glass') {
          const intensity = settings.glassmorphismIntensity || 5;
          const opacity = 1.0 - (intensity * 0.05);
          const darkOpacity = 1.0 - (intensity * 0.03);
          const blurLevels: { [key: number]: string } = {1: 'sm', 2: 'sm', 3: 'md', 4: 'md', 5: 'lg', 6: 'lg', 7: 'xl', 8: 'xl', 9: '2xl', 10: '2xl' };
          const blur = blurLevels[intensity] || 'lg';
          const blurClass = `backdrop-blur-${blur}`;
          const glassBg = `bg-white/[${opacity.toFixed(2)}] dark:bg-slate-800/[${darkOpacity.toFixed(2)}] ${blurClass}`;
          return `${glassBg} shadow-2xl border border-white/20 dark:border-slate-700`;
      }
      return 'bg-white dark:bg-slate-800 shadow-xl';
  }
  
  const modalBaseClasses = `w-full ${sizeClasses[size]} transform transition-all my-8 animate-slide-in-down rounded-lg`;
  const modalDesignClasses = getModalDesignClasses();
    
  const headerFooterDesignClasses = design === 'glass'
    ? 'bg-transparent'
    : 'bg-white dark:bg-slate-800';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4"
    >
      <div 
        className={`${modalBaseClasses} ${modalDesignClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-4 border-b dark:border-slate-700 sticky top-0 rounded-t-lg z-10 ${headerFooterDesignClasses}`}>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className={`flex items-center justify-end p-4 border-t dark:border-slate-700 gap-3 sticky bottom-0 rounded-b-lg ${headerFooterDesignClasses}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
