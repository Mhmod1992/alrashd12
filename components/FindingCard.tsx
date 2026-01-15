
import React from 'react';
import { StructuredFinding, PredefinedFinding } from '../types';
import Icon from './Icon';
import SearchIcon from './icons/SearchIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';

interface FindingCardProps {
    finding: StructuredFinding;
    predefined?: PredefinedFinding;
    onUpdate: (findingId: string, newValue: string) => void;
    onRemove: (findingId: string) => void;
    onRetry?: (findingId: string) => void;
    onPreview: (imageUrl: string) => void;
    isDeleting: boolean;
    canManage: boolean;
    isLocked?: boolean;
    viewMode?: 'grid' | 'list';
}

const StatusIndicator: React.FC<{ status?: 'saving' | 'saved' | 'error', viewMode: 'grid' | 'list', onRetry?: () => void }> = ({ status, viewMode, onRetry }) => {
    if (status === 'saving') {
        return (
            <div className={`flex items-center ${viewMode === 'list' ? 'ml-2' : 'absolute top-1 right-1 z-20 bg-yellow-100/90 dark:bg-yellow-900/80 px-1.5 py-0.5 rounded-full shadow-sm backdrop-blur-sm'}`}>
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
            </div>
        );
    }
    if (status === 'error') {
        return (
            <button
                onClick={(e) => { e.stopPropagation(); if (onRetry) onRetry(); }}
                className={`flex items-center justify-center ${viewMode === 'list' ? 'ml-2 text-red-500 hover:scale-110 transition-transform' : 'absolute top-1 right-1 z-20 bg-red-100/90 dark:bg-red-900/80 items-center gap-1 px-1.5 py-0.5 rounded-full shadow-sm backdrop-blur-sm hover:bg-red-200 dark:hover:bg-red-800 transition-colors'}`}
                title="فشل الحفظ. اضغط لإعادة المحاولة"
            >
                {viewMode === 'list' ? (
                    <RefreshCwIcon className="w-3 h-3" />
                ) : (
                    <>
                        <RefreshCwIcon className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400">إعادة</span>
                    </>
                )}
            </button>
        );
    }
    return null;
};

const FindingCard: React.FC<FindingCardProps> = ({
    finding,
    predefined,
    onUpdate,
    onRemove,
    onRetry,
    onPreview,
    isDeleting,
    canManage,
    isLocked,
    viewMode = 'grid'
}) => {
    const [localValue, setLocalValue] = React.useState(finding.value);

    React.useEffect(() => {
        setLocalValue(finding.value);
    }, [finding.value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onUpdate(finding.findingId, localValue);
            (e.target as HTMLElement).blur();
        }
    };

    const handleBlur = () => {
        if (localValue !== finding.value) {
            onUpdate(finding.findingId, localValue);
        }
    };

    if (viewMode === 'list') {
        return (
            <div className={`relative flex items-center gap-3 p-2 bg-[#fcfcfc] dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group ${isDeleting ? 'opacity-50' : ''}`}>
                {/* List View Image */}
                <div
                    className="w-10 h-10 flex-shrink-0 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden cursor-pointer relative group-hover:ring-2 ring-blue-100 dark:ring-slate-600 transition-all"
                    onClick={() => predefined?.reference_image && onPreview(predefined.reference_image)}
                >
                    {predefined?.reference_image ? (
                        <img
                            src={predefined.reference_image}
                            alt={finding.findingName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Icon name="findings" className="w-5 h-5" />
                        </div>
                    )}
                </div>

                {/* List View Content */}
                <div className="flex-grow min-w-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[150px] sm:max-w-xs" title={finding.findingName}>
                            {finding.findingName}
                        </h5>
                        <StatusIndicator status={finding.status} viewMode="list" onRetry={() => onRetry?.(finding.findingId)} />
                    </div>

                    <div className="w-32 sm:w-48">
                        {predefined && predefined.options && predefined.options.length > 0 ? (
                            <select
                                value={localValue}
                                onChange={(e) => { setLocalValue(e.target.value); onUpdate(finding.findingId, e.target.value); }}
                                disabled={!canManage || isDeleting || isLocked}
                                className="w-full text-xs py-1 px-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                                dir="auto"
                            >
                                {predefined.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={localValue}
                                onChange={(e) => setLocalValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleBlur}
                                disabled={!canManage || isDeleting || isLocked}
                                className="w-full py-1 px-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                                placeholder="الحالة..."
                            />
                        )}
                    </div>
                </div>

                {canManage && !isLocked && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(finding.findingId); }}
                        disabled={isDeleting}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        type="button"
                    >
                        <Icon name="delete" className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    }

    // Grid View (Default)
    return (
        <div className={`relative bg-[#fcfcfc] dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 group ${isDeleting ? 'opacity-50' : ''}`}>
            <StatusIndicator status={finding.status} viewMode="grid" onRetry={() => onRetry?.(finding.findingId)} />

            {/* Image Section - Compact Height */}
            <div className="h-16 bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center overflow-hidden cursor-pointer relative" onClick={() => predefined?.reference_image && onPreview(predefined.reference_image)}>
                {predefined?.reference_image ? (
                    <>
                        <img
                            src={predefined.reference_image}
                            alt={finding.findingName}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            style={{ objectPosition: predefined?.reference_image_position || 'center' }}
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                            <SearchIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 drop-shadow-md" />
                        </div>
                    </>
                ) : (
                    <Icon name="findings" className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                )}

                {canManage && !isLocked && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(finding.findingId); }}
                        disabled={isDeleting}
                        className="absolute top-1 left-1 bg-white/90 dark:bg-slate-800/90 text-red-500 hover:text-red-700 p-0.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-90 group-hover:scale-100 z-10"
                        type="button"
                        title="حذف"
                    >
                        <Icon name="delete" className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Content Section - Compact Padding & Text */}
            <div className="p-1.5 flex flex-col justify-between bg-[#fcfcfc] dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex-grow">
                <h5 className="font-bold text-slate-700 dark:text-slate-200 text-[9px] text-center line-clamp-2 mb-1 leading-tight" title={finding.findingName}>{finding.findingName}</h5>

                <div className="flex items-center justify-center w-full mt-auto">
                    {predefined && predefined.options && predefined.options.length > 0 ? (
                        <div className="relative w-full">
                            <select
                                value={localValue}
                                onChange={(e) => { setLocalValue(e.target.value); onUpdate(finding.findingId, e.target.value); }}
                                disabled={!canManage || isDeleting || isLocked}
                                className="w-full text-[9px] font-semibold py-0.5 pl-1 pr-4 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none cursor-pointer text-center transition-colors disabled:cursor-not-allowed disabled:opacity-70 h-6"
                                dir="auto"
                            >
                                {predefined.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 left-0 flex items-center pl-1 pointer-events-none">
                                <svg className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={localValue}
                            onChange={(e) => setLocalValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleBlur}
                            disabled={!canManage || isDeleting || isLocked}
                            className="w-full py-0.5 text-[9px] border-b border-slate-200 dark:border-slate-600 bg-transparent text-center focus:border-blue-500 outline-none placeholder-slate-400 disabled:cursor-not-allowed disabled:opacity-70 h-6"
                            placeholder="الحالة..."
                        />
                    )}
                </div>
            </div>

            {isDeleting && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                    <RefreshCwIcon className="w-5 h-5 animate-spin text-slate-400" />
                </div>
            )}
        </div>
    );
};

export default React.memo(FindingCard);
