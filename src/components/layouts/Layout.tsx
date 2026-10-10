import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, Sun, Moon, Monitor, Globe } from 'lucide-react';
import { COLLECTION_SUMMARY, COLLECTION_VERSION } from '@/data/collectionSummary';
import { useSettings } from '@/contexts/AppSettings';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { publicAsset } from '@/lib/publicAsset';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface LayoutProps {
  children: ReactNode;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}
export default function Layout({ children, selectedCategory, onSelectCategory, searchValue, onSearchChange }: LayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, setLanguage, theme, setTheme } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // 四个路由：光图 / 互动厅 / 馆史；档案页从光图与互动厅进入，不占导航位
  const onRoute = pathname === '/' || pathname.startsWith('/breed/');
  const navItems = [
    { to: '/', label: t('nav.lightMap') },
    { to: '/arcade', label: t('nav.arcade') },
    { to: '/about', label: t('nav.museum') },
  ];
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  useEffect(() => { setMenuOpen(false); setFilterOpen(false); }, [pathname]);
  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setMenuOpen(false);
    // 检索统一回到光图（唯一的检索入口在那里）
    navigate('/?search=' + encodeURIComponent(searchValue.trim()));
  };
  const utilities = <>
    <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={t('layout.changeTheme')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"><ThemeIcon className="h-5 w-5" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">{(['light', 'dark', 'system'] as const).map(mode => <DropdownMenuItem key={mode} onClick={() => setTheme(mode)} className="min-h-11">{t('theme.' + mode)}{theme === mode ? ' ✓' : ''}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={t('layout.changeLang')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"><Globe className="h-5 w-5" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem className="min-h-11" onClick={() => setLanguage('zh')}>简体中文</DropdownMenuItem><DropdownMenuItem className="min-h-11" onClick={() => setLanguage('en')}>English · 中文品种资料</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </>;
  return <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
    <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>{t('layout.skip')}</a>
    <header className="shrink-0 z-40 bg-museum-ink text-museum-paper border-b border-white/10">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-4 xl:gap-4 xl:px-6">
        <NavLink to="/" aria-label={t('layout.home')} className="shrink-0 rounded-lg">
          <BrandLogo compact className="xl:hidden h-10 w-10" /><BrandLogo className="hidden xl:block h-12 w-[252px]" />
        </NavLink>
        <span className="ml-1 flex-1 truncate font-serif text-sm lg:hidden">{t('app.title')}</span>
        <nav aria-label={t('layout.mainNav')} className="hidden lg:flex items-center gap-1">
          {navItems.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => 'min-h-11 inline-flex items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors ' + (isActive ? 'bg-white/15 text-white font-semibold' : 'text-museum-paper/80 hover:bg-white/10')}>{item.label}</NavLink>)}
        </nav>
        <form role="search" onSubmit={handleSearch} className="ml-auto hidden lg:block">
          <Input type="search" aria-label={t('layout.searchBreeds')} value={searchValue} onChange={e => onSearchChange(e.target.value)} placeholder={t('layout.searchPlaceholder')} className="min-h-11 w-36 xl:w-44 border-white/25 bg-white/10 text-white placeholder:text-white/65" />
        </form>
        <div className="hidden lg:flex">{utilities}</div>
        <button type="button" aria-label={t('layout.openSearch')} onClick={() => setMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"><Search className="h-5 w-5" /></button>
        <button type="button" aria-label={t('layout.openMenu')} onClick={() => setMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"><Menu className="h-5 w-5" /></button>
      </div>
    </header>
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent className="w-[min(90vw,360px)] overflow-y-auto bg-museum-ink text-museum-paper border-white/20 p-6">
        <SheetTitle className="text-museum-paper">{t('layout.navTitle')}</SheetTitle>
        <SheetDescription className="text-museum-paper/70">{t('layout.navDesc')}</SheetDescription>
        <form role="search" onSubmit={handleSearch} className="mt-6 flex gap-2"><Input autoFocus type="search" aria-label={t('layout.searchBreeds')} value={searchValue} onChange={e => onSearchChange(e.target.value)} className="min-h-11 min-w-0 bg-white/10 border-white/25 text-white" /><button type="submit" aria-label={t('layout.startSearch')} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-white/15"><Search className="h-5 w-5" /></button></form>
        <nav aria-label={t('layout.mobileNav')} className="my-6 flex flex-col gap-2">{navItems.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => 'flex min-h-11 items-center rounded-lg px-4 ' + (isActive ? 'bg-white/15 border-l-2 border-museum-gold' : 'hover:bg-white/10')}>{item.label}</NavLink>)}</nav>
        <div className="flex items-center gap-3 border-t border-white/20 pt-4">{utilities}<span className="text-xs text-museum-paper/75">{t('layout.appearanceLang')}</span></div>
      </SheetContent>
    </Sheet>
    <div className="flex flex-1 min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none"><div className="page-fade h-full">{children}</div></main>
      </div>
    </div>
    <footer className="shrink-0 bg-museum-ink text-museum-paper/85 px-4 py-2 text-center text-xs leading-relaxed">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>{t('layout.footerTagline')} {COLLECTION_SUMMARY.total} {t('layout.unitRecords')}<span className="hidden sm:inline"> · {t('layout.updated')} {COLLECTION_VERSION}</span></span>
        <span aria-hidden="true">·</span>
        <a className="underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-museum-gold" href={publicAsset('privacy.html')}>{t('layout.privacyLink')}</a>
        <a className="underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-museum-gold" href={publicAsset('privacy.html#images')}>{t('layout.imageSources')}</a>
        <a className="underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-museum-gold" href={publicAsset('audit/')}>{t('layout.qualityReport')}</a>
      </div>
      {t('layout.narrativesZh') && <span className="ml-2">{t('layout.narrativesZh')}</span>}
    </footer>
  </div>;
}
