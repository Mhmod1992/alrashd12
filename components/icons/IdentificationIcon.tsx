
import React from 'react';

const IdentificationIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <rect width="18" height="12" x="3" y="6" rx="2" />
    <path d="M3 10h18" />
    <path d="M10 14h4" />
    <path d="M8 14v.01" />
  </svg>
);

export default IdentificationIcon;
