export type PageSection = 'core' | 'services' | 'articles' | 'photoalbums';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export type AuditStatus = 'idle' | 'scanning' | 'done' | 'error';

export type ActiveTab = 'overview' | 'registry' | 'semantics' | 'strategy';

export interface TargetUrlEntry {
  url: string;
  path: string;
  section: PageSection;
}

export interface AuditIssue {
  id: string;
  severity: IssueSeverity;
  category: 'technical' | 'seo' | 'content' | 'conversion' | 'media' | 'url';
  title: string;
  detail: string;
  recommendation: string;
}

export interface HeadingItem {
  level: 1 | 2 | 3;
  text: string;
}

export interface PageAuditResult {
  url: string;
  path: string;
  section: PageSection;
  status: AuditStatus;
  scannedAt?: string;
  httpStatus?: number;
  finalUrl?: string;
  redirected?: boolean;
  responseTimeMs?: number;
  htmlSizeKb?: number;
  generator?: string;

  title?: string;
  titleLength?: number;
  description?: string;
  descriptionLength?: number;
  canonical?: string;
  canonicalMatchesSelf?: boolean;
  robots?: string;
  noindex?: boolean;

  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;

  h1List?: string[];
  headings?: HeadingItem[];

  wordCount?: number;
  charCountNoSpaces?: number;
  readingTimeMin?: number;
  textToHtmlRatio?: number;
  paragraphCount?: number;
  listCount?: number;
  tableCount?: number;
  excerpt?: string;
  extractedText?: string;

  formsCount?: number;
  phoneLinksCount?: number;
  emailLinksCount?: number;
  messengerLinksCount?: number;
  hasPriceMention?: boolean;
  ctaCount?: number;

  imagesTotal?: number;
  imagesMissingAlt?: number;
  imagesMissingDimensions?: number;

  internalLinks?: string[];
  internalLinksCount?: number;
  externalLinksCount?: number;
  brokenHrefCount?: number;

  schemaTypes?: string[];
  issues?: AuditIssue[];
  errorMessage?: string;

  aiAudit?: AiPageAudit;
}

export interface AiPageAudit {
  generatedAt: string;
  contentVerdict: string;
  eeatAssessment: string;
  conversionDiagnosis: string;
  semanticGaps: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedH1: string;
  prioritizedActions: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
  }>;
}

export interface AiSiteAudit {
  generatedAt: string;
  executiveSummary: string;
  positioningAndFunnel: string;
  cannibalizationStrategy: string;
  technicalAndSchemaRoadmap: string;
  quickWins: Array<{
    area: string;
    task: string;
    affectedScope: string;
    impact: string;
  }>;
  contentPlanRecommendations: Array<{
    topic: string;
    targetSection: string;
    rationale: string;
  }>;
}

export interface DuplicateGroup {
  type: 'title' | 'description' | 'h1';
  value: string;
  urls: string[];
}

export interface CannibalizationPair {
  urlA: string;
  urlB: string;
  titleA: string;
  titleB: string;
  sectionA: PageSection;
  sectionB: PageSection;
  similarityScore: number;
  sharedTokens: string[];
  reason: string;
}

export interface SlugIssue {
  url: string;
  path: string;
  section: PageSection;
  issueType: string;
  explanation: string;
}
