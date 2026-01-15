
import React from 'react';
import { Notification as NotificationType } from '../types';
import XIcon from './icons/XIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import InfoIcon from './icons/InfoIcon';

interface NotificationProps {
  notification: NotificationType;
  onDismiss: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onDismiss }) => {
  const { id, title, message, type } = notification;

  const ErrorCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );

  const styles = {
    success: {
      containerBg: 'bg-emerald-50 dark:bg-emerald-900/40',
      containerBorder: 'border-emerald-200 dark:border-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      textColor: 'text-emerald-900 dark:text-emerald-100',
      subTextColor: 'text-emerald-700 dark:text-emerald-300',
      bgIcon: 'bg-emerald-100 dark:bg-emerald-800/50',
      closeHover: 'hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50',
      Icon: CheckCircleIcon
    },
    error: {
      containerBg: 'bg-red-50 dark:bg-red-900/40',
      containerBorder: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-600 dark:text-red-400',
      textColor: 'text-red-900 dark:text-red-100',
      subTextColor: 'text-red-700 dark:text-red-300',
      bgIcon: 'bg-red-100 dark:bg-red-800/50',
      closeHover: 'hover:bg-red-200/50 dark:hover:bg-red-800/50',
      Icon: ErrorCircleIcon
    },
    warning: {
      containerBg: 'bg-amber-50 dark:bg-amber-900/40',
      containerBorder: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
      textColor: 'text-amber-900 dark:text-amber-100',
      subTextColor: 'text-amber-700 dark:text-amber-300',
      bgIcon: 'bg-amber-100 dark:bg-amber-800/50',
      closeHover: 'hover:bg-amber-200/50 dark:hover:bg-amber-800/50',
      Icon: AlertTriangleIcon
    },
    info: {
      containerBg: 'bg-blue-50 dark:bg-blue-900/40',
      containerBorder: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-900 dark:text-blue-100',
      subTextColor: 'text-blue-700 dark:text-blue-300',
      bgIcon: 'bg-blue-100 dark:bg-blue-800/50',
      closeHover: 'hover:bg-blue-200/50 dark:hover:bg-blue-800/50',
      Icon: InfoIcon
    }
  };

  const currentStyle = styles[type];
  const IconComponent = currentStyle.Icon;

  return (
    <div 
      className={`
        relative w-full backdrop-blur-md rounded-xl shadow-lg shadow-slate-300/20 dark:shadow-black/30
        pointer-events-auto flex overflow-hidden animate-slide-in-down border
        ${currentStyle.containerBg} ${currentStyle.containerBorder}
      `}
      role="alert"
    >
      {/* Content Area */}
      <div className="flex-1 p-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-1.5 rounded-full ${currentStyle.bgIcon} mt-0.5`}>
           <IconComponent className={`w-5 h-5 ${currentStyle.iconColor}`} />
        </div>

        {/* Text */}
        <div className="flex-1 pt-0.5">
          {title && <h4 className={`text-sm font-bold mb-1 ${currentStyle.textColor}`}>{title}</h4>}
          <p className={`text-sm leading-snug ${currentStyle.subTextColor}`}>{message}</p>
        </div>

        {/* Close Button */}
        <button 
          onClick={() => onDismiss(id)}
          className={`flex-shrink-0 transition-colors p-1 rounded-md ${currentStyle.subTextColor} ${currentStyle.closeHover} opacity-70 hover:opacity-100`}
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Notification;
