
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface DocumentScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageFile: File | null;
    onConfirm: (processedFile: File) => void;
}

const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({ isOpen, onClose, imageFile, onConfirm }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    
    // Transform State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [isLandscape, setIsLandscape] = useState(false);
    
    // Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterType, setFilterType] = useState<'original' | 'document' | 'bw'>('document');
    
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setImageUrl(url);
            // Reset state
            setScale(1);
            setPosition({ x: 0, y: 0 });
            setRotation(0);
            setFilterType('document');
            setIsLandscape(false);
            
            return () => URL.revokeObjectURL(url);
        }
    }, [imageFile]);

    // --- Interaction Logic ---
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        isDragging.current = true;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        startPos.current = { x: clientX, y: clientY };
        lastPos.current = { ...position };
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging.current) return;
        e.preventDefault(); // Prevent scrolling on touch
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        const deltaX = clientX - startPos.current.x;
        const deltaY = clientY - startPos.current.y;
        
        setPosition({
            x: lastPos.current.x + deltaX,
            y: lastPos.current.y + deltaY
        });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newScale = scale - e.deltaY * 0.001;
        setScale(Math.min(Math.max(0.1, newScale), 5));
    };

    // --- Processing Logic ---
    const processImage = useCallback(async () => {
        if (!imageRef.current || !containerRef.current || !imageFile) return;
        setIsProcessing(true);

        try {
            // 1. Determine Output Size (A4 High Quality)
            const A4_WIDTH = 1240;
            const A4_HEIGHT = 1754;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No canvas context');

            // Set canvas size based on orientation
            canvas.width = isLandscape ? A4_HEIGHT : A4_WIDTH;
            canvas.height = isLandscape ? A4_WIDTH : A4_HEIGHT;

            // Fill white background (for edges)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Calculate Mapping
            // Use containerRef (the A4 box) for viewport dimensions
            const viewportRect = containerRef.current.getBoundingClientRect();
            
            // Calculate ratio between Output Canvas and Visual Viewport
            const ratio = canvas.width / viewportRect.width;

            // Calculate the "Base Scale" from the DOM rendered size vs Natural size.
            // clientWidth/Height gives us the size of the image as it sits in the container (before CSS transform scale).
            // This accounts for the 'contain' style automatically.
            const renderedWidth = imageRef.current.clientWidth;
            const domScale = renderedWidth / imageRef.current.naturalWidth;

            ctx.save();
            
            // Move origin to center of canvas
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            // Apply visual transforms (Position -> Rotate -> Scale)
            // 1. Translate (Pan)
            ctx.translate(position.x * ratio, position.y * ratio);
            
            // 2. Rotate
            ctx.rotate((rotation * Math.PI) / 180);
            
            // 3. Scale
            // Final Scale = (Base Render Scale) * (User Zoom Scale) * (Screen-to-Canvas Ratio)
            const finalScale = domScale * scale * ratio;
            ctx.scale(finalScale, finalScale);
            
            // Draw centered
            ctx.drawImage(imageRef.current, -imageRef.current.naturalWidth / 2, -imageRef.current.naturalHeight / 2);
            ctx.restore();

            // 3. Apply Filters
            if (filterType !== 'original') {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    const v = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    if (filterType === 'bw') {
                        const bw = v > 128 ? 255 : 0;
                        data[i] = bw;
                        data[i + 1] = bw;
                        data[i + 2] = bw;
                    } else {
                        // High Contrast Document
                        const contrast = 1.3;
                        const intercept = 128 * (1 - contrast);
                        let nv = v * contrast + intercept;
                        if (nv > 210) nv = 255; 
                        if (nv < 60) nv = 0;   
                        nv = Math.min(255, Math.max(0, nv));
                        
                        data[i] = nv;
                        data[i + 1] = nv;
                        data[i + 2] = nv;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }

            // 4. Export
            canvas.toBlob((blob) => {
                if (blob) {
                    const newFile = new File([blob], `scanned_a4_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onConfirm(newFile);
                }
                setIsProcessing(false);
            }, 'image/jpeg', 0.85);

        } catch (e) {
            console.error(e);
            setIsProcessing(false);
        }
    }, [scale, position, rotation, filterType, isLandscape, imageFile, onConfirm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="الماسح الضوئي (A4)" size="xl">
            <div className="flex flex-col h-[80vh] select-none bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
                
                {/* --- Toolbar --- */}
                <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-slate-800 border-b dark:border-slate-700 gap-2 z-10 shadow-sm">
                    <div className="flex gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button 
                            onClick={() => setFilterType('original')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filterType === 'original' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                        >
                            أصلي
                        </button>
                        <button 
                            onClick={() => setFilterType('document')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filterType === 'document' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                        >
                            مستند
                        </button>
                        <button 
                            onClick={() => setFilterType('bw')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filterType === 'bw' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                        >
                            أبيض/أسود
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setRotation(r => r - 90)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="تدوير يسار">
                            <Icon name="refresh-cw" className="w-4 h-4 -scale-x-100" />
                        </button>
                        <button onClick={() => setRotation(r => r + 90)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="تدوير يمين">
                            <Icon name="refresh-cw" className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsLandscape(!isLandscape)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs w-20" title="قلب الإطار">
                            {isLandscape ? 'عرضي' : 'طولي'}
                        </button>
                    </div>
                </div>

                {/* --- Main Workspace --- */}
                <div className="flex-1 relative overflow-hidden bg-slate-800 flex items-center justify-center p-8">
                    {/* Dark Background Backdrop */}
                    <div className="absolute inset-0 bg-black/50 pointer-events-none z-0"></div>

                    {/* The A4 Viewport Container */}
                    <div 
                        ref={containerRef}
                        className="relative z-10 shadow-2xl flex items-center justify-center overflow-hidden bg-gray-300 border-4 border-white/20 ring-4 ring-black/20"
                        style={{
                            aspectRatio: isLandscape ? '297/210' : '210/297',
                            height: isLandscape ? 'auto' : '90%',
                            width: isLandscape ? '90%' : 'auto',
                            maxHeight: '100%',
                            maxWidth: '100%'
                        }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onTouchMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onTouchEnd={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        {/* Reference for visual grid only */}
                        <div className="absolute inset-0 pointer-events-none border border-blue-500/30 z-20">
                            {/* Grid Lines */}
                            <div className="w-full h-1/3 border-b border-blue-500/20 absolute top-0"></div>
                            <div className="w-full h-2/3 border-b border-blue-500/20 absolute top-0"></div>
                            <div className="h-full w-1/3 border-r border-blue-500/20 absolute left-0"></div>
                            <div className="h-full w-2/3 border-r border-blue-500/20 absolute left-0"></div>
                        </div>

                        {/* Image Container */}
                        {imageUrl && (
                            <img 
                                ref={imageRef}
                                src={imageUrl} 
                                alt="Source" 
                                className="absolute transition-transform duration-75 ease-linear cursor-move"
                                style={{
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                    // Use contain logic: fit image within container by default
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    width: 'auto',
                                    height: 'auto',
                                }}
                                draggable={false}
                            />
                        )}
                        
                        {/* Instructional Overlay (Fades out) */}
                         <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-30 opacity-70">
                            <span className="bg-black/60 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">
                                اسحب الصورة لضبطها داخل إطار A4
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- Footer --- */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex flex-col gap-4 z-10 shadow-lg">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-4 px-2">
                         <Icon name="search" className="w-4 h-4 text-slate-400" />
                         <input 
                            type="range" 
                            min="0.2" 
                            max="3" 
                            step="0.05" 
                            value={scale} 
                            onChange={e => setScale(parseFloat(e.target.value))} 
                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-600"
                         />
                         <button onClick={() => { setScale(1); setPosition({x:0, y:0}); setRotation(0); }} className="text-xs text-blue-600 font-bold hover:underline whitespace-nowrap">
                             ضبط تلقائي
                         </button>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t dark:border-slate-700/50">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>إلغاء</Button>
                        <Button onClick={processImage} disabled={isProcessing} className="px-8 shadow-lg shadow-blue-500/20">
                            {isProcessing ? (
                                <>
                                    <RefreshCwIcon className="w-4 h-4 animate-spin me-2" />
                                    جاري القص والحفظ...
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="w-4 h-4 me-2" />
                                    حفظ A4
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DocumentScannerModal;
