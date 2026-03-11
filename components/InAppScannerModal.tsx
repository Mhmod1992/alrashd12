import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

declare const Html5Qrcode: any;

interface InAppScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
}

const InAppScannerModal: React.FC<InAppScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
    const onScanSuccessRef = useRef(onScanSuccess);
    const scannerRef = useRef<any>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        onScanSuccessRef.current = onScanSuccess;
    }, [onScanSuccess]);

    // Ref to prevent multiple scan callbacks from firing in quick succession
    const hasScannedRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            // Stop scanner if modal closes
            if (scannerRef.current && isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current.clear();
                    setIsScanning(false);
                }).catch((err: any) => console.error("Failed to stop scanner", err));
            }
            return;
        }
        
        // Reset the scanned flag every time the modal opens
        hasScannedRef.current = false;
        setErrorMsg('');

        if (typeof Html5Qrcode === 'undefined') {
            setErrorMsg("مكتبة المسح غير متوفرة.");
            return;
        }

        const startScanner = async () => {
            try {
                const html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;

                const config = {
                    fps: 15, // High frame rate for faster detection
                    // No qrbox specified = full frame scanning (much better for detection)
                    aspectRatio: 1.0, 
                    disableFlip: false,
                };

                // Request high resolution and continuous focus from the environment (back) camera
                const cameraConfig = {
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    advanced: [{ focusMode: "continuous" }]
                };

                await html5QrCode.start(
                    cameraConfig,
                    config,
                    (decodedText: string) => {
                        // Success callback
                        if (!hasScannedRef.current) {
                            hasScannedRef.current = true;
                            // Stop scanner immediately upon success to freeze frame and prevent duplicate reads
                            html5QrCode.stop().then(() => {
                                setIsScanning(false);
                                onScanSuccessRef.current(decodedText);
                            }).catch((err: any) => {
                                console.error("Failed to stop scanner after success", err);
                                onScanSuccessRef.current(decodedText); // Proceed anyway
                            });
                        }
                    },
                    (errorMessage: string) => {
                        // Error callback (called frequently when no QR is in frame, ignore)
                    }
                );
                setIsScanning(true);
            } catch (err) {
                console.error("Error starting scanner", err);
                setErrorMsg("تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الصلاحيات.");
            }
        };

        // Small delay to ensure the DOM element is fully rendered before starting
        const timer = setTimeout(() => {
            startScanner();
        }, 100);

        // Cleanup function for when the modal closes or component unmounts
        return () => {
            clearTimeout(timer);
            if (scannerRef.current && isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current.clear();
                }).catch((error: any) => {
                    console.error("Failed to clear html5-qrcode on cleanup.", error);
                });
            }
        };
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="مسح رمز الاستجابة السريعة" size="lg">
            <div className="flex flex-col items-center relative">
                {errorMsg ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg text-center w-full">
                        {errorMsg}
                    </div>
                ) : (
                    <div className="relative w-full max-w-md aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner">
                        <div id="reader" className="w-full h-full object-cover"></div>
                        
                        {/* Overlay to guide user, but scanning happens full-frame */}
                        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 z-10"></div>
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                            <div className="w-3/4 h-3/4 border-2 border-white/50 rounded-xl relative">
                                {/* Corner markers */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
                                
                                {/* Scanning line animation */}
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_8px_2px_rgba(59,130,246,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
                            </div>
                        </div>
                    </div>
                )}
                <p className="mt-6 text-slate-600 dark:text-slate-300 text-center font-medium bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg">
                    وجّه الكاميرا نحو رمز QR الموجود في التقرير
                </p>
                <style>{`
                    @keyframes scan {
                        0% { top: 0%; opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { top: 100%; opacity: 0; }
                    }
                    /* Hide default Html5Qrcode UI elements if they appear */
                    #reader__dashboard_section_csr span { display: none !important; }
                    #reader__dashboard_section_swaplink { display: none !important; }
                    #reader__header_message { display: none !important; }
                `}</style>
            </div>
        </Modal>
    );
};

export default InAppScannerModal;
