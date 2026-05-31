import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('@app_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setIsDarkMode(settings.darkMode || false);
      }
    } catch (error) {
    }
  };

  const toggleDarkMode = async (value) => {
    setIsDarkMode(value);
    try {
      const savedSettings = await AsyncStorage.getItem('@app_settings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      settings.darkMode = value;
      await AsyncStorage.setItem('@app_settings', JSON.stringify(settings));
    } catch (error) {
    }
  };

  const theme = {
    isDarkMode,
    colors: {
      background: isDarkMode ? '#0F172A' : '#F8FAFC',
      cardBackground: isDarkMode ? '#1E293B' : '#FFFFFF',
      text: isDarkMode ? '#F1F5F9' : '#1E293B',
      textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
      textTertiary: isDarkMode ? '#64748B' : '#94A3B8',
      border: isDarkMode ? '#334155' : '#E2E8F0',
      primary: '#0891B2',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      statusBar: isDarkMode ? 'light-content' : 'dark-content',
      statusBarBg: isDarkMode ? '#0F172A' : '#F8FAFC',
    },
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
