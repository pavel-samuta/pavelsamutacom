import type { PageSection, TargetUrlEntry } from '../types/audit.ts';

export const RAW_TARGET_URLS: string[] = [
  'https://pavelsamuta.com/',
  'https://pavelsamuta.com/services',
  'https://pavelsamuta.com/photoalbums',
  'https://pavelsamuta.com/articles',
  'https://pavelsamuta.com/contacts',
  'https://pavelsamuta.com/documents',
  'https://pavelsamuta.com/comment',
  'https://pavelsamuta.com/otvety-na-chasto-zadavaemye-voprosy-faq',
  'https://pavelsamuta.com/services/inzhenernyj-predstavitel-zakazchika-tender',
  'https://pavelsamuta.com/services/izgotovlenie-chertezhej-dlja-patenta',
  'https://pavelsamuta.com/services/izgotovlenie-razvertki-dlja-gibki-lista',
  'https://pavelsamuta.com/services/konstruktorskaja-dokumentacija',
  'https://pavelsamuta.com/services/podborka-proektirovanie-korpusa-pribora',
  'https://pavelsamuta.com/services/proektirovanie-jelementov-mehanicheskih-peredach',
  'https://pavelsamuta.com/services/promyshlennoe-trehmernoe-modelirovanie',
  'https://pavelsamuta.com/services/raschet-chertezh-podbor-pruzhin',
  'https://pavelsamuta.com/services/rendering-modele-3d-vizualizacia',
  'https://pavelsamuta.com/services/revers-inzhiniring',
  'https://pavelsamuta.com/services/rnd-marketplace-niokr-servis',
  'https://pavelsamuta.com/services/tehnicheskoe-konsultirovanie',
  'https://pavelsamuta.com/articles/kak-podobrat-neobkhodimuiu-sherokhovatost-poverkhnosti',
  'https://pavelsamuta.com/articles/sozdanie-chertezha-v-kompas-3d-po-modeli-detali',
  'https://pavelsamuta.com/articles/konstruktivnye-i-tehnologicheskie-jelementy-detalej-na-chertezhe',
  'https://pavelsamuta.com/articles/raschet-vremeni-razrabotki-kd',
  'https://pavelsamuta.com/articles/dopusk-pryamolineynosti-chertezhi',
  'https://pavelsamuta.com/articles/chertezh-detali-zachem-nuzhen-i-chto-soderzhit',
  'https://pavelsamuta.com/articles/vzryv-skhema-prosto-obiasnit-slozhnoe',
  'https://pavelsamuta.com/articles/annotirovannaia-3d-model',
  'https://pavelsamuta.com/articles/zarplata-inzhenera-konstruktora-2025',
  'https://pavelsamuta.com/articles/kak-chitat-chertezh-shesterni-rukovodstvo',
  'https://pavelsamuta.com/articles/kak-sohranit-chertezh-v-format-pdf',
  'https://pavelsamuta.com/articles/pochemu-nuzhen-chertezh-model-dlja-izgotovlenija-detali',
  'https://pavelsamuta.com/articles/zavodskaya-slepota-bardak-na-proizvodstve',
  'https://pavelsamuta.com/articles/oplata-inzhenernykh-uslug-proverka-partnera',
  'https://pavelsamuta.com/articles/luchshie-formaty-fajlov-sapr-dlja-sovmestnogo-ispolzovania-3d-2d',
  'https://pavelsamuta.com/articles/chem-zanimayetsya-tekhnicheskiy-inzhener-konsultant',
  'https://pavelsamuta.com/articles/tender-niokr-prakticheskoe-rukovodstvo',
  'https://pavelsamuta.com/articles/investicii-v-ocifrovku-sapr-chertezhey-mogut-privesti-k-rezultat',
  'https://pavelsamuta.com/articles/revers-inzhiniring-2026-pochemu-kopiya-ne-analog',
  'https://pavelsamuta.com/articles/vosstanovlenie-detaley-oborudovaniya',
  'https://pavelsamuta.com/articles/inzhener-konstruktor-jekspert-v-reshenii-problem',
  'https://pavelsamuta.com/articles/pamjatka-po-vyboru-materiala-dlja-obrabotki-na-stanke-s-chpu',
  'https://pavelsamuta.com/articles/sozdanie-chertezha-po-modeli-detali',
  'https://pavelsamuta.com/articles/trehmernoe-modelirovanie-osobennosti-i-napravlenija-tehnologii',
  'https://pavelsamuta.com/articles/chto-takoe-biznesprotsess-i-kak-ego-uluchshit-s-inzhenernyim',
  'https://pavelsamuta.com/articles/uchet-delovoi-reputatcii-kak-nematerialnogo-aktiva',
  'https://pavelsamuta.com/articles/inzhenernyj-partner-dlya-biznesa',
  'https://pavelsamuta.com/articles/effekt-nulevoy-tochki-poteri-biznesa',
  'https://pavelsamuta.com/articles/inzhener-konstruktor-dlya-tenderov',
  'https://pavelsamuta.com/articles/audit-analoga-importnogo-oborudovaniya',
  'https://pavelsamuta.com/articles/inzhener-3-0-sozdatel-kapitala',
  'https://pavelsamuta.com/articles/detal-slomalas-originala-net-revers-inzhiniring',
  'https://pavelsamuta.com/articles/pochemu-pribyl-rozhdaetsya-ne-v-otdele-prodazh',
  'https://pavelsamuta.com/articles/sposob-sozdavat-importnye-izdelija',
  'https://pavelsamuta.com/articles/konstruktivnye-jelementy-detalej-na-chertezhe',
  'https://pavelsamuta.com/photoalbums/206169',
  'https://pavelsamuta.com/photoalbums/453298',
  'https://pavelsamuta.com/photoalbums/453202',
  'https://pavelsamuta.com/photoalbums/453294',
  'https://pavelsamuta.com/photoalbums/453199',
  'https://pavelsamuta.com/photoalbums/453200',
];

export const SECTION_LABELS: Record<PageSection, string> = {
  core: 'Основные',
  services: 'Услуги',
  articles: 'Статьи',
  photoalbums: 'Фотоальбомы',
};

export function classifyUrl(rawUrl: string): TargetUrlEntry {
  const cleaned = rawUrl.trim();
  let path = '/';
  try {
    const parsed = new URL(cleaned);
    path = parsed.pathname || '/';
  } catch {
    path = cleaned;
  }

  let section: PageSection = 'core';
  if (path.startsWith('/services/')) {
    section = 'services';
  } else if (path.startsWith('/articles/')) {
    section = 'articles';
  } else if (path.startsWith('/photoalbums/')) {
    section = 'photoalbums';
  }

  return {
    url: cleaned,
    path,
    section,
  };
}

export const INITIAL_TARGET_URLS: TargetUrlEntry[] = RAW_TARGET_URLS.map(classifyUrl);
