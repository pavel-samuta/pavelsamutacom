import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { SECTION_LABELS } from '../data/targetUrls.ts';
import type { AiSiteAudit, PageAuditResult, PageSection } from '../types/audit.ts';
import {
  auditUrlSlugs,
  findCannibalizationPairs,
  findDuplicates,
} from '../utils/auditAnalytics.ts';

interface AiStrategyViewProps {
  pages: PageAuditResult[];
  inboundMap: Map<string, string[]>;
  siteAudit: AiSiteAudit | null;
  onSaveSiteAudit: (audit: AiSiteAudit) => void;
}

export function AiStrategyView({
  pages,
  inboundMap,
  siteAudit,
  onSaveSiteAudit,
}: AiStrategyViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanned = pages.filter((p) => p.status === 'done');

  const handleGenerateSiteAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const sections: PageSection[] = ['core', 'services', 'articles', 'photoalbums'];
      const sectionBreakdown = sections.map((sec) => {
        const list = scanned.filter((p) => p.section === sec);
        return {
          section: SECTION_LABELS[sec],
          totalUrls: pages.filter((p) => p.section === sec).length,
          scannedUrls: list.length,
          avgWords:
            list.length > 0
              ? Math.round(
                  list.reduce((s, p) => s + (p.wordCount ?? 0), 0) / list.length,
                )
              : 0,
          missingDescCount: list.filter((p) => !p.description).length,
          missingSchemaCount: list.filter(
            (p) => (p.schemaTypes?.length ?? 0) === 0,
          ).length,
          noCtaCount: list.filter(
            (p) => (p.ctaCount ?? 0) === 0 && (p.formsCount ?? 0) === 0,
          ).length,
        };
      });

      const pageSnapshots = scanned.map((p) => ({
        path: p.path,
        section: p.section,
        httpStatus: p.httpStatus,
        words: p.wordCount,
        title: p.title,
        descLen: p.descriptionLength,
        h1: p.h1List?.[0],
        inboundLinks: inboundMap.get(p.url)?.length ?? 0,
        outboundInternalLinks: p.internalLinksCount ?? 0,
        forms: p.formsCount ?? 0,
        ctas: p.ctaCount ?? 0,
        imagesMissingAlt: p.imagesMissingAlt ?? 0,
        issues: (p.issues ?? [])
          .filter((i) => i.severity !== 'info')
          .map((i) => i.title),
      }));

      const summary = {
        domain: 'pavelsamuta.com',
        totalUrls: pages.length,
        scannedUrls: scanned.length,
        sectionBreakdown,
        duplicates: findDuplicates(pages),
        cannibalizationTop: findCannibalizationPairs(pages).slice(0, 12),
        slugIssues: auditUrlSlugs(pages),
        pages: pageSnapshots,
      };

      const response = await fetch('/api/audit/ai-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось сформировать стратегический отчет');
      }
      onSaveSiteAudit(data.siteAudit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обращении к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Комплексный синтез Gemini · На базе {scanned.length} просканированных страниц
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 text-balance">
            Стратегический план развития сайта и контента
          </h1>
        </div>

        <button
          type="button"
          onClick={handleGenerateSiteAudit}
          disabled={loading || scanned.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-45 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Формирование стратегии...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {siteAudit ? 'Пересчитать стратегию' : 'Сформировать AI-стратегию'}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 border border-red-200 bg-red-50 text-sm text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {!siteAudit && !loading && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Готово к стратегическому анализу
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            {scanned.length === 0
              ? 'Сначала запустите сканирование страниц в верхней панели, чтобы собрать реальные заголовки, объемы текстов, ссылки и технические ошибки со всего сайта pavelsamuta.com.'
              : `Собраны данные по ${scanned.length} из ${pages.length} страниц. Нажмите «Сформировать AI-стратегию», чтобы получить план устранения каннибализации, усиления B2B-конверсии и технической оптимизации.`}
          </p>
        </div>
      )}

      {siteAudit && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                1. Итоговое резюме аудита
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-line">
                {siteAudit.executiveSummary}
              </p>
            </div>

            <div className="pt-5 border-t border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                2. Позиционирование и коммерческая воронка
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-line">
                {siteAudit.positioningAndFunnel}
              </p>
            </div>

            <div className="pt-5 border-t border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                3. Устранение каннибализации и структура разделов
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-line">
                {siteAudit.cannibalizationStrategy}
              </p>
            </div>

            <div className="pt-5 border-t border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                4. Техническая дорожная карта и Schema.org
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-line">
                {siteAudit.technicalAndSchemaRoadmap}
              </p>
            </div>
          </section>

          {/* Quick Wins Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Быстрые победы (Quick Wins)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5">Направление</th>
                    <th className="py-3 px-4">Задача</th>
                    <th className="py-3 px-4">Охват</th>
                    <th className="py-3 px-5">Ожидаемый эффект</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {siteAudit.quickWins.map((qw, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-5 font-semibold text-slate-900 whitespace-nowrap">
                        {qw.area}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{qw.task}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {qw.affectedScope}
                      </td>
                      <td className="py-3 px-5 text-slate-700">{qw.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Content Plan */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Рекомендации по контент-плану и доработке материалов
              </h2>
            </div>
            <div className="divide-y divide-slate-200">
              {siteAudit.contentPlanRecommendations.map((rec, i) => (
                <div key={i} className="p-5 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-900">
                      {rec.topic}
                    </span>
                    <span className="text-xs font-medium text-slate-500 shrink-0">
                      {rec.targetSection}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {rec.rationale}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
