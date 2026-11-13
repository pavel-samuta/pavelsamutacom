import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { SECTION_LABELS } from '../data/targetUrls.ts';
import type { AiPageAudit, PageAuditResult } from '../types/audit.ts';

interface PageInspectorProps {
  page: PageAuditResult;
  inboundUrls: string[];
  onClose: () => void;
  onRescanPage: (url: string) => void;
  onSaveAiAudit: (url: string, audit: AiPageAudit) => void;
}

export function PageInspector({
  page,
  inboundUrls,
  onClose,
  onRescanPage,
  onSaveAiAudit,
}: PageInspectorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleRunAiAudit = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/audit/ai-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось выполнить AI-аудит страницы');
      }
      onSaveAiAudit(page.url, data.audit);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Ошибка запроса к серверу');
    } finally {
      setAiLoading(false);
    }
  };

  const issues = page.issues ?? [];
  const ai = page.aiAudit;

  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col h-full overflow-hidden">
      {/* Inspector Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <span>{SECTION_LABELS[page.section]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              HTTP {page.httpStatus ?? '—'}
            </span>
            {page.responseTimeMs !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {page.responseTimeMs} мс
                </span>
              </>
            )}
            {page.htmlSizeKb !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {page.htmlSizeKb} КБ
                </span>
              </>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1 break-words">
            {page.h1List?.[0] || page.title || page.path}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-slate-500 truncate">
              {page.url}
            </span>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 shrink-0"
              title="Открыть страницу в новой вкладке"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRescanPage(page.url)}
            disabled={page.status === 'scanning'}
            title="Пересканировать страницу"
            className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer disabled:opacity-45"
          >
            <RefreshCw
              className={`w-4 h-4 ${page.status === 'scanning' ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель деталей"
            className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {page.status !== 'done' ? (
          <div className="py-10 text-center text-sm text-slate-500">
            {page.status === 'scanning'
              ? 'Загрузка и разбор HTML-кода страницы...'
              : page.errorMessage ||
                'Страница еще не просканирована. Нажмите «Запустить аудит» или кнопку обновления.'}
          </div>
        ) : (
          <>
            {/* SERP Snippet Preview */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500">
                Предпросмотр сниппета в поиске (SERP)
              </h4>
              <div className="p-4 border border-slate-200 rounded-md bg-slate-50/50 space-y-1">
                <div className="text-xs font-mono text-slate-500 truncate">
                  {page.url}
                </div>
                <div className="text-base font-medium text-[#1a0dab] leading-snug">
                  {page.title || 'Title отсутствует'}
                </div>
                <div className="text-xs text-slate-600 leading-relaxed">
                  {page.description ||
                    page.excerpt ||
                    'Meta Description не задан — поисковая система подставит случайный фрагмент текста.'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Длина Title</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {page.titleLength ?? 0} симв.
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Длина Description</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {page.descriptionLength ?? 0} симв.
                  </span>
                </div>
              </div>
            </section>

            {/* Technical & Content Metrics */}
            <section className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-semibold text-slate-500 mb-3">
                Метрики контента, медиа и конверсии
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                <div>
                  <div className="text-slate-500">Объем текста</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {page.wordCount ?? 0} сл. · {page.readingTimeMin ?? 1} мин
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Текст / HTML</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {page.textToHtmlRatio ?? 0}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Абзацы / Списки / Табл.</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {page.paragraphCount ?? 0} / {page.listCount ?? 0} /{' '}
                    {page.tableCount ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Изображения (без alt)</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {page.imagesTotal ?? 0} ({page.imagesMissingAlt ?? 0} без alt)
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Формы / CTA / Цены</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {page.formsCount ?? 0} / {page.ctaCount ?? 0} /{' '}
                    {page.hasPriceMention ? 'есть цена' : 'нет цены'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Ссылки (вход / исход)</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {inboundUrls.length} / {page.internalLinksCount ?? 0}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div>
                  <span className="text-slate-500">Canonical: </span>
                  <span className="font-mono break-all">
                    {page.canonical || 'не задан'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Schema.org: </span>
                  <span className="font-mono">
                    {page.schemaTypes && page.schemaTypes.length > 0
                      ? page.schemaTypes.join(', ')
                      : 'не обнаружена'}
                  </span>
                </div>
              </div>
            </section>

            {/* Deterministic Issues */}
            <section className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-semibold text-slate-500">
                Выявленные замечания ({issues.length})
              </h4>
              {issues.length === 0 ? (
                <p className="text-xs text-emerald-700">
                  Технических и базовых SEO-замечаний не выявлено.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3 border border-slate-200 rounded-md space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        {issue.severity === 'critical' ? (
                          <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        ) : issue.severity === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-slate-900">
                          {issue.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 pl-5">
                        {issue.detail}
                      </p>
                      <p className="text-xs text-slate-800 pl-5 font-medium">
                        Решение: {issue.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Heading Outline */}
            <section className="pt-4 border-t border-slate-200 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500">
                Иерархия заголовков H1–H3 ({page.headings?.length ?? 0})
              </h4>
              {!page.headings || page.headings.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Заголовки H1–H3 в контентной области не найдены.
                </p>
              ) : (
                <div className="space-y-1 text-xs max-h-48 overflow-y-auto pr-1">
                  {page.headings.map((h, idx) => (
                    <div
                      key={`${h.level}-${idx}`}
                      className="flex items-baseline gap-2"
                      style={{ paddingLeft: `${(h.level - 1) * 14}px` }}
                    >
                      <span className="font-mono text-[11px] font-semibold text-slate-400 shrink-0">
                        H{h.level}
                      </span>
                      <span className="text-slate-800">{h.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Gemini AI Deep Page Audit */}
            <section className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">
                    Глубокий AI-аудит текста и конверсии
                  </h4>
                  <p className="text-xs text-slate-500">
                    Оценка E-E-A-T, семантических пробелов и готовые мета-теги
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunAiAudit}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Анализ...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      {ai ? 'Обновить AI-разбор' : 'Провести AI-разбор'}
                    </>
                  )}
                </button>
              </div>

              {aiError && (
                <div className="p-3 border border-red-200 bg-red-50 text-xs text-red-700 rounded-md">
                  {aiError}
                </div>
              )}

              {ai && (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Качество контента и интент
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {ai.contentVerdict}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Экспертность и доверие (E-E-A-T)
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {ai.eeatAssessment}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Конверсия и UX для B2B-заказчика
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {ai.conversionDiagnosis}
                    </p>
                  </div>

                  {ai.semanticGaps.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-700">
                        Чего не хватает в тексте (семантические пробелы)
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        {ai.semanticGaps.map((gap, i) => (
                          <li key={i}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Copyable Meta Rewrite */}
                  <div className="border border-slate-200 rounded-md p-3 bg-slate-50/70 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Готовые варианты мета-тегов и H1
                    </div>

                    {(
                      [
                        ['title', 'Title', ai.suggestedTitle],
                        ['desc', 'Description', ai.suggestedDescription],
                        ['h1', 'H1', ai.suggestedH1],
                      ] as Array<[string, string, string]>
                    ).map(([key, label, value]) => (
                      <div key={key} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-500">
                            {label} ({value.length} симв.)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(key, value)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                          >
                            {copiedField === key ? (
                              <>
                                <Check className="w-3 h-3" />
                                Скопировано
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Копировать
                              </>
                            )}
                          </button>
                        </div>
                        <div className="text-xs text-slate-800 bg-white border border-slate-200 rounded px-2.5 py-1.5">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ai.prioritizedActions.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Приоритетные доработки
                      </div>
                      <div className="space-y-2">
                        {ai.prioritizedActions.map((act, i) => (
                          <div
                            key={i}
                            className="p-2.5 border border-slate-200 rounded-md text-xs space-y-0.5"
                          >
                            <div className="font-semibold text-slate-900">
                              <span
                                className={`mr-1.5 ${
                                  act.priority === 'high'
                                    ? 'text-red-600'
                                    : act.priority === 'medium'
                                      ? 'text-amber-600'
                                      : 'text-slate-500'
                                }`}
                              >
                                [
                                {act.priority === 'high'
                                  ? 'Высокий'
                                  : act.priority === 'medium'
                                    ? 'Средний'
                                    : 'Низкий'}
                                ]
                              </span>
                              {act.action}
                            </div>
                            <div className="text-slate-500">
                              Эффект: {act.expectedImpact}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
