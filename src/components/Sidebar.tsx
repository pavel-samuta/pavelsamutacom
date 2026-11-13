import { useState } from 'react';
import {
  Download,
  FileText,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { SECTION_LABELS } from '../data/targetUrls.ts';
import type {
  ActiveTab,
  PageAuditResult,
  PageSection,
} from '../types/audit.ts';

export type IssueFilter = 'all' | 'critical' | 'warning' | 'clean' | 'pending';

interface SidebarProps {
  pages: PageAuditResult[];
  selectedSection: PageSection | 'all';
  onSelectSection: (section: PageSection | 'all') => void;
  issueFilter: IssueFilter;
  onSelectIssueFilter: (filter: IssueFilter) => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isScanning: boolean;
  scannedCount: number;
  totalCount: number;
  onExportCsv: () => void;
  onExportMarkdown: () => void;
  onAddUrls: (rawUrls: string[]) => void;
  onRescanAll: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  pages,
  selectedSection,
  onSelectSection,
  issueFilter,
  onSelectIssueFilter,
  activeTab,
  onTabChange,
  isScanning,
  scannedCount,
  totalCount,
  onExportCsv,
  onExportMarkdown,
  onAddUrls,
  onRescanAll,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const sectionCounts: Record<PageSection | 'all', number> = {
    all: pages.length,
    core: pages.filter((p) => p.section === 'core').length,
    services: pages.filter((p) => p.section === 'services').length,
    articles: pages.filter((p) => p.section === 'articles').length,
    photoalbums: pages.filter((p) => p.section === 'photoalbums').length,
  };

  const criticalPagesCount = pages.filter((p) =>
    (p.issues ?? []).some((i) => i.severity === 'critical'),
  ).length;
  const warningPagesCount = pages.filter(
    (p) =>
      !(p.issues ?? []).some((i) => i.severity === 'critical') &&
      (p.issues ?? []).some((i) => i.severity === 'warning'),
  ).length;
  const cleanPagesCount = pages.filter(
    (p) =>
      p.status === 'done' &&
      !(p.issues ?? []).some(
        (i) => i.severity === 'critical' || i.severity === 'warning',
      ),
  ).length;
  const pendingPagesCount = pages.filter(
    (p) => p.status === 'idle' || p.status === 'scanning',
  ).length;

  const progressPct =
    totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const list = urlInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('http'));
    if (list.length > 0) {
      onAddUrls(list);
      setUrlInput('');
      setShowAddForm(false);
    }
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 shrink-0 select-none">
      {/* Mobile-only navigation switcher */}
      <div className="md:hidden border-b border-slate-200 p-3 space-y-1">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-xs font-semibold text-slate-500">Разделы отчета</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Закрыть меню"
            className="p-1 text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {(
          [
            ['overview', 'Обзор'],
            ['registry', 'Реестр страниц'],
            ['semantics', 'Семантика и дубли'],
            ['strategy', 'AI-стратегия'],
          ] as Array<[ActiveTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              onTabChange(id);
              onCloseMobile();
            }}
            className={`w-full text-left px-2.5 py-2 rounded-md text-sm font-medium ${
              activeTab === id
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Crawl progress summary */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-slate-700">
            {isScanning ? 'Сканирование...' : 'Прогресс проверки'}
          </span>
          <span className="font-mono tabular-nums font-medium text-slate-900">
            {scannedCount} / {totalCount}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isScanning ? 'bg-blue-600' : 'bg-slate-900'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Section filter */}
      <div className="p-4 border-b border-slate-200 space-y-1">
        <div className="px-2 pb-1.5 text-xs font-semibold text-slate-500">
          Структура сайта
        </div>
        {(
          [
            ['all', 'Все страницы'],
            ['core', SECTION_LABELS.core],
            ['services', SECTION_LABELS.services],
            ['articles', SECTION_LABELS.articles],
            ['photoalbums', SECTION_LABELS.photoalbums],
          ] as Array<[PageSection | 'all', string]>
        ).map(([key, label]) => {
          const active = selectedSection === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectSection(key);
                if (activeTab === 'overview') onTabChange('registry');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors duration-150 cursor-pointer ${
                active
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{label}</span>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {sectionCounts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Severity filter */}
      <div className="p-4 border-b border-slate-200 space-y-1 flex-1 overflow-y-auto">
        <div className="px-2 pb-1.5 text-xs font-semibold text-slate-500">
          Статус диагностики
        </div>
        {(
          [
            ['all', 'Все URL', pages.length, 'text-slate-500'],
            ['critical', 'Критические ошибки', criticalPagesCount, 'text-red-600'],
            ['warning', 'Предупреждения', warningPagesCount, 'text-amber-600'],
            ['clean', 'Без замечаний', cleanPagesCount, 'text-emerald-700'],
            ['pending', 'Ожидают проверки', pendingPagesCount, 'text-slate-500'],
          ] as Array<[IssueFilter, string, number, string]>
        ).map(([key, label, count, countColor]) => {
          const active = issueFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectIssueFilter(key);
                if (activeTab !== 'registry') onTabChange('registry');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors duration-150 cursor-pointer ${
                active
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{label}</span>
              <span className={`font-mono tabular-nums text-xs font-medium ${countColor}`}>
                {count}
              </span>
            </button>
          );
        })}

        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="mt-4 pt-3 border-t border-slate-200 space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Добавить URL (по одному в строке)
            </label>
            <textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              rows={3}
              placeholder="https://pavelsamuta.com/..."
              className="w-full text-xs font-mono p-2 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
              >
                Добавить
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2 bg-slate-50/70">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить URL в список
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={scannedCount === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-45 rounded-md transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            disabled={scannedCount === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-45 rounded-md transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Отчет .MD
          </button>
        </div>
        <button
          type="button"
          onClick={onRescanAll}
          disabled={isScanning}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-45 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Пересканировать все заново
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
