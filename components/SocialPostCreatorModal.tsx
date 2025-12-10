import React, { useState } from 'react';
import { Contact, JobTicket } from '../types.ts';
import { XIcon, DownloadIcon, ShareIcon } from './icons.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';

interface SocialPostCreatorModalProps {
    job: { contact: Contact; ticket: JobTicket; completedAt: Date };
    onClose: () => void;
}

const SocialPostCreatorModal: React.FC<SocialPostCreatorModalProps> = ({ job, onClose }) => {
    const { addNotification } = useNotifications();
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    
    // Filter for images only
    const imageFiles = job.contact.files.filter(f => f.type.startsWith('image/'));

    const handleImageToggle = (id: string) => {
        setSelectedImageIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleDownloadImage = () => {
        if (selectedImageIds.length === 0) {
            addNotification("Please select an image to download.", "info");
            return;
        }
        // Download selected images
        selectedImageIds.forEach(id => {
            const image = imageFiles.find(f => f.id === id);
            if(image) {
                const a = document.createElement('a');
                a.href = image.dataUrl;
                a.download = image.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
        addNotification(`${selectedImageIds.length} image(s) saved to your device.`, "success");
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Create Social Post</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Select images from this job to use in your post.</p>
                    {imageFiles.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {imageFiles.map(file => (
                                <div 
                                    key={file.id} 
                                    onClick={() => handleImageToggle(file.id)}
                                    className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 ${selectedImageIds.includes(file.id) ? 'border-sky-500' : 'border-transparent'}`}
                                >
                                    <img src={file.dataUrl} alt="Job" className="w-full h-full object-cover" />
                                    {selectedImageIds.includes(file.id) && (
                                        <div className="absolute inset-0 bg-sky-500 bg-opacity-20 flex items-center justify-center">
                                            <div className="bg-sky-500 text-white rounded-full p-1"><ShareIcon className="w-4 h-4" /></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-slate-50 dark:bg-slate-700/50 rounded-lg mb-6">
                            <p className="text-slate-500">No images available for this job.</p>
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Caption Idea</label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-md text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                                Just finished another successful job for {job.contact.name}! 🔧🏠 #ServiceWork #HappyCustomer
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-lg flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50">Cancel</button>
                    <button onClick={handleDownloadImage} disabled={selectedImageIds.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-md hover:bg-sky-600 disabled:opacity-50 flex items-center gap-2">
                        <DownloadIcon className="w-4 h-4" /> Download Selected
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SocialPostCreatorModal;