import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CaseList from './pages/CaseList';
import CaseDetail from './pages/CaseDetail';
import Analytics from './pages/Analytics';
import FullTextSearch from './pages/FullTextSearch';
import DamagesAnalysis from './pages/DamagesAnalysis';

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="cases" element={<CaseList />} />
            <Route path="cases/:id" element={<CaseDetail />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="search" element={<FullTextSearch />} />
            <Route path="damages" element={<DamagesAnalysis />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
