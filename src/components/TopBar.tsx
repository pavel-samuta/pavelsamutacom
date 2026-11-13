import { Menu, Play, Square } from 'lucide-react';
import type { ActiveTab } from '../types/audit.ts';

interface TopBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isScanning: boolean;
  onStartScan: () => void;
  onStopScan: () => void;
  onToggleMobileSidebar: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'registry', label: 'Реестр страниц' },
  { id: 'semantics', label: 'Семантика и дубли' },
  { id: 'strategy', label: 'AI-стратегия' },
];

export function TopBar({
  activeTab,
  onTabChange,
  isScanning,
  onStartScan,
  onStopScan,
  onToggleMobileSidebar,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-8">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label="Открыть фильтры разделов"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Аудит pavelsamuta.com
        </span>
      </div>

      <nav
        aria-label="Основные разделы аудита"
        className="hidden md:flex items-center gap-6 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        {isScanning ? (
          <button
            type="button"
            onClick={onStopScan}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Остановить скан
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartScan}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Запустить аудит
          </button>
        )}
      </div>
    </header>
  );
}
