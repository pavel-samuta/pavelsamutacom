import { SECTION_LABELS } from '../data/targetUrls.ts';
import type { AiSiteAudit, PageAuditResult } from '../types/audit.ts';
import {
  auditUrlSlugs,
  findCannibalizationPairs,
  findDuplicates,
} from './auditAnalytics.ts';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string | number | boolean | undefined): string {
  const str = val === undefined ? '' : String(val);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportAuditCsv(pages: PageAuditResult[]) {
  const headers = [
    'URL',
    'Раздел',
    'Статус аудита',
    'HTTP код',
    'Время ответа (мс)',
    'Title',
    'Длина Title',
    'Meta Description',
    'Длина Description',
    'H1',
    'Слов в контенте',
    'Изображений всего',
    'Без Alt',
    'Формы',
    'CTA',
    'Внутренних ссылок',
    'Schema.org',
    'Критических ошибок',
    'Предупреждений',
    'Список проблем',
  ];

  const rows = pages.map((p) => {
    const crit = (p.issues ?? []).filter((i) => i.severity === 'critical').length;
    const warn = (p.issues ?? []).filter((i) => i.severity === 'warning').length;
    const issuesText = (p.issues ?? []).map((i) => i.title).join(' | ');

    return [
      p.url,
      SECTION_LABELS[p.section],
      p.status,
      p.httpStatus ?? '',
      p.responseTimeMs ?? '',
      p.title ?? '',
      p.titleLength ?? '',
      p.description ?? '',
      p.descriptionLength ?? '',
      (p.h1List ?? []).join(' / '),
      p.wordCount ?? '',
      p.imagesTotal ?? '',
      p.imagesMissingAlt ?? '',
      p.formsCount ?? '',
      p.ctaCount ?? '',
      p.internalLinksCount ?? '',
      (p.schemaTypes ?? []).join(', '),
      crit,
      warn,
      issuesText,
    ]
      .map(escapeCsv)
      .join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\n');
  downloadBlob(
    csv,
    `pavelsamuta-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;',
  );
}

export function exportAuditMarkdown(
  pages: PageAuditResult[],
  inboundMap: Map<string, string[]>,
  siteAudit: AiSiteAudit | null,
) {
  const scanned = pages.filter((p) => p.status === 'done');
  const duplicates = findDuplicates(pages);
  const cannibalization = findCannibalizationPairs(pages);
  const slugIssues = auditUrlSlugs(pages);

  const lines: string[] = [
    `# Аудит сайта и контента: pavelsamuta.com`,
    `Дата выгрузки: ${new Date().toLocaleString('ru-RU')}`,
    `Всего URL в реестре: ${pages.length} · Просканировано: ${scanned.length}`,
    '',
  ];

  if (siteAudit) {
    lines.push('## Стратегическое резюме (AI-анализ)');
    lines.push(siteAudit.executiveSummary);
    lines.push('');
    lines.push('### Позиционирование и воронка');
    lines.push(siteAudit.positioningAndFunnel);
    lines.push('');
    lines.push('### Каннибализация и структура');
    lines.push(siteAudit.cannibalizationStrategy);
    lines.push('');
    lines.push('### Техническая дорожная карта');
    lines.push(siteAudit.technicalAndSchemaRoadmap);
    lines.push('');
  }

  lines.push('## Дубли мета-тегов и H1');
  if (duplicates.length === 0) {
    lines.push('Точных дублей Title, Description или H1 не обнаружено.');
  } else {
    for (const d of duplicates) {
      lines.push(`- **${d.type.toUpperCase()}**: "${d.value}" (${d.urls.join(', ')})`);
    }
  }
  lines.push('');

  lines.push('## Каннибализация и пересечение тем');
  for (const pair of cannibalization.slice(0, 15)) {
    lines.push(
      `- [${pair.similarityScore}%] ${pair.urlA} ↔ ${pair.urlB} — ${pair.reason}`,
    );
  }
  lines.push('');

  lines.push('## Проблемы URL-слагов');
  for (const s of slugIssues) {
    lines.push(`- ${s.path}: ${s.issueType} — ${s.explanation}`);
  }
  lines.push('');

  lines.push('## Детальный реестр страниц');
  for (const p of pages) {
    const inCount = inboundMap.get(p.url)?.length ?? 0;
    const crit = (p.issues ?? []).filter((i) => i.severity === 'critical');
    const warn = (p.issues ?? []).filter((i) => i.severity === 'warning');
    lines.push(`### ${p.path} (${SECTION_LABELS[p.section]})`);
    lines.push(
      `HTTP: ${p.httpStatus ?? '—'} | Скорость: ${p.responseTimeMs ?? '—'} мс | Слов: ${p.wordCount ?? '—'} | Входящих ссылок: ${inCount}`,
    );
    lines.push(`Title (${p.titleLength ?? 0}): ${p.title || '—'}`);
    lines.push(`Description (${p.descriptionLength ?? 0}): ${p.description || '—'}`);
    lines.push(`H1: ${(p.h1List ?? []).join(' / ') || '—'}`);
    if (crit.length > 0 || warn.length > 0) {
      lines.push('Выявленные проблемы:');
      for (const issue of [...crit, ...warn]) {
        lines.push(`- [${issue.severity.toUpperCase()}] ${issue.title}: ${issue.recommendation}`);
      }
    }
    lines.push('');
  }

  downloadBlob(
    lines.join('\n'),
    `pavelsamuta-audit-report-${new Date().toISOString().slice(0, 10)}.md`,
    'text/markdown;charset=utf-8;',
  );
}
