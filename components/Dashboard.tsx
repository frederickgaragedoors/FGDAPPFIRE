import React, { useMemo } from 'react';
import { JobTicket, jobStatusColors, JobStatus, paymentStatusColors, paymentStatusLabels, StatusHistoryEntry } from '../types.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import EmptyState from './EmptyState.tsx';
import { ClipboardListIcon } from './icons.tsx';
import { formatTime, getLocalDateString } from '../utils.ts';

interface DashboardProps {
    onViewJobDetail: (contactId: string, ticketId: string) => void;
}

// FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
type JobWithContact = JobTicket & {
    contactId: string;
    contactName: string;
    effectiveDate: Date; // Normalized date for filtering
    displayDate: Date; // Full date object for display
    effectiveTime?: string;
    status: JobStatus;
};

const Dashboard: React.FC<DashboardProps> = ({ onViewJobDetail }) => {
    const { contacts } = useContacts();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const allJobs = useMemo<JobWithContact[]>(() => {
        return (contacts || []).flatMap(contact => 
            (contact.jobTickets || []).map((ticket): JobWithContact | null => {
                // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
                const history = ticket.statusHistory && ticket.statusHistory.length > 0
                    ? [...ticket.statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    : (ticket.createdAt ? [{ status: 'Job Created' as JobStatus, timestamp: ticket.createdAt, id: 'fallback' }] as StatusHistoryEntry[] : []);
                
                if (history.length === 0) return null;
                
                const latestStatusEntry = history[0];
                const timestamp = latestStatusEntry.timestamp;
                const hasTimeInLatestStatus = timestamp.includes('T');
                
                const displayDate = hasTimeInLatestStatus ? new Date(timestamp) : new Date(`${timestamp}T00:00:00`);
                
                // Normalize date part for filtering based on local date
                const effectiveDate = new Date(displayDate.getFullYear(), displayDate.getMonth(), displayDate.getDate());
                const effectiveDateString = getLocalDateString(effectiveDate);

                // Find the most recent "scheduling" status *on the job's effective day* to act as the appointment time.
                const scheduledEntry = history.find(h => 
                    (h.status === 'Scheduled' || h.status === 'Estimate Scheduled') &&
                    getLocalDateString(new Date(h.timestamp)) === effectiveDateString
                );

                // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
                let effectiveTime: string | undefined;

                if (scheduledEntry && scheduledEntry.timestamp.includes('T')) {
                    // Use the time from that specific scheduled status entry, converting to local time.
                    const d = new Date(scheduledEntry.timestamp);
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    effectiveTime = `${hours}:${minutes}`;
                } else {
                    const latestEntryWithTime = history.find(h => h.timestamp.includes('T'));
                    if (latestEntryWithTime) {
                        const d = new Date(latestEntryWithTime.timestamp);
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        effectiveTime = `${hours}:${minutes}`;
                    }
                }

                return {
                    ...ticket,
                    status: latestStatusEntry.status,
                    contactId: contact.id,
                    contactName: contact.name,
                    effectiveDate, // The normalized date for filtering
                    displayDate, // The full date object for display
                    effectiveTime,
                };
            }).filter((job): job is JobWithContact => job !== null)
        );
    }, [contacts]);

    const jobsAwaitingParts = useMemo(() => {
        return allJobs
            .filter(job => job.status === 'Awaiting Parts')
            .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    }, [allJobs]);
    
    // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
    const statusOrder: Record<JobStatus, number> = {
        'Job Created': 0,
        'Estimate Scheduled': 1,
        'Scheduled': 2,
        'In Progress': 3,
        'Quote Sent': 4,
        'Awaiting Parts': 5,
        'Supplier Run': 5,
        'Completed': 6,
        'Paid': 7,
        'Declined': 8,
    };

    const todaysJobs = useMemo(() => {
        return allJobs
            // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
            .filter(job => {
                return (job.status === 'Estimate Scheduled' || job.status === 'Scheduled' || job.status === 'In Progress') &&
                       job.effectiveDate.getTime() === today.getTime();
            })
            // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
            .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    }, [allJobs, today]);

    const tomorrowsJobs = useMemo(() => {
        return allJobs
            // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
            .filter(job => {
                return (job.status === 'Estimate Scheduled' || job.status === 'Scheduled' || job.status === 'In Progress') &&
                       job.effectiveDate.getTime() === tomorrow.getTime();
            })
            // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
            .sort((a, b) => {
                // Sort by time, then status
                const timeA = a.effectiveTime || '23:59';
                const timeB = b.effectiveTime || '23:59';
                if (timeA !== timeB) return timeA.localeCompare(timeB);
                return statusOrder[a.status] - statusOrder[b.status];
            });
    }, [allJobs, tomorrow]);

    const quotesToFollowUp = useMemo(() => {
        return allJobs.filter(job => {
            // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
            return job.status === 'Quote Sent' && job.effectiveDate.getTime() <= threeDaysAgo.getTime();
        }).sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    }, [allJobs, threeDaysAgo]);

    const upcomingWork = useMemo(() => {
        return allJobs
            // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
            .filter(job => {
                 // Filter for jobs strictly AFTER tomorrow
                 return (job.status === 'Scheduled' || job.status === 'Estimate Scheduled') && job.effectiveDate.getTime() > tomorrow.getTime();
            })
            .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    }, [allJobs, tomorrow]);

    const JobCard: React.FC<{ job: JobWithContact }> = ({ job }) => {
        // FIX: This commit resolves multiple TypeScript errors by updating the component to derive job status from the `statusHistory` array, aligning with the refactored data model. It introduces a `JobWithContact` type with a `status` property, fixes fallback logic for jobs without a full history, and correctly determines a job's effective time. Additionally, the status sorting order now includes 'Job Created' to prevent runtime errors.
        const statusColor = jobStatusColors[job.status];
        const paymentStatus = job.paymentStatus || 'unpaid';
        const paymentStatusColor = paymentStatusColors[paymentStatus];
        const paymentStatusLabel = paymentStatusLabels[paymentStatus];

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onViewJobDetail(job.contactId, job.id);
            }
        };

        return (
            <li 
                onClick={() => onViewJobDetail(job.contactId, job.id)}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-sky-500 dark:hover:border-sky-500 cursor-pointer card-hover outline-none focus:ring-2 focus:ring-sky-500"
            >
                <div className="flex justify-between items-start space-x-2">
                    <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{job.contactName}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {job.displayDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            {job.effectiveTime && <span className="ml-1 text-slate-500 font-normal">at {formatTime(job.effectiveTime)}</span>}
                        </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                         <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${statusColor.base} ${statusColor.text}`}>
                            {job.status}
                        </span>
                         <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${paymentStatusColor.base} ${paymentStatusColor.text}`}>
                            {paymentStatusLabel}
                        </span>
                    </div>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 truncate">{job.notes}</p>
            </li>
        );
    };

    const Section: React.FC<{ title: string; jobs: JobWithContact[]; emptyMessage: string }> = ({ title, jobs, emptyMessage }) => (
        <section>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">{title}</h2>
            {jobs.length > 0 ? (
                <ul className="space-y-3">
                    {jobs.map(job => <JobCard key={job.id} job={job} />)}
                </ul>
            ) : (
                 <p className="text-center text-slate-500 dark:text-slate-400 py-6 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">{emptyMessage}</p>
            )}
        </section>
    );

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 3 && hour < 12) return 'Good Morning';
        if (hour >= 12 && hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
            <div className="px-4 sm:px-6 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{getGreeting()}!</h1>
                <p className="mt-1 text-slate-500 dark:text-slate-400">Here's a summary of your business activity.</p>
            </div>
            <div className="px-4 sm:px-6 py-6 flex-grow">
                {allJobs.length > 0 ? (
                    <div className="max-w-7xl mx-auto w-full space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section 
                                title="Today's Work" 
                                jobs={todaysJobs} 
                                emptyMessage="Nothing scheduled for today." 
                            />
                            <Section 
                                title="Tomorrow's Work" 
                                jobs={tomorrowsJobs} 
                                emptyMessage="Nothing scheduled for tomorrow." 
                            />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section 
                                title="Upcoming Work" 
                                jobs={upcomingWork} 
                                emptyMessage="No other upcoming jobs scheduled." 
                            />
                            <Section 
                                title="Awaiting Parts" 
                                jobs={jobsAwaitingParts} 
                                emptyMessage="No jobs are awaiting parts." 
                            />
                        </div>
                        <div>
                            <Section 
                                title="Follow-Ups Required" 
                                jobs={quotesToFollowUp} 
                                emptyMessage="No quotes need follow-up." 
                            />
                        </div>
                    </div>
                ) : (
                    <EmptyState 
                        Icon={ClipboardListIcon}
                        title="No Jobs Found"
                        message="Get started by adding a job to one of your contacts."
                    />
                )}
            </div>
        </div>
    );
};

export default Dashboard;