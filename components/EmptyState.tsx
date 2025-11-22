import React from 'react';

interface EmptyStateProps {
    Icon: React.FC<{className?: string}>;
    title: string;
    message: string;
    actionText?: string;
    onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ Icon, title, message, actionText, onAction }) => {
  return (
    <div className="h-full flex flex-col justify-center items-center text-center p-8 bg-slate-50 dark:bg-slate-800">
      <div className="w-20 h-20 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full mb-6">
          <Icon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">{title}</h2>
      <p className="mt-2 max-w-xs text-slate-500 dark:text-slate-400">{message}</p>
      {actionText && onAction && (
          <button 
              onClick={onAction} 
              className="mt-6 px-4 py-2 bg-sky-500 text-white font-medium rounded-md hover:bg-sky-600 transition-colors"
          >
              {actionText}
          </button>
      )}
    </div>
  );
};

export default EmptyState;
