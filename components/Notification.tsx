import React, { useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, XIcon } from './icons.tsx';
import { Notification as NotificationType } from '../contexts/NotificationContext.tsx';

interface NotificationProps extends NotificationType {
    onDismiss: () => void;
}

const NOTIFICATION_TIMEOUT = 5000; // 5 seconds

const icons = {
    success: <CheckCircleIcon className="w-6 h-6 text-green-500" />,
    error: <XCircleIcon className="w-6 h-6 text-red-500" />,
    info: <InformationCircleIcon className="w-6 h-6 text-sky-500" />,
};

const Notification: React.FC<NotificationProps> = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, NOTIFICATION_TIMEOUT);

        return () => {
            clearTimeout(timer);
        };
    }, [onDismiss]);

    return (
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden mt-4 animate-toast-in">
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">{icons[type]}</div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{message}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button
                            onClick={onDismiss}
                            className="inline-flex rounded-md bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                        >
                            <span className="sr-only">Close</span>
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="h-1 bg-slate-200 dark:bg-slate-700">
                <div className={`h-1 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-sky-500'} animate-progress`}></div>
            </div>
        </div>
    );
};

export default Notification;
