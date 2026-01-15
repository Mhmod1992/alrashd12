import React from 'react';

const ViewfinderIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="21" x2="12" y2="15" />
    <line x1="12" y1="9" x2="12" y2="3" />
    <line x1="21" y1="12" x2="15" y2="12" />
    <line x1="9" y1="12" x2="3" y2="12" />
  </svg>
);

export default ViewfinderIcon;