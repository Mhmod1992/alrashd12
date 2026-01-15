
import React from 'react';
import { Settings } from '../types';

const MiniPlateDisplay: React.FC<{ plateNumber: string; settings: Settings; large?: boolean }> = ({ plateNumber, settings, large = false }) => {
    if (!plateNumber) return null;
    
    if (plateNumber.startsWith('شاصي')) {
        return <span className={`font-mono tracking-wider bg-white dark:bg-slate-700 border border-black dark:border-slate-500 rounded-md px-3 py-1 ${large ? 'text-lg' : 'text-sm'} whitespace-nowrap`}>{plateNumber}</span>;
    }

    const parts = plateNumber.split(' ');
    const arLetters = parts.filter(p => !/^\d+$/.test(p)).join('');
    const numbers = parts.find(p => /^\d+$/.test(p)) || '';
    
    const arToEnMap = new Map<string, string>();
    if (settings?.plateCharacters) {
        settings.plateCharacters.forEach((pc: { ar: string, en: string }) => {
            arToEnMap.set(pc.ar.replace('ـ', ''), pc.en);
        });
    }
    
    const enLetters = arLetters.split('').map(char => arToEnMap.get(char) || char).join('');

    return (
        <div className="flex justify-center w-full">
            <div className={`inline-flex items-center gap-4 bg-white dark:bg-slate-700 border-2 border-black dark:border-slate-500 rounded-lg font-mono shadow-sm text-black dark:text-white whitespace-nowrap flex-shrink-0 ${large ? 'px-8 py-4 min-w-[240px] justify-between' : 'px-4 py-2'}`}>
                <div className="text-center flex-shrink-0 flex flex-col items-center">
                    <div className={`font-bold tracking-[0.3em] ${large ? 'text-3xl' : 'text-base'}`}>{arLetters.split('').join(' ')}</div>
                    <div className="w-full h-px bg-slate-300 dark:bg-slate-600 my-1"></div>
                    <div className={`font-bold tracking-[0.2em] opacity-80 ${large ? 'text-base' : 'text-[11px]'}`}>{enLetters.split('').reverse().join(' ')}</div>
                </div>
                
                <div className={`bg-slate-300 dark:bg-slate-500 flex-shrink-0 ${large ? 'w-0.5 h-14' : 'w-px h-10'}`}></div>
                
                <div className="text-center flex flex-col items-center flex-shrink-0" dir="ltr">
                    <div className={`font-bold tracking-[0.3em] ${large ? 'text-3xl' : 'text-base'}`}>
                        {numbers.split('').join(' ')}
                    </div>
                    <div className="w-full h-px bg-slate-300 dark:bg-slate-600 my-1"></div>
                    <div className={`font-bold tracking-[0.3em] opacity-80 ${large ? 'text-3xl' : 'text-[11px]'}`}>
                        {numbers.split('').join(' ')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MiniPlateDisplay;
