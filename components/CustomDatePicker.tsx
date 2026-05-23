import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ar } from 'date-fns/locale/ar';

registerLocale('ar', ar);

interface CustomDatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    minDate?: Date | null;
    maxDate?: Date | null;
    disabled?: boolean;
    id?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    value,
    onChange,
    placeholder = 'اختر التاريخ',
    className = '',
    minDate,
    maxDate = new Date(), // يمنع اختيار تواريخ مستقبلية كوضع افتراضي
    disabled = false,
    id
}) => {
    // Parse value string (YYYY-MM-DD) into Date object
    const selectedDate = value ? new Date(value) : null;

    const handleChange = (date: Date | null) => {
        if (!date) {
            onChange('');
            return;
        }
        // Format to YYYY-MM-DD to preserve local timezone day selection
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
    };

    return (
        <div className="w-full custom-datepicker-container relative" style={{ direction: 'rtl' }}>
             <style>
                {`
                .custom-datepicker-container .react-datepicker-wrapper {
                    width: 100%;
                }
                .custom-datepicker-container .react-datepicker-popper {
                    z-index: 1000 !important;
                }
                .custom-datepicker-container .react-datepicker {
                    font-family: inherit;
                    border: none;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    border-radius: 1rem;
                    direction: rtl;
                }
                .custom-datepicker-container .react-datepicker__header {
                    background-color: white;
                    border-bottom: 1px solid #f1f5f9;
                    border-top-right-radius: 1rem;
                    border-top-left-radius: 1rem;
                    padding-top: 1rem;
                }
                .custom-datepicker-container .react-datepicker__current-month {
                    font-weight: 800;
                    font-size: 0.9rem;
                    color: #1e293b;
                    margin-bottom: 0.5rem;
                }
                .custom-datepicker-container .react-datepicker__day-name {
                    color: #94a3b8;
                    font-weight: 700;
                    width: 2.2rem;
                }
                .custom-datepicker-container .react-datepicker__day {
                    width: 2.2rem;
                    line-height: 2.2rem;
                    border-radius: 0.5rem;
                    color: #475569;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .custom-datepicker-container .react-datepicker__day:hover {
                    background-color: #f1f5f9;
                    color: #2563eb;
                }
                .custom-datepicker-container .react-datepicker__day--selected {
                    background-color: #2563eb !important;
                    color: white !important;
                    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
                }
                .custom-datepicker-container .react-datepicker__day--keyboard-selected {
                    background-color: #eff6ff;
                    color: #2563eb;
                }
                .custom-datepicker-container .react-datepicker__day--disabled {
                    color: #cbd5e1 !important;
                    cursor: not-allowed;
                    background-color: transparent !important;
                    opacity: 0.5;
                }
                .custom-datepicker-container .react-datepicker__day--outside-month {
                    color: #cbd5e1;
                    font-weight: 400;
                }
                .custom-datepicker-container .react-datepicker__navigation {
                    top: 1.2rem;
                }
                .custom-datepicker-container .react-datepicker__navigation--next {
                    left: 1rem;
                    right: auto;
                }
                .custom-datepicker-container .react-datepicker__navigation--previous {
                    right: 1rem;
                    left: auto;
                }
                .custom-datepicker-container .react-datepicker__input-container input {
                    width: 100%;
                    text-align: right;
                    direction: ltr;
                }
                .custom-datepicker-container .react-datepicker__close-icon {
                    right: auto;
                    left: 0;
                    padding-left: 0.75rem;
                    padding-right: 0;
                }
                .custom-datepicker-container .react-datepicker__close-icon::after {
                    background-color: #3b82f6;
                }
                .dark .custom-datepicker-container .react-datepicker {
                    background-color: #1e293b;
                    color: #f1f5f9;
                    border: 1px solid #334155;
                }
                .dark .custom-datepicker-container .react-datepicker__header {
                    background-color: #1e293b;
                    border-bottom: 1px solid #334155;
                }
                .dark .custom-datepicker-container .react-datepicker__current-month {
                    color: #f1f5f9;
                }
                .dark .custom-datepicker-container .react-datepicker__day {
                    color: #cbd5e1;
                }
                .dark .custom-datepicker-container .react-datepicker__day:hover {
                    background-color: #334155;
                }
                .dark .custom-datepicker-container .react-datepicker__day--disabled {
                    color: #475569 !important;
                    background-color: transparent !important;
                }
                .dark .custom-datepicker-container .react-datepicker__day--outside-month {
                    color: #475569;
                }
                `}
            </style>
            <DatePicker
                id={id}
                selected={selectedDate}
                onChange={handleChange}
                dateFormat="yyyy/MM/dd"
                placeholderText={placeholder}
                className={className}
                minDate={minDate || undefined}
                maxDate={maxDate || undefined}
                disabled={disabled}
                isClearable={!disabled}
                locale="ar"
                renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
                    <div className="flex justify-between items-center px-4 pb-2">
                        <button onClick={decreaseMonth} type="button" className="text-slate-400 hover:text-blue-500 transition-colors">
                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {('0' + (date.getMonth() + 1)).slice(-2)} / {date.getFullYear()}
                        </span>
                        <button onClick={increaseMonth} type="button" className="text-slate-400 hover:text-blue-500 transition-colors">
                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    </div>
                )}
            />
        </div>
    );
};

export default CustomDatePicker;
