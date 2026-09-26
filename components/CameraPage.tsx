import React, { useRef, useEffect, useState, useCallback } from 'react';
import Icon from './Icon';

interface CameraPageProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

type AspectRatioMode = '16:9' | 'full';

const CameraPage: React.FC<CameraPageProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>('16:9');
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("لا يمكن الوصول إلى الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // Flip Camera (Front / Back)
  const handleToggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Tap to Focus
  const handleVideoClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !streamRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    setFocusPoint({ x: clientX, y: clientY });
    setTimeout(() => setFocusPoint(null), 1200);

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = (track.getCapabilities && track.getCapabilities()) || {};

      // @ts-ignore
      if (capabilities.focusMode && capabilities.focusMode.includes('manual') && capabilities.pointsOfInterest) {
        const x = clientX / rect.width;
        const y = clientY / rect.height;
        track.applyConstraints({
          advanced: [{
            pointsOfInterest: [{ x, y }]
          } as any]
        }).catch(e => console.error("Tap to focus failed:", e));
      }
    } catch (e) {
      // Ignore if not supported by browser
    }
  };

  // Capture & Exact Crop Logic
  const handleCaptureClick = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    if (!vW || !vH) return;

    // Trigger shutter flash
    setIsFlashing(true);
    if ('vibrate' in navigator) {
      try { navigator.vibrate(50); } catch (e) { /* ignore */ }
    }
    setTimeout(() => setIsFlashing(false), 150);

    if (aspectMode === 'full' || !frameRef.current) {
      // Capture full video frame
      canvas.width = vW;
      canvas.height = vH;
      context.drawImage(video, 0, 0, vW, vH);
    } else {
      // Precise Viewfinder Frame Crop
      const videoRect = video.getBoundingClientRect();
      const frameRect = frameRef.current.getBoundingClientRect();

      // Calculate rendered video dimensions with object-cover
      const videoRatio = vW / vH;
      const elemRatio = videoRect.width / videoRect.height;

      let renderedW = videoRect.width;
      let renderedH = videoRect.height;
      let scale = 1;

      if (elemRatio > videoRatio) {
        // Video is scaled to match element width
        scale = videoRect.width / vW;
        renderedH = vH * scale;
      } else {
        // Video is scaled to match element height
        scale = videoRect.height / vH;
        renderedW = vW * scale;
      }

      const renderedLeft = videoRect.left + (videoRect.width - renderedW) / 2;
      const renderedTop = videoRect.top + (videoRect.height - renderedH) / 2;

      // Calculate frame offset in rendered video coordinates
      const cropX_rendered = Math.max(0, frameRect.left - renderedLeft);
      const cropY_rendered = Math.max(0, frameRect.top - renderedTop);
      const cropW_rendered = Math.min(renderedW, frameRect.right - renderedLeft) - cropX_rendered;
      const cropH_rendered = Math.min(renderedH, frameRect.bottom - renderedTop) - cropY_rendered;

      // Convert to native video source pixels
      const sx = Math.max(0, cropX_rendered / scale);
      const sy = Math.max(0, cropY_rendered / scale);
      const sw = Math.min(vW - sx, cropW_rendered / scale);
      const sh = Math.min(vH - sy, cropH_rendered / scale);

      // Output high-resolution 16:9 canvas
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);

      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      }
      onClose();
    }, 'image/jpeg', 0.92);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-[110] flex flex-col items-center justify-between overflow-hidden select-none animate-fade-in" dir="rtl">
      
      {/* Background Video Stream */}
      <div className="absolute inset-0 w-full h-full overflow-hidden cursor-crosshair" onClick={handleVideoClick}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Focus Tap Ring Animation */}
        {focusPoint && (
          <div
            className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 border-2 border-amber-400 rounded-full animate-ping pointer-events-none z-30"
            style={{ left: focusPoint.x, top: focusPoint.y }}
          />
        )}
      </div>

      {/* Shutter Flash Overlay */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Top Header Bar */}
      <div className="relative z-30 w-full max-w-4xl px-4 py-3 sm:py-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-95"
          title="إغلاق"
        >
          <Icon name="close" className="w-6 h-6" />
        </button>

        {/* Viewfinder Mode Info Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{aspectMode === '16:9' ? 'إطار التقرير (16:9) - يتم حفظ ما بداخل الإطار فقط' : 'كامل الشاشة'}</span>
        </div>

        {/* Mode Toggles */}
        <div className="flex items-center gap-2">
          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2.5 rounded-full backdrop-blur-md transition-all active:scale-95 ${
              showGrid ? 'bg-amber-500/80 text-white' : 'bg-white/20 text-white/80 hover:bg-white/30'
            }`}
            title="الشبكة الإرشادية"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          </button>

          {/* Aspect Ratio Toggle (16:9 vs Full) */}
          <button
            onClick={() => setAspectMode(prev => (prev === '16:9' ? 'full' : '16:9'))}
            className={`px-3 py-1.5 rounded-full text-xs font-black backdrop-blur-md transition-all active:scale-95 border ${
              aspectMode === '16:9'
                ? 'bg-blue-600/90 text-white border-blue-400/50 shadow-md'
                : 'bg-white/20 text-white/90 border-white/20 hover:bg-white/30'
            }`}
            title="تغيير أبعاد الإطار"
          >
            {aspectMode === '16:9' ? '16:9' : 'كامل'}
          </button>
        </div>
      </div>

      {/* Center Viewfinder Guide (16:9 Mask Overlay) */}
      {aspectMode === '16:9' ? (
        <div className="relative z-20 w-full flex-1 flex items-center justify-center p-4 pointer-events-none">
          <div
            ref={frameRef}
            className="relative w-full max-w-xl sm:max-w-2xl aspect-[16/9] rounded-xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] border-2 border-white/40"
          >
            {/* 4 Corner Accent Brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-md" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-md" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-md" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-md" />

            {/* Rule of Thirds Grid Lines */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-1/3 left-0 right-0 border-t border-white/60 border-dashed" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white/60 border-dashed" />
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/60 border-dashed" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/60 border-dashed" />
              </div>
            )}

            {/* Center Reticle Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
              <div className="w-8 h-8 border border-white/80 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              </div>
            </div>

            {/* Frame Watermark Tag */}
            <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-white/90 border border-white/20">
              حدود ظهور الصورة في التقرير
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-20 w-full flex-1 flex items-center justify-center p-4 pointer-events-none">
          {showGrid && (
            <div className="w-full h-full max-w-2xl max-h-[80vh] relative border border-white/30 rounded-xl opacity-40">
              <div className="absolute top-1/3 left-0 right-0 border-t border-white/60 border-dashed" />
              <div className="absolute top-2/3 left-0 right-0 border-t border-white/60 border-dashed" />
              <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/60 border-dashed" />
              <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/60 border-dashed" />
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white text-center p-6 z-40">
          <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
            <Icon name="close" className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">تعذر فتح الكاميرا</h3>
          <p className="text-sm text-slate-300 max-w-sm mb-6">{error}</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="relative z-30 w-full max-w-md px-6 py-5 pb-8 flex items-center justify-around bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        
        {/* Flip Camera Button */}
        <button
          onClick={handleToggleFacingMode}
          className="p-3.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-90"
          title="تبديل الكاميرا (أمامية / خلفية)"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.052.775 3.924 2.055 5.345M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8c0-2.052-.775-3.924-2.055-5.345" />
            <path d="M20 4v6h-6M4 20v-6h6" />
          </svg>
        </button>

        {/* Capture Shutter Button */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={handleCaptureClick}
            disabled={!!error}
            className="w-20 h-20 rounded-full bg-white ring-4 ring-white/40 active:scale-90 active:bg-slate-200 disabled:bg-gray-500 disabled:opacity-50 transition-all flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)]"
            aria-label="التقاط صورة"
          >
            <div className="w-16 h-16 rounded-full border-2 border-slate-900/20 bg-white" />
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="p-3.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-90"
          title="إلغاء"
        >
          <Icon name="close" className="w-6 h-6" />
        </button>
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraPage;
