import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

// Declare global types for the library
declare const Html5Qrcode: any;
declare const Html5QrcodeSupportedFormats: any;

interface InAppScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
}

const InAppScannerModal: React.FC<InAppScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [isScannerStarted, setIsScannerStarted] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);
    const [isFlashOn, setIsFlashOn] = useState(false);
    
    const scannerRef = useRef<any>(null);
    const onScanSuccessRef = useRef(onScanSuccess);
    const hasScannedRef = useRef(false);

    useEffect(() => {
        onScanSuccessRef.current = onScanSuccess;
    }, [onScanSuccess]);

    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.warn("Error stopping scanner", err);
            }
        }
        setIsScannerStarted(false);
        setIsFlashOn(false);
    };

    const startScanner = async () => {
        if (typeof Html5Qrcode === 'undefined') {
            setScannerError("مكتبة الماسح الضوئي غير محملة. يرجى التحقق من الاتصال.");
            return;
        }

        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode("reader");
        }

        setScannerError(null);
        hasScannedRef.current = false;

        let formatsToSupport = undefined;
        try {
            if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
                formatsToSupport = [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.ITF
                ];
            }
        } catch (e) {}

        const config = {
            fps: 20,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const width = Math.min(viewfinderWidth * 0.8, 300);
                const height = Math.min(viewfinderHeight * 0.6, 250);
                return { width, height };
            },
            aspectRatio: 1.0,
            formatsToSupport
        };

        try {
            // Use simple string-based facingMode for maximum compatibility
            await scannerRef.current.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    if (!hasScannedRef.current) {
                        hasScannedRef.current = true;
                        
                        // Vibrations for physical feedback if supported
                        if (navigator.vibrate) navigator.vibrate(100);
                        
                        onScanSuccessRef.current(decodedText);
                    }
                },
                (errorMessage: string) => {
                    // Ignore common errors while looking for code
                }
            );

            setIsScannerStarted(true);

            // Check flash support
            const track = scannerRef.current.getRunningTrack();
            if (track) {
                const capabilities = track.getCapabilities();
                setHasFlash(!!capabilities.torch);
            }

        } catch (err: any) {
            console.error("Scanner failed to start", err);
            setScannerError(err.message || "لا يمكن الوصول للكاميرا.");
        }
    };

    useEffect(() => {
        if (isOpen) {
            // Short delay to ensure DOM is ready
            const timer = setTimeout(startScanner, 300);
            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        } else {
            stopScanner();
        }
    }, [isOpen]);

    const toggleFlash = async () => {
        if (!scannerRef.current || !hasFlash) return;
        try {
            const newState = !isFlashOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: newState }]
            });
            setIsFlashOn(newState);
        } catch (err) {
            console.warn("Flash toggle failed", err);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="الماسح الضوئي" size="lg">
            <div className="flex flex-col items-center">
                <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-2xl bg-slate-900 border-4 border-slate-200 dark:border-slate-800 shadow-2xl">
                    <div id="reader" className="w-full h-full"></div>
                    
                    {/* Viewfinder Overlay */}
                    {isScannerStarted && !scannerError && (
                        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                            {/* Scanning Line Animation */}
                            <div className="absolute w-[80%] h-0.5 bg-blue-500 shadow-[0_0_10px_2px_rgba(59,130,246,0.5)] animate-scan-move rounded-full"></div>
                            
                            {/* Corners */}
                            <div className="absolute top-[20%] left-[10%] w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                            <div className="absolute top-[20%] right-[10%] w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                            <div className="absolute bottom-[20%] left-[10%] w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                            <div className="absolute bottom-[20%] right-[10%] w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                        </div>
                    )}

                    {/* Flash Toggle */}
                    {hasFlash && isScannerStarted && (
                        <button 
                            onClick={toggleFlash}
                            className={`absolute top-4 left-4 z-20 p-3 rounded-full transition-all ${isFlashOn ? 'bg-amber-400 text-slate-900 shadow-lg' : 'bg-black/50 text-white border border-white/20'}`}
                        >
                            <Icon name={isFlashOn ? "sparkles" : "sparkles"} className="w-5 h-5" />
                        </button>
                    )}

                    {!isScannerStarted && !scannerError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
                            <Icon name="refresh-cw" className="w-10 h-10 animate-spin opacity-20 mb-4" />
                            <p className="text-sm opacity-50">جاري تهيئة الكاميرا...</p>
                        </div>
                    )}
                </div>

                {scannerError ? (
                    <div className="mt-6 w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl border border-red-100 dark:border-red-800 text-center">
                        <Icon name="close" className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="font-bold text-sm mb-3 whitespace-pre-wrap">{scannerError}</p>
                        <button 
                            onClick={startScanner}
                            className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-bold active:scale-95 transition-transform"
                        >
                            إعادة المحاولة
                        </button>
                    </div>
                ) : (
                    <div className="mt-6 text-center space-y-2">
                        <div className="flex items-center justify-center gap-2 group">
                            <div className="flex gap-1">
                                <span className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                وجه الكاميرا نحو الكود
                            </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                            تأكد من وضوح الكود داخل الإطار المخصص. سيتم القراءة تلقائياً عند التعرف.
                        </p>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scan-move {
                    0%, 100% { top: 20%; transform: translateY(0); opacity: 0.2; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    50% { top: 80%; transform: translateY(-100%); opacity: 0.8; }
                }
                .animate-scan-move {
                    animation: scan-move 2.5s ease-in-out infinite;
                }
            `}</style>
        </Modal>
    );
};

export default InAppScannerModal;
