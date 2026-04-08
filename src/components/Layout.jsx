import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Shield, BarChart3, List, Scale } from 'lucide-react';

export default function Layout() {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'text-[var(--vermillion)] border-b-2 border-[var(--vermillion)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#332e27] text-[#eae8e0] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-[var(--vermillion)] flex items-center justify-center">
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold tracking-wide leading-tight">
                  營業秘密案件儀表板
                </h1>
                <p className="text-[10px] tracking-[0.2em] text-[#b8b0a0] uppercase">
                  Taiwan Trade Secrets Dashboard
                </p>
              </div>
            </NavLink>

            <div className="flex items-center gap-1">
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#9a8f7c] mr-4 bg-[#4a4339] px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
                <span>每日 04:06 自動更新</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-[var(--border)] sticky top-16 z-40">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-1">
          <NavLink to="/" end className={linkClass}>
            <BarChart3 size={15} />
            <span>總覽</span>
          </NavLink>
          <NavLink to="/cases" className={linkClass}>
            <List size={15} />
            <span>案件列表</span>
          </NavLink>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-white mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Scale size={12} />
            <span>資料來源：司法院、智慧財產及商業法院、智慧財產局、法務部調查局</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Built with React · GitHub Actions 自動抓取 · 開放原始碼
          </p>
        </div>
      </footer>
    </div>
  );
}
