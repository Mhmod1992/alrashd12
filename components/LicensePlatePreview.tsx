
import React, { useMemo } from 'react';
import { PlatePreviewSettings, PlateCharacterMap } from '../types';

interface LicensePlatePreviewProps {
    arabicTop: string; // Numbers (Arabic)
    arabicBottom: string; // Letters (Arabic)
    englishTop: string; // Letters (English)
    englishBottom: string; // Numbers (English)
    settings: PlatePreviewSettings;
    plateCharacters?: PlateCharacterMap[];
}

const LicensePlatePreview: React.FC<LicensePlatePreviewProps> = ({ 
    arabicTop, 
    arabicBottom, 
    englishTop, 
    englishBottom, 
    settings,
    plateCharacters
}) => {
    
    const containerStyle: React.CSSProperties = {
        backgroundColor: settings.backgroundColor,
        borderColor: settings.borderColor,
        borderWidth: '2px',
    };

    const textStyle: React.CSSProperties = {
        color: settings.fontColor,
        fontFamily: settings.fontFamily,
    };

    const separatorStyle: React.CSSProperties = {
        width: settings.separatorWidth,
        height: settings.separatorHeight,
        margin: '0 0.25rem',
    };

    // Create a map for fast lookup if characters are provided
    const arToEnMap = useMemo(() => {
        if (!plateCharacters) return null;
        const map = new Map<string, string>();
        plateCharacters.forEach(pc => map.set(pc.ar.replace('ـ', ''), pc.en));
        return map;
    }, [plateCharacters]);

    // Clean inputs to get arrays of characters
    const arLetters = arabicBottom.replace(/\s/g, '').split('');
    
    let enLetters: string[];

    if (arToEnMap && arLetters.length > 0) {
        // If map is available, derive English letters directly from Arabic letters
        // This ensures visual alignment regardless of string direction/order input
        enLetters = arLetters.map(char => arToEnMap.get(char) || '');
    } else {
        // Fallback for previews without map (e.g. settings page dummy data) or if Arabic is empty
        // We do NOT reverse here anymore, assuming input is LTR English matching RTL Arabic visual slots naturally 
        // or handled by parent. For standard "V J H" preview, direct mapping works best.
        enLetters = englishTop.replace(/\s/g, '').split('');
    }

    const arNumbers = arabicTop.replace(/\s/g, '').split('');
    const enNumbers = englishBottom.replace(/\s/g, '').split('');

    // Ensure arrays align by length
    const maxLetters = Math.max(arLetters.length, enLetters.length);
    const maxNumbers = Math.max(arNumbers.length, enNumbers.length);

    let fontSizeClass = 'text-2xl';
    if (Math.max(maxLetters, maxNumbers) > 3) {
        fontSizeClass = 'text-xl';
    }

    return (
        <div 
            className="w-full max-w-sm mx-auto rounded-lg flex items-center justify-between p-2 shadow-md"
            style={containerStyle}
        >
            {/* KSA Flag part */}
            <div className="flex flex-col items-center justify-center px-2 flex-shrink-0">
                <span className="text-xs font-bold" style={{color: settings.fontColor}}>KSA</span>
                <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Flag_of_Saudi_Arabia.svg/23px-Flag_of_Saudi_Arabia.svg.png" 
                    alt="KSA Flag" 
                    className="h-3"
                />
            </div>
            
            {/* Main Content */}
            <div className="flex items-stretch justify-evenly flex-grow min-w-0 h-full">
                
                {/* Letters Block (Right Side) */}
                {/* dir="rtl" ensures the 1st character (index 0) is visually on the RIGHT */}
                <div 
                    className="flex flex-row items-center justify-center gap-1 sm:gap-2 px-1 flex-grow"
                    dir="rtl"
                >
                    {Array.from({ length: maxLetters }).map((_, i) => (
                        <div key={`letter-${i}`} className="flex flex-col items-center justify-center">
                            <span className={`font-bold leading-none mb-1 ${fontSizeClass}`} style={textStyle}>
                                {arLetters[i] || ''}
                            </span>
                            <span className={`font-bold leading-none ${fontSizeClass}`} style={textStyle}>
                                {enLetters[i] || ''}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Separator */}
                {settings.separatorImageUrl ? (
                    <img 
                        src={settings.separatorImageUrl} 
                        alt="Separator" 
                        className="object-contain self-center" 
                        style={separatorStyle} 
                    />
                ) : (
                    <div 
                        className="self-center flex-shrink-0"
                        style={{ ...separatorStyle, width: '2px', backgroundColor: settings.borderColor, height: '60%' }} 
                    ></div>
                )}

                {/* Numbers Block (Left Side) */}
                {/* dir="ltr" ensures the 1st number (index 0) is visually on the LEFT */}
                <div 
                    className="flex flex-row items-center justify-center gap-1 sm:gap-2 px-1 flex-grow"
                    dir="ltr"
                >
                    {Array.from({ length: maxNumbers }).map((_, i) => (
                        <div key={`number-${i}`} className="flex flex-col items-center justify-center">
                            <span className={`font-bold leading-none mb-1 ${fontSizeClass}`} style={textStyle}>
                                {arNumbers[i] || ''}
                            </span>
                            <span className={`font-bold leading-none ${fontSizeClass}`} style={textStyle}>
                                {enNumbers[i] || ''}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default LicensePlatePreview;
