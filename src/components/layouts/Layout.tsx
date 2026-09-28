import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, Sun, Moon, Monitor, Globe, SlidersHorizontal } from 'lucide-react';
import { breeds, categories } from '@/data/breeds';
import { getCategorySvgIcon } from '@/lib/categorySvgIcons';
import { useSettings } from '@/contexts/AppSettings';
import { BrandLogo } from '@/components/brand/BrandLogo';
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
  const { t, language, setLanguage, theme, setTheme } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const zh = language === 'zh';
  const showCategories = pathname === '/map' || pathname === '/encyclopedia';
  const navItems = [
    { to: '/', label: t('nav.home') }, { to: '/map', label: t('nav.map') },
    { to: '/dashboard', label: t('nav.dashboard') }, { to: '/encyclopedia', label: t('nav.encyclopedia') },
    { to: '/compare', label: t('compare.title') }, { to: '/ai', label: t('nav.ai') },
  ];
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  useEffect(() => { setMenuOpen(false); setFilterOpen(false); }, [pathname]);
  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setMenuOpen(false);
    navigate('/map?search=' + encodeURIComponent(searchValue.trim()));
  };
  const categoryNav = <nav aria-label={zh ? '畜种分类' : 'Breed categories'} className="grid grid-cols-3 gap-2 lg:flex lg:flex-col">
    {[null, ...categories].map((category) => {
      const Icon = category ? getCategorySvgIcon(category) : null;
      const active = selectedCategory === category;
      return <button key={category ?? 'all'} type="button" aria-pressed={active}
        onClick={() => { onSelectCategory(category); setFilterOpen(false); }}
        className={'min-h-11 rounded-lg px-3 py-2 flex items-center justify-center lg:justify-start gap-2 text-sm transition-colors ' + (active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary')}>
        {Icon && <Icon className="h-5 w-5 shrink-0" />}{category ? t('cat.' + category) : t('common.all')}
      </button>;
    })}
  </nav>;
  const utilities = <>
    <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={zh ? '切换主题' : 'Change theme'} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"><ThemeIcon className="h-5 w-5" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">{(['light', 'dark', 'system'] as const).map(mode => <DropdownMenuItem key={mode} onClick={() => setTheme(mode)} className="min-h-11">{t('theme.' + mode)}{theme === mode ? ' ✓' : ''}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={zh ? '切换语言' : 'Change language'} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"><Globe className="h-5 w-5" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem className="min-h-11" onClick={() => setLanguage('zh')}>简体中文</DropdownMenuItem><DropdownMenuItem className="min-h-11" onClick={() => setLanguage('en')}>English · 中文品种资料</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </>;
  return <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
    <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>{zh ? '跳到主要内容' : 'Skip to content'}</a>
    <header className="shrink-0 z-40 bg-museum-ink text-museum-paper border-b border-white/10">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-4 xl:gap-4 xl:px-6">
        <NavLink to="/" aria-label={zh ? '博物馆首页' : 'Museum home'} className="shrink-0 rounded-lg">
          <BrandLogo compact className="xl:hidden h-10 w-10" /><BrandLogo className="hidden xl:block h-12 w-[252px]" />
        </NavLink>
        <span className="ml-1 flex-1 truncate font-serif text-sm lg:hidden">{t('app.title')}</span>
        <nav aria-label={zh ? '主导航' : 'Main navigation'} className="hidden lg:flex items-center gap-1">
          {navItems.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => 'min-h-11 inline-flex items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors ' + (isActive ? 'bg-white/15 text-white font-semibold' : 'text-museum-paper/80 hover:bg-white/10')}>{item.label}</NavLink>)}
        </nav>
        <form role="search" onSubmit={handleSearch} className="ml-auto hidden lg:block">
          <Input type="search" aria-label={zh ? '搜索品种' : 'Search breeds'} value={searchValue} onChange={e => onSearchChange(e.target.value)} placeholder={zh ? '搜索品种 / 别名' : 'Search breeds'} className="min-h-11 w-36 xl:w-44 border-white/25 bg-white/10 text-white placeholder:text-white/65" />
        </form>
        <div className="hidden lg:flex">{utilities}</div>
        <button type="button" aria-label={zh ? '打开品种搜索' : 'Open breed search'} onClick={() => setMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"><Search className="h-5 w-5" /></button>
        <button type="button" aria-label={zh ? '打开导航菜单' : 'Open navigation menu'} onClick={() => setMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"><Menu className="h-5 w-5" /></button>
      </div>
    </header>
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent className="w-[min(90vw,360px)] overflow-y-auto bg-museum-ink text-museum-paper border-white/20 p-6">
        <SheetTitle className="text-museum-paper">{zh ? '参观导航' : 'Museum navigation'}</SheetTitle>
        <SheetDescription className="text-museum-paper/70">{zh ? '查找品种，探索馆藏。' : 'Search breeds and explore the collection.'}</SheetDescription>
        <form role="search" onSubmit={handleSearch} className="mt-6 flex gap-2"><Input autoFocus type="search" aria-label={zh ? '搜索品种' : 'Search breeds'} value={searchValue} onChange={e => onSearchChange(e.target.value)} className="min-h-11 min-w-0 bg-white/10 border-white/25 text-white" /><button type="submit" aria-label={zh ? '开始搜索' : 'Search'} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-white/15"><Search className="h-5 w-5" /></button></form>
        <nav aria-label={zh ? '移动导航' : 'Mobile navigation'} className="my-6 flex flex-col gap-2">{navItems.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => 'flex min-h-11 items-center rounded-lg px-4 ' + (isActive ? 'bg-white/15 border-l-2 border-museum-gold' : 'hover:bg-white/10')}>{item.label}</NavLink>)}</nav>
        <div className="flex items-center gap-3 border-t border-white/20 pt-4">{utilities}<span className="text-xs text-museum-paper/75">{zh ? '外观与语言' : 'Appearance & language'}</span></div>
      </SheetContent>
    </Sheet>
    <div className="flex flex-1 min-h-0">
      {showCategories && <aside className="hidden lg:block w-32 shrink-0 overflow-y-auto border-r border-border/30 bg-card p-3"><p className="mb-3 px-3 text-xs tracking-widest text-muted-foreground">{zh ? '馆藏分类' : 'CATEGORIES'}</p>{categoryNav}</aside>}
      <div className="flex min-w-0 flex-1 flex-col">
        {showCategories && <div className="lg:hidden shrink-0 border-b border-border/30 px-4 py-2"><button type="button" onClick={() => setFilterOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"><SlidersHorizontal className="h-4 w-4" />{zh ? '畜种筛选' : 'Categories'} · {selectedCategory ?? t('common.all')}</button></div>}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none"><div className="page-fade h-full">{children}</div></main>
      </div>
    </div>
    <Sheet open={filterOpen} onOpenChange={setFilterOpen}><SheetContent side="left" className="w-[min(90vw,360px)] overflow-y-auto"><SheetTitle>{zh ? '筛选馆藏' : 'Filter collection'}</SheetTitle><SheetDescription>{zh ? '按畜禽类别浏览，可随时切回全部。' : 'Choose a category or view all breeds.'}</SheetDescription><div className="mt-5">{categoryNav}</div></SheetContent></Sheet>
    <footer className="shrink-0 bg-museum-ink text-museum-paper/75 px-4 py-2 text-center text-[11px] leading-relaxed">
      {zh ? '传承农耕文明 · 站内收录' : 'Museum collection'} {breeds.length} {zh ? '条' : 'records'}<span className="hidden sm:inline"> · {zh ? '数据更新' : 'Updated'} 2026-09-27</span>
      {!zh && <span className="ml-2">Breed narratives: Chinese</span>}
    </footer>
  </div>;
}
