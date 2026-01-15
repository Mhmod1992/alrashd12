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
    // Use a ref to hold the latest callback to avoid re-running the effect with every render
    const onScanSuccessRef = useRef(onScanSuccess);
    useEffect(() => {
        onScanSuccessRef.current = onScanSuccess;
    }, [onScanSuccess]);

    // Ref to prevent multiple scan callbacks from firing in quick succession
    const hasScannedRef = useRef(false);

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

        const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                supportedScanTypes: [0], // SCAN_TYPE_CAMERA
                // Use videoConstraints for a stronger request for the back camera
                videoConstraints: {
                    facingMode: { exact: "environment" }
                }
            },
            /* verbose= */ false);

        const successCallback = (decodedText: string) => {
            // Only process the first successful scan
            if (!hasScannedRef.current) {
                hasScannedRef.current = true; // Set the flag
                onScanSuccessRef.current(decodedText);
            }
        };

        const errorCallback = (errorMessage: string) => {
            // Ignore frequent "QR code not found" messages to keep the console clean
            if (!errorMessage.toLowerCase().includes('qr code not found')) {
                console.warn(`QR Scanner Error: ${errorMessage}`);
            }
        };

        html5QrcodeScanner.render(successCallback, errorCallback);

        // Cleanup function for when the modal closes or component unmounts
        return () => {
            if (html5QrcodeScanner && html5QrcodeScanner.getState() !== 1) { // 1 is NOT_STARTED
                html5QrcodeScanner.clear().catch((error: any) => {
                    // This can happen if the component unmounts quickly. Safe to ignore.
                    console.error("Failed to clear html5-qrcode-scanner on cleanup.", error);
                });
            }
        };
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="مسح رمز الاستجابة السريعة" size="lg">
            <div className="flex flex-col items-center">
                <div id="reader" className="w-full max-w-md aspect-square"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400 text-center">
                    وجّه الكاميرا نحو رمز QR الموجود في التقرير لفتح الطلب مباشرة.
                </p>
            </div>
        </Modal>
    );
};

export default InAppScannerModal;
