import { BarChart3, MoonStar, ScanSearch, SunMedium } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { GlassButton } from '../ui/GlassButton';
import { InstallPWAButton } from '../ui/InstallPWAButton';
import { useTheme } from '../providers/ThemeProvider';

const links = [
  { to: '/', label: 'Home' },
  { to: '/generator', label: 'Create' },
  { to: '/scanner', label: 'Scan' },
  { to: '/history', label: 'Library' },
  { to: '/statistics', label: 'Stats', icon: BarChart3 },
  { to: '/tools', label: 'Tools' },
  { to: '/transfer', label: 'Transfer' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-3 z-50 mx-auto mb-2 w-[calc(100%-1rem)] max-w-6xl">
      <nav className="glass-panel rounded-[24px] p-2 sm:rounded-full">
        <div className="flex items-center gap-2">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5 rounded-full px-2 py-1.5">
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[15px] bg-gradient-to-br from-cyan-300 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
              <span className="absolute inset-0 bg-white/15" />
              <ScanSearch size={19} className="relative" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-bold tracking-tight text-[var(--text)]">OR-Generator</span>
              <span className="block text-[10px] font-medium uppercase tracking-[.2em] text-[var(--text-muted)]">QR + Barcode Studio</span>
            </span>
          </Link>

          <div className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {links.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link key={link.to} to={link.to}
                  className={"shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm " + (active ? 'bg-white text-slate-950 shadow-md shadow-black/10' : 'text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]')}>
                  {link.label}
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
  );
}
