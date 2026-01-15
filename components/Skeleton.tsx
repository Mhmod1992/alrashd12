
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700/50 rounded ${className}`} />
  );
};

export const SkeletonCard: React.FC = () => (
  <div className="p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-slate-100 dark:border-slate-700">
    <div className="flex justify-between items-start">
      <div className="space-y-3 w-full">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
    <div className="p-4 border-b dark:border-slate-700 flex justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
    </div>
    <div className="p-4 space-y-4">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  </div>
);

export const AppShellSkeleton: React.FC = () => (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden" dir="rtl">
      {/* Sidebar Skeleton */}
      <div className="w-64 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 hidden md:flex flex-col p-4 gap-6">
         <div className="flex justify-center mb-4">
            <Skeleton className="h-8 w-24" />
         </div>
         <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
         </div>
      </div>
      
      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
         {/* Header Skeleton */}
         <div className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 justify-between">
            <Skeleton className="h-10 w-64 rounded-lg" />
            <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
         </div>
         
         {/* Body Skeleton */}
         <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
            <div className="mt-8">
                <SkeletonTable rows={6} />
            </div>
         </div>
      </div>
    </div>
);
