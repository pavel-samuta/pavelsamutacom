import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';
import { classifyUrl } from './src/data/targetUrls.ts';
import type {
  AiPageAudit,
  AiSiteAudit,
  AuditIssue,
  HeadingItem,
  PageAuditResult,
  PageSection,
} from './src/types/audit.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не задан на сервере.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeUrl(rawHref: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(rawHref, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    resolved.hash = '';
    const pathname =
      resolved.pathname === '/' ? '/' : resolved.pathname.replace(/\/+$/, '');
    return `${resolved.origin}${pathname}${resolved.search}`;
  } catch {
    return null;
  }
}

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((w) => /[a-zA-Zа-яА-ЯёЁ0-9]/.test(w)).length;
}

function buildDeterministicIssues(
  page: Omit<PageAuditResult, 'issues' | 'status'>,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const section: PageSection = page.section;

  if ((page.httpStatus ?? 0) >= 400 || (page.httpStatus ?? 0) === 0) {
    issues.push({
      id: 'http-error',
      severity: 'critical',
      category: 'technical',
      title: `Ошибка HTTP ${page.httpStatus ?? 'сети'}`,
      detail: `Страница вернула код ответа ${page.httpStatus ?? 'ошибка соединения'}.`,
      recommendation:
        'Проверьте доступность страницы на сервере, настройте 301-редирект или восстановите маршрут.',
    });
    return issues;
  }

  if (page.redirected) {
    issues.push({
      id: 'redirected',
      severity: 'warning',
      category: 'technical',
      title: 'Обнаружен редирект URL',
      detail: `Запрошенный URL перенаправляет на ${page.finalUrl}.`,
      recommendation:
        'Обновите внутренние ссылки и карту сайта sitemap.xml на конечный канонический URL.',
    });
  }

  if (page.noindex) {
    issues.push({
      id: 'noindex',
      severity: 'critical',
      category: 'technical',
      title: 'Страница закрыта от индексации (noindex)',
      detail: `Мета-тег robots содержит директиву "${page.robots}".`,
      recommendation:
        'Если страница должна привлекать органический трафик, удалите noindex.',
    });
  }

  if ((page.responseTimeMs ?? 0) > 1500) {
    issues.push({
      id: 'slow-ttfb',
      severity: 'warning',
      category: 'technical',
      title: `Медленный ответ сервера (${page.responseTimeMs} мс)`,
      detail: 'Время ответа превышает рекомендуемый порог в 1500 мс.',
      recommendation:
        'Включите серверное кэширование, оптимизируйте изображения и скрипты CMS.',
    });
  }

  // Title checks
  const titleLen = page.titleLength ?? 0;
  if (!page.title) {
    issues.push({
      id: 'missing-title',
      severity: 'critical',
      category: 'seo',
      title: 'Отсутствует тег <title>',
      detail: 'На странице не найден заголовок Title для поисковой выдачи.',
      recommendation:
        'Добавьте уникальный <title> длиной 45–65 символов с основным коммерческим или информационным ключом.',
    });
  } else if (titleLen < 30) {
    issues.push({
      id: 'short-title',
      severity: 'warning',
      category: 'seo',
      title: `Слишком короткий Title (${titleLen} симв.)`,
      detail: `Текущий Title: «${page.title}». Не используется потенциал ключевых фраз.`,
      recommendation:
        'Расширьте Title до 45–65 символов, добавив уточнение услуги, стандарта или выгоды.',
    });
  } else if (titleLen > 70) {
    issues.push({
      id: 'long-title',
      severity: 'warning',
      category: 'seo',
      title: `Слишком длинный Title (${titleLen} симв.)`,
      detail: 'Заголовок может обрезаться в сниппете Google и Яндекса (норма до 65–70 символов).',
      recommendation:
        'Сократите Title до 50–65 символов, вынеся главное ключевое слово в начало.',
    });
  }

  // Meta description checks
  const descLen = page.descriptionLength ?? 0;
  if (!page.description) {
    issues.push({
      id: 'missing-desc',
      severity: 'critical',
      category: 'seo',
      title: 'Отсутствует Meta Description',
      detail: 'Поисковая система будет формировать сниппет из случайного фрагмента текста.',
      recommendation:
        'Напишите продающий Meta Description (120–160 символов) с УТП и призывом к действию.',
    });
  } else if (descLen < 70) {
    issues.push({
      id: 'short-desc',
      severity: 'warning',
      category: 'seo',
      title: `Короткий Meta Description (${descLen} симв.)`,
      detail: 'Описание короче 70 символов снижает кликабельность (CTR) в поиске.',
      recommendation:
        'Дополните описание до 130–160 символов: укажите сроки, формат результата (ЕСКД/STEP/PDF) и географию/подход.',
    });
  } else if (descLen > 175) {
    issues.push({
      id: 'long-desc',
      severity: 'warning',
      category: 'seo',
      title: `Длинный Meta Description (${descLen} симв.)`,
      detail: 'Текст превышает 175 символов и будет обрезан многоточием в выдаче.',
      recommendation:
        'Сожмите ключевой смысл в первые 145–160 символов.',
    });
  }

  // H1 checks
  const h1Count = page.h1List?.length ?? 0;
  if (h1Count === 0) {
    issues.push({
      id: 'missing-h1',
      severity: 'critical',
      category: 'seo',
      title: 'Отсутствует заголовок H1',
      detail: 'На странице нет главного заголовка <h1> в контентной области.',
      recommendation:
        'Добавьте ровно один релевантный заголовок H1, отражающий суть страницы.',
    });
  } else if (h1Count > 1) {
    issues.push({
      id: 'multiple-h1',
      severity: 'warning',
      category: 'seo',
      title: `Несколько заголовков H1 (${h1Count} шт.)`,
      detail: `Найдены H1: ${page.h1List?.slice(0, 3).join(' | ')}`,
      recommendation:
        'Оставьте один главный H1, остальные заголовки переведите в H2 или H3.',
    });
  } else if (
    page.title &&
    page.h1List?.[0] &&
    page.title.trim().toLowerCase() === page.h1List[0].trim().toLowerCase()
  ) {
    issues.push({
      id: 'h1-equals-title',
      severity: 'info',
      category: 'seo',
      title: 'H1 полностью дублирует Title',
      detail: 'Точное совпадение H1 и Title упускает возможность охватить дополнительные словоформы.',
      recommendation:
        'Сделайте Title более SEO-ориентированным, а H1 — более емким и понятным посетителю.',
    });
  }

  // Canonical & OpenGraph
  if (!page.canonical) {
    issues.push({
      id: 'missing-canonical',
      severity: 'warning',
      category: 'technical',
      title: 'Не задан тег rel="canonical"',
      detail: 'Отсутствует канонический адрес, что повышает риск дублей при появлении GET-параметров.',
      recommendation: 'Настройте вывод самоссылающегося <link rel="canonical">.',
    });
  } else if (page.canonicalMatchesSelf === false) {
    issues.push({
      id: 'canonical-mismatch',
      severity: 'warning',
      category: 'technical',
      title: 'Canonical указывает на другой URL',
      detail: `Canonical: ${page.canonical}`,
      recommendation:
        'Убедитесь, что это не ошибка шаблона; если страница самостоятельная, исправьте canonical.',
    });
  }

  if (!page.ogImage || !page.ogTitle) {
    issues.push({
      id: 'incomplete-og',
      severity: 'info',
      category: 'seo',
      title: 'Неполная разметка OpenGraph',
      detail: `Отсутствует ${!page.ogTitle ? 'og:title' : ''}${!page.ogTitle && !page.ogImage ? ' и ' : ''}${!page.ogImage ? 'og:image' : ''}.`,
      recommendation:
        'Задайте og:title, og:description и og:image (1200x630) для корректного предпросмотра ссылок в Telegram и соцсетях.',
    });
  }

  // Structured data
  if (!page.schemaTypes || page.schemaTypes.length === 0) {
    issues.push({
      id: 'missing-schema',
      severity: 'warning',
      category: 'seo',
      title: 'Нет микроразметки Schema.org (JSON-LD)',
      detail: 'Не обнаружены структурированные данные Service, Article, FAQPage или BreadcrumbList.',
      recommendation:
        section === 'services'
          ? 'Добавьте JSON-LD разметку Service + BreadcrumbList + FAQPage.'
          : section === 'articles'
            ? 'Добавьте JSON-LD разметку Article + Person (автор) + BreadcrumbList.'
            : 'Добавьте Organization / LocalBusiness / FAQPage для расширенных сниппетов.',
    });
  }

  // Content depth thresholds by section
  const wc = page.wordCount ?? 0;
  if (section === 'articles' && wc < 350) {
    issues.push({
      id: 'thin-article',
      severity: wc < 150 ? 'critical' : 'warning',
      category: 'content',
      title: `Недостаточный объем статьи (${wc} сл.)`,
      detail: 'Для экспертных инженерных статей рекомендуется глубина от 600–1200 слов с примерами и стандартами.',
      recommendation:
        'Дополните материал разбором типовых ошибок, таблицей допусков/стандартов (ГОСТ/ЕСКД), кейсом и блоком перелинковки на услугу.',
    });
  } else if (section === 'services' && wc < 220) {
    issues.push({
      id: 'thin-service',
      severity: wc < 100 ? 'critical' : 'warning',
      category: 'content',
      title: `Мало текста на коммерческой странице (${wc} сл.)`,
      detail: 'Посадочной странице услуги не хватает описания этапов работы, сроков, форматов выдачи и кейсов.',
      recommendation:
        'Добавьте состав услуги, входные данные от заказчика, итоговые форматы (STEP/DXF/КД по ГОСТ), сроки и ответы на возражения.',
    });
  } else if (section === 'photoalbums' && wc < 60) {
    issues.push({
      id: 'thin-album',
      severity: 'warning',
      category: 'content',
      title: `Фотоальбом без текстового описания (${wc} сл.)`,
      detail: 'Поисковые системы не могут ранжировать галерею без контекстного описания проектов.',
      recommendation:
        'Добавьте к каждому кейсу в альбоме 2–3 абзаца: задачу клиента, примененное ПО, сложность и результат.',
    });
  }

  // Headings depth inside articles/services
  const h2Count = (page.headings ?? []).filter((h) => h.level === 2).length;
  if ((section === 'articles' || section === 'services') && wc > 300 && h2Count === 0) {
    issues.push({
      id: 'no-h2',
      severity: 'warning',
      category: 'content',
      title: 'Текст не структурирован подзаголовками H2',
      detail: 'Сплошной текст без подзаголовков H2 ухудшает сканируемость и удержание читателя.',
      recommendation: 'Разбейте материал на логические блоки с H2–H3 и маркированными списками.',
    });
  }

  // Media alt checks
  if ((page.imagesMissingAlt ?? 0) > 0) {
    issues.push({
      id: 'missing-alt',
      severity: (page.imagesMissingAlt ?? 0) >= 3 ? 'warning' : 'info',
      category: 'media',
      title: `Изображения без атрибута alt (${page.imagesMissingAlt} из ${page.imagesTotal})`,
      detail: 'Пустой alt снижает доступность и лишает трафика из Поиска по картинкам (особенно важно для 3D-моделей и чертежей).',
      recommendation:
        'Пропишите осмысленные alt-описания для чертежей, 3D-рендеров и схем.',
    });
  }

  // Conversion checks
  if (section === 'services' && (page.ctaCount ?? 0) === 0 && (page.formsCount ?? 0) === 0) {
    issues.push({
      id: 'no-cta-service',
      severity: 'critical',
      category: 'conversion',
      title: 'На странице услуги не обнаружен явный CTA / форма заявки',
      detail: 'Потенциальный заказчик не видит прямого целевого действия в теле страницы.',
      recommendation:
        'Разместите блок заказа расчета/консультации, кнопку отправки ТЗ и контакты мессенджеров в контенте услуги.',
    });
  }

  if (section === 'articles' && (page.internalLinks?.length ?? 0) === 0) {
    issues.push({
      id: 'no-internal-links-article',
      severity: 'warning',
      category: 'conversion',
      title: 'Статья не ссылается на услуги или другие материалы',
      detail: 'В основном контенте статьи нет внутренних ссылок (тупиковая страница без передачи веса).',
      recommendation:
        'Добавьте контекстные ссылки на релевантную услугу и 2–3 смежные статьи.',
    });
  }

  return issues;
}

async function crawlSingleUrl(rawUrl: string): Promise<PageAuditResult> {
  const baseEntry = classifyUrl(rawUrl);
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(baseEntry.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PavelSamutaSiteAuditor/1.0; +https://pavelsamuta.com)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    const responseTimeMs = Date.now() - startTime;
    const html = await response.text();
    const htmlSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 10) / 10;
    const generator =
      response.headers.get('x-generator') || undefined;

    const $ = cheerio.load(html);

    const title = $('head > title').first().text().replace(/\s+/g, ' ').trim();
    const description =
      $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim() ?? '';
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() ?? '';
    const robots = $('meta[name="robots"]').attr('content')?.trim() ?? '';
    const noindex = /noindex/i.test(robots);

    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? '';
    const ogDescription =
      $('meta[property="og:description"]').attr('content')?.trim() ?? '';
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim() ?? '';

    const metaGenerator = $('meta[name="generator"]').attr('content')?.trim();
    const detectedGenerator = generator || metaGenerator || undefined;

    // Extract JSON-LD Schema.org types
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).text());
        const collectTypes = (node: unknown) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            node.forEach(collectTypes);
            return;
          }
          const rec = node as Record<string, unknown>;
          if (typeof rec['@type'] === 'string') {
            schemaTypes.push(rec['@type']);
          } else if (Array.isArray(rec['@type'])) {
            rec['@type'].forEach((t) => {
              if (typeof t === 'string') schemaTypes.push(t);
            });
          }
          if (rec['@graph']) collectTypes(rec['@graph']);
        };
        collectTypes(parsed);
      } catch {
        // Ignore malformed JSON-LD
      }
    });

    // Clone body & strip global header/footer/nav boilerplate to isolate main content
    const $contentRoot = $('body').clone();
    $contentRoot
      .find(
        'script, style, noscript, svg, template, header.site-header, .site-header, footer, .site-footer, #top_contacts_widget, .menu-cart-wrapper, .js-combo-box__content_menu, .share-buttons, .breadcrumbs, [aria-hidden="true"]',
      )
      .remove();

    const h1List: string[] = [];
    const headings: HeadingItem[] = [];
    $contentRoot.find('h1, h2, h3').each((_, el) => {
      const tag = el.tagName?.toLowerCase();
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (tag === 'h1') {
        h1List.push(text);
        headings.push({ level: 1, text });
      } else if (tag === 'h2') {
        headings.push({ level: 2, text });
      } else if (tag === 'h3') {
        headings.push({ level: 3, text });
      }
    });

    const paragraphCount = $contentRoot.find('p').filter((_, el) => {
      return $(el).text().trim().length > 15;
    }).length;
    const listCount = $contentRoot.find('ul, ol').length;
    const tableCount = $contentRoot.find('table').length;

    const rawText = $contentRoot
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = countWords(rawText);
    const charCountNoSpaces = rawText.replace(/\s+/g, '').length;
    const readingTimeMin = Math.max(1, Math.round((wordCount / 180) * 10) / 10);
    const textToHtmlRatio =
      html.length > 0
        ? Math.round((Buffer.byteLength(rawText, 'utf8') / Buffer.byteLength(html, 'utf8')) * 1000) / 10
        : 0;

    // Images inside main content
    let imagesTotal = 0;
    let imagesMissingAlt = 0;
    let imagesMissingDimensions = 0;
    $contentRoot.find('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src || src.startsWith('data:image/svg')) return;
      imagesTotal += 1;
      const alt = $(el).attr('alt');
      if (alt === undefined || alt.trim() === '') {
        imagesMissingAlt += 1;
      }
      if (!$(el).attr('width') && !$(el).attr('height')) {
        imagesMissingDimensions += 1;
      }
    });

    // Conversion signals inside content + contact blocks
    const formsCount = $contentRoot.find('form').length;
    const phoneLinksCount = $('a[href^="tel:"]').length;
    const emailLinksCount = $('a[href^="mailto:"]').length;
    const messengerLinksCount = $(
      'a[href*="t.me"], a[href*="telegram"], a[href*="wa.me"], a[href*="whatsapp"], a[href*="viber"]',
    ).length;
    const hasPriceMention = /(от\s+\d|byn|руб|₽|\$\s*\d)/i.test(rawText);
    const ctaCount = $contentRoot
      .find('button, input[type="submit"], a.btn, a.button, [class*="btn"], [class*="order"], [class*="feedback"]')
      .filter((_, el) => {
        const text = $(el).text().trim();
        return text.length > 0 || el.tagName?.toLowerCase() === 'input';
      }).length;

    // Links inside content area (contextual links)
    const internalLinksSet = new Set<string>();
    let externalLinksCount = 0;
    let brokenHrefCount = 0;
    const baseOrigin = new URL(baseEntry.url).origin;

    $contentRoot.find('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim() ?? '';
      if (!href || href === '#' || href.startsWith('javascript:')) {
        brokenHrefCount += 1;
        return;
      }
      if (href.startsWith('tel:') || href.startsWith('mailto:')) return;
      const resolved = normalizeUrl(href, baseEntry.url);
      if (!resolved) return;
      try {
        const parsed = new URL(resolved);
        if (parsed.origin === baseOrigin) {
          internalLinksSet.add(resolved);
        } else {
          externalLinksCount += 1;
        }
      } catch {
        // Ignore malformed
      }
    });

    const finalNormalized = normalizeUrl(response.url, baseEntry.url) ?? baseEntry.url;
    const requestedNormalized = normalizeUrl(baseEntry.url, baseEntry.url) ?? baseEntry.url;
    const redirected = finalNormalized !== requestedNormalized;

    let canonicalMatchesSelf: boolean | undefined;
    if (canonical) {
      const normCan = normalizeUrl(canonical, baseEntry.url);
      canonicalMatchesSelf = normCan === requestedNormalized || normCan === finalNormalized;
    }

    const partialResult: Omit<PageAuditResult, 'issues' | 'status'> = {
      url: baseEntry.url,
      path: baseEntry.path,
      section: baseEntry.section,
      scannedAt: new Date().toISOString(),
      httpStatus: response.status,
      finalUrl: response.url,
      redirected,
      responseTimeMs,
      htmlSizeKb,
      generator: detectedGenerator,
      title,
      titleLength: title.length,
      description,
      descriptionLength: description.length,
      canonical: canonical || undefined,
      canonicalMatchesSelf,
      robots: robots || undefined,
      noindex,
      ogTitle: ogTitle || undefined,
      ogDescription: ogDescription || undefined,
      ogImage: ogImage || undefined,
      h1List,
      headings: headings.slice(0, 40),
      wordCount,
      charCountNoSpaces,
      readingTimeMin,
      textToHtmlRatio,
      paragraphCount,
      listCount,
      tableCount,
      excerpt: rawText.slice(0, 280),
      extractedText: rawText.slice(0, 9000),
      formsCount,
      phoneLinksCount,
      emailLinksCount,
      messengerLinksCount,
      hasPriceMention,
      ctaCount,
      imagesTotal,
      imagesMissingAlt,
      imagesMissingDimensions,
      internalLinks: Array.from(internalLinksSet),
      internalLinksCount: internalLinksSet.size,
      externalLinksCount,
      brokenHrefCount,
      schemaTypes: Array.from(new Set(schemaTypes)),
    };

    const issues = buildDeterministicIssues(partialResult);

    return {
      ...partialResult,
      status: 'done',
      issues,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке URL';
    return {
      url: baseEntry.url,
      path: baseEntry.path,
      section: baseEntry.section,
      status: 'error',
      scannedAt: new Date().toISOString(),
      responseTimeMs,
      errorMessage: message,
      issues: [
        {
          id: 'fetch-failed',
          severity: 'critical',
          category: 'technical',
          title: 'Не удалось загрузить страницу',
          detail: message,
          recommendation: 'Повторите сканирование или проверьте доступность сервера.',
        },
      ],
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.post('/api/audit/scan-batch', async (req, res) => {
    try {
      const urlsInput = req.body?.urls;
      if (!Array.isArray(urlsInput) || urlsInput.length === 0) {
        res.status(400).json({ error: 'Передайте массив urls для сканирования.' });
        return;
      }
      const urls = urlsInput
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .slice(0, 10);

      const results = await Promise.all(urls.map((u) => crawlSingleUrl(u)));
      res.json({ results });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ошибка пакетного сканирования';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/audit/ai-page', async (req, res) => {
    try {
      const page = req.body?.page as PageAuditResult | undefined;
      if (!page || !page.url) {
        res.status(400).json({ error: 'Данные страницы не переданы.' });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Проведи профессиональный SEO-, UX- и контент-аудит следующей страницы инженерного/CAD/R&D сайта pavelsamuta.com на русском языке.

URL: ${page.url}
Раздел: ${page.section}
HTTP: ${page.httpStatus}
Title (${page.titleLength ?? 0} симв.): ${page.title || 'ОТСУТСТВУЕТ'}
Meta Description (${page.descriptionLength ?? 0} симв.): ${page.description || 'ОТСУТСТВУЕТ'}
H1: ${(page.h1List ?? []).join(' | ') || 'ОТСУТСТВУЕТ'}
Структура H1-H3: ${(page.headings ?? []).map((h) => `H${h.level}: ${h.text}`).join(' ; ')}
Объем текста: ${page.wordCount ?? 0} слов, абзацев: ${page.paragraphCount ?? 0}, списков: ${page.listCount ?? 0}, таблиц: ${page.tableCount ?? 0}
Конверсия: форм ${page.formsCount ?? 0}, CTA-элементов ${page.ctaCount ?? 0}, упоминание цены: ${page.hasPriceMention ? 'да' : 'нет'}
Изображения: всего ${page.imagesTotal ?? 0}, без alt ${page.imagesMissingAlt ?? 0}
Schema.org: ${(page.schemaTypes ?? []).join(', ') || 'отсутствует'}
Технические проблемы: ${(page.issues ?? []).map((i) => i.title).join('; ') || 'нет'}

Извлеченный текст страницы (фрагмент):
"""
${(page.extractedText || page.excerpt || '').slice(0, 5500)}
"""

Дай конкретный, предметный аудит без воды. Учитывай B2B-специфику машиностроительного конструирования, ЕСКД/ГОСТ, CAD, реверс-инжиниринга и НИОКР.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Ты ведущий SEO-стратег, B2B-маркетолог и технический редактор промышленного консалтинга. Отвечай строго на русском языке, конкретно, опираясь только на переданные данные страницы.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              contentVerdict: {
                type: Type.STRING,
                description:
                  'Развернутая оценка качества контента, полноты раскрытия темы и соответствия интенту пользователя (3-4 предложения).',
              },
              eeatAssessment: {
                type: Type.STRING,
                description:
                  'Оценка экспертности и доверия (E-E-A-T): наличие стандартов, кейсов, цифр, доказательств, авторства.',
              },
              conversionDiagnosis: {
                type: Type.STRING,
                description:
                  'Анализ воронки и конверсии: насколько понятно коммерческое предложение, следующий шаг и работа с возражениями B2B-заказчика.',
              },
              semanticGaps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Список из 4-6 недостающих подтем, технических терминов (LSI) или вопросов клиентов, которые стоит добавить.',
              },
              suggestedTitle: {
                type: Type.STRING,
                description:
                  'Готовый оптимизированный вариант Title длиной 50-65 символов.',
              },
              suggestedDescription: {
                type: Type.STRING,
                description:
                  'Готовый продающий вариант Meta Description длиной 135-160 символов.',
              },
              suggestedH1: {
                type: Type.STRING,
                description: 'Рекомендуемый четкий заголовок H1.',
              },
              prioritizedActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    priority: {
                      type: Type.STRING,
                      description: 'Одно из: high, medium, low',
                    },
                    action: {
                      type: Type.STRING,
                      description: 'Конкретное действие по доработке страницы.',
                    },
                    expectedImpact: {
                      type: Type.STRING,
                      description: 'Ожидаемый эффект для SEO или конверсии.',
                    },
                  },
                },
                description: '3-5 приоритетных шагов улучшения страницы.',
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const audit: AiPageAudit = {
        generatedAt: new Date().toISOString(),
        contentVerdict: parsed.contentVerdict ?? '',
        eeatAssessment: parsed.eeatAssessment ?? '',
        conversionDiagnosis: parsed.conversionDiagnosis ?? '',
        semanticGaps: Array.isArray(parsed.semanticGaps) ? parsed.semanticGaps : [],
        suggestedTitle: parsed.suggestedTitle ?? '',
        suggestedDescription: parsed.suggestedDescription ?? '',
        suggestedH1: parsed.suggestedH1 ?? '',
        prioritizedActions: Array.isArray(parsed.prioritizedActions)
          ? parsed.prioritizedActions
          : [],
      };

      res.json({ audit });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ошибка AI-аудита страницы';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/audit/ai-site', async (req, res) => {
    try {
      const summaryPayload = req.body?.summary;
      if (!summaryPayload) {
        res.status(400).json({ error: 'Сводка по сайту не передана.' });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Проведи комплексный стратегический аудит сайта pavelsamuta.com и его контент-архитектуры на основе собранных краулером данных.

Данные краулинга:
${JSON.stringify(summaryPayload, null, 2)}

Сформируй практический, структурированный стратегический план для владельца инженерного бизнеса (конструкторская документация, 3D-моделирование, реверс-инжиниринг, НИОКР, сопровождение тендеров):
1. Общее резюме текущего состояния сайта и контента.
2. Анализ воронки «Статьи -> Услуги -> Заявка/Контакты» и позиционирования.
3. План устранения каннибализации и дублей (какие статьи/услуги объединить, где настроить перелинковку или 301).
4. Техническая дорожная карта (Schema.org, Nethouse-ограничения, мета-теги, фотоальбомы).
5. Быстрые победы (Quick Wins) и план нового/обновляемого контента.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Ты директор по SEO и B2B-контент-маркетингу. Отвечай на русском языке четко, системно, ссылаясь на конкретные разделы и URL из переданной сводки.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: 'Итоговый диагноз состояния сайта и контента (4-6 предложений).',
              },
              positioningAndFunnel: {
                type: Type.STRING,
                description:
                  'Разбор коммерческой воронки: как информационные статьи и фотоальбомы конвертируются в лиды на услуги.',
              },
              cannibalizationStrategy: {
                type: Type.STRING,
                description:
                  'Рекомендации по выявленным пересечениям тем и дублям URL/заголовков.',
              },
              technicalAndSchemaRoadmap: {
                type: Type.STRING,
                description:
                  'План технической оптимизации (мета-шаблоны, JSON-LD, alt-атрибуты, скорость, ЧПУ).',
              },
              quickWins: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    area: { type: Type.STRING },
                    task: { type: Type.STRING },
                    affectedScope: { type: Type.STRING },
                    impact: { type: Type.STRING },
                  },
                },
                description: '6-8 задач с максимальной отдачей при минимальных трудозатратах.',
              },
              contentPlanRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    targetSection: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                },
                description: '4-6 идей по доработке или созданию ключевых материалов для B2B-лидов.',
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const siteAudit: AiSiteAudit = {
        generatedAt: new Date().toISOString(),
        executiveSummary: parsed.executiveSummary ?? '',
        positioningAndFunnel: parsed.positioningAndFunnel ?? '',
        cannibalizationStrategy: parsed.cannibalizationStrategy ?? '',
        technicalAndSchemaRoadmap: parsed.technicalAndSchemaRoadmap ?? '',
        quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
        contentPlanRecommendations: Array.isArray(parsed.contentPlanRecommendations)
          ? parsed.contentPlanRecommendations
          : [],
      };

      res.json({ siteAudit });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ошибка стратегического AI-аудита';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
