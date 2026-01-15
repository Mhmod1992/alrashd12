
import React, { useEffect } from 'react';
import Icon from './Icon';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const overlayClasses = `fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
  const drawerClasses = `fixed top-0 left-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  return (
    <>
      <div className={overlayClasses} aria-hidden="true" />
      <aside className={drawerClasses} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
            <h2 id="drawer-title" className="text-xl font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Close drawer"
            >
              <Icon name="close" className="w-6 w-6" />
            </button>
          </div>
          {/* Content */}
          <div className="flex-grow overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Drawer;
