import React, { useEffect, useRef } from 'react';
import Modal from './Modal';
import Icon from './Icon';

declare const Html5QrcodeScanner: any;

interface InAppScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
}

const InAppScannerModal: React.FC<InAppScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
    const onScanSuccessRef = useRef(onScanSuccess);
    
    useEffect(() => {
        onScanSuccessRef.current = onScanSuccess;
    }, [onScanSuccess]);

    // Ref to prevent multiple scan callbacks from firing in quick succession
    const hasScannedRef = useRef(false);
    const scannerInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        
        // Reset the scanned flag every time the modal opens
        hasScannedRef.current = false;

        if (typeof Html5QrcodeScanner === 'undefined') {
            console.error("Html5QrcodeScanner library is not loaded.");
            return;
        }

        // Small delay to ensure the modal animation finishes and the DOM is fully ready
        const timer = setTimeout(() => {
            try {
                const html5QrcodeScanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 20, // High frame rate for faster detection
                        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                            // 95% of the smaller dimension to simulate full-frame safely
                            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                            const size = Math.floor(minEdge * 0.95);
                            return { width: size, height: size };
                        },
                        aspectRatio: 1.0,
                        supportedScanTypes: [0], // SCAN_TYPE_CAMERA
                        disableFlip: true,
                        // Removed strict width/height to prevent black screen on some devices
                        videoConstraints: {
                            facingMode: "environment"
                        }
                    },
                    /* verbose= */ false
                );

                scannerInstanceRef.current = html5QrcodeScanner;

                const successCallback = (decodedText: string) => {
                    // Only process the first successful scan
                    if (!hasScannedRef.current) {
                        hasScannedRef.current = true; // Set the flag
                        
                        // Stop scanner immediately upon success
                        if (scannerInstanceRef.current) {
                            scannerInstanceRef.current.clear().catch(console.error);
                        }
                        
                        onScanSuccessRef.current(decodedText);
                    }
                };

                const errorCallback = (errorMessage: string) => {
                    // Ignore frequent "QR code not found" messages to keep the console clean
                    if (!errorMessage.toLowerCase().includes('qr code not found')) {
                        // console.warn(`QR Scanner Error: ${errorMessage}`);
                    }
                };

                html5QrcodeScanner.render(successCallback, errorCallback);
            } catch (err) {
                console.error("Failed to initialize scanner:", err);
            }
        }, 400); // 400ms delay matches the modal slide-in animation duration

        // Cleanup function for when the modal closes or component unmounts
        return () => {
            clearTimeout(timer);
            if (scannerInstanceRef.current) {
                try {
                    const state = scannerInstanceRef.current.getState();
                    if (state !== 1) { // 1 is NOT_STARTED
                        scannerInstanceRef.current.clear().catch((error: any) => {
                            console.error("Failed to clear html5-qrcode-scanner on cleanup.", error);
                        });
                    }
                } catch (e) {
                    console.error("Error during scanner cleanup", e);
                }
            }
        };
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="مسح رمز الاستجابة السريعة" size="lg">
            <div className="flex flex-col items-center relative">
                <div className="relative w-full max-w-md mx-auto">
                    {/* The scanner will inject its UI here. Removed strict height/bg classes so it sizes naturally */}
                    <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-inner bg-slate-50 dark:bg-slate-900"></div>
                    
                    {/* Custom Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                        <div className="w-[95%] h-[95%] border-2 border-white/30 rounded-xl relative">
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
                    /* Make sure the video fills the container */
                    #reader video { object-fit: cover !important; width: 100% !important; border-radius: 1rem; }
                    /* Hide the default border of the reader */
                    #reader { border: none !important; }
                    /* Style the default permission button if it shows up */
                    #reader button { 
                        background-color: #3b82f6 !important; 
                        color: white !important; 
                        padding: 0.5rem 1rem !important; 
                        border-radius: 0.5rem !important; 
                        border: none !important;
                        font-family: inherit !important;
                        cursor: pointer !important;
                        z-index: 50 !important;
                        position: relative !important;
                        margin-top: 1rem !important;
                        margin-bottom: 1rem !important;
                    }
                `}</style>
            </div>
        </Modal>
    );
};

export default InAppScannerModal;
