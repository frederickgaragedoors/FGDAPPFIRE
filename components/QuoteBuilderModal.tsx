import React, { useState, useEffect } from 'react';
import { Contact, Quote, QuoteOption, Part, CatalogItem } from '../types.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { XIcon, PlusIcon, TrashIcon, PencilSquareIcon } from './icons.tsx';
import { generateId } from '../utils.ts';

interface QuoteBuilderModalProps {
  contact: Contact;
  quoteId?: string;
  onClose: () => void;
}

const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({ contact, quoteId, onClose }) => {
    const { handleSaveQuote } = useContacts();
    const { businessInfo, partsCatalog } = useApp();
    
    const [title, setTitle] = useState('');
    const [options, setOptions] = useState<QuoteOption[]>([]);
    const [activeOptionId, setActiveOptionId] = useState<string | null>(null);

    useEffect(() => {
        const existingQuote = contact.quotes?.find(q => q.id === quoteId);
        if (existingQuote) {
            setTitle(existingQuote.title);
            setOptions(existingQuote.options.map(o => ({...o, parts: [...o.parts]}))); // Deep copy
            setActiveOptionId(existingQuote.options[0]?.id || null);
        } else {
            const newOptionId = generateId();
            setOptions([{ id: newOptionId, name: 'Standard Option', description: '', parts: [], laborCost: 0 }]);
            setActiveOptionId(newOptionId);
            setTitle('New Garage Door Quote');
        }
    }, [contact, quoteId]);
    
    const activeOption = options.find(o => o.id === activeOptionId);

    const handleOptionChange = (field: keyof QuoteOption, value: any) => {
        setOptions(prev => prev.map(o => o.id === activeOptionId ? { ...o, [field]: value } : o));
    };

    const addOption = () => {
        const newId = generateId();
        const newOption: QuoteOption = { id: newId, name: `Option ${options.length + 1}`, description: '', parts: [], laborCost: 0 };
        setOptions(prev => [...prev, newOption]);
        setActiveOptionId(newId);
    };
    
    const removeOption = (id: string) => {
        if (options.length <= 1) return;
        const newOptions = options.filter(o => o.id !== id);
        setOptions(newOptions);
        if (activeOptionId === id) {
            setActiveOptionId(newOptions[0].id);
        }
    };
    
    const addPart = () => {
        const newPart: Part = { id: generateId(), name: '', cost: 0, quantity: 1 };
        handleOptionChange('parts', [...(activeOption?.parts || []), newPart]);
    };

    const handlePartChange = (partId: string, field: keyof Part, value: any) => {
        const updatedParts = (activeOption?.parts || []).map(p => 
            p.id === partId ? { ...p, [field]: value } : p
        );
        handleOptionChange('parts', updatedParts);
    };

    const removePart = (partId: string) => {
        handleOptionChange('parts', (activeOption?.parts || []).filter(p => p.id !== partId));
    };
    
    const handleQuickAddPart = (catalogItemId: string) => {
        const item = partsCatalog.find(i => i.id === catalogItemId);
        if (item) {
            const newPart: Part = { id: generateId(), name: item.name, cost: item.defaultCost, quantity: 1 };
            handleOptionChange('parts', [...(activeOption?.parts || []), newPart]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const quoteToSave: Quote = {
            id: quoteId || generateId(),
            quoteNumber: (contact.quotes?.find(q => q.id === quoteId)?.quoteNumber) || generateId(),
            title,
            createdAt: (contact.quotes?.find(q => q.id === quoteId)?.createdAt) || new Date().toISOString(),
            status: (contact.quotes?.find(q => q.id === quoteId)?.status) || 'Draft',
            options,
            salesTaxRate: businessInfo.defaultSalesTaxRate || 0,
            processingFeeRate: businessInfo.defaultProcessingFeeRate || 0,
        };
        handleSaveQuote(contact.id, quoteToSave);
        onClose();
    };
    
    const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300";

    return (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-40 flex flex-col" role="dialog" aria-modal="true">
            <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
                <header className="p-4 border-b dark:border-slate-700 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{quoteId ? 'Edit Quote' : 'New Quote'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">For: {contact.name}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                             <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">
                                Save Quote
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                    {/* Left Panel: Options List */}
                    <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col">
                         <div className="p-4">
                            <label htmlFor="quote-title" className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Quote Title</label>
                            <input id="quote-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={`mt-1 ${inputStyles}`} required />
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                             <button type="button" onClick={addOption} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                                <PlusIcon className="w-4 h-4" /> Add Option
                            </button>
                        </div>
                        <ul className="flex-grow overflow-y-auto p-2">
                            {options.map(option => (
                                <li key={option.id}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveOptionId(option.id)}
                                        className={`w-full text-left p-3 rounded-md flex justify-between items-center ${activeOptionId === option.id ? 'bg-sky-100 dark:bg-sky-900/50' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                        <span className={`font-medium ${activeOptionId === option.id ? 'text-sky-800 dark:text-sky-200' : ''}`}>{option.name}</span>
                                        {options.length > 1 && (
                                            <button type="button" onClick={(e) => { e.stopPropagation(); removeOption(option.id); }} className="p-1 rounded-full text-slate-400 hover:text-red-500">
                                                <XIcon className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Panel: Option Details */}
                    {activeOption && (
                        <div className="flex-grow p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="option-name" className={labelStyles}>Option Name</label>
                                    <input id="option-name" type="text" value={activeOption.name} onChange={e => handleOptionChange('name', e.target.value)} className={`mt-1 ${inputStyles}`} required />
                                </div>
                                <div>
                                    <label htmlFor="labor-cost" className={labelStyles}>Labor Cost</label>
                                    <div className="relative mt-1">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 sm:text-sm">$</span></div>
                                        <input type="number" id="labor-cost" value={activeOption.laborCost} onChange={(e) => handleOptionChange('laborCost', parseFloat(e.target.value) || 0)} className={`${inputStyles} pl-7`} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="description" className={labelStyles}>Description / Included Work</label>
                                <textarea id="description" value={activeOption.description} onChange={e => handleOptionChange('description', e.target.value)} rows={4} className={`mt-1 ${inputStyles}`} placeholder="e.g., Includes removal of old door, installation of new door, and all hardware..."></textarea>
                            </div>

                             <div>
                                <h3 className="text-md font-semibold text-slate-800 dark:text-slate-100 mb-2">Parts & Materials</h3>
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <div className="mb-4">
                                        <label htmlFor="part-select" className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Quick Add from Catalog</label>
                                        <select id="part-select" onChange={e => { handleQuickAddPart(e.target.value); (e.target as HTMLSelectElement).value = ''; }} className={`mt-1 ${inputStyles}`} value="">
                                            <option value="">Select a part...</option>
                                            {partsCatalog?.slice().sort((a, b) => a.name.localeCompare(b.name)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        {(activeOption.parts || []).map(part => (
                                            <div key={part.id} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px_40px] gap-2 items-center">
                                                <input type="text" placeholder="Part Name" value={part.name} onChange={(e) => handlePartChange(part.id, 'name', e.target.value)} className={inputStyles} />
                                                <input type="number" value={part.quantity} onChange={(e) => handlePartChange(part.id, 'quantity', parseInt(e.target.value) || 1)} className={`${inputStyles} text-center`} min="1" />
                                                <div className="relative">
                                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 sm:text-sm">$</span></div>
                                                    <input type="number" value={part.cost} onChange={(e) => handlePartChange(part.id, 'cost', parseFloat(e.target.value) || 0)} className={`${inputStyles} pl-7 pr-2`} />
                                                </div>
                                                <button type="button" onClick={() => removePart(part.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={addPart} className="mt-3 flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-sky-600 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-800">
                                        <PlusIcon className="w-4 h-4 mr-2" /> Add Part Manually
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default QuoteBuilderModal;