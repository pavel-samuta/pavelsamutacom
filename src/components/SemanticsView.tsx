import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Link2Off } from 'lucide-react';
import { SECTION_LABELS } from '../data/targetUrls.ts';
import type { PageAuditResult } from '../types/audit.ts';
import {
  auditUrlSlugs,
  findCannibalizationPairs,
  findDuplicates,
} from '../utils/auditAnalytics.ts';

interface SemanticsViewProps {
  pages: PageAuditResult[];
  inboundMap: Map<string, string[]>;
  onInspectUrl: (url: string) => void;
}

export function SemanticsView({
  pages,
  inboundMap,
  onInspectUrl,
}: SemanticsViewProps) {
  const scannedCount = pages.filter((p) => p.status === 'done').length;

  const duplicates = useMemo(() => findDuplicates(pages), [pages]);
  const cannibalization = useMemo(() => findCannibalizationPairs(pages), [pages]);
  const slugIssues = useMemo(() => auditUrlSlugs(pages), [pages]);

  const orphanPages = useMemo(() => {
    if (scannedCount === 0) return [];
    return pages.filter(
      (p) =>
        p.status === 'done' &&
        p.path !== '/' &&
        (inboundMap.get(p.url)?.length ?? 0) === 0,
    );
  }, [pages, inboundMap, scannedCount]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-slate-500">
          Кросс-страничный анализ · Проверено страниц: {scannedCount} из {pages.length}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 text-balance">
          Семантика, дубли, каннибализация и перелинковка
        </h1>
      </div>

      {/* 1. Keyword / Topic Cannibalization */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Пересечение тем и риск каннибализации ({cannibalization.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Пары страниц со схожими URL-слагами, заголовками Title и H1, которые могут конкурировать в поиске по одним запросам
          </p>
        </div>

        {cannibalization.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Пересечений тем не обнаружено.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {cannibalization.map((pair, idx) => (
              <div key={`${pair.urlA}-${pair.urlB}-${idx}`} className="p-5 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Сходство {pair.similarityScore}% · Общие токены: {pair.sharedTokens.join(', ')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onInspectUrl(pair.urlA)}
                    className="text-left p-3 border border-slate-200 hover:border-blue-400 rounded-md transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] text-slate-500">
                      {SECTION_LABELS[pair.sectionA]} · {new URL(pair.urlA).pathname}
                    </div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {pair.titleA}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInspectUrl(pair.urlB)}
                    className="text-left p-3 border border-slate-200 hover:border-blue-400 rounded-md transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] text-slate-500">
                      {SECTION_LABELS[pair.sectionB]} · {new URL(pair.urlB).pathname}
                    </div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {pair.titleB}
                    </div>
                  </button>
                </div>
                <p className="text-xs text-slate-600">{pair.reason}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Exact Duplicates of Title / Description / H1 */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Точные дубли Title, Meta Description и H1 ({duplicates.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Выявляются по мере завершения сканирования HTML
          </p>
        </div>

        {scannedCount === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Запустите сканирование страниц для поиска дублей мета-тегов.
          </div>
        ) : duplicates.length === 0 ? (
          <div className="p-6 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Точных дублей Title, Description и H1 среди проверенных страниц не найдено.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {duplicates.map((group, idx) => (
              <div key={`${group.type}-${idx}`} className="p-5 space-y-2">
                <div className="text-xs font-semibold text-red-600">
                  Дубль {group.type.toUpperCase()} ({group.urls.length} стр.): «{group.value}»
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {group.urls.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => onInspectUrl(u)}
                      className="font-mono text-blue-600 hover:underline cursor-pointer"
                    >
                      {new URL(u).pathname}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Orphan Pages (0 inbound contextual links) */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Изолированные страницы без контекстных входящих ссылок ({orphanPages.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Страницы, на которые нет ссылок из основного контента других проверенных страниц (без учета шапки и футера)
          </p>
        </div>

        {scannedCount === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Данные появятся после сканирования графа внутренних ссылок.
          </div>
        ) : orphanPages.length === 0 ? (
          <div className="p-6 text-sm text-emerald-700">
            Все проверенные страницы связаны контекстными ссылками.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600">
                  <th className="py-2.5 px-5">Раздел</th>
                  <th className="py-2.5 px-4">URL</th>
                  <th className="py-2.5 px-4">Заголовок H1</th>
                  <th className="py-2.5 px-5 text-right">Исходящих ссылок</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orphanPages.map((p) => (
                  <tr
                    key={p.url}
                    onClick={() => onInspectUrl(p.url)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap">
                      {SECTION_LABELS[p.section]}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Link2Off className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {p.path}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {p.h1List?.[0] || p.title || '—'}
                    </td>
                    <td className="py-2.5 px-5 text-right font-mono tabular-nums text-slate-600">
                      {p.internalLinksCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. URL Slug Hygiene */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Гигиена URL-адресов и транслитерации ({slugIssues.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Числовые ID альбомов, обрезанные длинные слаги и неоднородная транслитерация
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {slugIssues.map((s) => (
            <div
              key={s.url}
              onClick={() => onInspectUrl(s.url)}
              className="px-5 py-3.5 hover:bg-slate-50 cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono font-medium text-slate-900">
                  {s.path}
                </span>
                <span className="text-xs font-medium text-amber-700 shrink-0">
                  {s.issueType}
                </span>
              </div>
              <p className="text-xs text-slate-600">{s.explanation}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
