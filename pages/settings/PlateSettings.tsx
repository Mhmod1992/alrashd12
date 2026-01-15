
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Settings } from '../../types';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

const PlateSettings: React.FC = () => {
    const { settings, updateSettings, addNotification } = useAppContext();
    const [currentSettings, setCurrentSettings] = useState<Settings>(settings);

    const formInputClasses = "block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    useEffect(() => {
        setCurrentSettings(settings);
    }, [settings]);

    const handleSave = async () => {
        try {
            await updateSettings(currentSettings);
            addNotification({ title: 'نجاح', message: 'تم حفظ إعدادات اللوحة بنجاح!', type: 'success' });
        } catch (error) {
             console.error('Failed to save plate settings', error);
        }
    };
    
    const handlePlateCharChange = (index: number, key: 'ar' | 'en', value: string) => {
        setCurrentSettings(prev => {
           const updatedChars = [...prev.plateCharacters];
           updatedChars[index] = { ...updatedChars[index], [key]: value };
           return {...prev, plateCharacters: updatedChars};
        });
    };
    
    const addPlateChar = () => {
        setCurrentSettings(prev => ({
            ...prev,
            plateCharacters: [...prev.plateCharacters, { ar: '', en: '' }],
        }));
    }

    const removePlateChar = (index: number) => {
        setCurrentSettings(prev => ({
            ...prev,
            plateCharacters: prev.plateCharacters.filter((_, i) => i !== index),
        }));
    }

    return (
         <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div>
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">أحرف اللوحة</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    قم بتعريف الأحرف العربية وما يقابلها باللغة الإنجليزية ليتم ترجمة اللوحات تلقائياً في النظام.
                </p>
                
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-center">
                        <span>الحرف العربي</span>
                        <span>الحرف الإنجليزي</span>
                        <span className="w-10"></span>
                    </div>
                    
                    <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar space-y-3">
                        {currentSettings.plateCharacters.map((char, index) => (
                            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center animate-fade-in">
                                <input 
                                    type="text" 
                                    value={char.ar} 
                                    onChange={e => handlePlateCharChange(index, 'ar', e.target.value)} 
                                    className={`${formInputClasses} text-center font-bold text-lg`} 
                                    placeholder="ع"
                                />
                                <input 
                                    type="text" 
                                    value={char.en} 
                                    onChange={e => handlePlateCharChange(index, 'en', e.target.value.toUpperCase())} 
                                    className={`${formInputClasses} text-center font-bold text-lg uppercase`} 
                                    placeholder="E"
                                />
                                <button 
                                    onClick={() => removePlateChar(index)} 
                                    className="text-red-500 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="حذف الحرف"
                                >
                                    <Icon name="delete" className="w-5 h-5"/>
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700">
                        <button 
                            onClick={addPlateChar} 
                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-bold flex items-center justify-center gap-2"
                        >
                            <Icon name="add" className="w-5 h-5" />
                            إضافة حرف جديد
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-6 border-t dark:border-slate-700">
                <Button onClick={handleSave} leftIcon={<Icon name="save" className="w-5 h-5"/>}>
                    حفظ التغييرات
                </Button>
            </div>
        </div>
    );
};

export default PlateSettings;
