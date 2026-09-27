import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Map,
  BarChart3,
  BookOpen,
  Search,
  Menu,
  Bot,
  Sun,
  Moon,
  Monitor,
  Globe,
  GitCompare,
  Check,
} from 'lucide-react';
import { categories } from '@/data/breeds';
import { categoryColors } from '@/lib/categoryIcons';
import { getCategorySvgIcon } from '@/lib/categorySvgIcons';
import { useSettings } from '@/contexts/AppSettings';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LayoutProps {
  children: React.ReactNode;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  selectedCategory,
  onSelectCategory,
  searchValue,
  onSearchChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage, theme, setTheme } = useSettings();
  const [mobileCatOpen, setMobileCatOpen] = useState(false);

  const isHome = location.pathname === '/';

  const topNavItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/map', label: t('nav.map'), icon: Map },
    { to: '/dashboard', label: t('nav.dashboard'), icon: BarChart3 },
    { to: '/encyclopedia', label: t('nav.encyclopedia'), icon: BookOpen },
    { to: '/ai', label: t('nav.ai'), icon: Bot },
    { to: '/compare', label: t('compare.title'), icon: GitCompare },
  ];

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = theme === 'light' ? t('theme.light') : theme === 'dark' ? t('theme.dark') : t('theme.system');

  useEffect(() => {
    setMobileCatOpen(false);
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) navigate('/map');
  };

  const CategoryNav: React.FC = () => (
    <nav className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`flex flex-col items-center gap-1 py-2.5 rounded-md transition-all duration-200 ${
          selectedCategory === null ? 'bg-[#d4a853] text-white shadow-md' : 'text-foreground hover:bg-accent'
        }`}
      >
        <span className="text-base font-bold leading-none">{t('common.all')}</span>
        <span className="text-xs font-medium">{t('common.all')}</span>
      </button>
      {categories.map((cat) => {
        const Icon = getCategorySvgIcon(cat);
        const isActive = selectedCategory === cat;
        const color = categoryColors[cat] ?? '#95A5A6';
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(isActive ? null : cat)}
            className={`group flex flex-col items-center gap-1 py-2.5 rounded-md transition-all duration-200 ${
              isActive ? 'shadow-md' : 'hover:bg-accent'
            }`}
            style={isActive ? { backgroundColor: color } : undefined}
          >
            <Icon
              className={`w-7 h-7 ${isActive ? 'text-white' : 'text-[#999] group-hover:text-[#333]'}`}
            />
            <span className="text-xs font-medium leading-none" style={isActive ? { color: '#fff' } : { color: '#666' }}>
              {t(`cat.${cat}`)}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-dvh w-full overflow-hidden">
      {/* 顶部文字导航栏 */}
      <header className="shrink-0 sticky top-0 z-40 bg-[#1a3a2a] text-[#f5f0e8] border-b border-[#1a3a2a]">
        <div className="flex items-center h-14 px-4 md:px-6 gap-4">
          {!isHome && (
            <div className="md:hidden">
              <Sheet open={mobileCatOpen} onOpenChange={setMobileCatOpen}>
                <SheetTrigger asChild>
                  <button type="button" className="p-2 -ml-2 rounded-md hover:bg-white/10 transition-colors">
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 bg-sidebar p-4 overflow-y-auto">
                  <SheetTitle className="sr-only">{t('nav.encyclopedia')}</SheetTitle>
                  <CategoryNav />
                </SheetContent>
              </Sheet>
            </div>
          )}

          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#d4a853] flex items-center justify-center text-[#1a3a2a] font-bold text-sm">
              畜
            </div>
            <span className="font-serif text-base md:text-lg font-semibold hidden sm:inline">{t('app.title')}</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {topNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-[#f5f0e8]/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={handleSearchSubmit} className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f5f0e8]/50" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={language === 'zh' ? '搜索品种名称...' : 'Search breed...'}
                className="pl-8 h-9 w-32 sm:w-52 bg-white/10 border-white/20 text-[#f5f0e8] placeholder:text-[#f5f0e8]/50 focus:bg-white/15 focus:border-[#d4a853]"
              />
            </div>
          </form>

          {/* 主题切换：下拉菜单选择 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#f5f0e8] hover:bg-white/10 h-9 w-9 shrink-0"
                title={themeLabel}
              >
                <ThemeIcon className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="w-4 h-4 mr-2" />
                {t('theme.light')}
                {theme === 'light' && <Check className="w-4 h-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="w-4 h-4 mr-2" />
                {t('theme.dark')}
                {theme === 'dark' && <Check className="w-4 h-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="w-4 h-4 mr-2" />
                {t('theme.system')}
                {theme === 'system' && <Check className="w-4 h-4 ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 语言切换 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#f5f0e8] hover:bg-white/10 h-9 w-9 shrink-0"
                title={language === 'zh' ? '简体中文' : 'English'}
              >
                <Globe className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('zh')}>简体中文</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('en')}>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 移动端底部文字导航 */}
        <nav className="md:hidden flex items-center gap-1 px-2 pb-1 overflow-x-auto">
          {topNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-[#f5f0e8]/70 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex flex-1 min-h-0">
        {!isHome && (
          <aside className="hidden md:flex flex-col w-[180px] shrink-0 bg-sidebar border-r border-border p-3 overflow-y-auto">
            <CategoryNav />
          </aside>
        )}

        {/* 主内容区：占满剩余高度并内部滚动，消除底部空白 */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          <div className="page-fade h-full">{children}</div>
        </main>
      </div>

      <footer className="shrink-0 bg-[#1a3a2a] text-[#f5f0e8]/70 py-3 px-6 text-center text-xs border-t border-[#1a3a2a]">
        {t('home.footerCopyright')} · {language === 'zh' ? '传承农耕文明，守护地方品种' : 'Inheriting farming civilization, safeguarding local breeds'}
        <span className="mx-2 text-[#f5f0e8]/40">|</span>
        {t('home.lastUpdate')}：2026-09-15 · {t('home.totalBreeds')}：687
      </footer>
    </div>
  );
};

export default Layout;