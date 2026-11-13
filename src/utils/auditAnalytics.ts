import type {
  CannibalizationPair,
  DuplicateGroup,
  PageAuditResult,
  SlugIssue,
} from '../types/audit.ts';

const STOP_WORDS = new Set([
  'для', 'или', 'как', 'что', 'это', 'при', 'без', 'под', 'над', 'про', 'все',
  'от', 'по', 'на', 'из', 'в', 'и', 'к', 'с', 'у', 'о', 'за', 'не', 'но', 'до',
  'dlja', 'dlya', 'kak', 'chto', 'ili', 'na', 'po', 'ot', 'iz', 'v', 'i', 'k', 's',
  'pavelsamuta', 'com', 'павел', 'самута', 'услуги', 'статьи',
]);

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokenizeRussianAndSlug(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

export function findDuplicates(pages: PageAuditResult[]): DuplicateGroup[] {
  const scanned = pages.filter((p) => p.status === 'done');
  const groups: DuplicateGroup[] = [];

  const collect = (
    type: 'title' | 'description' | 'h1',
    extractor: (p: PageAuditResult) => string | undefined,
  ) => {
    const map = new Map<string, string[]>();
    for (const p of scanned) {
      const raw = extractor(p);
      if (!raw || !raw.trim()) continue;
      const key = normalizeText(raw);
      const list = map.get(key) ?? [];
      list.push(p.url);
      map.set(key, list);
    }
    for (const [, urls] of map.entries()) {
      if (urls.length > 1) {
        const first = scanned.find((p) => p.url === urls[0]);
        const value = (first ? extractor(first) : '') ?? '';
        groups.push({ type, value, urls });
      }
    }
  };

  collect('title', (p) => p.title);
  collect('description', (p) => p.description);
  collect('h1', (p) => p.h1List?.[0]);

  return groups;
}

export function findCannibalizationPairs(pages: PageAuditResult[]): CannibalizationPair[] {
  const candidates = pages.filter(
    (p) => p.section === 'services' || p.section === 'articles',
  );
  const pairs: CannibalizationPair[] = [];

  const getTokens = (p: PageAuditResult): string[] => {
    const slugPart = p.path.split('/').pop() ?? '';
    const source = [
      slugPart.replace(/-/g, ' '),
      p.title ?? '',
      p.h1List?.[0] ?? '',
    ].join(' ');
    return tokenizeRussianAndSlug(source);
  };

  const tokenCache = new Map<string, Set<string>>();
  for (const p of candidates) {
    tokenCache.set(p.url, new Set(getTokens(p)));
  }

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const setA = tokenCache.get(a.url) ?? new Set<string>();
      const setB = tokenCache.get(b.url) ?? new Set<string>();
      if (setA.size === 0 || setB.size === 0) continue;

      const shared: string[] = [];
      for (const t of setA) {
        if (setB.has(t)) shared.push(t);
      }

      const unionSize = new Set([...setA, ...setB]).size;
      const jaccard = unionSize > 0 ? shared.length / unionSize : 0;

      if (shared.length >= 3 || jaccard >= 0.32) {
        const sameSection = a.section === b.section;
        const reason = sameSection
          ? `Пересечение тем внутри раздела «${a.section === 'articles' ? 'Статьи' : 'Услуги'}» (${shared.length} общих ключевых токена). Риск каннибализации выдачи.`
          : 'Пересечение коммерческой страницы услуги и информационной статьи — проверьте перелинковку и разделение интента.';

        pairs.push({
          urlA: a.url,
          urlB: b.url,
          titleA: a.h1List?.[0] || a.title || a.path,
          titleB: b.h1List?.[0] || b.title || b.path,
          sectionA: a.section,
          sectionB: b.section,
          similarityScore: Math.round(jaccard * 100),
          sharedTokens: shared.slice(0, 6),
          reason,
        });
      }
    }
  }

  return pairs.sort((x, y) => y.similarityScore - x.similarityScore);
}

export function computeInboundLinksMap(pages: PageAuditResult[]): Map<string, string[]> {
  const inbound = new Map<string, string[]>();
  const knownNormalized = new Set(pages.map((p) => normalizeUrlForMatch(p.url)));

  for (const p of pages) {
    inbound.set(p.url, []);
  }

  for (const source of pages) {
    if (source.status !== 'done' || !source.internalLinks) continue;
    const seenFromThisSource = new Set<string>();
    for (const targetRaw of source.internalLinks) {
      const normTarget = normalizeUrlForMatch(targetRaw);
      if (normTarget === normalizeUrlForMatch(source.url)) continue;
      if (!knownNormalized.has(normTarget) || seenFromThisSource.has(normTarget)) continue;
      seenFromThisSource.add(normTarget);

      const targetPage = pages.find((p) => normalizeUrlForMatch(p.url) === normTarget);
      if (targetPage) {
        const list = inbound.get(targetPage.url) ?? [];
        list.push(source.url);
        inbound.set(targetPage.url, list);
      }
    }
  }

  return inbound;
}

export function normalizeUrlForMatch(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin.toLowerCase()}${pathname.toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function auditUrlSlugs(pages: PageAuditResult[]): SlugIssue[] {
  const issues: SlugIssue[] = [];

  for (const p of pages) {
    const slug = p.path.split('/').pop() ?? '';
    if (!slug) continue;

    if (/^\d+$/.test(slug)) {
      issues.push({
        url: p.url,
        path: p.path,
        section: p.section,
        issueType: 'Нечитаемый числовой ID вместо ЧПУ',
        explanation: `URL оканчивается на числовой идентификатор (${slug}). Для SEO и CTR лучше использовать осмысленный транслитерированный слаг темы альбома.`,
      });
    }

    if (
      slug.includes('jelement') ||
      slug.includes('reputatcii') ||
      slug.includes('modele-') ||
      slug.includes('vizualizacia') ||
      slug.includes('annotirovannaia') ||
      slug.includes('neobkhodimuiu') ||
      slug.includes('obiasnit') ||
      slug.includes('dlja') ||
      slug.includes('dlya')
    ) {
      const hasMixedTranslit =
        (slug.includes('dlja') || slug.includes('jekspert') || slug.includes('jelement')) ||
        slug.includes('reputatcii') ||
        slug.includes('vizualizacia');
      if (hasMixedTranslit) {
        issues.push({
          url: p.url,
          path: p.path,
          section: p.section,
          issueType: 'Смешанная транслитерация или опечатка в URL',
          explanation:
            'В слаге используются разные стандарты транслитерации (j/ja/je/ii/ia) или опечатки («reputatcii», «modele-3d-vizualizacia»). На текущих проиндексированных страницах менять только через 301-редирект.',
        });
      }
    }

    if (slug.endsWith('-rezultat') || slug.includes('chto-takoe-biznesprotsess-i-kak-ego-uluchshit-s-inzhenernyim')) {
      issues.push({
        url: p.url,
        path: p.path,
        section: p.section,
        issueType: 'Обрезанный или слишком длинный URL-слаг',
        explanation:
          'Слаг превышает 60–65 символов и обрывается на середине фразы («...privesti-k-rezultat», «...s-inzhenernyim»). Рекомендуется ограничивать слаг 3–5 ключевыми словами.',
      });
    }
  }

  return issues;
}
