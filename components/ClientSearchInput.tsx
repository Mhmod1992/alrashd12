import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Client } from '../types';
import { useAppContext } from '../context/AppContext';
import { cleanSaudiPhoneNumber, formatPhoneNumberDisplay } from '../lib/utils';
import RefreshCwIcon from './icons/RefreshCwIcon';
import SearchIcon from './icons/SearchIcon';
import UserCheckIcon from './icons/UserCheckIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface ClientSearchInputProps {
    clientName: string;
    clientPhone: string;
    onNameChange: (name: string) => void;
    onPhoneChange: (phone: string) => void;
    selectedClientId?: string | null;
    onSelectClient?: (client: Client) => void;
    onClearSelection?: () => void;
    disabled?: boolean;
}

export const ClientSearchInput: React.FC<ClientSearchInputProps> = ({
    clientName,
    clientPhone,
    onNameChange,
    onPhoneChange,
    selectedClientId,
    onSelectClient,
    onClearSelection,
    disabled = false
}) => {
    const { clients, searchClients } = useAppContext();

    const [isPhoneFocused, setIsPhoneFocused] = useState(false);
    const [isNameFocused, setIsNameFocused] = useState(false);
    const [isSearchingPhone, setIsSearchingPhone] = useState(false);
    const [isSearchingName, setIsSearchingName] = useState(false);
    const [phoneSuggestions, setPhoneSuggestions] = useState<Client[]>([]);
    const [nameSuggestions, setNameSuggestions] = useState<Client[]>([]);
    const [activePhoneIndex, setActivePhoneIndex] = useState(-1);
    const [activeNameIndex, setActiveNameIndex] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<number | null>(null);

    // Find if the currently entered phone matches an existing client
    const matchedClient = useMemo(() => {
        if (selectedClientId) {
            const found = clients.find(c => c.id === selectedClientId);
            if (found) return found;
        }
        const cleaned = clientPhone.replace(/\D/g, '');
        if (cleaned.length >= 9) {
            const last9 = cleaned.slice(-9);
            return clients.find(c => c.phone && c.phone.replace(/\D/g, '').endsWith(last9));
        }
        return null;
    }, [selectedClientId, clientPhone, clients]);

    // Handle outside click to close suggestions
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsPhoneFocused(false);
                setIsNameFocused(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    // Perform phone search (local memory first + debounced database search)
    const handlePhoneChange = useCallback((rawVal: string) => {
        const digits = cleanSaudiPhoneNumber(rawVal);

        onPhoneChange(digits);
        setActivePhoneIndex(-1);

        if (digits.length < 9) {
            setPhoneSuggestions([]);
            return;
        }

        // 1. Immediate local matching from cached clients
        const lastDigits = digits.slice(-9);
        const localMatches = clients.filter(c => {
            const p = (c.phone || '').replace(/\D/g, '');
            return p.includes(digits) || (lastDigits.length >= 9 && p.endsWith(lastDigits));
        }).slice(0, 8);

        setPhoneSuggestions(localMatches);

        // 2. Debounced remote query if searchClients is available
        if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
        }

        if (searchClients && digits.length >= 9) {
            setIsSearchingPhone(true);
            debounceTimerRef.current = window.setTimeout(async () => {
                try {
                    const remoteMatches = await searchClients(digits);
                    if (Array.isArray(remoteMatches)) {
                        // Merge and deduplicate
                        setPhoneSuggestions(prev => {
                            const map = new Map<string, Client>();
                            localMatches.forEach(c => map.set(c.id, c));
                            remoteMatches.forEach(c => map.set(c.id, c));
                            return Array.from(map.values()).slice(0, 8);
                        });
                    }
                } catch (err) {
                    console.error("Client phone search error:", err);
                } finally {
                    setIsSearchingPhone(false);
                }
            }, 250);
        }
    }, [clients, searchClients, onPhoneChange]);

    // Perform name search (local memory first + debounced database search)
    const handleNameChange = useCallback((rawVal: string) => {
        const val = rawVal;
        onNameChange(val);
        setActiveNameIndex(-1);

        const trimmed = val.trim();
        if (trimmed.length < 2) {
            setNameSuggestions([]);
            return;
        }

        // 1. Immediate local matching
        const lower = trimmed.toLowerCase();
        const localMatches = clients.filter(c => 
            c.name && c.name.toLowerCase().includes(lower)
        ).slice(0, 8);

        setNameSuggestions(localMatches);

        // 2. Debounced remote query
        if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
        }

        if (searchClients && trimmed.length >= 2) {
            setIsSearchingName(true);
            debounceTimerRef.current = window.setTimeout(async () => {
                try {
                    const remoteMatches = await searchClients(trimmed);
                    if (Array.isArray(remoteMatches)) {
                        setNameSuggestions(prev => {
                            const map = new Map<string, Client>();
                            localMatches.forEach(c => map.set(c.id, c));
                            remoteMatches.forEach(c => map.set(c.id, c));
                            return Array.from(map.values()).slice(0, 8);
                        });
                    }
                } catch (err) {
                    console.error("Client name search error:", err);
                } finally {
                    setIsSearchingName(false);
                }
            }, 250);
        }
    }, [clients, searchClients, onNameChange]);

    // Handle selection of a client from suggestions
    const selectClient = (client: Client) => {
        onNameChange(client.name);
        onPhoneChange(client.phone || '');
        if (onSelectClient) {
            onSelectClient(client);
        }
        setIsPhoneFocused(false);
        setIsNameFocused(false);
        setPhoneSuggestions([]);
        setNameSuggestions([]);
    };

    // Keyboard navigation for phone input
    const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isPhoneFocused || phoneSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivePhoneIndex(prev => (prev < phoneSuggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivePhoneIndex(prev => (prev > 0 ? prev - 1 : phoneSuggestions.length - 1));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (activePhoneIndex >= 0 && activePhoneIndex < phoneSuggestions.length) {
                e.preventDefault();
                selectClient(phoneSuggestions[activePhoneIndex]);
            } else if (e.key === 'Tab' && phoneSuggestions.length > 0) {
                e.preventDefault();
                selectClient(phoneSuggestions[0]);
            }
        } else if (e.key === 'Escape') {
            setIsPhoneFocused(false);
        }
    };

    // Keyboard navigation for name input
    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isNameFocused || nameSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveNameIndex(prev => (prev < nameSuggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveNameIndex(prev => (prev > 0 ? prev - 1 : nameSuggestions.length - 1));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (activeNameIndex >= 0 && activeNameIndex < nameSuggestions.length) {
                e.preventDefault();
                selectClient(nameSuggestions[activeNameIndex]);
            } else if (e.key === 'Tab' && nameSuggestions.length > 0) {
                e.preventDefault();
                selectClient(nameSuggestions[0]);
            }
        } else if (e.key === 'Escape') {
            setIsNameFocused(false);
        }
    };

    return (
        <div ref={containerRef} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Client Name Input */}
                <div className="relative">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                        <span>اسم العميل</span>
                        {isSearchingName && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                <RefreshCwIcon className="w-3 h-3 animate-spin" />
                                جاري البحث...
                            </span>
                        )}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={clientName}
                            disabled={disabled}
                            onChange={(e) => handleNameChange(e.target.value)}
                            onFocus={() => {
                                setIsNameFocused(true);
                                setIsPhoneFocused(false);
                                if (clientName.trim().length >= 2) {
                                    handleNameChange(clientName);
                                }
                            }}
                            onKeyDown={handleNameKeyDown}
                            placeholder="اسم العميل"
                            autoComplete="off"
                            className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-amber-500 pr-2 pl-8"
                        />
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                            {isSearchingName ? (
                                <RefreshCwIcon className="w-4 h-4 animate-spin text-amber-500" />
                            ) : (
                                <SearchIcon className="w-4 h-4" />
                            )}
                        </div>
                    </div>

                    {/* Name Suggestions Dropdown */}
                    {isNameFocused && nameSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                            <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                                عملاء مسجلون مطابقون للاسم ({nameSuggestions.length}):
                            </div>
                            {nameSuggestions.map((client, idx) => (
                                <div
                                    key={client.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectClient(client);
                                    }}
                                    onMouseEnter={() => setActiveNameIndex(idx)}
                                    className={`p-2 cursor-pointer transition flex items-center justify-between text-xs ${
                                        idx === activeNameIndex
                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100'
                                            : 'hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 truncate">
                                        <UserCheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="font-semibold truncate">{client.name}</span>
                                        {client.is_vip && (
                                            <span className="bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-[10px] px-1 rounded font-bold">
                                                VIP
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 font-mono" dir="ltr">
                                        {formatPhoneNumberDisplay(client.phone)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Client Phone Input with Real-time Search */}
                <div className="relative">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                        <span>رقم الهاتف (بحث فوري بالعملاء)</span>
                        {isSearchingPhone && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                <RefreshCwIcon className="w-3 h-3 animate-spin" />
                                جاري البحث...
                            </span>
                        )}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            dir="ltr"
                            value={clientPhone}
                            disabled={disabled}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            onFocus={() => {
                                setIsPhoneFocused(true);
                                setIsNameFocused(false);
                                if (clientPhone.length >= 9) {
                                    handlePhoneChange(clientPhone);
                                }
                            }}
                            onKeyDown={handlePhoneKeyDown}
                            placeholder="05xxxxxxxx"
                            autoComplete="off"
                            className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-amber-500 pl-2 pr-8 font-mono text-left"
                        />
                        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                            {isSearchingPhone ? (
                                <RefreshCwIcon className="w-4 h-4 animate-spin text-amber-500" />
                            ) : (
                                <SearchIcon className="w-4 h-4" />
                            )}
                        </div>
                    </div>

                    {/* Phone Suggestions Dropdown */}
                    {isPhoneFocused && phoneSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                            <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                                عملاء مسجلون مطابقون للرقم ({phoneSuggestions.length}):
                            </div>
                            {phoneSuggestions.map((client, idx) => (
                                <div
                                    key={client.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectClient(client);
                                    }}
                                    onMouseEnter={() => setActivePhoneIndex(idx)}
                                    className={`p-2 cursor-pointer transition flex items-center justify-between text-xs ${
                                        idx === activePhoneIndex
                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100'
                                            : 'hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 truncate">
                                        <UserCheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="font-semibold truncate">{client.name}</span>
                                        {client.is_vip && (
                                            <span className="bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-[10px] px-1 rounded font-bold">
                                                VIP
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-slate-600 dark:text-slate-300 shrink-0 font-mono font-medium" dir="ltr">
                                        {formatPhoneNumberDisplay(client.phone)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Client Connection Status Badge */}
            {matchedClient ? (
                <div className="flex items-center justify-between text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1.5 rounded-lg animate-fade-in shadow-xs">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>متصل بسجل العميل: <strong>{matchedClient.name}</strong></span>
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-mono" dir="ltr">
                            ({formatPhoneNumberDisplay(matchedClient.phone)})
                        </span>
                        {matchedClient.is_vip && (
                            <span className="bg-amber-200 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                عميل VIP
                            </span>
                        )}
                    </div>
                    {onClearSelection && (
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-[11px] underline shrink-0 mr-2"
                        >
                            تعديل يدوي
                        </button>
                    )}
                </div>
            ) : clientPhone.length >= 9 ? (
                <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-lg">
                    <span className="text-amber-500">ℹ️</span>
                    <span>رقم جديد: سيتم حفظ العميل وربطه تلقائياً مع هذا الطلب عند التحصيل.</span>
                </div>
            ) : null}
        </div>
    );
};
