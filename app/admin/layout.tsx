'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* 1. HEADER MOBILE (Khusus Layar HP < md) */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="font-black text-gray-900 text-sm tracking-wide">
            PANEL ADMIN
          </span>
        </div>

        {/* Tombol Hamburger di Header */}
        <button
          type="button"
          onClick={toggleMobileMenu}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition active:scale-95"
          aria-label="Buka Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* 2. OVERLAY GELAP (Klik area luar untuk menutup) */}
      {isMobileMenuOpen && (
        <div
          onClick={closeMobileMenu}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* 3. SIDEBAR CONTAINER */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 bg-white
          transform transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:z-auto flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        {/* Tombol Silang (X) di Pojok Kanan Atas Sidebar - Khusus HP */}
        <div className="flex md:hidden justify-end p-3 border-b border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={closeMobileMenu}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition active:scale-95 flex items-center gap-1 text-xs font-semibold"
            aria-label="Tutup Menu"
          >
            <span>Tutup</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Isi Sidebar (Tidak langsung menutup saat diklik) */}
        <div className="h-full overflow-y-auto">
          <Sidebar role="admin" />
        </div>
      </aside>

      {/* 4. AREA KONTEN UTAMA */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto min-w-0">
        {children}
      </main>

    </div>
  );
}