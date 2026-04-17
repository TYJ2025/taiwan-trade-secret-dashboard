import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Shield, BarChart3, List, Scale, TrendingUp, Moon, Sun, Menu, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Layout() {
  const { dark, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'text-[var(--vermillion)] border-b-2 border-[var(--vermillion)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
    }`;

  const mobileLinkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
      isActive
        ? 'text-[var(--vermillion)] bg-[var(--bg-secondary)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] transition-colors duration-300">
      {/* Header */}
      <header className="bg-[var(--header-bg)] text-[var(--header-text)] sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <NavLink to="/" className="flex items-center gap-2.5 sm:gap-3 group">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[var(--vermillion)] flex items-center justify-center flex-shrink-0">
                <Shield size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold tracking-wide leading-tight truncate">
                  營業秘密案件儀表板
                </h1>
                <p className="text-[9px] sm:text-[10px] tracking-[0.15em] sm:tracking-[0.2em] text-[var(--header-sub)] uppercase hidden xs:block">
                  Taiwan Trade Secrets Dashboard
                </p>
              </div>
            </NavLink>

            <div className="flex items-center gap-2">
              {/* Auto-update badge - desktop */}
              <div className="hidden md:flex items-center gap-1 text-[10px] text-[var(--header-sub)] mr-2 bg-[var(--header-badge-bg)] px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
                <span>每日 04:06 自動更新</span>
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={toggle}
                className="w-8 h-8 flex items-center justify-center text-[var(--header-sub)] hover:text-[var(--header-text)] transition-colors"
                title={dark ? '切換淺色模式' : '切換深色模式'}
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden w-8 h-8 flex items-center justify-center text-[var(--header-sub)] hover:text-[var(--header-text)]"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation - Desktop */}
      <nav className="bg-[var(--bg-card)] border-b border-[var(--border)] sticky top-14 sm:top-16 z-40 hidden sm:block">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          <NavLink to="/" end className={linkClass}>
            <BarChart3 size={15} />
            <span>總覽</span>
          </NavLink>
          <NavLink to="/cases" className={linkClass}>
            <List size={15} />
            <span>案件列表</span>
          </NavLink>
          <NavLink to="/analytics" className={linkClass}>
            <TrendingUp size={15} />
            <span>進階分析</span>
          </NavLink>
        </div>
      </nav>

      {/* Navigation - Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-[var(--bg-card)] border-b border-[var(--border)] sticky top-14 z-40 animate-slide-down">
          <NavLink to="/" end className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
            <BarChart3 size={15} />
            <span>總覽</span>
          </NavLink>
          <NavLink to="/cases" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
            <List size={15} />
            <span>案件列表</span>
          </NavLink>
          <NavLink to="/analytics" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
            <TrendingUp size={15} />
            <span>進階分析</span>
          </NavLink>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-card)] mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Scale size={12} />
            <span>資料來源：司法院、智慧財產及商業法院、智慧財產局、法務部調查局</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            v2.0 · Built with React · GitHub Actions 自動抓取
          </p>
        </div>
      </footer>
    </div>
  );
}
