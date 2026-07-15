import { Menu, MoonStar, ScanSearch, SunMedium } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { GlassButton } from '../ui/GlassButton';
import { useTheme } from '../providers/ThemeProvider';

const links = [
  { to: '/', label: 'Home' },
  { to: '/generator', label: 'Generator' },
  { to: '/scanner', label: 'Scanner' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-4 z-50 mx-auto mb-6 w-[min(100%-1rem,72rem)] rounded-full border border-white/10 bg-black/20 px-3 py-2 shadow-glass backdrop-blur-2xl sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 rounded-full px-2 py-1 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-white">
            <ScanSearch size={18} />
          </span>
          <span className="hidden text-sm font-semibold sm:block">OR-Generator</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-full px-4 py-2 text-sm transition ${active ? 'bg-white text-slate-950' : 'text-white/75 hover:bg-white/8 hover:text-white'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <GlassButton className="h-10 w-10 p-0" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
          </GlassButton>
          <GlassButton className="md:hidden h-10 w-10 p-0" aria-label="Open menu">
            <Menu size={16} />
          </GlassButton>
        </div>
      </div>
    </nav>
  );
}