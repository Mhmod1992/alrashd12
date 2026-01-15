import React from 'react';

const HistoryIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M12 8v4l3 3" />
    <path d="M3.05 11a9 9 0 1 1 .5 4m-3.5-4a9 9 0 0 0 10.4 7.9" />
  </svg>
);

export default HistoryIcon;