import React, { useState, useEffect } from 'react';
import { JobStatus, StatusHistoryEntry, ALL_JOB_STATUSES } from '../types.ts';
import { XIcon } from './icons.tsx';

interface StatusUpdateModalProps {
  entry?: StatusHistoryEntry | null;
  onSave: (entry: Omit<StatusHistoryEntry, 'id'> & { id?: string }) => void;
  onClose: () => void;
  enabledStatuses?: Record<JobStatus, boolean>;
}

const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({ entry, onSave, onClose, enabledStatuses }) => {
  const [status, setStatus] = useState<JobStatus>('Estimate Scheduled');
  const [timestamp, setTimestamp] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<number | ''>('');

  useEffect(() => {
    if (entry) {
      setStatus(entry.status);
      setTimestamp(entry.timestamp.substring(0, 16)); // Format for datetime-local input
      setNotes(entry.notes || '');
      setDuration(entry.duration || '');
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setTimestamp(now.toISOString().slice(0, 16));
      setStatus('Estimate Scheduled');
      setNotes('');
      setDuration('');
    }
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: entry?.id,
      status,
      timestamp: new Date(timestamp).toISOString(),
      notes,
      duration: (duration !== '' && duration !== null) ? Number(duration) : 60,
    });
  };

  const visibleStatuses = ALL_JOB_STATUSES.filter(s => 
    (enabledStatuses ? enabledStatuses[s] : true) || (entry && entry.status === s)
  );

  const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
  const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
          <div className="p-6 border-b dark:border-slate-700 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{entry ? 'Edit Status' : 'Update Status'}</h2>
              <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label htmlFor="status" className={labelStyles}>Status</label>
              <select id="status" value={status} onChange={e => setStatus(e.target.value as JobStatus)} className={`mt-1 ${inputStyles}`}>
                {visibleStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="timestamp" className={labelStyles}>Date & Time</label>
                    <input type="datetime-local" id="timestamp" value={timestamp} onChange={e => setTimestamp(e.target.value)} required className={`mt-1 ${inputStyles}`} />
                </div>
                 <div>
                    <label htmlFor="duration" className={labelStyles}>Duration (min)</label>
                    <input
                        type="number"
                        id="duration"
                        value={duration}
                        onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className={`mt-1 ${inputStyles}`}
                        placeholder="60"
                    />
                </div>
            </div>
            <div>
              <label htmlFor="status-notes" className={labelStyles}>Notes (Optional)</label>
              <textarea id="status-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`mt-1 ${inputStyles}`} placeholder="Add details about this status change..."></textarea>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-end items-center rounded-b-lg border-t dark:border-slate-700">
            <div className="flex space-x-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusUpdateModal;
