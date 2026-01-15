
import React, { Suspense, lazy } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import NotificationContainer from './components/NotificationContainer';
import ConfirmModal from './components/ConfirmModal';
import NewRequestSuccessModal from './components/NewRequestSuccessModal';
import { AppShellSkeleton } from './components/Skeleton';
import Modal from './components/Modal';
import InactiveAccount from './pages/InactiveAccount';
import GeneralManagerSetup from './pages/GeneralManagerSetup';
import Login from './pages/Login';
import InstallPwaBanner from './components/InstallPwaBanner';
import Button from './components/Button'; // Import Button
import RefreshCwIcon from './components/icons/RefreshCwIcon'; // Import Refresh Icon
import IncomingRequestNotifier from './components/IncomingRequestNotifier'; // Import the new notifier

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Requests = lazy(() => import('./pages/Requests'));
const Clients = lazy(() => import('./pages/Clients'));
const Settings = lazy(() => import('./pages/Settings'));
const FillRequest = lazy(() => import('./pages/FillRequest').then(module => ({ default: module.FillRequest })));
const PrintReport = lazy(() => import('./pages/PrintReport'));
const Financials = lazy(() => import('./pages/Financials'));
const RequestDraft = lazy(() => import('./pages/RequestDraft'));
const Profile = lazy(() => import('./pages/employees/Profile'));
const Brokers = lazy(() => import('./pages/Brokers'));
const Expenses = lazy(() => import('./pages/Expenses'));
const OtherRevenues = lazy(() => import('./pages/OtherRevenues'));
const Mailbox = lazy(() => import('./pages/Mailbox'));
const Archive = lazy(() => import('./pages/Archive'));
const WaitingForPaymentRequests = lazy(() => import('./pages/WaitingForPaymentRequests'));
const Employees = lazy(() => import('./pages/Employees')); // Import Employees Page
const Reservations = lazy(() => import('./pages/Reservations')); // Import Reservations Page

const PageLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 text-sm">جاري تحميل الصفحة...</p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  // Added setPage to destructuring
  const { page, setPage, isLoading, isSetupComplete, authUser, settings, isFocusMode, isMailboxOpen, setIsMailboxOpen, can, isSessionError, refreshSessionAndReload } = useAppContext();
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);


  // Redirect Logic based on Permissions (More flexible than Role check)
  React.useEffect(() => {
    if (authUser && authUser.is_active) {
      // If user is on dashboard but doesn't have permission, redirect them
      if (page === 'dashboard' && !can('view_dashboard')) {
        if (authUser.role === 'receptionist') {
          setPage('waiting-requests');
        } else {
          setPage('requests');
        }
      }

      // Strict Redirect for Receptionist: They should NEVER see the main 'requests' page
      if (authUser.role === 'receptionist' && page === 'requests') {
        setPage('waiting-requests');
      }
    }
  }, [authUser, page, setPage, can]);

  // Sync Background
  React.useEffect(() => {
    const bgContainer = document.getElementById('background-container');
    const blobs = [
      document.getElementById('blob-1'),
      document.getElementById('blob-2'),
      document.getElementById('blob-3')
    ];
    if (!bgContainer) return;

    const hideBlobs = () => blobs.forEach(blob => { if (blob) blob.style.display = 'none'; });
    const showBlobs = () => blobs.forEach(blob => { if (blob) blob.style.display = 'block'; });

    if (settings.backgroundImageUrl) {
      bgContainer.style.backgroundImage = `url(${settings.backgroundImageUrl})`;
      bgContainer.style.backgroundColor = '';
      hideBlobs();
    } else if (settings.backgroundColor) {
      bgContainer.style.backgroundImage = '';
      bgContainer.style.backgroundColor = settings.backgroundColor;
      hideBlobs();
    } else {
      bgContainer.style.backgroundImage = '';
      bgContainer.style.backgroundColor = '';
      showBlobs();
    }
  }, [settings.backgroundImageUrl, settings.backgroundColor]);

  // Sync Favicon with Logo
  React.useEffect(() => {
    const link: any = document.querySelector("link[rel~='icon']");
    if (!link) return;

    if (settings.logoUrl) {
      link.href = settings.logoUrl;
    } else {
      link.href = 'icon.svg';
    }
  }, [settings.logoUrl]);

  // Sync App Title
  React.useEffect(() => {
    if (settings.appName) {
      document.title = settings.appName;
    }
  }, [settings.appName]);

  // The problematic force-reload logic has been removed from here
  // and replaced with a better "revival" mechanism in AppContext.

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  // --- RECOVERY SCREEN ---
  // If the session check failed but we didn't want to log out yet (e.g. network error), show this instead of Login.
  if (isSessionError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 animate-fade-in" dir="rtl">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
          <div className="mx-auto mb-6 bg-red-50 dark:bg-red-900/30 w-20 h-20 rounded-full flex items-center justify-center animate-pulse">
            <RefreshCwIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">النظام لا يستجيب</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            يبدو أن هناك مشكلة في الاتصال أو تحميل البيانات. يرجى تحديث النظام للمتابعة.
          </p>
          <Button onClick={refreshSessionAndReload} className="w-full justify-center py-3 text-lg shadow-lg shadow-red-500/20" variant="danger" leftIcon={<RefreshCwIcon className="w-5 h-5" />}>
            تحديث النظام
          </Button>
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return <GeneralManagerSetup />;
  }

  if (!authUser) {
    return <Login />;
  }

  if (!authUser.is_active) {
    return <InactiveAccount />;
  }

  const mainContent = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'financials':
        return <Financials />;
      case 'expenses':
        return <Expenses />;
      case 'revenues':
        return <OtherRevenues />;
      case 'requests':
        return <Requests />;
      case 'waiting-requests':
        return <WaitingForPaymentRequests />;
      case 'archive':
        return <Archive />;
      case 'clients':
        return <Clients />;
      case 'brokers':
        return <Brokers />;
      case 'settings':
        return <Settings />;
      case 'fill-request':
        return <FillRequest />;
      case 'print-report':
        return <PrintReport />;
      case 'request-draft':
        return <RequestDraft />;
      case 'profile':
        return <Profile />;
      case 'mailbox':
        return <Mailbox />;
      case 'employees':
        return <Employees />;
      case 'reservations':
        return <Reservations />;
      default:
        return <Dashboard />;
    }
  };

  if (page === 'print-report' || page === 'request-draft') {
    return (
      <Suspense fallback={<PageLoader />}>
        {mainContent()}
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen text-slate-800 dark:text-slate-200">
      {!isFocusMode && <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isFocusMode && <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-slate-100/80 dark:bg-slate-900/80 ${isFocusMode ? '' : 'p-4 sm:p-6'}`}>
          <Suspense fallback={<PageLoader />}>
            {mainContent()}
          </Suspense>
        </main>
      </div>

      {/* Mailbox Modal */}
      <Modal isOpen={isMailboxOpen} onClose={() => setIsMailboxOpen(false)} title="" size="4xl">
        <div className="h-[80vh] -m-6">
          <Suspense fallback={<PageLoader />}>
            <Mailbox isModal={true} />
          </Suspense>
        </div>
      </Modal>

      <NotificationContainer />
      <ConfirmModal />
      <NewRequestSuccessModal />
      <InstallPwaBanner />
      <IncomingRequestNotifier />
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <PrintStyles />
      <AppContent />
    </AppProvider>
  );
}

const PrintStyles = () => (
  <style type="text/css">
    {`
      @media print {
        /* Force browsers to render background colors and box shadows */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Tailwind CSS class overrides for printing */
        .border-dashed {
          border-style: dashed !important;
        }
      }
    `}
  </style>
);

export default App;
