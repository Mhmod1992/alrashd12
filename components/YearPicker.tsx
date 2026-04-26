
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ar } from 'date-fns/locale/ar';

interface YearPickerProps {
    value: number;
    onChange: (year: number) => void;
    className?: string;
    placeholder?: string;
    required?: boolean;
}

const YearPicker: React.FC<YearPickerProps> = ({ value, onChange, className, placeholder, required }) => {
    return (
        <div className="w-full relative custom-year-picker">
            <style>
                {`
                .custom-year-picker .react-datepicker-wrapper { width: 100%; }
                .custom-year-picker .react-datepicker__header { background-color: white; border-bottom: 1px solid #f1f5f9; }
                .custom-year-picker .react-datepicker__year-text--selected { background-color: #2563eb !important; border-radius: 0.5rem; }
                .dark .custom-year-picker .react-datepicker { background-color: #1e293b; border-color: #334155; color: white; }
                .dark .custom-year-picker .react-datepicker__header { background-color: #1e293b; border-bottom-color: #334155; }
                .dark .custom-year-picker .react-datepicker__year-text { color: #cbd5e1; }
                .dark .custom-year-picker .react-datepicker__year-text:hover { background-color: #334155; }
                .dark .custom-year-picker .react-datepicker__current-year { color: white; }
                `}
            </style>
            <DatePicker
                selected={value ? new Date(value, 0, 1) : null}
                onChange={(date: Date | null) => {
                    if (date) onChange(date.getFullYear());
                }}
                showYearPicker
                dateFormat="yyyy"
                locale={ar}
                placeholderText={placeholder || "اختر السنة"}
                className={className}
                required={required}
            />
        </div>
    );
};

export default YearPicker;
