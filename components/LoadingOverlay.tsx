import React from 'react';
import { useData } from '../contexts/DataContext.tsx';

const LoadingOverlay: React.FC = () => {
    const { isGlobalLoading, globalLoadingMessage } = useData();

    if (!isGlobalLoading) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex flex-col items-center justify-center z-[9998]">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
            {globalLoadingMessage && (
                <p className="mt-4 text-white text-lg font-medium">{globalLoadingMessage}</p>
            )}
        </div>
    );
};

export default LoadingOverlay;