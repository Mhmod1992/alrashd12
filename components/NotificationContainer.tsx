
import React from 'react';
import { useAppContext } from '../context/AppContext';
import Notification from './Notification';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useAppContext();

  const handleDismiss = (id: string) => {
    removeNotification(id);
  };

  return (
    <div className="fixed top-24 right-6 z-[99999] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
};

export default NotificationContainer;
