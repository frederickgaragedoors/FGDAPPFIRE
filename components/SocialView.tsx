import React, { useState, useMemo } from 'react';
import { useContacts } from '../contexts/ContactContext.tsx';
import { Contact, JobTicket, jobStatusColors } from '../types.ts';
import EmptyState from './EmptyState.tsx';
import SocialPostCreatorModal from './SocialPostCreatorModal.tsx';
import AiPostGeneratorModal from './AiPostGeneratorModal.tsx';
import { MegaphoneIcon, SparklesIcon } from './icons.tsx';

type CompletedJob = {
    contact: Contact;
    ticket: JobTicket;
    completedAt: Date;
};

const SocialView: React.FC = () => {
    const { contacts } = useContacts();
    const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null);
    const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false);

    const recentCompletedJobs = useMemo<CompletedJob[]>(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const jobs: CompletedJob[] = [];

        contacts.forEach(contact => {
            (contact.jobTickets || []).forEach(ticket => {
                const latestStatus = [...ticket.statusHistory].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                if (latestStatus && (latestStatus.status === 'Completed' || latestStatus.status === 'Paid')) {
                    const completedAt = new Date(latestStatus.timestamp);
                    if (completedAt >= thirtyDaysAgo) {
                        jobs.push({ contact, ticket, completedAt });
                    }
                }
            });
        });

        return jobs.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    }, [contacts]);

    const JobCard: React.FC<{ job: CompletedJob }> = ({ job }) => {
        const firstImage = job.contact.files.find(f => f.type.startsWith('image/'));
        const statusColor = jobStatusColors[job.ticket.statusHistory[0].status] || jobStatusColors['Completed'];

        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="relative aspect-video bg-slate-200 dark:bg-slate-700">
                    {firstImage?.dataUrl && (
                        <img src={firstImage.dataUrl} alt="Job photo" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: statusColor.base, color: statusColor.text }}>
                        Completed
                    </div>
                </div>
                <div className="p-4 flex-grow flex flex-col">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{job.contact.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{job.completedAt.toLocaleDateString()}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 flex-grow truncate">{job.ticket.notes}</p>
                    <button 
                        onClick={() => setSelectedJob(job)}
                        className="w-full mt-4 px-4 py-2 bg-sky-500 text-white font-medium rounded-md hover:bg-sky-600 transition-colors shadow-sm text-sm"
                    >
                        Create Social Post
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Social Media Assistant</h1>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">Turn your recent work into engaging social media posts with AI.</p>
                    </div>
                    <button 
                        onClick={() => setIsAiGeneratorOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-sm"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        <span>Generate AI Post</span>
                    </button>
                </div>

                <div className="p-4 sm:p-6 flex-grow">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Create Post from a Recent Job</h2>
                    {recentCompletedJobs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {recentCompletedJobs.map(job => (
                                <JobCard key={job.ticket.id} job={job} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full py-8">
                            <EmptyState 
                                Icon={MegaphoneIcon}
                                title="No Recent Completed Jobs"
                                message="Complete a job to start creating social media posts from your work."
                            />
                        </div>
                    )}
                </div>
            </div>
            {selectedJob && (
                <SocialPostCreatorModal 
                    job={selectedJob}
                    onClose={() => setSelectedJob(null)}
                />
            )}
            {isAiGeneratorOpen && (
                <AiPostGeneratorModal onClose={() => setIsAiGeneratorOpen(false)} />
            )}
        </>
    );
};

export default SocialView;