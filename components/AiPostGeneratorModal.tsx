import React, { useState } from 'react';
import { XIcon, SparklesIcon, DownloadIcon } from './icons.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';

interface AiPostGeneratorModalProps {
    onClose: () => void;
}

const AiPostGeneratorModal: React.FC<AiPostGeneratorModalProps> = ({ onClose }) => {
    const { addNotification } = useNotifications();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        // Simulation of AI generation since real API call requires setup
        setTimeout(() => {
            // Placeholder URL or logic
            setGeneratedImageUrl('https://placehold.co/600x400/png?text=AI+Generated+Image');
            setIsGenerating(false);
        }, 2000);
    };

    const handleDownloadImage = () => {
        if (!generatedImageUrl) return;
        const a = document.createElement('a');
        a.href = generatedImageUrl;
        a.download = `ai_generated_post_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        addNotification("Image saved to your device.", "success");
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">AI Post Generator</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Describe the image you want</label>
                    <textarea 
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                        placeholder="e.g., A professional garage door installation team working on a sunny day..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    ></textarea>
                    
                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || !prompt}
                        className="mt-4 w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isGenerating ? 'Generating...' : <><SparklesIcon className="w-4 h-4 mr-2"/> Generate</>}
                    </button>

                    {generatedImageUrl && (
                        <div className="mt-6">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Result:</p>
                            <img src={generatedImageUrl} alt="Generated" className="w-full rounded-md shadow-sm" />
                            <button 
                                onClick={handleDownloadImage}
                                className="mt-3 w-full flex items-center justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                            >
                                <DownloadIcon className="w-4 h-4 mr-2"/> Download Image
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiPostGeneratorModal;