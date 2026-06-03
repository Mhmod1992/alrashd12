import React, { useMemo, useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import {
  FinancialStats,
  InspectionRequest,
  Expense,
  Revenue,
  PaymentType,
  RequestStatus,
  ActivityLog,
  Client,
  Car,
} from "../types";
import { supabase } from "../lib/supabaseClient";
import LineChart from "../components/LineChart";
import Icon from "../components/Icon";
import RefreshCwIcon from "../components/icons/RefreshCwIcon";
import TrendingUpIcon from "../components/icons/TrendingUpIcon";
import DollarSignIcon from "../components/icons/DollarSignIcon";
import UsersIcon from "../components/icons/UsersIcon";
import BriefcaseIcon from "../components/icons/BriefcaseIcon";
import CarIcon from "../components/icons/CarIcon";
import PlusIcon from "../components/icons/PlusIcon";
import CreditCardIcon from "../components/icons/CreditCardIcon";
import FileTextIcon from "../components/icons/FileTextIcon";
import SearchIcon from "../components/icons/SearchIcon";
import PhoneIcon from "../components/icons/PhoneIcon";
import { Skeleton } from "../components/Skeleton";
import Modal from "../components/Modal";
import Button from "../components/Button";
import MiniPlateDisplay from "../components/MiniPlateDisplay";
import {
  AreaChart,
  Area as RechartsArea,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  LineChart as RechartsLineChart,
  Line,
  ReferenceLine,
  LabelList,
  ComposedChart,
} from "recharts";
import {
  PlusCircleIcon,
  PenToolIcon,
  ActivityIcon,
  MonitorIcon,
  LayersIcon,
  FilePlusIcon,
  SettingsIcon,
  TerminalIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";

// --- Quick Actions Component ---
// --- Safe LocalStorage Helper ---
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      console.warn(
        "Storage quota exceeded, clearing dashboard cache to free space",
      );
      // Clear all dashboard related caches to free up space
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("dashboard_")) {
          localStorage.removeItem(k);
        }
      });
      // Try setting again after clearing
      try {
        localStorage.setItem(key, value);
      } catch (retryError) {
        console.error(
          "Failed to set item even after clearing cache",
          retryError,
        );
      }
    } else {
      console.error("LocalStorage error", e);
    }
  }
};

const QuickActions: React.FC<{
  onOpenSearchClient: () => void;
  onOpenVehicleHistorySearch: () => void;
  onOpenQuickExpense: () => void;
}> = ({
  onOpenSearchClient,
  onOpenVehicleHistorySearch,
  onOpenQuickExpense,
}) => {
  const { setPage, setInitialRequestModalState } = useAppContext();

  const actions = [
    {
      label: "طلب جديد",
      icon: <PlusIcon className="w-5 h-5" />,
      color: "bg-blue-600 text-white",
      action: () => {
        setInitialRequestModalState("new");
        setPage("requests");
      },
    },
    {
      label: "البحث عن عميل",
      icon: <SearchIcon className="w-5 h-5" />,
      color:
        "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
      action: onOpenSearchClient,
    },
    {
      label: "بحث عن سيارة فحصت سابقا",
      icon: <CarIcon className="w-5 h-5" />,
      color:
        "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
      action: onOpenVehicleHistorySearch,
    },
    {
      label: "مصروف سريع",
      icon: <CreditCardIcon className="w-5 h-5" />,
      color: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
      action: onOpenQuickExpense,
    },
    {
      label: "الطلبات",
      icon: <FileTextIcon className="w-5 h-5" />,
      color:
        "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
      action: () => setPage("requests"),
    },
    {
      label: "الواتساب",
      icon: <Icon name="whatsapp" className="w-5 h-5" />,
      color:
        "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
      action: () => setPage("whatsapp-inbox"),
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-6">
      {actions.map((btn, idx) => (
        <button
          key={idx}
          onClick={btn.action}
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 dark:border-slate-700/50 hover:shadow-lg transition-all active:scale-95 group"
        >
          <div
            className={`p-2 sm:p-2.5 rounded-xl mb-1.5 sm:mb-2 ${btn.color} shadow-md transition-transform group-hover:scale-110`}
          >
            {React.cloneElement(
              btn.icon as React.ReactElement<{ className?: string }>,
              { className: "w-4 h-4 sm:w-5 sm:h-5" },
            )}
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
            {btn.label}
          </span>
        </button>
      ))}
    </div>
  );
};

// --- Period Toggle ---
const PeriodToggle: React.FC<{
  activePeriod: "today" | "week" | "month" | "year";
  onChange: (p: "today" | "week" | "month" | "year") => void;
  isLoading: boolean;
}> = ({ activePeriod, onChange, isLoading }) => {
  const periods = [
    { id: "today", label: "يومي" },
    { id: "week", label: "أسبوعي" },
    { id: "month", label: "شهري" },
  ];

  return (
    <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
      {periods.map((p) => (
        <button
          key={p.id}
          onClick={() => !isLoading && onChange(p.id as any)}
          className={`
                        px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all
                        ${
                          activePeriod === p.id
                            ? "bg-white dark:bg-slate-500 text-slate-800 dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                        }
                    `}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

// --- Compact KPI Card ---
const ExecutiveKpiCard: React.FC<{
  title: string;
  value: string;
  subtitle?: React.ReactNode;
  trend?: number;
  icon: React.ReactNode;
  colorClass: string; // Tailwind text color class
  bgClass: string; // Tailwind bg color class
  isLoading?: boolean;
}> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  colorClass,
  bgClass,
  isLoading,
}) => {
  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl p-4 shadow-sm border border-white/20 dark:border-slate-700/50 flex flex-col justify-between h-full relative overflow-hidden group hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300">
      {/* Decor Circle */}
      <div
        className={`absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-10 ${bgClass} group-hover:scale-150 transition-transform duration-700 ease-in-out`}
      ></div>

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div
          className={`p-2.5 rounded-xl ${bgClass} ${colorClass} shadow-inner`}
        >
          {React.cloneElement(
            icon as React.ReactElement<{ className?: string }>,
            { className: "w-5 h-5" },
          )}
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? "text-emerald-600" : "text-rose-500"} bg-slate-100/50 dark:bg-slate-900/50 px-2 py-1 rounded-full backdrop-blur-sm`}
          >
            <span>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
            <TrendingUpIcon
              className={`w-3 h-3 ${trend < 0 ? "rotate-180" : ""}`}
            />
          </div>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
          {title}
        </p>
        <>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-numeric tracking-tight">
            {value}
          </h3>
          {subtitle && <div className="mt-1">{subtitle}</div>}
        </>
      </div>
    </div>
  );
};

const PerformanceCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  headerBg: string;
  badgeLabel: string;
  data: { name: string; count: number; subLabel?: string }[];
  isLoading: boolean;
  mainCountLabel: string;
}> = ({
  title,
  icon,
  headerBg,
  badgeLabel,
  data,
  isLoading,
  mainCountLabel,
}) => {
  const staffCount = data.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow group">
      <div
        className={`p-2.5 border-b dark:border-slate-700 flex justify-between items-center ${headerBg}`}
      >
        <div className="flex items-center gap-2">
          <span className="p-1 bg-white/50 dark:bg-black/20 rounded-lg text-slate-700 dark:text-white">
            {icon}
          </span>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
            {title}
          </h4>
        </div>
        <div className="text-[9px] bg-white/40 dark:bg-black/20 px-1.5 py-0.5 rounded-full font-black text-slate-600 dark:text-slate-300">
          {staffCount} {badgeLabel}
        </div>
      </div>
      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar bg-white/50 dark:bg-slate-800/50">
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {item.name}
                    </span>
                    {item.subLabel && (
                      <span className="text-[9px] text-slate-400">
                        {item.subLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-numeric">
                      {item.count}
                    </span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                      {mainCountLabel}
                    </span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-[10px] font-black text-yellow-700 dark:text-yellow-500">
                    {item.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-400 text-[10px] font-bold">
              لا يوجد بيانات
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Vehicle History Search Modal
const VehicleHistorySearchModal: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { settings, checkCarHistory, carMakes, carModels } = useAppContext();
  const [plateNums, setPlateNums] = useState("");
  const [plateChars, setPlateChars] = useState("");
  const [vin, setVin] = useState("");
  const [useVin, setUseVin] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [foundResult, setFoundResult] = useState<{
    car: Car;
    previousRequests: InspectionRequest[];
    lastClient?: Client;
  } | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [carDetails, setCarDetails] = useState<{
    makeName?: string;
    modelName?: string;
  }>({});

  const handleSearch = async () => {
    if (!useVin && (!plateNums || !plateChars)) return;
    if (useVin && !vin) return;

    setIsSearching(true);
    setHasAttempted(true);
    try {
      // MATCH NEW REQUEST FORM FORMAT: "CHARS NUMS"
      const plateString = useVin ? null : `${plateChars} ${plateNums}`;
      const result = await checkCarHistory(plateString, useVin ? vin : null);
      setFoundResult(result as any);

      if (result?.car) {
        // Fetch make and model name since they might not be loaded in context yet
        const make = carMakes.find((m) => m.id === result.car.make_id);
        const model = carModels.find((m) => m.id === result.car.model_id);

        let fetchedMakeName = make?.name_en || make?.name_ar;
        let fetchedModelName = model?.name_en || model?.name_ar;

        if (!fetchedMakeName && result.car.make_id) {
          const { data } = await supabase
            .from("car_makes")
            .select("name_en, name_ar")
            .eq("id", result.car.make_id)
            .single();
          if (data) fetchedMakeName = data.name_en || data.name_ar;
        }

        if (!fetchedModelName && result.car.model_id) {
          const { data } = await supabase
            .from("car_models")
            .select("name_en, name_ar")
            .eq("id", result.car.model_id)
            .single();
          if (data) fetchedModelName = data.name_en || data.name_ar;
        }

        setCarDetails({
          makeName: fetchedMakeName,
          modelName: fetchedModelName,
        });
      }
    } catch (error) {
      console.error("Error searching car history", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="استعلام عن تاريخ مركبة">
      <div className="space-y-6">
        <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              بيانات التعريف
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-vin"
                checked={useVin}
                onChange={(e) => setUseVin(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="use-vin"
                className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                استخدام رقم الشاصي
              </label>
            </div>
          </div>

          {!useVin ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder="أرقام اللوحة"
                value={plateNums}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPlateNums(val.split("").join(" "));
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg"
                style={{ direction: "ltr" }}
              />
              <input
                type="text"
                placeholder="أحرف اللوحة"
                value={plateChars}
                onChange={(e) => {
                  const rawVal = e.target.value.replace(/\s/g, "");
                  const validChars = rawVal
                    .split("")
                    .filter((char) => {
                      return settings.plateCharacters.some(
                        (pc) =>
                          pc.ar === char ||
                          pc.en.toLowerCase() === char.toLowerCase(),
                      );
                    })
                    .join("");
                  setPlateChars(validChars.slice(0, 4).split("").join(" "));
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg"
                style={{
                  direction: /[\u0600-\u06FF]/.test(plateChars) ? "rtl" : "ltr",
                }}
              />
            </div>
          ) : (
            <input
              type="text"
              placeholder="أدخل رقم الشاصي (VIN)..."
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm uppercase tracking-wider"
              autoFocus
            />
          )}

          <Button
            onClick={handleSearch}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3"
            disabled={isSearching}
          >
            {isSearching ? (
              <RefreshCwIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4" />
            )}
            بحث عن المركبة
          </Button>
        </div>

        {hasAttempted && !isSearching && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {foundResult ? (
              <>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl">
                  <div className="flex flex-col items-center gap-4">
                    <MiniPlateDisplay
                      plateNumber={
                        foundResult.car.plate_number ||
                        foundResult.car.vin ||
                        ""
                      }
                      settings={settings}
                    />
                    <div className="text-center">
                      {(() => {
                        const name = [
                          carDetails.makeName,
                          carDetails.modelName,
                          foundResult.car.year,
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return name ? (
                          <p className="font-bold text-emerald-900 dark:text-emerald-100 text-lg mb-1 uppercase tracking-wide">
                            {name}
                          </p>
                        ) : null;
                      })()}
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        زارتنا {foundResult.previousRequests.length} مرة مسبقاً
                      </p>
                    </div>
                  </div>

                  {foundResult.lastClient && (
                    <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-800/50">
                      <p className="text-[10px] text-emerald-500/70 uppercase font-black tracking-widest mb-1">
                        آخر عميل مسجل
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-emerald-800 dark:text-emerald-200">
                          {foundResult.lastClient.name}
                        </span>
                        <span className="text-xs text-emerald-600/80 font-mono italic">
                          {foundResult.lastClient.phone}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 px-1">
                    الزيارات الأخيرة
                  </p>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                    {foundResult.previousRequests.map((req: any) => {
                      const d = new Date(req.created_at);
                      if (d.getHours() < 4) d.setDate(d.getDate() - 1);
                      
                      const dStart = new Date(d);
                      dStart.setHours(0, 0, 0, 0);

                      const now = new Date();
                      if (now.getHours() < 4) now.setDate(now.getDate() - 1);
                      now.setHours(0, 0, 0, 0);

                      const diffTime = Math.abs(now.getTime() - dStart.getTime());
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      
                      let relativeFormat = `منذ ${diffDays} يوماً`;
                      if (diffDays === 0) relativeFormat = "اليوم";
                      else if (diffDays === 1) relativeFormat = "منذ يوم";
                      else if (diffDays === 2) relativeFormat = "منذ يومين";
                      else if (diffDays >= 3 && diffDays <= 10) relativeFormat = `منذ ${diffDays} أيام`;

                      const englishDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                      const dayName = d.toLocaleDateString("ar-SA", { weekday: 'long' });

                      const cName = req.client?.name || foundResult.lastClient?.name || "غير معروف";
                      const cPhone = req.client?.phone || foundResult.lastClient?.phone || "غير متوفر";

                      return (
                        <div
                          key={req.id}
                          className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-between group hover:border-blue-300 transition-colors"
                        >
                          <div className="flex flex-1 items-center justify-between pl-4 gap-2">
                            {/* Column 1: Order & Date */}
                            <div className="flex flex-col gap-1 min-w-[70px]">
                              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                                #{req.request_number}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono text-left" dir="ltr">
                                {englishDate}
                              </span>
                            </div>

                            {/* Column 2: Day & Relative */}
                            <div className="flex flex-col gap-1 min-w-[80px]">
                              <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                                {dayName}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                                {relativeFormat}
                              </span>
                            </div>

                            {/* Column 3: Client Info */}
                            <div className="flex flex-col gap-1 min-w-[100px] text-right">
                              <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                                {cName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
                                {cPhone}
                              </span>
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}${window.location.pathname}?page=print-report&requestId=${req.id}&from=print`;
                              window.open(url, "_blank");
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap"
                          >
                            عرض التقرير
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <AlertCircleIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">
                  لم يسبق لهذه المركبة زيارتنا من قبل
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  يمكنك البدء بإنشاء طلب جديد لها
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700/50">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          {foundResult && (
            <Button
              variant="primary"
              onClick={() => {
                // Logic to start a new request for this car if needed?
                onClose();
              }}
            >
              تأكيد ومعالجة
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Client Search Modal
const ClientSearchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { searchClients } = useAppContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchClients(query);
        setResults(data);
      } catch (error) {
        console.error("Error searching clients", error);
      } finally {
        setIsLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, searchClients]);

  return (
    <Modal isOpen={true} onClose={onClose} title="البحث السريع عن العملاء">
      <div className="space-y-4">
        <div className="relative">
          <SearchIcon className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((client) => (
                <div
                  key={client.id}
                  className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                        {client.name}
                      </p>
                      <p className="text-xs text-slate-500 font-numeric flex items-center gap-1 mt-1">
                        <PhoneIcon className="w-3 h-3" /> {client.phone}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded text-xs font-bold items-center text-center">
                      <div className="text-[10px] text-blue-400 dark:text-blue-500 mb-0.5">
                        الطلبات
                      </div>
                      {(client as any)?.count || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query.trim() ? (
            <p className="text-center text-slate-500 text-sm py-4">
              لا يوجد نتائج
            </p>
          ) : null}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Quick Expense Modal
const QuickExpenseModal: React.FC<{
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ onClose, onSuccess }) => {
  const { addExpense, authUser, employees } = useAppContext();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("تشغيلية");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    setIsSubmitting(true);
    try {
      const employeeData = employees?.find((e) => e.email === authUser?.email);
      await addExpense({
        amount: parseFloat(amount),
        category,
        description,
        date: new Date().toISOString(),
        employeeId: employeeData?.id || "",
        employeeName:
          employeeData?.name || authUser?.email?.split("@")[0] || "Unknown",
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding expense", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="إضافة مصروف سريع">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            المبلغ
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            التصنيف
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
          >
            <option value="تشغيلية">تشغيلية</option>
            <option value="بوفيه">بوفيه</option>
            <option value="مشتريات">مشتريات</option>
            <option value="أخرى">أخرى</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            البيان
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose} type="button">
            إلغاء
          </Button>
          <Button variant="danger" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "جاري الحفظ..." : "حفظ وتسجيل"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const RecentActivity: React.FC<{ logs: ActivityLog[]; isLoading: boolean }> = ({
  logs,
  isLoading,
}) => {
  const { setPage, setSelectedRequestId } = useAppContext();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden h-[400px] flex flex-col">
      <div className="p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
          <Icon name="history" className="w-4 h-4 text-blue-500" />
          النشاط الأخير
        </h4>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {logs.length > 0 ? (
          <div className="divide-y dark:divide-slate-700/50">
            {logs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition-colors flex flex-col gap-1 cursor-pointer"
                onClick={() => {
                  if (log.link_id) {
                    setSelectedRequestId(log.link_id);
                    if (log.link_page) setPage(log.link_page);
                    else setPage("fill-request");
                  }
                }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                    {log.employeeName}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {log.action}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {log.details}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs py-10">
            لا يوجد نشاط مؤخراً.
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const {
    authUser,
    fetchServerFinancials,
    employees,
    technicians,
    clients,
    cars,
    carMakes,
    carModels,
    requests,
    reservations,
    systemLogs,
    fetchClientsCount,
    searchClients,
    addExpense,
    customFindingCategories,
  } = useAppContext();
  const [activePeriod, setActivePeriod] = useState<
    "today" | "week" | "month" | "year"
  >("today");
  const [stats, setStats] = useState<FinancialStats | null>(() => {
    const cached = localStorage.getItem("dashboard_main_stats_cache");
    return cached ? JSON.parse(cached).data : null;
  });
  const [clientStats, setClientStats] = useState<{
    total: number;
    new: number;
    prevNew: number;
    returning?: number;
  }>(() => {
    const cached = localStorage.getItem("dashboard_client_stats_cache");
    return cached
      ? JSON.parse(cached)
      : { total: 0, new: 0, prevNew: 0, returning: 0 };
  });
  const [prevStats, setPrevStats] = useState<FinancialStats | null>(null);
  const [pulseStats, setPulseStats] = useState<FinancialStats | null>(() => {
    const cached = localStorage.getItem("dashboard_revenue_pulse_cache");
    return cached ? JSON.parse(cached).data : null;
  });
  const [forecastData, setForecastData] = useState<any[]>(() => {
    const cached = localStorage.getItem("dashboard_forecast_cache");
    return cached ? JSON.parse(cached) : [];
  });
  const [monthStats, setMonthStats] = useState<FinancialStats | null>(() => {
    const cached = localStorage.getItem("dashboard_month_stats_cache");
    return cached ? JSON.parse(cached).data : null;
  });
  const [prevMonthStats, setPrevMonthStats] = useState<FinancialStats | null>(
    null,
  );
  const [carFilter, setCarFilter] = useState<
    "yesterday" | "week" | "month" | "all"
  >("month");
  const [carStats, setCarStats] = useState<FinancialStats | null>(() => {
    const cached = localStorage.getItem("dashboard_car_stats_cache");
    return cached ? JSON.parse(cached).data : null;
  });
  const [allCarModels, setAllCarModels] = useState<any[]>(() => {
    const cached = localStorage.getItem("dashboard_car_models_cache");
    return cached ? JSON.parse(cached) : [];
  });
  const [isCarLoading, setIsCarLoading] = useState(
    !localStorage.getItem("dashboard_car_stats_cache"),
  );
  const [isLoading, setIsLoading] = useState(
    !localStorage.getItem("dashboard_main_stats_cache"),
  );
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const nowRaw = new Date();
      const now = new Date(nowRaw);
      if (now.getHours() < 4) now.setDate(now.getDate() - 1);

      let start = new Date(now);
      let end = new Date(now);
      let prevStart = new Date(now);
      let prevEnd = new Date(now);

      if (activePeriod === "today") {
        start.setHours(4, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        end.setMilliseconds(-1);
        prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 1);
        prevEnd = new Date(end);
        prevEnd.setDate(prevEnd.getDate() - 1);
      } else if (activePeriod === "week") {
        const day = now.getDay();
        const diff = now.getDate() - day; // Start on Sunday
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 7);
        prevEnd = new Date(end);
        prevEnd.setDate(prevEnd.getDate() - 7);
      } else if (activePeriod === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end.setHours(23, 59, 59, 999);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999,
        );
      }

      // --- Performance Optimization: Caching for Past Data ---
      const CACHE_KEY = "dashboard_revenue_pulse_cache";
      const CACHE_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours
      const cachedStr = localStorage.getItem(CACHE_KEY);
      let pastPulseStats: FinancialStats | null = null;
      let shouldFetchFullPulse = true;

      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRY;
          const cacheDate = new Date(cached.timestamp).toLocaleDateString(
            "en-CA",
          );
          const todayStr = now.toLocaleDateString("en-CA");

          if (!isExpired && cacheDate === todayStr) {
            pastPulseStats = cached.data;
            shouldFetchFullPulse = false;
          }
        } catch (e) {
          console.error("Cache parse error", e);
        }
      }

      const pulseEnd = new Date();
      pulseEnd.setHours(23, 59, 59, 999);
      const pulseStart = new Date();
      pulseStart.setDate(pulseEnd.getDate() - 60); // Fetch 60 days for last month comparison
      pulseStart.setHours(0, 0, 0, 0);

      // Always fetch current calendar month and previous calendar month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      const [
        currentStats,
        previousStats,
        todayPulseStats,
        fullPulseStats,
        currentMonthStatsData,
        prevMonthStatsData,
        totalClientsCount,
        newClientsCount,
        prevNewClientsCount,
      ] = await Promise.all([
        fetchServerFinancials(start.toISOString(), end.toISOString(), false),
        fetchServerFinancials(
          prevStart.toISOString(),
          prevEnd.toISOString(),
          false,
        ),
        fetchServerFinancials(
          now.toLocaleDateString("en-CA") + "T00:00:00Z",
          pulseEnd.toISOString(),
          false,
        ), // Today only
        shouldFetchFullPulse
          ? fetchServerFinancials(
              pulseStart.toISOString(),
              pulseEnd.toISOString(),
              false,
            )
          : Promise.resolve(null),
        fetchServerFinancials(
          currentMonthStart.toISOString(),
          currentMonthEnd.toISOString(),
          false,
        ),
        fetchServerFinancials(
          prevMonthStart.toISOString(),
          prevMonthEnd.toISOString(),
          false,
        ),
        fetchClientsCount(),
        fetchClientsCount(start.toISOString(), end.toISOString()),
        fetchClientsCount(prevStart.toISOString(), prevEnd.toISOString()),
      ]);

      const uniqueClientIdsForPeriod = new Set(
        currentStats.filteredRequests
          .map((r: any) => r.client_id)
          .filter(Boolean),
      );
      let returningClientsCount = Array.from(uniqueClientIdsForPeriod).filter(
        (id) => {
          const c = clients.find((cl: any) => cl.id === id);
          return c && new Date(c.created_at) < start;
        },
      ).length;

      const cStats = {
        total: totalClientsCount,
        new: newClientsCount,
        prevNew: prevNewClientsCount,
        returning: returningClientsCount,
      };
      setClientStats(cStats);
      safeSetItem("dashboard_client_stats_cache", JSON.stringify(cStats));

      setStats(currentStats);
      setPrevStats(previousStats);
      safeSetItem(
        "dashboard_main_stats_cache",
        JSON.stringify({ timestamp: Date.now(), data: currentStats }),
      );

      let finalPulse: FinancialStats;
      if (shouldFetchFullPulse && fullPulseStats) {
        finalPulse = fullPulseStats;
        safeSetItem(
          CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            data: fullPulseStats,
          }),
        );
      } else if (pastPulseStats) {
        const mergedDaily = { ...pastPulseStats.daily };
        const todayKey = now.toLocaleDateString("en-CA");
        mergedDaily[todayKey] = todayPulseStats.daily[todayKey] || {
          date: todayKey,
          cars: 0,
          revenue: 0,
          cash: 0,
          card: 0,
          transfer: 0,
          unpaid: 0,
          expenses: 0,
          commission: 0,
        };

        finalPulse = {
          ...pastPulseStats,
          daily: mergedDaily,
          totalRevenue: (Object.values(mergedDaily) as any[]).reduce(
            (sum: number, d: any) => sum + (d.revenue || 0),
            0,
          ),
        } as FinancialStats;
      } else {
        finalPulse = todayPulseStats;
      }

      setPulseStats(finalPulse);

      // --- Forecasting Logic (Weighted Moving Average) ---
      const forecast: any[] = [];
      const dailyData = finalPulse.daily;

      for (let i = 1; i <= 7; i++) {
        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + i);
        const dayOfWeek = futureDate.getDay();

        let sum = 0;
        let count = 0;
        for (let w = 1; w <= 4; w++) {
          const pastDate = new Date(futureDate);
          pastDate.setDate(futureDate.getDate() - w * 7);
          const pastKey = pastDate.toLocaleDateString("en-CA");
          if (dailyData[pastKey]) {
            const weight = 5 - w;
            sum += dailyData[pastKey].revenue * weight;
            count += weight;
          }
        }

        const predictedRevenue = count > 0 ? Math.round(sum / count) : 0;
        forecast.push({
          label: futureDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "numeric",
          }),
          dateStr: futureDate.toLocaleDateString("en-CA"),
          revenue: predictedRevenue,
        });
      }
      setForecastData(forecast);
      safeSetItem("dashboard_forecast_cache", JSON.stringify(forecast));

      setMonthStats(currentMonthStatsData);
      setPrevMonthStats(prevMonthStatsData);
      safeSetItem(
        "dashboard_month_stats_cache",
        JSON.stringify({ timestamp: Date.now(), data: currentMonthStatsData }),
      );
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Dashboard Load Error", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCarData = async () => {
    setIsCarLoading(true);
    try {
      const now = new Date();
      let start = new Date();
      let end = new Date();

      if (carFilter === "yesterday") {
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      } else if (carFilter === "week") {
        const day = now.getDay();
        const diff = now.getDate() - day; // Start on Sunday
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      } else if (carFilter === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      } else if (carFilter === "all") {
        start = new Date(2000, 0, 1);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }

      const [stats, { data: modelsData }] = await Promise.all([
        fetchServerFinancials(start.toISOString(), end.toISOString(), false),
        supabase.from("car_models").select("*"),
      ]);

      if (modelsData) {
        setAllCarModels(modelsData);
        safeSetItem("dashboard_car_models_cache", JSON.stringify(modelsData));
      }

      setCarStats(stats);
      safeSetItem(
        "dashboard_car_stats_cache",
        JSON.stringify({ timestamp: Date.now(), data: stats }),
      );
    } catch (error) {
      console.error("Car Data Load Error", error);
    } finally {
      setIsCarLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activePeriod]);

  useEffect(() => {
    loadCarData();
  }, [carFilter]);

  const [isSearchClientModalOpen, setIsSearchClientModalOpen] = useState(false);
  const [isVehicleHistoryModalOpen, setIsVehicleHistoryModalOpen] =
    useState(false);
  const [isQuickExpenseModalOpen, setIsQuickExpenseModalOpen] = useState(false);

  // Derived Data
  const activeCars =
    stats?.filteredRequests.filter(
      (r) => r.status === "قيد التنفيذ" || r.status === "جديد",
    ).length || 0;

  // Growth Calculation
  const growthPercentage =
    clientStats.prevNew > 0
      ? Math.round(
          ((clientStats.new - clientStats.prevNew) / clientStats.prevNew) * 100,
        )
      : clientStats.new > 0
        ? 100
        : 0;

  const performanceData = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (activePeriod === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (activePeriod === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day;
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (activePeriod === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (activePeriod === "year") {
      start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const allStaff = [
      ...employees.map((e) => ({ ...e, type: "employee" as const })),
      ...technicians.map((t) => ({ ...t, type: "technician" as const })),
    ];

    const currentRequests = requests.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      return !isNaN(d.getTime()) && d >= start && d <= end;
    });

    const processedStats = allStaff.map((person: any) => {
      const created: any[] = [];
      const inspected: any[] = [];
      const noted: any[] = [];
      const multipleSectionsArr: any[] = [];
      let totalSectionsInspected = 0;
      let multipleSectionsCount = 0;

      currentRequests.forEach((r) => {
        let involved = false;

        // 1. Created
        if (person.type === "employee" && r.employee_id === person.id) {
          created.push(r);
          involved = true;
        }

        // 2. Inspected
        let sectionsInspectedInThisReq = 0;
        if (r.technician_assignments) {
          Object.values(r.technician_assignments).forEach((techList) => {
            if (techList.includes(person.id)) {
              sectionsInspectedInThisReq++;
            }
          });
        }

        if (sectionsInspectedInThisReq > 0) {
          inspected.push(r);
          totalSectionsInspected += sectionsInspectedInThisReq;
          if (sectionsInspectedInThisReq > 1) {
            multipleSectionsCount++;
            multipleSectionsArr.push(r);
          }
          involved = true;
        }

        // 3. Noted
        let wroteNote = false;
        if (
          r.activity_log?.some(
            (log) =>
              log.employeeId === person.id &&
              (log.action.includes("ملاحظة") ||
                log.action.includes("فحص") ||
                log.action.includes("صوتي") ||
                log.action.includes("حفظ مؤقت")),
          )
        ) {
          wroteNote = true;
        }

        if (
          !wroteNote &&
          r.general_notes?.some(
            (n) =>
              n.authorId === person.id ||
              (n.authorName === person.name && person.type === "employee"),
          )
        ) {
          wroteNote = true;
        }
        if (!wroteNote && r.category_notes) {
          wroteNote = Object.values(r.category_notes)
            .flat()
            .some(
              (n) =>
                n.authorId === person.id ||
                (n.authorName === person.name && person.type === "employee"),
            );
        }
        if (wroteNote) {
          noted.push(r);
          involved = true;
        }
      });

      return {
        id: person.id,
        name: person.name,
        createdCount: created.length,
        notedCount: noted.length,
        multipleSectionsCount: multipleSectionsCount,
        inspectedCount: totalSectionsInspected,
      };
    });

    // Technician assignments to categories logic from Employees.tsx
    const techCategoryCounts: Record<string, Record<string, number>> = {};
    currentRequests.forEach((r) => {
      if (r.technician_assignments) {
        Object.entries(r.technician_assignments).forEach(([catId, techIds]) => {
          const cat = customFindingCategories.find((c) => c.id === catId);
          const catName = cat ? cat.name : catId === "general" ? "عام" : catId;
          if (!techCategoryCounts[catName]) techCategoryCounts[catName] = {};
          techIds.forEach((id) => {
            techCategoryCounts[catName][id] =
              (techCategoryCounts[catName][id] || 0) + 1;
          });
        });
      }
    });

    const topInspectorsByRole = Object.entries(techCategoryCounts)
      .map(([role, techCounts]) => {
        const items = Object.entries(techCounts)
          .map(([techId, count]) => ({
            id: techId,
            name: allStaff.find((s) => s.id === techId)?.name || "غير معروف",
            count: count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return { role, items };
      })
      .sort((a, b) => (b.items[0]?.count || 0) - (a.items[0]?.count || 0));

    const getListFromProcessed = (
      key: "createdCount" | "notedCount" | "multipleSectionsCount",
    ) => {
      return processedStats
        .filter((s) => s[key] > 0)
        .sort((a, b) => b[key] - a[key])
        .slice(0, 5)
        .map((s) => ({ name: s.name, count: s[key] }));
    };

    return {
      creators: getListFromProcessed("createdCount"),
      dataEntry: getListFromProcessed("notedCount"),
      multi: getListFromProcessed("multipleSectionsCount"),
      inspectorsByRole: topInspectorsByRole,
    };
  }, [activePeriod, employees, technicians, requests, customFindingCategories]);

  const transactionFeed = useMemo(() => {
    if (!stats) return [];
    const incomes = stats.filteredRequests.map((r) => ({
      type: "income",
      amount: r.price,
      date: r.created_at,
      description: `فحص #${r.request_number}`,
      user:
        employees.find((e) => e.id === r.employee_id)?.name.split(" ")[0] ||
        "-",
    }));
    const expenses = stats.filteredExpenses.map((e) => ({
      type: "expense",
      amount: e.amount,
      date: e.date,
      description: e.category,
      user: e.employeeName?.split(" ")[0] || "-",
    }));
    return [...incomes, ...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [stats, employees]);

  const activityLogs = useMemo(() => {
    const allLogs: ActivityLog[] = [];

    // Add application-level events from requests
    requests.forEach((req) => {
      const employee = employees.find((e) => e.id === req.employee_id);
      allLogs.push({
        id: `create-${req.id}`,
        timestamp: req.created_at || new Date().toISOString(),
        employeeId: req.employee_id || "",
        employeeName: employee?.name || "النظام",
        action: "إنشاء طلب",
        details: `تم إنشاء طلب جديد رقم #${req.request_number}`,
        link_id: req.id,
      });
    });

    // Add reservations (bookings)
    reservations.forEach((res) => {
      allLogs.push({
        id: `res-${res.id}`,
        timestamp: res.created_at || new Date().toISOString(),
        employeeId: "",
        employeeName: res.client_name || "عميل",
        action: "حجز جديد",
        details: `تم إنشاء حجز جديد للعميل ${res.client_name}`,
        link_id: res.id,
      });
    });

    // Add systemLogs (which contains deletes, transfers, etc. from the current session)
    if (systemLogs && Array.isArray(systemLogs)) {
      systemLogs.forEach((log) => {
        allLogs.push(log);
      });
    }

    // Sort by timestamp descending
    return allLogs
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 20);
  }, [requests, reservations, systemLogs]);

  const pieData = stats?.paymentDistribution || [];

  // Data for advanced charts
  const carInspectionFrequencyData = useMemo(() => {
    if (!carStats) return [];
    const frequencyMap = new Map<string, number>();

    // Use allCarModels if available, fallback to context carModels
    const modelsToUse = allCarModels.length > 0 ? allCarModels : carModels;

    carStats.filteredRequests.forEach((req) => {
      let make = (
        req.car_snapshot?.make_ar ||
        req.car_snapshot?.make_en ||
        ""
      ).trim();
      let model = (
        req.car_snapshot?.model_ar ||
        req.car_snapshot?.model_en ||
        ""
      ).trim();

      if (!make || !model) {
        const car = cars.find((c) => c.id === req.car_id);
        if (car) {
          const makeObj = carMakes.find((m) => m.id === car.make_id);
          const modelObj = modelsToUse.find((m) => m.id === car.model_id);

          make = make || makeObj?.name_ar || makeObj?.name_en || "";
          model = model || modelObj?.name_ar || modelObj?.name_en || "";
        }
      }

      if (make && model) {
        // Group by Make and Model ONLY to aggregate same models from different years
        // We also strip any 4-digit year from the model name to ensure clean grouping
        const cleanModel = model.replace(/\b(19|20)\d{2}\b/g, "").trim();
        const fullName = `${make} ${cleanModel}`;
        frequencyMap.set(fullName, (frequencyMap.get(fullName) || 0) + 1);
      } else if (make || model) {
        const name = (make || model)
          .trim()
          .replace(/\b(19|20)\d{2}\b/g, "")
          .trim();
        if (name) {
          frequencyMap.set(name, (frequencyMap.get(name) || 0) + 1);
        }
      }
    });

    return Array.from(frequencyMap.entries())
      .map(([name, count]) => ({ make: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15); // Show top 15 for better overview
  }, [carStats, cars, carMakes, carModels, allCarModels]);

  const dailyRevenueChartData = useMemo(() => {
    if (!pulseStats) return [];

    const data: any[] = [];
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    // Centric View: 7 days past + Today + 7 days forecast
    // Past 7 days
    for (let i = 7; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = d.toLocaleDateString("en-CA");
      const dayData = pulseStats.daily[dStr] || { revenue: 0 };

      const lastMonthDate = new Date(d);
      lastMonthDate.setDate(d.getDate() - 28);
      const lastMonthData = pulseStats.daily[
        lastMonthDate.toLocaleDateString("en-CA")
      ] || { revenue: 0 };

      data.push({
        label: d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "numeric",
        }),
        dateStr: dStr,
        actual: dayData.revenue,
        lastMonth: lastMonthData.revenue,
        forecast: null,
        isToday: false,
      });
    }

    // Today
    const todayData = pulseStats.daily[todayStr] || { revenue: 0 };
    const lastMonthTodayDate = new Date(now);
    lastMonthTodayDate.setDate(now.getDate() - 28);
    const lastMonthTodayData = pulseStats.daily[
      lastMonthTodayDate.toLocaleDateString("en-CA")
    ] || { revenue: 0 };

    data.push({
      label: "اليوم",
      dateStr: todayStr,
      actual: todayData.revenue,
      lastMonth: lastMonthTodayData.revenue,
      forecast: null,
      isToday: true,
    });

    // Forecast 7 days
    forecastData.forEach((f) => {
      const fDate = new Date(f.dateStr);
      const lastMonthFDate = new Date(fDate);
      lastMonthFDate.setDate(fDate.getDate() - 28);
      const lastMonthFData = pulseStats.daily[
        lastMonthFDate.toLocaleDateString("en-CA")
      ] || { revenue: 0 };

      data.push({
        label: f.label,
        dateStr: f.dateStr,
        actual: null,
        lastMonth: lastMonthFData.revenue,
        forecast: f.revenue,
        isToday: false,
      });
    });

    return data;
  }, [pulseStats, forecastData]);

  const monthlyRequestsComparisonData = useMemo(() => {
    if (!monthStats || !prevMonthStats) return [];

    const data: any[] = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInCurrentMonth = new Date(
      currentYear,
      currentMonth + 1,
      0,
    ).getDate();

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      data.push({
        day: i,
        current: 0,
        previous: 0,
      });
    }

    monthStats.filteredRequests.forEach((req) => {
      const day = new Date(req.created_at).getDate();
      const dayData = data.find((d) => d.day === day);
      if (dayData) dayData.current += 1;
    });

    prevMonthStats.filteredRequests.forEach((req) => {
      const day = new Date(req.created_at).getDate();
      const dayData = data.find((d) => d.day === day);
      if (dayData) dayData.previous += 1;
    });

    return data;
  }, [monthStats, prevMonthStats]);

  const monthlyRevenueComparisonData = useMemo(() => {
    if (!monthStats || !prevMonthStats) return [];

    const data: any[] = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInCurrentMonth = new Date(
      currentYear,
      currentMonth + 1,
      0,
    ).getDate();

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      data.push({
        day: i,
        current: 0,
        previous: 0,
      });
    }

    monthStats.filteredRequests.forEach((req) => {
      const day = new Date(req.created_at).getDate();
      const dayData = data.find((d) => d.day === day);
      if (dayData) dayData.current += req.price;
    });

    prevMonthStats.filteredRequests.forEach((req) => {
      const day = new Date(req.created_at).getDate();
      const dayData = data.find((d) => d.day === day);
      if (dayData) dayData.previous += req.price;
    });

    return data;
  }, [monthStats, prevMonthStats]);

  // Date Formatting for Welcome
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const formattedDate = today.toLocaleDateString("ar-SA", dateOptions);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 p-2 sm:p-6 animate-fade-in custom-scrollbar">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 px-2">
        <div className="relative">
          <div className="absolute -left-12 -top-12 w-24 h-24 bg-blue-500/20 rounded-full blur-3xl"></div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3 relative z-10">
            مرحباً، {authUser?.name.split(" ")[0]}{" "}
            <span className="animate-bounce">👋</span>
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <TrendingUpIcon className="w-3 h-3 text-blue-500" />
              <span>
                آخر تحديث:{" "}
                {lastRefreshed.toLocaleTimeString("ar-SA", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <Icon name="calendar-clock" className="w-3 h-3 text-indigo-500" />
              <span>{formattedDate}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 self-start md:self-auto">
          <PeriodToggle
            activePeriod={activePeriod}
            onChange={setActivePeriod}
            isLoading={isLoading}
          />
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-blue-500 transition-all active:rotate-180 duration-700"
          >
            <RefreshCwIcon
              className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-2">
        <QuickActions
          onOpenSearchClient={() => setIsSearchClientModalOpen(true)}
          onOpenVehicleHistorySearch={() => setIsVehicleHistoryModalOpen(true)}
          onOpenQuickExpense={() => setIsQuickExpenseModalOpen(true)}
        />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 px-2">
        <ExecutiveKpiCard
          title="إجمالي العملاء"
          value={`${clientStats.total.toLocaleString()}`}
          icon={<UsersIcon />}
          bgClass="bg-blue-100 dark:bg-blue-900/40"
          colorClass="text-blue-600 dark:text-blue-400"
          isLoading={isLoading}
        />
        <ExecutiveKpiCard
          title={
            activePeriod === "today" ? "عملاء جدد اليوم" : "عملاء جدد للفترة"
          }
          value={`${clientStats.new.toLocaleString()}`}
          subtitle={
            <div className="text-xs text-slate-500 font-bold">
              و {clientStats.returning || 0} عملاء قدامى
            </div>
          }
          trend={growthPercentage}
          icon={<UsersIcon />}
          bgClass="bg-emerald-100 dark:bg-emerald-900/40"
          colorClass="text-emerald-600 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <ExecutiveKpiCard
          title="السيارات تحت الفحص"
          value={activeCars.toString()}
          icon={<Icon name="car" />}
          bgClass="bg-amber-100 dark:bg-amber-900/40"
          colorClass="text-amber-600 dark:text-amber-400"
          isLoading={isLoading}
        />
        <ExecutiveKpiCard
          title="إجمالي الطلبات للفترة"
          value={`${stats?.filteredRequests.length || 0}`}
          icon={<FileTextIcon />}
          bgClass="bg-violet-100 dark:bg-violet-900/40"
          colorClass="text-violet-600 dark:text-violet-400"
          isLoading={isLoading}
        />
      </div>

      {/* Employee Performance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8 px-2">
        <PerformanceCard
          title="منشؤو الطلبات"
          icon={
            <FilePlusIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          }
          headerBg="bg-blue-50/80 dark:bg-blue-900/30"
          badgeLabel="موظف"
          data={performanceData.creators}
          isLoading={isLoading}
          mainCountLabel="طلب"
        />
        <PerformanceCard
          title="مدخلو البيانات"
          icon={
            <PenToolIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          }
          headerBg="bg-purple-50/80 dark:bg-purple-900/30"
          badgeLabel="موظف"
          data={performanceData.dataEntry}
          isLoading={isLoading}
          mainCountLabel="ملاحظة"
        />
        <PerformanceCard
          title="المشاركات المتعددة بالطلب (قسمين فأكثر)"
          icon={
            <LayersIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          }
          headerBg="bg-amber-50/80 dark:bg-amber-900/30"
          badgeLabel="موظف"
          data={performanceData.multi}
          isLoading={isLoading}
          mainCountLabel="طلب"
        />
        {performanceData.inspectorsByRole.map((cat, idx) => (
          <PerformanceCard
            key={idx}
            title={`أبرز المنفذين: ${cat.role}`}
            icon={
              <SettingsIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            }
            headerBg="bg-orange-50/80 dark:bg-orange-900/30"
            badgeLabel="موظف"
            data={cat.items}
            isLoading={isLoading}
            mainCountLabel="فحص"
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 px-2">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-white/20 dark:border-slate-700/50 p-6 relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-500">
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
                <TrendingUpIcon className="w-5 h-5 text-blue-500" />
                مقارنة حجم الطلبات
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                مقارنة عدد الطلبات للشهر الحالي بالسابق
              </p>
            </div>
          </div>
          <div className="w-full h-72 sm:h-96 relative z-10 overflow-x-auto pb-2 custom-scrollbar">
            <div className="min-w-[700px] w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyRequestsComparisonData}
                  margin={{ top: 20, right: 10, bottom: 5, left: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="day"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "20px",
                      border: "none",
                      boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(10px)",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} طلب`,
                      name,
                    ]}
                    labelFormatter={(label) => `يوم ${label}`}
                  />
                  <Legend
                    verticalAlign="top"
                    height={40}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      paddingBottom: "20px",
                    }}
                  />
                  <Bar
                    dataKey="current"
                    name="الشهر الحالي"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                  />
                  <Bar
                    dataKey="previous"
                    name="الشهر الماضي"
                    fill="#e2e8f0"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Cars Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-white/20 dark:border-slate-700/50 p-6 flex flex-col group hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-500 h-[450px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
                <Icon name="car" className="w-5 h-5 text-indigo-500" />
                السيارات الأكثر فحصاً
              </h3>
            </div>
            <select
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value as any)}
              className="text-[10px] font-bold border-none rounded-xl bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="yesterday">أمس</option>
              <option value="week">أسبوع</option>
              <option value="month">شهر</option>
              <option value="all">الكل</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {isCarLoading ? (
              <Skeleton className="w-full h-full rounded-2xl" />
            ) : (
              <div className="flex flex-col gap-3">
                {carInspectionFrequencyData.length > 0 ? (
                  carInspectionFrequencyData.map((item, index) => {
                    const maxCount = Math.max(
                      ...carInspectionFrequencyData.map((d) => d.count),
                      1,
                    );
                    const percentage = (item.count / maxCount) * 100;
                    return (
                      <div
                        key={index}
                        className="relative w-full h-11 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl overflow-hidden flex items-center group/item border border-slate-100/50 dark:border-slate-700/30 shrink-0"
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 dark:from-blue-400/10 dark:to-indigo-400/5 transition-all duration-700 ease-out"
                          style={{ width: `${percentage}%` }}
                        ></div>
                        <div className="relative z-10 flex justify-between items-center w-full px-4 gap-3">
                          <div className="font-black text-blue-600 dark:text-blue-400 text-xs w-8">
                            {item.count}
                          </div>
                          <div className="flex-1 text-center text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                            {item.make}
                          </div>
                          <div className="w-8"></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-slate-400 text-xs py-10">
                    لا توجد سجلات
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-2">
        <div className="lg:col-span-1">
          <RecentActivity logs={activityLogs} isLoading={isLoading} />
        </div>
      </div>

      {/* Modals placed here */}
      {isSearchClientModalOpen && (
        <ClientSearchModal onClose={() => setIsSearchClientModalOpen(false)} />
      )}
      {isVehicleHistoryModalOpen && (
        <VehicleHistorySearchModal
          onClose={() => setIsVehicleHistoryModalOpen(false)}
        />
      )}
      {isQuickExpenseModalOpen && (
        <QuickExpenseModal
          onClose={() => setIsQuickExpenseModalOpen(false)}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
};

export default Dashboard;
