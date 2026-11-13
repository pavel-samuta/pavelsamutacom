import { ArrowRight, AlertOctagon, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { SECTION_LABELS } from '../data/targetUrls.ts';
import type { ActiveTab, PageAuditResult, PageSection } from '../types/audit.ts';
import type { IssueFilter } from './Sidebar.tsx';

interface OverviewViewProps {
  pages: PageAuditResult[];
  inboundMap: Map<string, string[]>;
  isScanning: boolean;
  onStartScan: () => void;
  onNavigateRegistry: (section: PageSection | 'all', filter: IssueFilter) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export function OverviewView({
  pages,
  inboundMap,
  isScanning,
  onStartScan,
  onNavigateRegistry,
  onNavigateTab,
}: OverviewViewProps) {
  const scanned = pages.filter((p) => p.status === 'done');
  const errored = pages.filter((p) => p.status === 'error');
  const finishedCount = scanned.length + errored.length;

  const totalCritical = pages.reduce(
    (sum, p) =>
      sum + (p.issues ?? []).filter((i) => i.severity === 'critical').length,
    0,
  );
  const totalWarnings = pages.reduce(
    (sum, p) =>
      sum + (p.issues ?? []).filter((i) => i.severity === 'warning').length,
    0,
  );

  const avgWords =
    scanned.length > 0
      ? Math.round(
          scanned.reduce((sum, p) => sum + (p.wordCount ?? 0), 0) / scanned.length,
        )
      : 0;
  const avgResponseMs =
    scanned.length > 0
      ? Math.round(
          scanned.reduce((sum, p) => sum + (p.responseTimeMs ?? 0), 0) /
            scanned.length,
        )
      : 0;

  const sections: PageSection[] = ['core', 'services', 'articles', 'photoalbums'];

  // Aggregate recurring issues by ID
  const issueAgg = new Map<
    string,
    { title: string; severity: 'critical' | 'warning' | 'info'; count: number; recommendation: string }
  >();
  for (const p of pages) {
    for (const issue of p.issues ?? []) {
      const existing = issueAgg.get(issue.id);
      if (existing) {
        existing.count += 1;
      } else {
        issueAgg.set(issue.id, {
          title: issue.title,
          severity: issue.severity,
          count: 1,
          recommendation: issue.recommendation,
        });
      }
    }
  }

  const topSystemicIssues = Array.from(issueAgg.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter((item) => item.severity !== 'info')
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      return b.count - a.count;
    })
    .slice(0, 8);

  const orphanCount = scanned.filter(
    (p) => p.path !== '/' && (inboundMap.get(p.url)?.length ?? 0) === 0,
  ).length;

  const detectedGenerator =
    scanned.find((p) => p.generator)?.generator ?? 'Nethouse CMS';

  return (
    <div className="space-y-8">
      {/* Header block */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            pavelsamuta.com · {pages.length} целевых URL · Платформа: {detectedGenerator}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mt-1 text-balance">
            Сводный аудит сайта и контента
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {finishedCount === 0 && !isScanning && (
            <button
              type="button"
              onClick={onStartScan}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Начать проверку страниц
            </button>
          )}
          {scanned.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('strategy')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              Сформировать AI-стратегию
            </button>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Проверено страниц</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {finishedCount} / {pages.length}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              HTTP 200: {scanned.filter((p) => p.httpStatus === 200).length}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateRegistry('all', 'critical')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500">Критические ошибки</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-red-600">
              {totalCritical}
            </span>
            <span className="text-xs text-slate-500">Открыть список</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateRegistry('all', 'warning')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500">Предупреждения SEO и UX</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-600">
              {totalWarnings}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Изолированных: {orphanCount}
            </span>
          </div>
        </button>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Средний объем и отклик</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {avgWords > 0 ? `${avgWords} сл.` : '—'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {avgResponseMs > 0 ? `${avgResponseMs} мс` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Section Health Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Срез по разделам сайта
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Сопоставление текстовой глубины, метаданных, микроразметки и конверсионных блоков
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-5">Раздел</th>
                <th className="py-3 px-4 text-right">URL</th>
                <th className="py-3 px-4 text-right">Ср. объем</th>
                <th className="py-3 px-4 text-right">Ср. TTFB</th>
                <th className="py-3 px-4 text-right">Title / Desc</th>
                <th className="py-3 px-4 text-right">Schema.org</th>
                <th className="py-3 px-4 text-right">CTA / Формы</th>
                <th className="py-3 px-5 text-right">Ошибки (крит / пред)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {sections.map((sec) => {
                const secPages = pages.filter((p) => p.section === sec);
                const secScanned = secPages.filter((p) => p.status === 'done');
                const secAvgWords =
                  secScanned.length > 0
                    ? Math.round(
                        secScanned.reduce((s, p) => s + (p.wordCount ?? 0), 0) /
                          secScanned.length,
                      )
                    : 0;
                const secAvgMs =
                  secScanned.length > 0
                    ? Math.round(
                        secScanned.reduce((s, p) => s + (p.responseTimeMs ?? 0), 0) /
                          secScanned.length,
                      )
                    : 0;
                const metaOk = secScanned.filter(
                  (p) => Boolean(p.title) && Boolean(p.description),
                ).length;
                const schemaOk = secScanned.filter(
                  (p) => (p.schemaTypes?.length ?? 0) > 0,
                ).length;
                const ctaOk = secScanned.filter(
                  (p) => (p.ctaCount ?? 0) > 0 || (p.formsCount ?? 0) > 0,
                ).length;
                const critCount = secPages.reduce(
                  (s, p) =>
                    s +
                    (p.issues ?? []).filter((i) => i.severity === 'critical')
                      .length,
                  0,
                );
                const warnCount = secPages.reduce(
                  (s, p) =>
                    s +
                    (p.issues ?? []).filter((i) => i.severity === 'warning')
                      .length,
                  0,
                );

                return (
                  <tr
                    key={sec}
                    onClick={() => onNavigateRegistry(sec, 'all')}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-5 font-medium text-slate-900">
                      {SECTION_LABELS[sec]}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {secPages.length}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {secScanned.length > 0 ? `${secAvgWords} сл.` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {secScanned.length > 0 ? `${secAvgMs} мс` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {secScanned.length > 0
                        ? `${metaOk} / ${secScanned.length}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {secScanned.length > 0
                        ? `${schemaOk} / ${secScanned.length}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {secScanned.length > 0
                        ? `${ctaOk} / ${secScanned.length}`
                        : '—'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums">
                      <span className={critCount > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                        {critCount}
                      </span>
                      <span className="text-slate-300 mx-1.5">/</span>
                      <span className={warnCount > 0 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                        {warnCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Systemic Issues */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Системные проблемы по всему сайту
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Повторяющиеся ошибки и точки роста, сгруппированные по частоте
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('semantics')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Проверить дубли и перелинковку
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {finishedCount === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-600">
              Запустите сканирование, чтобы собрать живые метрики HTML, мета-тегов, структуры заголовков и текстов со всех 61 страниц pavelsamuta.com.
            </p>
          </div>
        ) : topSystemicIssues.length === 0 ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Критических и предупреждающих системных ошибок не найдено.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {topSystemicIssues.map((item) => (
              <div
                key={item.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.severity === 'critical' ? (
                      <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span
                      className={`text-xs font-medium ${
                        item.severity === 'critical'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {item.severity === 'critical' ? 'Критично' : 'Предупреждение'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6">
                    {item.recommendation}
                  </p>
                </div>
                <div className="pl-6 sm:pl-0 shrink-0 text-right">
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                    {item.count}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">стр.</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
