import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
} from 'lucide-react';
import { SECTION_LABELS } from '../data/targetUrls.ts';
import type { AiPageAudit, PageAuditResult, PageSection } from '../types/audit.ts';
import { PageInspector } from './PageInspector.tsx';
import type { IssueFilter } from './Sidebar.tsx';

type SortKey = 'default' | 'issues' | 'words_asc' | 'words_desc' | 'speed' | 'inbound';

interface RegistryViewProps {
  pages: PageAuditResult[];
  inboundMap: Map<string, string[]>;
  selectedSection: PageSection | 'all';
  issueFilter: IssueFilter;
  selectedUrl: string | null;
  onSelectUrl: (url: string | null) => void;
  onRescanPage: (url: string) => void;
  onSaveAiAudit: (url: string, audit: AiPageAudit) => void;
}

export function RegistryView({
  pages,
  inboundMap,
  selectedSection,
  issueFilter,
  selectedUrl,
  onSelectUrl,
  onRescanPage,
  onSaveAiAudit,
}: RegistryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('default');

  const filteredPages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = pages.filter((p) => {
      if (selectedSection !== 'all' && p.section !== selectedSection) {
        return false;
      }

      const crit = (p.issues ?? []).filter((i) => i.severity === 'critical').length;
      const warn = (p.issues ?? []).filter((i) => i.severity === 'warning').length;

      if (issueFilter === 'critical' && crit === 0) return false;
      if (issueFilter === 'warning' && (crit > 0 || warn === 0)) return false;
      if (issueFilter === 'clean' && (p.status !== 'done' || crit > 0 || warn > 0)) {
        return false;
      }
      if (issueFilter === 'pending' && p.status !== 'idle' && p.status !== 'scanning') {
        return false;
      }

      if (q) {
        const hay = [
          p.path,
          p.title ?? '',
          p.h1List?.[0] ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    if (sortBy === 'default') return filtered;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'issues') {
        const aScore =
          (a.issues ?? []).filter((i) => i.severity === 'critical').length * 10 +
          (a.issues ?? []).filter((i) => i.severity === 'warning').length;
        const bScore =
          (b.issues ?? []).filter((i) => i.severity === 'critical').length * 10 +
          (b.issues ?? []).filter((i) => i.severity === 'warning').length;
        return bScore - aScore;
      }
      if (sortBy === 'words_asc') {
        return (a.wordCount ?? 999999) - (b.wordCount ?? 999999);
      }
      if (sortBy === 'words_desc') {
        return (b.wordCount ?? -1) - (a.wordCount ?? -1);
      }
      if (sortBy === 'speed') {
        return (b.responseTimeMs ?? -1) - (a.responseTimeMs ?? -1);
      }
      if (sortBy === 'inbound') {
        return (
          (inboundMap.get(a.url)?.length ?? 0) -
          (inboundMap.get(b.url)?.length ?? 0)
        );
      }
      return 0;
    });
  }, [pages, selectedSection, issueFilter, searchQuery, sortBy, inboundMap]);

  const selectedPage = useMemo(
    () => pages.find((p) => p.url === selectedUrl) ?? null,
    [pages, selectedUrl],
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по URL, Title или H1..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
            Показано: {filteredPages.length}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Сортировка страниц"
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="default">Порядок: по списку</option>
            <option value="issues">Сначала больше проблем</option>
            <option value="words_asc">Меньше слов (тонкий контент)</option>
            <option value="words_desc">Больше слов</option>
            <option value="speed">Медленный ответ (мс)</option>
            <option value="inbound">Меньше входящих ссылок</option>
          </select>
        </div>
      </div>

      {/* Split Workspace: Table + Inspector */}
      <div
        className={`grid gap-4 items-start ${
          selectedPage ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        <div
          className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${
            selectedPage ? 'xl:col-span-7' : 'col-span-1'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Страница и заголовок</th>
                  <th className="py-2.5 px-3 text-right">HTTP</th>
                  <th className="py-2.5 px-3 text-right">Слова</th>
                  <th className="py-2.5 px-3 text-right">Title / Desc</th>
                  <th className="py-2.5 px-3 text-right">Вход. ссыл.</th>
                  <th className="py-2.5 px-4 text-right">Диагностика</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredPages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      Нет страниц, подходящих под выбранные фильтры.
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((p) => {
                    const isSelected = p.url === selectedUrl;
                    const crit = (p.issues ?? []).filter(
                      (i) => i.severity === 'critical',
                    ).length;
                    const warn = (p.issues ?? []).filter(
                      (i) => i.severity === 'warning',
                    ).length;
                    const inboundCount = inboundMap.get(p.url)?.length ?? 0;

                    return (
                      <tr
                        key={p.url}
                        onClick={() => onSelectUrl(isSelected ? null : p.url)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4 max-w-[340px]">
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span>{SECTION_LABELS[p.section]}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono truncate">{p.path}</span>
                          </div>
                          <div className="text-xs font-medium text-slate-900 truncate mt-0.5">
                            {p.h1List?.[0] || p.title || '—'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {p.status === 'scanning' ? (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              скан
                            </span>
                          ) : p.status === 'idle' ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={
                                (p.httpStatus ?? 0) >= 400 || p.status === 'error'
                                  ? 'text-red-600 font-semibold'
                                  : 'text-slate-700'
                              }
                            >
                              {p.httpStatus ?? 'ERR'}
                              {p.responseTimeMs !== undefined && (
                                <span className="text-slate-400 ml-1">
                                  {p.responseTimeMs}мс
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {p.status === 'done' ? p.wordCount ?? 0 : '—'}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {p.status === 'done'
                            ? `${p.titleLength ?? 0} / ${p.descriptionLength ?? 0}`
                            : '—'}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {p.status === 'done' ? inboundCount : '—'}
                        </td>

                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {p.status === 'idle' && (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Clock className="w-3.5 h-3.5" />
                              Ожидает
                            </span>
                          )}
                          {p.status === 'scanning' && (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Проверка
                            </span>
                          )}
                          {(p.status === 'done' || p.status === 'error') && (
                            <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                              {crit > 0 ? (
                                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                  {crit} крит
                                </span>
                              ) : null}
                              {warn > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {warn} пред
                                </span>
                              ) : null}
                              {crit === 0 && warn === 0 && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  ОК
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedPage && (
          <div className="xl:col-span-5 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6.5rem)] flex flex-col">
            <PageInspector
              page={selectedPage}
              inboundUrls={inboundMap.get(selectedPage.url) ?? []}
              onClose={() => onSelectUrl(null)}
              onRescanPage={onRescanPage}
              onSaveAiAudit={onSaveAiAudit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
