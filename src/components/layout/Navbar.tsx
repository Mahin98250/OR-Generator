import { BarChart3, Home, MoonStar, QrCode, ScanLine, Settings2, SunMedium, Wrench, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { GlassButton } from '../ui/GlassButton';
import { InstallPWAButton } from '../ui/InstallPWAButton';
import { useTheme } from '../providers/ThemeProvider';

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/generator', label: 'Create', icon: QrCode },
  { to: '/scanner', label: 'Scan', icon: ScanLine },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/transfer', label: 'Transfer', icon: Zap },
  { to: '/history', label: 'Library', icon: BarChart3 },
  { to: '/statistics', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

const mobileLinks = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/generator', label: 'Create', icon: QrCode },
  { to: '/scanner', label: 'Scan', icon: ScanLine },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/transfer', label: 'Transfer', icon: Zap },
];

export function Navbar() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <header className="sticky top-2 z-50 mx-auto hidden w-[calc(100%-1.5rem)] max-w-7xl md:block">
        <nav className="glass-panel rounded-[26px] p-2">
          <div className="flex items-center gap-2">
            <Link to="/" className="group flex shrink-0 items-center gap-2.5 rounded-full px-2 py-1.5">
              <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[15px] bg-gradient-to-br from-cyan-300 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                <span className="absolute inset-0 bg-white/15" />
                <QrCode size={19} className="relative" />
              </span>
              <span>
                <span className="block text-sm font-bold tracking-tight text-[var(--text)]">OptiCode Studio</span>
                <span className="block text-[10px] font-medium uppercase tracking-[.2em] text-[var(--text-muted)]">QR · Barcode · Optical</span>
              </span>
            </Link>

            <div className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {links.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link key={to} to={to}
                    className={"shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition lg:px-4 lg:text-sm " + (active ? 'bg-white text-slate-950 shadow-md shadow-black/10' : 'text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]')}>
                    <span className="inline-flex items-center gap-1.5"><Icon size={14} />{label}</span>
                  </Link>
                );
              })}
            </div>

            <InstallPWAButton />
            <GlassButton aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-10 w-10 shrink-0 p-0">
              {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
            </GlassButton>
          </div>
        </nav>
      </header>

      <header className="safe-top sticky top-0 z-50 px-3 pt-2 md:hidden">
        <div className="glass-panel flex h-14 items-center justify-between rounded-[20px] px-2.5">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-cyan-300 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <QrCode size={17} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-[var(--text)]">OptiCode</span>
              <span className="block truncate text-[9px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Studio</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <InstallPWAButton />
            <GlassButton aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-9 w-9 shrink-0 p-0">
              {theme === 'dark' ? <SunMedium size={15} /> : <MoonStar size={15} />}
            </GlassButton>
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav fixed inset-x-2 bottom-2 z-[60] md:hidden" aria-label="Primary">
        <div className="glass-panel mx-auto grid max-w-md grid-cols-5 rounded-[24px] p-1.5 shadow-2xl">
          {mobileLinks.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} aria-current={active ? 'page' : undefined}
                className={"flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[9px] font-bold transition " + (active ? 'bg-white text-slate-950 shadow-md' : 'text-[var(--text-muted)]')}>
                <Icon size={18} strokeWidth={active ? 2.6 : 2} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
