import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiStrategyView } from './components/AiStrategyView.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { RegistryView } from './components/RegistryView.tsx';
import { SemanticsView } from './components/SemanticsView.tsx';
import { Sidebar, type IssueFilter } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { classifyUrl, INITIAL_TARGET_URLS } from './data/targetUrls.ts';
import type {
  ActiveTab,
  AiPageAudit,
  AiSiteAudit,
  PageAuditResult,
  PageSection,
} from './types/audit.ts';
import { computeInboundLinksMap } from './utils/auditAnalytics.ts';
import { exportAuditCsv, exportAuditMarkdown } from './utils/exporters.ts';

const STORAGE_KEY = 'pavelsamuta_audit_v1';
const BATCH_SIZE = 6;

function createInitialPages(): PageAuditResult[] {
  return INITIAL_TARGET_URLS.map((entry) => ({
    url: entry.url,
    path: entry.path,
    section: entry.section,
    status: 'idle',
  }));
}

function loadSavedState(): {
  pages: PageAuditResult[];
  siteAudit: AiSiteAudit | null;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { pages: createInitialPages(), siteAudit: null };
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
      const resetScanning = parsed.pages.map((p: PageAuditResult) =>
        p.status === 'scanning' ? { ...p, status: 'idle' as const } : p,
      );
      return {
        pages: resetScanning,
        siteAudit: parsed.siteAudit ?? null,
      };
    }
  } catch {
    // Fallback to initial pages
  }
  return { pages: createInitialPages(), siteAudit: null };
}

export default function App() {
  const initial = useMemo(() => loadSavedState(), []);
  const [pages, setPages] = useState<PageAuditResult[]>(initial.pages);
  const [siteAudit, setSiteAudit] = useState<AiSiteAudit | null>(initial.siteAudit);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedSection, setSelectedSection] = useState<PageSection | 'all'>('all');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const stopRequestedRef = useRef(false);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Persist to localStorage (excluding large raw extractedText if huge, keep up to 4KB)
  useEffect(() => {
    try {
      const compactPages = pages.map((p) => ({
        ...p,
        extractedText: p.extractedText?.slice(0, 4500),
      }));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pages: compactPages, siteAudit }),
      );
    } catch {
      // Ignore quota exceeded
    }
  }, [pages, siteAudit]);

  const inboundMap = useMemo(() => computeInboundLinksMap(pages), [pages]);

  const scannedCount = useMemo(
    () => pages.filter((p) => p.status === 'done' || p.status === 'error').length,
    [pages],
  );

  const runBatchCrawl = useCallback(async (targetUrls: string[]) => {
    if (targetUrls.length === 0) return;
    stopRequestedRef.current = false;
    setIsScanning(true);
    setScanError(null);

    try {
      for (let i = 0; i < targetUrls.length; i += BATCH_SIZE) {
        if (stopRequestedRef.current) break;

        const batch = targetUrls.slice(i, i + BATCH_SIZE);
        const batchSet = new Set(batch);

        setPages((prev) =>
          prev.map((p) =>
            batchSet.has(p.url) ? { ...p, status: 'scanning' } : p,
          ),
        );

        const response = await fetch('/api/audit/scan-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Ошибка сканирования пакета URL');
        }

        const resultMap = new Map<string, PageAuditResult>();
        for (const r of (data.results ?? []) as PageAuditResult[]) {
          resultMap.set(r.url, r);
        }

        setPages((prev) =>
          prev.map((p) => {
            const updated = resultMap.get(p.url);
            if (!updated) return p;
            return {
              ...updated,
              aiAudit: p.aiAudit,
            };
          }),
        );
      }
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Сбой соединения при сканировании',
      );
      setPages((prev) =>
        prev.map((p) =>
          p.status === 'scanning' ? { ...p, status: 'idle' } : p,
        ),
      );
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Auto-start scan on first load if nothing scanned yet
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    const hasDone = pagesRef.current.some((p) => p.status === 'done');
    if (!hasDone) {
      const pendingUrls = pagesRef.current.map((p) => p.url);
      void runBatchCrawl(pendingUrls);
    }
  }, [runBatchCrawl]);

  const handleStartScan = () => {
    const pending = pages
      .filter((p) => p.status === 'idle' || p.status === 'error')
      .map((p) => p.url);
    const targets = pending.length > 0 ? pending : pages.map((p) => p.url);
    void runBatchCrawl(targets);
  };

  const handleStopScan = () => {
    stopRequestedRef.current = true;
  };

  const handleRescanAll = () => {
    const allUrls = pages.map((p) => p.url);
    setPages((prev) =>
      prev.map((p) => ({
        url: p.url,
        path: p.path,
        section: p.section,
        status: 'idle',
        aiAudit: p.aiAudit,
      })),
    );
    void runBatchCrawl(allUrls);
  };

  const handleRescanPage = (url: string) => {
    void runBatchCrawl([url]);
  };

  const handleSaveAiAudit = (url: string, audit: AiPageAudit) => {
    setPages((prev) =>
      prev.map((p) => (p.url === url ? { ...p, aiAudit: audit } : p)),
    );
  };

  const handleAddUrls = (rawUrls: string[]) => {
    const existing = new Set(pages.map((p) => p.url));
    const additions: PageAuditResult[] = [];
    for (const raw of rawUrls) {
      const entry = classifyUrl(raw);
      if (!existing.has(entry.url)) {
        existing.add(entry.url);
        additions.push({
          url: entry.url,
          path: entry.path,
          section: entry.section,
          status: 'idle',
        });
      }
    }
    if (additions.length > 0) {
      setPages((prev) => [...prev, ...additions]);
      void runBatchCrawl(additions.map((a) => a.url));
    }
  };

  const handleNavigateRegistry = (
    section: PageSection | 'all',
    filter: IssueFilter,
  ) => {
    setSelectedSection(section);
    setIssueFilter(filter);
    setActiveTab('registry');
  };

  const handleInspectUrl = (url: string) => {
    setSelectedSection('all');
    setIssueFilter('all');
    setSelectedUrl(url);
    setActiveTab('registry');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isScanning={isScanning}
        onStartScan={handleStartScan}
        onStopScan={handleStopScan}
        onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          pages={pages}
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
          issueFilter={issueFilter}
          onSelectIssueFilter={setIssueFilter}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isScanning={isScanning}
          scannedCount={scannedCount}
          totalCount={pages.length}
          onExportCsv={() => exportAuditCsv(pages)}
          onExportMarkdown={() =>
            exportAuditMarkdown(pages, inboundMap, siteAudit)
          }
          onAddUrls={handleAddUrls}
          onRescanAll={handleRescanAll}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {scanError && (
            <div className="mb-6 p-3 border border-red-200 bg-red-50 text-xs text-red-700 rounded-md flex items-center justify-between gap-4">
              <span>{scanError}</span>
              <button
                type="button"
                onClick={() => setScanError(null)}
                className="font-semibold underline cursor-pointer"
              >
                Скрыть
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewView
              pages={pages}
              inboundMap={inboundMap}
              isScanning={isScanning}
              onStartScan={handleStartScan}
              onNavigateRegistry={handleNavigateRegistry}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'registry' && (
            <RegistryView
              pages={pages}
              inboundMap={inboundMap}
              selectedSection={selectedSection}
              issueFilter={issueFilter}
              selectedUrl={selectedUrl}
              onSelectUrl={setSelectedUrl}
              onRescanPage={handleRescanPage}
              onSaveAiAudit={handleSaveAiAudit}
            />
          )}

          {activeTab === 'semantics' && (
            <SemanticsView
              pages={pages}
              inboundMap={inboundMap}
              onInspectUrl={handleInspectUrl}
            />
          )}

          {activeTab === 'strategy' && (
            <AiStrategyView
              pages={pages}
              inboundMap={inboundMap}
              siteAudit={siteAudit}
              onSaveSiteAudit={setSiteAudit}
            />
          )}
        </main>
      </div>
    </div>
  );
}
