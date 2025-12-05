import React, { useState, useEffect, useMemo } from 'react';
import { Contact, JobTicket, FileAttachment } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { XIcon, SparklesIcon, ClipboardCheckIcon, ClipboardIcon, CheckCircleIcon } from './icons.tsx';

interface SocialPostCreatorModalProps {
  job: {
    contact: Contact;
    ticket: JobTicket;
  };
  onClose: () => void;
}

type Platform = 'Facebook' | 'Instagram' | 'Nextdoor';

const SocialPostCreatorModal: React.FC<SocialPostCreatorModalProps> = ({ job, onClose }) => {
    const { businessInfo } = useApp();
    const { addNotification } = useNotifications();

    const [platform, setPlatform] = useState<Platform>('Facebook');
    const [postContent, setPostContent] = useState('');
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const imageFiles = useMemo(() => job.contact.files.filter(f => f.type.startsWith('image/')), [job.contact.files]);

    const getJobSummary = (ticket: JobTicket): string => {
        if (ticket.notes?.toLowerCase().includes('new door')) return 'new door installation';
        if (ticket.notes?.toLowerCase().includes('opener')) return 'garage door opener repair';
        const hasSprings = ticket.parts.some(p => p.name.toLowerCase().includes('spring'));
        if (hasSprings) return 'spring replacement';
        return 'garage door repair';
    };

    const getCity = (address: string): string => {
        const parts = address.split(',');
        return parts.length > 1 ? parts[1].trim() : 'their neighborhood';
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setPostContent('');
        try {
            const jobSummary = getJobSummary(job.ticket);
            const city = getCity(job.contact.address);
            const businessName = businessInfo.name || 'our team';

            const prompt = `Generate a social media post for ${platform}.
            The post is about a completed "${jobSummary}" for a customer in ${city}.
            The tone should be friendly, professional, and celebratory.
            Briefly mention the benefit of the repair (e.g., safety, convenience, quiet operation).
            End with a call to action to contact us for service.
            
            Include these relevant hashtags at the end: #${city.replace(/\s+/g, '')} #${businessName.replace(/\s+/g, '')} #GarageDoorRepair #HomeImprovement`;
            
            const proxyResponse = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                })
            });

            if (!proxyResponse.ok) {
                const errorData = await proxyResponse.json();
                throw new Error(errorData.error.message || `API request failed with status ${proxyResponse.status}`);
            }

            const response = await proxyResponse.json();
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
            setPostContent(text || 'Could not generate content.');

        } catch (error: any) {
            console.error("Error generating social post:", error);
            addNotification(`Failed to generate content: ${error.message}`, 'error');
            setPostContent('There was an error generating the post content.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(postContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };
    
    const handleImageSelect = (id: string) => {
        setSelectedImageIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    
    const handleDownloadImage = () => {
        if (selectedImageIds.length === 0) {
            addNotification("Please select an image to download.", "info");
            return;
        }
        const image = imageFiles.find(f => f.id === selectedImageIds[0]);
        if(image) {
            const a = document.createElement('a');
            a.href = image.dataUrl;
            a.download = image.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col" role="dialog" aria-modal="true">
            <header className="p-4 border-b dark:border-slate-700 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Social Post Creator</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">For job at {job.contact.name}'s</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>
            
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                {/* Left Panel: Content */}
                <div className="w-full md:w-1/2 p-6 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            {(['Facebook', 'Instagram', 'Nextdoor'] as Platform[]).map(p => (
                                <button key={p} onClick={() => setPlatform(p)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${platform === p ? 'bg-white dark:bg-slate-700 text-sky-600 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleGenerate} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300">
                            <SparklesIcon className="w-5 h-5" />
                            {isLoading ? 'Generating...' : 'Generate with AI'}
                        </button>
                    </div>
                    
                    <textarea 
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder={isLoading ? 'AI is thinking...' : 'Generated post content will appear here...'}
                        className="w-full h-full mt-4 p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 flex-grow resize-none"
                    />

                    <div className="mt-4 flex justify-end">
                        <button onClick={handleCopy} disabled={!postContent} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isCopied ? <ClipboardCheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5" />}
                            {isCopied ? 'Copied!' : 'Copy Text'}
                        </button>
                    </div>
                </div>

                {/* Right Panel: Visuals */}
                <div className="w-full md:w-1/2 p-6 flex flex-col">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Select Visuals</h3>
                        <button onClick={handleDownloadImage} disabled={selectedImageIds.length === 0} className="px-4 py-2 text-sm rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                            Download Selected
                        </button>
                    </div>

                    {imageFiles.length > 0 ? (
                        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto flex-grow">
                            {imageFiles.map(file => (
                                <div key={file.id} onClick={() => handleImageSelect(file.id)} className="relative aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden cursor-pointer group">
                                    <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover"/>
                                    {selectedImageIds.includes(file.id) && (
                                        <div className="absolute inset-0 bg-sky-500 bg-opacity-70 flex items-center justify-center ring-4 ring-sky-500 rounded-lg">
                                            <CheckCircleIcon className="w-8 h-8 text-white"/>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-grow flex items-center justify-center">
                            <p className="text-slate-500">No photos found for this job.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SocialPostCreatorModal;