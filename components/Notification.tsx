
import React from 'react';
import { Notification as NotificationType } from '../types';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import InfoIcon from './icons/InfoIcon';

interface NotificationProps {
  notification: NotificationType;
  style?: React.CSSProperties;
}

const Notification: React.FC<NotificationProps> = ({ notification, style }) => {
  const { title, message, type } = notification;

  const ErrorCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );

  const styles = {
    success: {
      containerBg: 'bg-[#edfdf2] dark:bg-emerald-900/90',
      iconColor: 'text-[#047857] dark:text-emerald-400',
      textColor: 'text-[#065f46] dark:text-emerald-50',
      subTextColor: 'text-[#047857]/80 dark:text-emerald-200/80',
      bgIcon: 'bg-[#d1fae5] dark:bg-emerald-800/80',
      Icon: CheckCircleIcon
    },
    error: {
      containerBg: 'bg-[#fef2f2] dark:bg-red-900/90',
      iconColor: 'text-[#b91c1c] dark:text-red-400',
      textColor: 'text-[#991b1b] dark:text-red-50',
      subTextColor: 'text-[#b91c1c]/80 dark:text-red-200/80',
      bgIcon: 'bg-[#fee2e2] dark:bg-red-800/80',
      Icon: ErrorCircleIcon
    },
    warning: {
      containerBg: 'bg-[#fffbeb] dark:bg-amber-900/90',
      iconColor: 'text-[#b45309] dark:text-amber-400',
      textColor: 'text-[#92400e] dark:text-amber-50',
      subTextColor: 'text-[#b45309]/80 dark:text-amber-200/80',
      bgIcon: 'bg-[#fef3c7] dark:bg-amber-800/80',
      Icon: AlertTriangleIcon
    },
    info: {
      containerBg: 'bg-[#eff6ff] dark:bg-blue-900/90',
      iconColor: 'text-[#1d4ed8] dark:text-blue-400',
      textColor: 'text-[#1e40af] dark:text-blue-50',
      subTextColor: 'text-[#1d4ed8]/80 dark:text-blue-200/80',
      bgIcon: 'bg-[#dbeafe] dark:bg-blue-800/80',
      Icon: InfoIcon
    }
  };

  const currentStyle = styles[type];
  const IconComponent = currentStyle.Icon;

  return (
    <div 
      className={`
        absolute w-full rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/40
        flex overflow-hidden transition-all duration-300 ease-out border border-black/5 dark:border-white/5
        ${currentStyle.containerBg}
      `}
      style={style}
      role="alert"
    >
      <div className="flex-1 p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
        <div className={`flex-shrink-0 p-1 sm:p-1.5 rounded-full ${currentStyle.bgIcon}`}>
           <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${currentStyle.iconColor}`} />
        </div>

        <div className="flex-1 pt-0.5">
          {title && <h4 className={`text-sm sm:text-base font-bold mb-0.5 ${currentStyle.textColor}`}>{title}</h4>}
          {message && (
            <p className={`text-xs sm:text-sm leading-snug ${currentStyle.subTextColor}`}>
              {message.split('*').map((part, i) => 
                i % 2 === 1 ? (
                  <strong key={i} className="font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/30 px-1 rounded mx-0.5">
                    {part}
                  </strong>
                ) : part
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notification;
