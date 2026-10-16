import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  setNotifications,
}: NotificationCenterProps) {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error('Failed to mark notifications as read');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {
      toast.error('Failed to update notification');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification deleted');
    } catch (e) {
      toast.error('Failed to delete notification');
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'SUCCESS':
        return <Sparkles className="h-4 w-4 text-primary animate-pulse" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-400 animate-bounce" />;
      default:
        return <Info className="h-4 w-4 text-accent-cyan" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white/95 backdrop-blur-xl border-l border-slate-200 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border transition-all flex items-start space-x-3 relative group ${
                      item.isRead
                        ? 'bg-slate-50 border-slate-100 opacity-60'
                        : 'bg-white border-slate-200/90 shadow-sm'
                    }`}
                  >
                    {/* Alert Icon */}
                    <div className="mt-0.5 flex-shrink-0">{getAlertIcon(item.type)}</div>

                    {/* Alert text */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-slate-900 leading-normal truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!item.isRead && (
                            <button
                              onClick={() => markAsRead(item.id)}
                              className="text-[9px] text-primary hover:underline flex-shrink-0 flex items-center space-x-0.5 cursor-pointer"
                              title="Mark as read"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(item.id)}
                            className="text-[9px] text-slate-400 hover:text-red-500 flex-shrink-0 flex items-center space-x-0.5 cursor-pointer ml-1"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">{item.message}</p>
                      <span className="text-[9px] text-gray-500 block">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-2 text-gray-500">
                  <Bell className="h-8 w-8 text-gray-600 animate-pulse" />
                  <p className="text-xs font-semibold">All caught up! No notifications.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
