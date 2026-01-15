import React from 'react';
import { useAppContext } from '../context/AppContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'whatsapp';
  leftIcon?: React.ReactNode;
  size?: 'sm' | 'md';
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', leftIcon, className = '', size = 'md', ...props }) => {
  const { settings } = useAppContext();
  const design = settings.design || 'aero';

  const baseClasses = "flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-95";
  
  const getPrimaryVariant = () => {
    switch (design) {
        case 'classic':
            return 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500 shadow-md hover:shadow-lg';
        case 'glass':
            return 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 backdrop-blur-sm bg-opacity-90';
        default: // aero - Enhanced Gradient
            return 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 focus:ring-blue-500 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 border border-blue-400/20';
    }
  }

  const variantClasses = {
    primary: getPrimaryVariant(),
    secondary: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-slate-500 shadow-sm hover:shadow-md',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 focus:ring-red-500 shadow-lg shadow-red-500/30',
    whatsapp: 'bg-[#25D366] text-white hover:bg-[#128C7E] focus:ring-green-500 shadow-md shadow-green-500/20',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
      {leftIcon}
      {children}
    </button>
  );
};

export default Button;