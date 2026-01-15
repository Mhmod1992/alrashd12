import React from 'react';

const CarOutline: React.FC = () => {
    return (
        <div className="grid grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
            <div className="col-span-2 border rounded-md p-2 dark:border-slate-600">
                <p className="text-center text-sm font-semibold">منظر علوي</p>
                <svg viewBox="0 0 200 100" className="w-full h-auto">
                    <path d="M 50 10 C 20 10, 10 20, 10 50 C 10 80, 20 90, 50 90 L 150 90 C 180 90, 190 80, 190 50 C 190 20, 180 10, 150 10 Z" stroke="currentColor" strokeWidth="2" fill="none" />
                    <rect x="55" y="20" width="90" height="60" stroke="currentColor" strokeWidth="1" fill="none" rx="5" />
                    <line x1="55" y1="50" x2="145" y2="50" stroke="currentColor" strokeWidth="1" />
                    <line x1="100" y1="20" x2="100" y2="80" stroke="currentColor" strokeWidth="1" />
                </svg>
            </div>
            <div className="border rounded-md p-2 dark:border-slate-600">
                <p className="text-center text-sm font-semibold">منظر أمامي</p>
                <svg viewBox="0 0 100 60" className="w-full h-auto">
                    <path d="M 10 20 C 5 20, 5 10, 20 10 L 80 10 C 95 10, 95 20, 90 20 L 90 40 C 95 40, 95 50, 80 50 L 20 50 C 5 50, 5 40, 10 40 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <rect x="25" y="15" width="50" height="20" stroke="currentColor" strokeWidth="1" fill="none" />
                    <circle cx="30" cy="45" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <circle cx="70" cy="45" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
            </div>
             <div className="border rounded-md p-2 dark:border-slate-600">
                <p className="text-center text-sm font-semibold">منظر خلفي</p>
                 <svg viewBox="0 0 100 60" className="w-full h-auto">
                    <path d="M 10 20 C 5 20, 5 10, 20 10 L 80 10 C 95 10, 95 20, 90 20 L 90 40 C 95 40, 95 50, 80 50 L 20 50 C 5 50, 5 40, 10 40 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <rect x="20" y="25" width="20" height="10" stroke="currentColor" strokeWidth="1" fill="none" />
                    <rect x="60" y="25" width="20" height="10" stroke="currentColor" strokeWidth="1" fill="none" />
                    <circle cx="30" cy="45" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <circle cx="70" cy="45" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
            </div>
            <div className="border rounded-md p-2 dark:border-slate-600">
                <p className="text-center text-sm font-semibold">جانب أيمن</p>
                <svg viewBox="0 0 200 80" className="w-full h-auto">
                   <path d="M 10 50 L 190 50 L 190 60 C 180 70, 170 70, 160 60 L 150 50 L 140 50 C 120 20, 100 20, 70 20 L 50 50 L 40 60 C 30 70, 20 70, 10 60 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                   <rect x="75" y="25" width="60" height="25" stroke="currentColor" strokeWidth="1" fill="none" />
                   <circle cx="40" cy="55" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                   <circle cx="160" cy="55" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
            </div>
            <div className="border rounded-md p-2 dark:border-slate-600">
                <p className="text-center text-sm font-semibold">جانب أيسر</p>
                <svg viewBox="0 0 200 80" className="w-full h-auto" style={{ transform: 'scaleX(-1)' }}>
                   <path d="M 10 50 L 190 50 L 190 60 C 180 70, 170 70, 160 60 L 150 50 L 140 50 C 120 20, 100 20, 70 20 L 50 50 L 40 60 C 30 70, 20 70, 10 60 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                   <rect x="75" y="25" width="60" height="25" stroke="currentColor" strokeWidth="1" fill="none" />
                   <circle cx="40" cy="55" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                   <circle cx="160" cy="55" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
            </div>
        </div>
    );
};
export default CarOutline;
