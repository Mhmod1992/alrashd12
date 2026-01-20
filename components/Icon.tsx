
import React from 'react';
import PlusIcon from './icons/PlusIcon';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import PrinterIcon from './icons/PrinterIcon';
import TrashIcon from './icons/TrashIcon';
import EditIcon from './icons/EditIcon';
import CameraIcon from './icons/CameraIcon';
import DocumentReportIcon from './icons/DocumentReportIcon';
import SettingsIcon from './icons/SettingsIcon';
import SaveIcon from './icons/SaveIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import ClipboardListIcon from './icons/ClipboardListIcon';
import CarIcon from './icons/CarIcon';
import IdentificationIcon from './icons/IdentificationIcon';
import DownloadIcon from './icons/DownloadIcon';
import PhoneIcon from './icons/PhoneIcon';
import DollarSignIcon from './icons/DollarSignIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import XIcon from './icons/XIcon';
import HistoryIcon from './icons/HistoryIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ImageIcon from './icons/ImageIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import ViewfinderIcon from './icons/ViewfinderIcon';
import SparklesIcon from './icons/SparklesIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import CreditCardIcon from './icons/CreditCardIcon';
import BuildingStorefrontIcon from './icons/BuildingStorefrontIcon';
import MailIcon from './icons/MailIcon';
import SendIcon from './icons/SendIcon';
import FilterIcon from './icons/FilterIcon';
import LockIcon from './icons/LockIcon';
import SearchIcon from './icons/SearchIcon';
import EyeIcon from './icons/EyeIcon';
import ArchiveIcon from './icons/ArchiveIcon';
import StarIcon from './icons/StarIcon';
import WhatsappIcon from './icons/WhatsappIcon';
import CalendarClockIcon from './icons/CalendarClockIcon';
import CalendarCheckIcon from './icons/CalendarCheckIcon';
import UploadIcon from './icons/UploadIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';


interface IconProps {
  name: 'add' | 'lock' | 'back' | 'print' | 'delete' | 'edit' | 'camera' | 'document-report' | 'settings' | 'save' | 'chevron-right' | 'employee' | 'broker' | 'findings' | 'cars' | 'car' | 'report' | 'download' | 'phone' | 'dollar-sign' | 'microphone' | 'close' | 'history' | 'chevron-down' | 'check-circle' | 'gallery' | 'appearance' | 'scan-plate' | 'sparkles' | 'refresh-cw' | 'credit-card' | 'workshop' | 'mail' | 'send' | 'filter' | 'search' | 'eye' | 'archive' | 'star' | 'whatsapp' | 'calendar-clock' | 'calendar-check' | 'upload' | 'chevron-up' | 'share';
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, className }) => {
  switch (name) {
    case 'add':
      return <PlusIcon className={className} />;
    case 'lock':
      return <LockIcon className={className} />;
    case 'back':
      return <ArrowLeftIcon className={className} />;
    case 'print':
        return <PrinterIcon className={className} />;
    case 'delete':
        return <TrashIcon className={className} />;
    case 'edit':
        return <EditIcon className={className} />;
    case 'camera':
        return <CameraIcon className={className} />;
    case 'document-report':
        return <DocumentReportIcon className={className} />;
    case 'settings':
        return <SettingsIcon className={className} />;
    case 'save':
        return <SaveIcon className={className} />;
    case 'chevron-right':
        return <ChevronRightIcon className={className} />;
    case 'employee':
        return <UserCircleIcon className={className} />;
    case 'broker':
        return <BriefcaseIcon className={className} />;
    case 'findings':
        return <ClipboardListIcon className={className} />;
    case 'cars':
    case 'car':
        return <CarIcon className={className} />;
    case 'report':
        return <IdentificationIcon className={className} />;
    case 'download':
        return <DownloadIcon className={className} />;
    case 'phone':
        return <PhoneIcon className={className} />;
    case 'dollar-sign':
        return <DollarSignIcon className={className} />;
    case 'microphone':
        return <MicrophoneIcon className={className} />;
    case 'close':
        return <XIcon className={className} />;
    case 'history':
        return <HistoryIcon className={className} />;
    case 'chevron-down':
        return <ChevronDownIcon className={className} />;
    case 'chevron-up':
        return <ChevronUpIcon className={className} />;
    case 'check-circle':
        return <CheckCircleIcon className={className} />;
    case 'gallery':
        return <ImageIcon className={className} />;
    case 'appearance':
        return <PaintBrushIcon className={className} />;
    case 'scan-plate':
        return <ViewfinderIcon className={className} />;
    case 'sparkles':
        return <SparklesIcon className={className} />;
    case 'refresh-cw':
        return <RefreshCwIcon className={className} />;
    case 'credit-card':
        return <CreditCardIcon className={className} />;
    case 'workshop':
        return <BuildingStorefrontIcon className={className} />;
    case 'mail':
        return <MailIcon className={className} />;
    case 'send':
        return <SendIcon className={className} />;
    case 'filter':
        return <FilterIcon className={className} />;
    case 'search':
        return <SearchIcon className={className} />;
    case 'eye':
        return <EyeIcon className={className} />;
    case 'archive':
        return <ArchiveIcon className={className} />;
    case 'star':
        return <StarIcon className={className} />;
    case 'whatsapp':
        return <WhatsappIcon className={className} />;
    case 'calendar-clock':
        return <CalendarClockIcon className={className} />;
    case 'calendar-check':
        return <CalendarCheckIcon className={className} />;
    case 'upload':
    case 'share': // Map share to UploadIcon as it mimics the iOS share sheet icon
        return <UploadIcon className={className} />;
    default:
      return null;
  }
};

export default Icon;
