
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Notification from './Notification';

const NotificationContainer: React.FC = () => {
  const { notifications } = useAppContext();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile(); // Check initially
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get up to 3 most recent notifications, reversed so newest is first (index 0)
  const visibleNotifications = [...notifications].reverse().slice(0, 3);

  return (
    <div className="fixed top-16 left-4 right-4 sm:top-24 sm:left-auto sm:right-6 z-[99999] sm:w-full sm:max-w-sm pointer-events-none print:hidden">
      <div className="relative w-full">
        {visibleNotifications.map((notification, index) => {
          // Stacking logic:
          const scale = 1 - index * 0.05;
          const offsetStep = isMobile ? 10 : 16;
          const translateY = index * offsetStep; 
          const opacity = index === 0 ? 1 : index === 1 ? 0.8 : 0.4;
          const zIndex = 50 - index;

          return (
            <Notification
              key={notification.id}
              notification={notification}
              style={{
                transform: `translateY(${translateY}px) scale(${scale})`,
                opacity: opacity,
                zIndex: zIndex,
                transformOrigin: 'top center'
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default NotificationContainer;
