// FIX: Import React to make types like React.Dispatch available.
import React, { useState, useEffect, useCallback } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Settings, SettingsPage, Employee, Permission, UserPreferences } from '../../types';
import { mockSettings } from '../../data/mockData';
import { supabase } from '../../lib/supabaseClient';
import { PERSONAL_SETTING_KEYS } from '../constants';

export const useThemeScope = (
    authUser: Employee | null,
    setAuthUser: React.Dispatch<React.SetStateAction<Employee | null>>,
    can: (permission: Permission) => boolean
) => {
    // Theme
    const [themeSetting, setThemeSetting] = useLocalStorage<'light' | 'dark' | 'system'>('theme', 'system');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    // Settings
    const [settingsPage, setSettingsPage] = useLocalStorage<SettingsPage>('currentSettingsPage', 'general');
    const [globalSettings, setGlobalSettings] = useState<Settings>(mockSettings);
    const [settings, setSettings] = useState<Settings>(mockSettings);
    const [isSetupComplete, setIsSetupComplete] = useState(true);

    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateTheme = () => {
            const isSystemDark = mediaQuery.matches;
            const isDark = themeSetting === 'dark' || (themeSetting === 'system' && isSystemDark);
            root.classList.toggle('dark', isDark);
            setTheme(isDark ? 'dark' : 'light');
        };
        updateTheme();
        mediaQuery.addEventListener('change', updateTheme);
        return () => mediaQuery.removeEventListener('change', updateTheme);
    }, [themeSetting]);

    const toggleTheme = useCallback(() => {
        setThemeSetting(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'system';
            return 'light';
        });
    }, [setThemeSetting]);

    useEffect(() => {
        if (authUser && authUser.preferences) {
            const userPrefs = authUser.preferences;
            setSettings({
                ...globalSettings,
                ...userPrefs
            });
        } else {
            setSettings(globalSettings);
        }
    }, [globalSettings, authUser]);

    const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
        const personalUpdates: Partial<UserPreferences> = {};
        const globalUpdates: Partial<Settings> = {};
        (Object.keys(newSettings) as Array<keyof Settings>).forEach(key => {
            if (PERSONAL_SETTING_KEYS.includes(key as any)) (personalUpdates as any)[key] = newSettings[key];
            else (globalUpdates as any)[key] = newSettings[key];
        });
        if (authUser && Object.keys(personalUpdates).length > 0) {
            const currentPrefs = authUser.preferences || {};
            const newPrefs = { ...currentPrefs, ...personalUpdates };
            const { error } = await supabase.from('employees').update({ preferences: newPrefs }).eq('id', authUser.id);
            if (!error) setAuthUser(prev => prev ? ({ ...prev, preferences: newPrefs }) : null);
        }
        if (Object.keys(globalUpdates).length > 0 && can('manage_settings_general')) {
            const updatedGlobalSettings = { ...globalSettings, ...globalUpdates };
            setGlobalSettings(updatedGlobalSettings);
            await supabase.from('app_settings').upsert({ id: 1, settings_data: updatedGlobalSettings });
        }
    }, [globalSettings, authUser, can, setAuthUser]);

    return {
        theme,
        toggleTheme,
        themeSetting,
        setThemeSetting,
        settingsPage,
        setSettingsPage,
        settings,
        setSettings,
        updateSettings,
        globalSettings,
        setGlobalSettings,
        isSetupComplete,
        setIsSetupComplete
    };
};