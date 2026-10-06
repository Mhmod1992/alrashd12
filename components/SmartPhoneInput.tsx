
import React, { useRef, useState } from 'react';
import { cleanSaudiPhoneNumber } from '../lib/utils';

interface SmartPhoneInputProps {
    value: string; // digits only (e.g. "0512345678")
    onChange: (value: string) => void;
    autoFocus?: boolean;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    id?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const SmartPhoneInput = React.forwardRef<HTMLInputElement, SmartPhoneInputProps>(({
    value = '',
    onChange,
    autoFocus = false,
    required = false,
    disabled = false,
    className = '',
    id,
    onFocus,
    onBlur,
    onKeyDown
}, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [selectionRange, setSelectionRange] = useState<[number, number] | null>(null);
    const internalRef = useRef<HTMLInputElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement;
        if (target.selectionStart !== null && target.selectionEnd !== null && target.selectionStart !== target.selectionEnd) {
            setSelectionRange([target.selectionStart, target.selectionEnd]);
        } else {
            setSelectionRange(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = cleanSaudiPhoneNumber(e.target.value);
        onChange(val);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const cleaned = cleanSaudiPhoneNumber(text);
        onChange(cleaned);
    };

    const handleContainerClick = () => {
        if (!disabled) {
            combinedRef.current?.focus();
        }
    };

    const renderVisual = () => {
        const digits = value.split('');
        const template = '05xxxxxxxx'.split('');

        return (
            <div className="flex items-center font-mono select-none pointer-events-none text-xs sm:text-sm" style={{ direction: 'ltr' }}>
                {template.map((tChar, i) => {
                    const digit = digits[i];
                    const isFilled = digit !== undefined;
                    const isCurrent = i === value.length;
                    
                    return (
                        <React.Fragment key={i}>
                            {/* Hyphens at specific positions */}
                            {(i === 3 || i === 6) && (
                                <span className="text-slate-400 mx-1 tracking-tighter font-semibold font-sans text-xs">-</span>
                            )}
                            
                            <div className="relative flex items-center justify-center w-[0.72em]">
                                {/* Integrated Smart Cursor */}
                                {isFocused && isCurrent && !selectionRange && (
                                    <div className="absolute inset-y-0.5 -left-0.5 w-[2px] bg-blue-500 animate-pulse rounded-full z-10" />
                                )}
                                
                                {/* Case for cursor at the very end (mask full) */}
                                {isFocused && i === 9 && value.length === 10 && !selectionRange && (
                                    <div className="absolute inset-y-0.5 -right-0.5 w-[2px] bg-blue-500 animate-pulse rounded-full z-10" />
                                )}

                                {/* Selection Background Highlight */}
                                {selectionRange && i >= selectionRange[0] && i < selectionRange[1] && (
                                    <div className="absolute inset-0 bg-blue-200/50 dark:bg-blue-500/40 z-0 rounded-sm" />
                                )}

                                <span className={`transition-all duration-150 z-10 relative leading-none ${
                                    isFilled 
                                        ? 'text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm' 
                                        : 'text-slate-400 dark:text-slate-500/50 text-xs'
                                } ${!isFilled && tChar === 'x' ? 'italic' : ''}`}>
                                    {isFilled ? digit : tChar}
                                </span>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div 
            className={`relative flex items-center justify-start h-[40px] px-3 rounded-xl border transition-all duration-200 cursor-text bg-white dark:bg-slate-800 ${
                disabled
                    ? 'opacity-85 cursor-not-allowed bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    : isFocused 
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm' 
                    : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
            } ${className}`}
            onClick={handleContainerClick}
        >
            {/* Visual Template Layer */}
            <div className="z-0">
                {renderVisual()}
            </div>

            {/* Hidden Interaction Layer */}
            <input
                id={id}
                ref={combinedRef}
                type="tel"
                value={value}
                disabled={disabled}
                onChange={handleChange}
                onPaste={handlePaste}
                onSelect={handleSelect}
                onKeyDown={onKeyDown}
                onKeyUp={handleSelect}
                onMouseUp={handleSelect}
                onFocus={(e) => { if (!disabled) { setIsFocused(true); handleSelect(e); onFocus?.(); } }}
                onBlur={(e) => { setIsFocused(false); handleSelect(e); onBlur?.(); }}
                autoFocus={autoFocus}
                required={required}
                maxLength={25}
                className="absolute inset-0 w-full h-full bg-transparent text-transparent z-10 cursor-text disabled:cursor-not-allowed selection:bg-transparent dark:selection:bg-transparent caret-transparent focus:outline-none"
                autoComplete="off"
                style={{ direction: 'ltr' }}
            />
        </div>
    );
});

SmartPhoneInput.displayName = 'SmartPhoneInput';

export default SmartPhoneInput;
