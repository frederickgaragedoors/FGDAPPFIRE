
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Contact, FileAttachment, CustomField, DefaultFieldSetting, JobTicket, DoorProfile } from '../types.ts';
import { UserCircleIcon, ArrowLeftIcon, FileIcon, TrashIcon, PlusIcon } from './icons.tsx';
import { fileToDataUrl, formatFileSize, generateId } from '../utils.ts';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

// Declare google for TS
declare const google: any;

interface ContactFormProps {
  initialContact?: Contact;
  onSave: (contactData: Omit<Contact, 'id'>) => void;
  onCancel: () => void;
  defaultFields?: DefaultFieldSetting[];
  initialJobDate?: string;
  apiKey?: string;
}

const ContactForm: React.FC<ContactFormProps> = ({ initialContact, onSave, onCancel, defaultFields, initialJobDate, apiKey }) => {
  const [name, setName] = useState(initialContact?.name || '');
  const [email, setEmail] = useState(initialContact?.email || '');
  const [phone, setPhone] = useState(initialContact?.phone || '');
  const [address, setAddress] = useState(initialContact?.address || '');
  const [photoUrl, setPhotoUrl] = useState(initialContact?.photoUrl || '');
  const [files, setFiles] = useState<FileAttachment[]>(initialContact?.files || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(
    initialContact?.customFields || defaultFields?.map(df => ({ id: generateId(), label: df.label, value: '' })) || []
  );
  
  const addressInputRef = useRef<HTMLInputElement>(null);
  const { isLoaded: isMapsLoaded } = useGoogleMaps(apiKey);

  const [doorProfiles, setDoorProfiles] = useState<DoorProfile[]>(() => {
      if (initialContact?.doorProfiles) {
          return initialContact.doorProfiles.map(p => ({
              ...p,
              doorInstallDate: p.doorInstallDate || (p as any).installDate || 'Unknown',
              springInstallDate: p.springInstallDate || (p as any).installDate || 'Unknown',
              openerInstallDate: p.openerInstallDate || (p as any).installDate || 'Unknown',
              springs: p.springs || (p.springSize ? [{ id: generateId(), size: p.springSize }] : [{ id: generateId(), size: '' }])
          }));
      }
      if ((initialContact as any)?.doorProfile) {
          const oldP = (initialContact as any).doorProfile;
          return [{ 
              ...oldP, 
              id: generateId(),
              doorInstallDate: oldP.installDate || 'Unknown',
              springInstallDate: oldP.installDate || 'Unknown',
              openerInstallDate: oldP.installDate || 'Unknown',
              springs: [{ id: generateId(), size: oldP.springSize || '' }]
            }];
      }
      return [{
        id: generateId(),
        dimensions: '',
        doorType: '',
        springSystem: '',
        springSize: '',
        springs: [{ id: generateId(), size: '' }],
        openerBrand: '',
        openerModel: '',
        doorInstallDate: 'Unknown',
        springInstallDate: 'Unknown',
        openerInstallDate: 'Unknown'
      }];
  });

  const [stagedFiles, setStagedFiles] = useState<FileAttachment[]>([]);

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    if (isMapsLoaded && addressInputRef.current && (window as any).google && (window as any).google.maps) {
        const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInputRef.current, {
            fields: ['formatted_address', 'geometry', 'name'],
        });
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
                setAddress(place.formatted_address);
            } else if (place.name) {
                setAddress(place.name);
            }
        });
    }
  }, [isMapsLoaded]);

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        const dataUrl = await fileToDataUrl(file);
        setPhotoUrl(dataUrl);
      } catch (error) {
        console.error("Error reading photo:", error);
        alert("There was an error processing the photo. It might be too large or corrupted.");
      }
    }
    input.value = '';
  }, []);

  const handleFilesChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (input.files) {
      try {
        const newFilesPromises = Array.from(input.files).map(async (file: File) => {
          const dataUrl = await fileToDataUrl(file);
          return {
            id: generateId(),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: dataUrl,
          };
        });
        const newFiles = await Promise.all(newFilesPromises);
        setStagedFiles(prevFiles => [...prevFiles, ...newFiles]);
      } catch (error) {
        console.error("Error reading files:", error);
        alert("There was an error processing your files. They might be too large or corrupted.");
      }
    }
    input.value = '';
  }, []);

  const removeFile = (id: string, isStaged: boolean) => {
    if (isStaged) {
        setStagedFiles(stagedFiles.filter(file => file.id !== id));
    } else {
        setFiles(files.filter(file => file.id !== id));
    }
  };
  
  const handleCustomFieldChange = (id: string, field: 'label' | 'value', value: string) => {
    setCustomFields(customFields.map(cf => cf.id === id ? { ...cf, [field]: value } : cf));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { id: generateId(), label: '', value: '' }]);
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(cf => cf.id !== id));
  };

  const handleDoorProfileChange = (id: string, field: keyof DoorProfile, value: string) => {
    setDoorProfiles(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSpringCountChange = (profileId: string, count: number) => {
      const newCount = Math.max(1, Math.min(4, count)); // Limit between 1 and 4 for UI sanity
      setDoorProfiles(prev => prev.map(p => {
          if (p.id !== profileId) return p;
          
          const currentSprings = p.springs || [];
          if (newCount > currentSprings.length) {
              // Add springs
              const toAdd = newCount - currentSprings.length;
              const newSprings = Array.from({ length: toAdd }, () => ({ id: generateId(), size: '' }));
              return { ...p, springs: [...currentSprings, ...newSprings] };
          } else if (newCount < currentSprings.length) {
              // Remove springs from the end
              return { ...p, springs: currentSprings.slice(0, newCount) };
          }
          return p;
      }));
  };

  const handleSpringSizeChange = (profileId: string, springId: string, value: string) => {
      setDoorProfiles(prev => prev.map(p => {
          if (p.id !== profileId) return p;
          return {
              ...p,
              springs: (p.springs || []).map(s => s.id === springId ? { ...s, size: value } : s)
          };
      }));
  };

  const addDoorProfile = () => {
      setDoorProfiles(prev => [...prev, {
        id: generateId(),
        dimensions: '',
        doorType: '',
        springSystem: '',
        springSize: '',
        springs: [{ id: generateId(), size: '' }],
        openerBrand: '',
        openerModel: '',
        doorInstallDate: 'Unknown',
        springInstallDate: 'Unknown',
        openerInstallDate: 'Unknown'
      }]);
  };

  const removeDoorProfile = (id: string) => {
      setDoorProfiles(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFiles = [...files, ...stagedFiles];
    
    let initialJobTickets: JobTicket[] = initialContact?.jobTickets || [];
    
    if (initialJobDate && !initialContact) {
        initialJobTickets = [{
            id: generateId(),
            date: initialJobDate,
            status: 'Estimate Scheduled',
            notes: '',
            parts: [],
            laborCost: 0,
            createdAt: new Date().toISOString()
        }];
    }

    // Sync legacy springSize field with first spring for backward compatibility
    const processedProfiles = doorProfiles.map(p => ({
        ...p,
        springSize: p.springs && p.springs.length > 0 ? p.springs[0].size : ''
    }));

    const finalDoorProfiles = processedProfiles.filter(p => 
        p.dimensions || p.doorType || p.springSystem || p.openerBrand || p.openerModel
    );

    onSave({ 
        name, 
        email, 
        phone, 
        address, 
        photoUrl, 
        files: finalFiles, 
        customFields, 
        jobTickets: initialJobTickets,
        doorProfiles: finalDoorProfiles
    });
  };

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white";
  const labelClass = "block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1";

  const renderDateInput = (label: string, profileId: string, field: keyof DoorProfile, value: string) => {
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const selectValue = isDate ? 'date' : (value === 'Original' ? 'Original' : 'Unknown');

      const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const selection = e.target.value;
          if (selection === 'date') {
              handleDoorProfileChange(profileId, field, new Date().toISOString().split('T')[0]);
          } else {
              handleDoorProfileChange(profileId, field, selection);
          }
      };

      return (
          <div>
              <label className={labelClass}>{label}</label>
              <div className="flex space-x-2">
                  <select value={selectValue} onChange={handleSelectChange} className={`${inputClass} w-1/2`}>
                      <option value="Unknown">Unknown</option>
                      <option value="Original">Original</option>
                      <option value="date">Specific Date</option>
                  </select>
                  {isDate && (
                      <input 
                        type="date" 
                        value={value} 
                        onChange={e => handleDoorProfileChange(profileId, field, e.target.value)} 
                        className={`${inputClass} w-1/2`} 
                      />
                  )}
              </div>
          </div>
      );
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col bg-white dark:bg-slate-800 overflow-y-auto">
      <div className="p-4 flex items-center border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
        <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden">
            <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        </button>
        <h2 className="ml-4 flex-grow font-bold text-lg text-slate-700 dark:text-slate-200">
          {initialContact ? 'Edit Contact' : 'New Contact'}
        </h2>
        <div className="flex space-x-2">
            <button type="button" onClick={onCancel} className="hidden md:inline px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save</button>
        </div>
      </div>
      
      {initialJobDate && !initialContact && (
        <div className="px-4 sm:px-6 pt-6">
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-md p-3 text-sm text-sky-800 dark:text-sky-200">
                This new contact will be automatically scheduled for a job on <strong>{new Date(initialJobDate).toLocaleDateString()}</strong>.
            </div>
        </div>
      )}
      
      <div className="px-4 sm:px-6 py-6 flex-grow">
        {/* 2-Column Grid on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* Left Column: Contact Info */}
            <div>
                <div className="mb-4">
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Contact Details</h3>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-lg p-6">
                    {/* Photo */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="relative w-24 h-24">
                            {photoUrl ? (
                                <img src={photoUrl} alt="Contact" className="w-24 h-24 rounded-full object-cover ring-2 ring-white dark:ring-slate-600 shadow-sm" />
                            ) : (
                                <UserCircleIcon className="w-24 h-24 text-slate-300 dark:text-slate-500" />
                            )}
                            <label htmlFor="photo-upload" className="absolute -bottom-1 -right-1 p-2 bg-sky-500 text-white rounded-full cursor-pointer hover:bg-sky-600 transition-colors shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            </label>
                        </div>
                    </div>

                    {/* Basic Inputs */}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Full Name</label>
                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Email</label>
                            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Phone</label>
                            <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Address</label>
                            <input 
                                ref={addressInputRef}
                                type="text"
                                id="address" 
                                value={address} 
                                onChange={e => setAddress(e.target.value)} 
                                onKeyDown={e => { if(e.key === 'Enter') e.preventDefault(); }}
                                placeholder=""
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white"
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {/* Custom Fields */}
                    <div className="border-t border-slate-200 dark:border-slate-600 mt-6 pt-6">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Custom Fields</h4>
                        <div className="space-y-4">
                            {customFields.map((field) => (
                                <div key={field.id} className="flex items-end space-x-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Label</label>
                                        <input type="text" value={field.label} onChange={(e) => handleCustomFieldChange(field.id, 'label', e.target.value)} placeholder="e.g. Company" className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm dark:text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Value</label>
                                        <input type="text" value={field.value} onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)} placeholder="e.g. Acme Corp" className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm dark:text-white" />
                                    </div>
                                    <button type="button" onClick={() => removeCustomField(field.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addCustomField} className="mt-4 flex items-center px-3 py-2 rounded-md text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors">
                            <PlusIcon className="w-4 h-4 mr-2" /> Add Field
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: Door Profiles */}
            <div>
                <div className="flex items-center justify-between mb-4 pt-6 lg:pt-0 border-t lg:border-t-0 dark:border-slate-700">
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Door/System Profiles</h3>
                </div>
                <div className="space-y-6">
                    {doorProfiles.map((profile, index) => (
                        <div key={profile.id} className="relative p-4 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {doorProfiles.length > 1 ? `Door System #${index + 1}` : 'Primary Door System'}
                                </h4>
                                <button 
                                    type="button" 
                                    onClick={() => removeDoorProfile(profile.id)} 
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    title="Remove this profile"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Door Details */}
                            <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-600">
                                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Door Details</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Dimensions (WxH)</label>
                                        <input type="text" placeholder="e.g. 16x7" value={profile.dimensions} onChange={e => handleDoorProfileChange(profile.id, 'dimensions', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Door Type</label>
                                        <select value={profile.doorType} onChange={e => handleDoorProfileChange(profile.id, 'doorType', e.target.value)} className={inputClass}>
                                            <option value="">Select Type...</option>
                                            <option value="Sectional">Sectional</option>
                                            <option value="One-piece">One-piece</option>
                                            <option value="Rolling Steel">Rolling Steel</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        {renderDateInput("Door Install Date", profile.id, 'doorInstallDate', profile.doorInstallDate)}
                                    </div>
                                </div>
                            </div>

                            {/* Spring Details */}
                            <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-600">
                                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Spring Details</h5>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>System</label>
                                            <select value={profile.springSystem} onChange={e => handleDoorProfileChange(profile.id, 'springSystem', e.target.value)} className={inputClass}>
                                                <option value="">Select...</option>
                                                <option value="Torsion">Torsion</option>
                                                <option value="Extension">Extension</option>
                                                <option value="TorqueMaster">TorqueMaster</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}># Springs</label>
                                            <select 
                                                value={profile.springs?.length || 1} 
                                                onChange={e => handleSpringCountChange(profile.id, parseInt(e.target.value))} 
                                                className={inputClass}
                                            >
                                                <option value="1">1</option>
                                                <option value="2">2</option>
                                                <option value="3">3</option>
                                                <option value="4">4</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        {profile.springs && profile.springs.map((spring, idx) => (
                                            <div key={spring.id} className="mb-2 last:mb-0">
                                                <label className={labelClass}>Spring #{idx + 1} Size</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. .250 x 2 x 32" 
                                                    value={spring.size} 
                                                    onChange={e => handleSpringSizeChange(profile.id, spring.id, e.target.value)} 
                                                    className={inputClass} 
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        {renderDateInput("Spring Install Date", profile.id, 'springInstallDate', profile.springInstallDate)}
                                    </div>
                                </div>
                            </div>

                            {/* Opener Details */}
                            <div>
                                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Opener Details</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Opener Brand</label>
                                        <input type="text" placeholder="e.g. LiftMaster" value={profile.openerBrand} onChange={e => handleDoorProfileChange(profile.id, 'openerBrand', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Opener Model</label>
                                        <input type="text" placeholder="e.g. 8550W" value={profile.openerModel} onChange={e => handleDoorProfileChange(profile.id, 'openerModel', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        {renderDateInput("Opener Install Date", profile.id, 'openerInstallDate', profile.openerInstallDate)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addDoorProfile} className="mt-4 w-full flex justify-center items-center px-4 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <PlusIcon className="w-4 h-4 mr-2" /> Add Another Door
                </button>
            </div>
        </div>

        {/* Full Width Attachments */}
        <div className="mt-8 border-t dark:border-slate-700 pt-6">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Attachments</h3>
             <div className="mt-4 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <FileIcon className="mx-auto h-12 w-12 text-slate-400"/>
                  <div className="flex text-sm text-slate-600 dark:text-slate-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-sky-500">
                      <span>Upload files</span>
                      <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={handleFilesChange}/>
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">Any file type</p>
                </div>
              </div>
        </div>

        {files.length > 0 && (
          <div className="mt-4">
             <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">Current Attachments</h4>
             <ul className="mt-2 space-y-2">
                {files.map(file => (
                  <li key={file.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 p-2 bg-slate-100 dark:bg-slate-700 rounded-md shadow-sm">
                    <FileIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                    <button type="button" onClick={() => removeFile(file.id, false)} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
             </ul>
          </div>
        )}

        {stagedFiles.length > 0 && (
          <div className="mt-4">
             <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">Staged Files for Upload</h4>
             <ul className="mt-2 space-y-2 p-3 bg-sky-50 dark:bg-sky-900/50 rounded-md">
                {stagedFiles.map(file => (
                  <li key={file.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 p-2 bg-white dark:bg-slate-700 rounded-md shadow-sm">
                    <FileIcon className="w-5 h-5 text-sky-500" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                    <button type="button" onClick={() => removeFile(file.id, true)} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
             </ul>
          </div>
        )}
      </div>
    </form>
  );
};

export default ContactForm;
