
import React, { useState, useRef, useEffect } from 'react';

// Local Icons for AudioPlayer
const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;

const formatTime = (timeInSeconds: number) => {
    const totalSeconds = Math.floor(timeInSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<{ audioData: string; duration: number }> = ({ audioData, duration }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            const onTimeUpdate = () => setCurrentTime(audio.currentTime);
            const onEnded = () => {
                setIsPlaying(false);
                setCurrentTime(0);
            };

            audio.addEventListener('timeupdate', onTimeUpdate);
            audio.addEventListener('ended', onEnded);
            
            return () => {
                audio.removeEventListener('timeupdate', onTimeUpdate);
                audio.removeEventListener('ended', onEnded);
            };
        }
    }, []);
    
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-2 w-full">
            <audio ref={audioRef} src={audioData} preload="metadata" crossOrigin="anonymous"></audio>
            <button onClick={togglePlayPause} className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200">
                {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </button>
            <div className="flex-grow flex items-center gap-2">
                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1">
                    <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 w-14 text-center">
                    {formatTime(currentTime)}
                </span>
            </div>
        </div>
    );
};

export default AudioPlayer;
