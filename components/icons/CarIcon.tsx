
import React from 'react';

const CarIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H12c-.6 0-1.2.2-1.7.7L8 10H6c-.6 0-1.1.4-1.1 1v3c0 .6.4 1 1 1h2" />
    <circle cx="9" cy="17" r="2" />
    <circle cx="15" cy="17" r="2" />
  </svg>
);

export default CarIcon;
