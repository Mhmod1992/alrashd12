import React, { useState, useEffect, useRef } from 'react';
import { smartSuggestion, convertText } from '../lib/keyboardCorrection';

// Safe setter to update React controlled inputs correctly
function setReactInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const setter = descriptor?.set;
  
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  // Dispatch events so React and other listeners know about the change
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

interface TooltipPosition {
  top: number;
  left: number;
  width: number;
}

export const KeyboardLayoutCorrector: React.FC = () => {
  const [activeElement, setActiveElement] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [suggestion, setSuggestion] = useState<{ original: string; corrected: string } | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [ignoredText, setIgnoredText] = useState<string>('');
  const [isTypingMode, setIsTypingMode] = useState<boolean>(false);
  const [placeAbove, setPlaceAbove] = useState<boolean>(false);
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Sync ref with state so we can access it safely outside standard react lifecycles
  useEffect(() => {
    activeElementRef.current = activeElement;
  }, [activeElement]);

  const runAnalysisOnElement = (el: HTMLInputElement | HTMLTextAreaElement) => {
    const val = el.value;
    if (!val || val.length < 2 || val === ignoredText) {
      setSuggestion(null);
      return;
    }

    const result = smartSuggestion(val);
    if (result && result.corrected !== val) {
      setSuggestion({ original: val, corrected: result.corrected });
      setIsTypingMode(true);
      updatePosition(el);
    } else {
      setSuggestion(null);
    }
  };

  // Update position based on viewport bounds (fixed layout coordinates)
  const updatePosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldAbove = spaceBelow < 110; // place above if viewport height is small below
    
    setPlaceAbove(shouldAbove);
    setPosition({
      top: shouldAbove ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width
    });
  };

  // 1. Maintain event listeners globally
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        (target as HTMLInputElement).type !== 'password' &&
        !(target as HTMLInputElement).disabled &&
        !(target as HTMLInputElement).readOnly
      ) {
        const inputEl = target as HTMLInputElement | HTMLTextAreaElement;
        setActiveElement(inputEl);
        
        // Run correction check IMMEDIATELY upon focus
        setTimeout(() => {
          runAnalysisOnElement(inputEl);
        }, 80);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Prevent focusout from overwriting freshly focused inputs
      setTimeout(() => {
        const active = document.activeElement;
        if (
          active && (
            active.tagName === 'INPUT' || 
            active.tagName === 'TEXTAREA' || 
            active.closest('.correction-tooltip-container')
          )
        ) {
          return;
        }

        // Keep active if current tracked element still physically has focus
        if (activeElementRef.current && document.activeElement === activeElementRef.current) {
          return;
        }

        setActiveElement(null);
        setSuggestion(null);
        setSelectedText('');
        setPosition(null);
      }, 150);
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        (target as HTMLInputElement).type !== 'password' &&
        !(target as HTMLInputElement).disabled &&
        !(target as HTMLInputElement).readOnly
      ) {
        if (target !== activeElementRef.current) {
          setActiveElement(target);
        }
        runAnalysisOnElement(target);
      }
    };

    const handleSelection = () => {
      let currentEl = activeElementRef.current;
      if (!currentEl) {
        const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
        if (
          active && 
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
          active.type !== 'password' &&
          !active.disabled &&
          !active.readOnly
        ) {
          setActiveElement(active);
          currentEl = active;
        } else {
          return;
        }
      }
      
      const start = currentEl.selectionStart;
      const end = currentEl.selectionEnd;
      
      if (start !== null && end !== null && end - start > 1) {
        const text = currentEl.value.substring(start, end);
        if (text && text.trim().length >= 2) {
          // Check if selection contains layout errors
          const result = smartSuggestion(text);
          if (result && result.corrected !== text) {
            setSelectedText(text);
            setIsTypingMode(false);
            setSuggestion({ original: text, corrected: result.corrected });
            updatePosition(currentEl);
          } else {
            setSelectedText('');
          }
        } else {
          setSelectedText('');
        }
      } else {
        setSelectedText('');
        if (!isTypingMode) {
          setSuggestion(null);
        }
      }
    };

    const handleWindowScroll = () => {
      if (activeElementRef.current && suggestion) {
        updatePosition(activeElementRef.current);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('input', handleInput);
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);
    window.addEventListener('scroll', handleWindowScroll, true);
    window.addEventListener('resize', handleWindowScroll);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('keyup', handleSelection);
      window.removeEventListener('scroll', handleWindowScroll, true);
      window.removeEventListener('resize', handleWindowScroll);
    };
  }, [ignoredText, isTypingMode, suggestion]);

  // Convert entire content or suggestion text
  const applyCorrection = () => {
    const el = activeElementRef.current;
    if (!el || !suggestion) return;

    if (selectedText) {
      // Selection mode: Correct ONLY selected portion
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const val = el.value;
      
      const prefix = val.substring(0, start);
      const suffix = val.substring(end);
      const converted = convertText(selectedText);
      const newValue = prefix + converted + suffix;
      
      setReactInputValue(el, newValue);
      
      // Retain cursor focus and highlight corrected text
      el.focus();
      setTimeout(() => {
        el.setSelectionRange(start, start + converted.length);
      }, 10);
      
      setSelectedText('');
      setSuggestion(null);
    } else {
      // Whole text / Live typing mode
      setReactInputValue(el, suggestion.corrected);
      el.focus();
      setSuggestion(null);
    }
  };

  // Force quick conversion of entire field
  const handleForceConversion = () => {
    const el = activeElementRef.current;
    if (!el) return;
    const currentVal = el.value;
    if (!currentVal) return;
    
    const converted = convertText(currentVal);
    setReactInputValue(el, converted);
    el.focus();
    setSuggestion(null);
    setSelectedText('');
  };

  const dismissSuggestion = () => {
    const el = activeElementRef.current;
    if (el) {
      setIgnoredText(el.value);
    }
    setSuggestion(null);
    setSelectedText('');
  };

  if (!suggestion || !position) return null;

  // Clamp left value so it never overflows the viewport edges
  // Because this is an RTL Arabic application, align the suggestion box with the RIGHT side of the input element
  const tooltipWidth = 290;
  const idealLeft = position.left + position.width - tooltipWidth - 8;
  const minLeft = 12;
  const maxLeft = Math.max(12, window.innerWidth - tooltipWidth - 16);
  const safeLeft = Math.min(Math.max(idealLeft, minLeft), maxLeft);

  // Guard top coordinate to never go out of the screen (top bounds check)
  const rawTop = placeAbove ? position.top - 46 : position.top + 6;
  const safeTop = Math.max(8, rawTop);

  return (
    <div 
      ref={tooltipRef}
      onMouseDown={(e) => {
        // CRITICAL: Prevent default behavior to block focus loss from input/textarea elements
        e.preventDefault();
      }}
      className="fixed z-[99999] correction-tooltip-container animate-fade-in"
      style={{
        top: `${safeTop}px`,
        left: `${safeLeft}px`,
        direction: 'rtl'
      }}
    >
      <div 
        className="flex items-center gap-2 p-1.5 bg-slate-900 border border-violet-500/30 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.65)] text-white cursor-default select-none animate-in fade-in zoom-in duration-150"
        dir="rtl"
      >
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs">
          <span className="text-sm">✨</span>
          <span className="font-sans font-medium text-[11px] text-slate-300">
            {selectedText ? 'تصحيح الملاحظة:' : 'هل تقصد:'}
          </span>
          <strong className="font-sans font-semibold text-emerald-300 max-w-[130px] truncate block text-[11px] hover:overflow-visible" title={suggestion.corrected}>
            {suggestion.corrected}
          </strong>
        </div>

        <div className="flex items-center gap-1.5 border-r border-slate-700/60 pr-1.5 mr-0.5">
          <button 
            type="button"
            onClick={applyCorrection}
            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 active:scale-95 text-[10px] font-bold text-white rounded-lg transition-all cursor-pointer shadow-md shadow-violet-900/40"
          >
            تصحيح
          </button>
          
          <button 
            type="button"
            onClick={handleForceConversion}
            className="flex items-center justify-center p-1.5 text-xs hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
            title="تحويل كامل النص"
          >
            🔄
          </button>
          
          <button 
            type="button"
            onClick={dismissSuggestion}
            className="flex items-center justify-center p-1.5 text-xs hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
            title="تجاهل"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
