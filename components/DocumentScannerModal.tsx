
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
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterType, setFilterType] = useState<'original' | 'document' | 'bw'>('document');
    
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setImageUrl(url);
            // Reset state
            setScale(1);
            setPosition({ x: 0, y: 0 });
            setRotation(0);
            setFilterType('document');
            
            return () => URL.revokeObjectURL(url);
        }
    }, [imageFile]);

    // --- Drag & Zoom Logic ---
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        isDragging.current = true;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        startPos.current = { x: clientX - position.x, y: clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setPosition({
            x: clientX - startPos.current.x,
            y: clientY - startPos.current.y
        });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newScale = scale - e.deltaY * 0.001;
        setScale(Math.min(Math.max(0.5, newScale), 5));
    };

    // --- Processing Logic ---
    const processImage = useCallback(async () => {
        if (!imageRef.current || !containerRef.current || !imageFile) return;
        setIsProcessing(true);

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No canvas context');

            // 1. Setup Canvas based on Crop Area (The visible container area)
            // We want high res, so we base it on the container size multiplied by a factor or the image natural size
            // Strategy: Render the visible portion of the image at high resolution
            
            const containerRect = containerRef.current.getBoundingClientRect();
            const outputWidth = 1200; // Fixed high res width
            const outputHeight = Math.round(outputWidth * (containerRect.height / containerRect.width));
            
            canvas.width = outputWidth;
            canvas.height = outputHeight;

            // Fill white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Draw Image with transforms
            // Calculate mapping from Screen Pixels to Canvas Pixels
            const ratio = outputWidth / containerRect.width;
            
            ctx.save();
            // Move to center of canvas
            ctx.translate(outputWidth / 2, outputHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            ctx.translate(position.x * ratio / scale, position.y * ratio / scale); // Apply Pan
            
            // Draw image centered
            const img = imageRef.current;
            // We draw the image centered at (0,0) of the transformed context
            // Note: rotation resets center logic slightly, simplified:
            // Just draw the image such that the center of the image aligns with current context origin (which is modified by pan/zoom)
            // Actually, position is screen pixels. 
            
            // Re-think:
            // The image is visually at: center_of_container + position
            // We need to draw it on canvas at: center_of_canvas + (position * ratio)
            
            // Correct Transforms:
            // 1. Translate to Center
            // 2. Apply Pan (scaled to canvas)
            // 3. Apply Scale
            // 4. Apply Rotation
            // 5. Draw Image offset by -width/2, -height/2
            
            // Reset transforms for a cleaner approach
            ctx.restore();
            ctx.save();
            
            // Center of canvas
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            
            ctx.translate(cx, cy);
            
            // Apply visual offsets (position is relative to visual center usually, but here it's absolute drag)
            // Let's assume start position (0,0) means image center is at container center.
            // Our drag logic `setPosition` modifies x/y.
            
            ctx.translate(position.x * ratio, position.y * ratio);
            ctx.scale(scale, scale);
            ctx.rotate((rotation * Math.PI) / 180);
            
            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
            ctx.restore();

            // 3. Apply Filters (Document Scanner Effect)
            if (filterType !== 'original') {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Grayscale
                    const v = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    if (filterType === 'bw') {
                        // Hard Threshold
                        const bw = v > 128 ? 255 : 0;
                        data[i] = bw;
                        data[i + 1] = bw;
                        data[i + 2] = bw;
                    } else {
                        // Document Enhance (High Contrast + White Background)
                        // Increase contrast
                        const contrast = 1.2;
                        const intercept = 128 * (1 - contrast);
                        let nv = v * contrast + intercept;
                        
                        // Smart White Level (Clip light grays to white)
                        if (nv > 200) nv = 255;
                        // Smart Black Level (Darken text)
                        if (nv < 50) nv = 0;
                        
                        // Clamp
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
                    const newFile = new File([blob], `scanned_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onConfirm(newFile);
                }
                setIsProcessing(false);
            }, 'image/jpeg', 0.85);

        } catch (e) {
            console.error(e);
            setIsProcessing(false);
        }
    }, [scale, position, rotation, filterType, imageFile, onConfirm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="الماسح الضوئي الذكي" size="lg">
            <div className="flex flex-col h-[70vh] select-none">
                {/* Toolbar */}
                <div className="flex justify-center gap-2 mb-4 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <button 
                        onClick={() => setFilterType('original')} 
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterType === 'original' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        أصلي
                    </button>
                    <button 
                        onClick={() => setFilterType('document')} 
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterType === 'document' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        تحسين مستند
                    </button>
                    <button 
                        onClick={() => setFilterType('bw')} 
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterType === 'bw' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        أبيض وأسود
                    </button>
                </div>

                {/* Viewport */}
                <div 
                    ref={containerRef}
                    className="flex-1 bg-slate-900 overflow-hidden relative cursor-move rounded-lg border-2 border-slate-700 shadow-inner group"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onTouchMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchEnd={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    {/* Grid Overlay / Crop Hints */}
                    <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
                        <div className="w-full h-full border-2 border-blue-500/50 box-border"></div>
                        <div className="absolute top-1/3 left-0 w-full h-px bg-white/20"></div>
                        <div className="absolute top-2/3 left-0 w-full h-px bg-white/20"></div>
                        <div className="absolute left-1/3 top-0 h-full w-px bg-white/20"></div>
                        <div className="absolute left-2/3 top-0 h-full w-px bg-white/20"></div>
                        {/* Corner Markers */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
                    </div>
                    
                    {/* Instruction Overlay */}
                    <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-20 transition-opacity duration-300 opacity-50 group-hover:opacity-0">
                        <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                            اسحب للتحريك &bull; استخدم العجلة للتكبير
                        </span>
                    </div>

                    {/* Image Container */}
                    <div 
                        className="w-full h-full flex items-center justify-center transition-transform duration-75"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`
                        }}
                    >
                        {imageUrl && (
                            <img 
                                ref={imageRef}
                                src={imageUrl} 
                                alt="Scan Preview" 
                                className="max-w-none max-h-none pointer-events-none shadow-2xl"
                                style={{
                                    // Image is displayed naturally, but constrained by initial load logic which is CSS based for preview
                                    // For accurate transform, we rely on the div wrapper transform
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 flex flex-col gap-4">
                     {/* Rotate & Zoom Controls */}
                    <div className="flex items-center justify-between px-2">
                        <div className="flex gap-2">
                             <button onClick={() => setRotation(r => r - 90)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                                <Icon name="refresh-cw" className="w-4 h-4 -scale-x-100" />
                            </button>
                            <button onClick={() => setRotation(r => r + 90)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                                <Icon name="refresh-cw" className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-1 max-w-xs mx-4">
                             <Icon name="search" className="w-4 h-4 text-slate-400" />
                             <input 
                                type="range" 
                                min="0.5" 
                                max="3" 
                                step="0.1" 
                                value={scale} 
                                onChange={e => setScale(parseFloat(e.target.value))} 
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                             />
                        </div>

                         <button onClick={() => { setScale(1); setPosition({x:0, y:0}); setRotation(0); }} className="text-xs text-blue-600 font-bold hover:underline">
                             إعادة ضبط
                         </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-700">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>إلغاء</Button>
                        <Button onClick={processImage} disabled={isProcessing} className="min-w-[120px]">
                            {isProcessing ? (
                                <>
                                    <RefreshCwIcon className="w-4 h-4 animate-spin me-2" />
                                    جاري المعالجة...
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="w-4 h-4 me-2" />
                                    حفظ المستند
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
