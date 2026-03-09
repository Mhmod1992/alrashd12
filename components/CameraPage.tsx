
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Icon from './Icon';

interface CameraPageProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraPage: React.FC<CameraPageProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    const startCamera = async () => {
      if (isOpen) {
        stopCamera();
        setError(null);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setError("لا يمكن الوصول إلى الكاميرا. يرجى التأكد من منح الصلاحية.");
        }
      } else {
        stopCamera();
      }
    };
    startCamera();
    return () => stopCamera();
  }, [isOpen, stopCamera]);
  
  const handleCaptureClick = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    const targetRatio = 1 / 1;
    const videoRatio = videoWidth / videoHeight;
    
    let cropWidth = videoWidth;
    let cropHeight = videoHeight;
    let cropX = 0;
    let cropY = 0;
    
    if (videoRatio > targetRatio) {
      cropWidth = videoHeight * targetRatio;
      cropX = (videoWidth - cropWidth) / 2;
    } else {
      cropHeight = videoWidth / targetRatio;
      cropY = (videoHeight - cropHeight) / 2;
    }
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      }
      onClose();
    }, 'image/jpeg', 0.9);
  };
  
   const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    // @ts-ignore
    if (capabilities.focusMode && capabilities.focusMode.includes('manual') && capabilities.pointsOfInterest) {
      const rect = video.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      track.applyConstraints({
        advanced: [{
          pointsOfInterest: [{ x, y }]
        } as any]
      }).catch(e => console.error("Tap to focus failed:", e));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[110] flex flex-col items-center justify-center animate-fade-in p-4" dir="ltr">
      <div className="relative w-full max-w-[min(100%,_85vh)] aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" onClick={handleVideoClick} />
        
        {error && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-center p-4 z-10" dir="rtl">
              <h3 className="text-2xl font-bold">حدث خطأ</h3>
              <p className="mt-2 text-lg">{error}</p>
          </div>
        )}

        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="bg-black/50 text-white rounded-full p-3 hover:bg-black/75 transition-colors">
              <Icon name="close" className="w-6 h-6" />
          </button>
        </div>
        
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <button 
              onClick={handleCaptureClick} 
              disabled={!!error}
              className="w-20 h-20 rounded-full bg-white ring-4 ring-white/30 disabled:bg-gray-400 disabled:opacity-50 transition-all"
              aria-label="التقاط صورة"
          />
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};

export default CameraPage;