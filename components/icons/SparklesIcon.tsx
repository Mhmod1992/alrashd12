
import React from 'react';

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" opacity="0.2" fill="currentColor" stroke="none" />
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path d="M12 8V2" />
    <path d="M15 10.5 19.5 6" />
    <path d="M16 12h6" />
    <path d="M15 13.5 19.5 18" />
    <path d="M12 16v6" />
    <path d="M9 13.5 4.5 18" />
    <path d="M8 12H2" />
    <path d="M9 10.5 4.5 6" />
  </svg>
);

export default SparklesIcon;
