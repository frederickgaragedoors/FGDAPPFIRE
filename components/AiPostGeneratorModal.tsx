import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { XIcon, SparklesIcon, ClipboardCheckIcon, ClipboardIcon, DownloadIcon } from './icons.tsx';

interface AiPostGeneratorModalProps {
  onClose: () => void;
}

type Platform = 'Facebook' | 'Instagram' | 'Nextdoor';

const AiPostGeneratorModal: React.FC<AiPostGeneratorModalProps> = ({ onClose }) => {
    const { businessInfo } = useApp();
    const { addNotification } = useNotifications();

    const [platform, setPlatform] = useState<Platform>('Facebook');
    const [userPrompt, setUserPrompt] = useState('');
    const [generatedText, setGeneratedText] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleGenerate = async () => {
        if (!userPrompt.trim()) {
            addNotification("Please enter a description for your post.", "info");
            return;
        }
        setIsLoading(true);
        setGeneratedText('');
        setGeneratedImageUrl(null);

        try {
            const businessName = businessInfo.name || 'our team';

            // --- Generic Proxy Fetch Function ---
            const callProxy = async (body: object) => {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || `API request failed with status ${response.status}`);
                }
                return response.json();
            };

            // --- Image Generation ---
            const imagePromise = callProxy({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: `Create a photorealistic, eye-catching image for a social media post for a local service business. The post is about: "${userPrompt}".` }] },
            }).then(response => {
                const imagePart = response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
                if (imagePart && imagePart.inlineData) {
                    return `data:image/png;base64,${imagePart.inlineData.data}`;
                }
                return null;
            });

            // --- Text Generation ---
            const textPromise = callProxy({
                model: 'gemini-2.5-flash',
                contents: `Generate a social media post for ${platform}. The post is for a local service business named "${businessName}".
                The topic is: "${userPrompt}".
                The tone should be friendly, professional, and trustworthy.
                End with a clear call to action (e.g., "Call us today!", "Visit our website!").
                Include relevant hashtags like #${businessName.replace(/\s+/g, '')}, #LocalBusiness, #HomeServices.`,
            }).then(response => {
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                return text || 'Could not generate text.';
            });

            const [imageUrl, textContent] = await Promise.all([imagePromise, textPromise]);
            
            setGeneratedImageUrl(imageUrl);
            setGeneratedText(textContent);

        } catch (error: any) {
            console.error("Error generating AI post:", error);
            addNotification(`Failed to generate content: ${error.message}`, 'error');
            setGeneratedText('There was an error generating the post content.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleDownloadImage = () => {
        if (!generatedImageUrl) return;
        const a = document.createElement('a');
        a.href = generatedImageUrl;
        a.download = `ai_generated_post_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col" role="dialog" aria-modal="true">
            <header className="p-4 border-b dark:border-slate-700 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Generate AI Post</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>
            
            <div className="flex-grow flex flex-col md:flex-row overflow-y-auto">
                {/* Left Panel: Controls & Text */}
                <div className="w-full md:w-1/2 p-6 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
                    <label className="font-semibold mb-2">1. Describe your post</label>
                    <textarea 
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="e.g., A special offer on garage door spring replacements for the fall season."
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 resize-none"
                        rows={3}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-4">
                        <div className="flex flex-col">
                            <label className="font-semibold mb-2">2. Choose a platform</label>
                            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                {(['Facebook', 'Instagram', 'Nextdoor'] as Platform[]).map(p => (
                                    <button key={p} onClick={() => setPlatform(p)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors text-center ${platform === p ? 'bg-white dark:bg-slate-700 text-sky-600 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col sm:items-end">
                            <label className="font-semibold mb-2">3. Generate!</label>
                            <button onClick={handleGenerate} disabled={isLoading} className="flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 w-full sm:w-auto">
                                <SparklesIcon className="w-5 h-5" />
                                {isLoading ? 'Generating...' : 'Generate Post'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex flex-col flex-grow">
                         <h3 className="font-semibold mb-2">Generated Text</h3>
                        <textarea 
                            value={generatedText}
                            readOnly
                            placeholder="Generated post content will appear here..."
                            className="w-full min-h-[200px] p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-800 flex-grow resize-none"
                        />
                        <div className="mt-2 flex justify-end">
                            <button onClick={handleCopy} disabled={!generatedText} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                                {isCopied ? <ClipboardCheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5" />}
                                {isCopied ? 'Copied!' : 'Copy Text'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Image */}
                <div className="w-full md:w-1/2 p-6 flex flex-col">
                    <h3 className="font-semibold mb-2">Generated Image</h3>
                    <div className="flex-grow aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                        {isLoading ? (
                            <div className="flex flex-col items-center text-slate-500">
                                <div className="w-8 h-8 border-4 border-slate-300 border-t-sky-500 rounded-full animate-spin"></div>
                                <span className="mt-2 text-sm">Generating image...</span>
                            </div>
                        ) : generatedImageUrl ? (
                            <img src={generatedImageUrl} alt="AI generated content" className="w-full h-full object-cover"/>
                        ) : (
                            <div className="text-center text-slate-500">
                                <SparklesIcon className="w-10 h-10 mx-auto mb-2"/>
                                <p>Image will appear here</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button onClick={handleDownloadImage} disabled={!generatedImageUrl || isLoading} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                            <DownloadIcon className="w-5 h-5"/>
                            Download Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiPostGeneratorModal;
