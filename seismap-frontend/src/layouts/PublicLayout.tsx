import { Activity, ArrowUpRight, Globe2, Layers3, LineChart, RadioTower } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { PreviewBanner } from '../components/ui';

export function PublicLayout() {
  return <div className="public-shell">
    <a className="skip-link" href="#public-main-content">Lewati ke konten utama</a>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="ambient ambient-three" />
    <PreviewBanner />
    <header className="public-nav glass-nav">
      <NavLink to="/" className="brand-lockup"><span className="brand-mark"><Activity size={20} /></span><span><strong>SEISMAP</strong><small>PEMETAAN & ANALISIS GEMPA INDONESIA</small></span></NavLink>
      <nav className="public-links" aria-label="Navigasi utama">
        <NavLink to="/" end><Globe2 size={15} />Sorotan</NavLink>
        <NavLink to="/peta-klaster"><Layers3 size={15} />Peta Klaster</NavLink>
        <NavLink to="/analisis"><LineChart size={15} />Analisis</NavLink>
        <NavLink to="/gempa-terkini"><RadioTower size={15} />Gempa Terkini</NavLink>
      </nav>
      <NavLink to="/admin/login" className="nav-admin-link">Admin <ArrowUpRight size={14} /></NavLink>
    </header>
    <main className="public-main" id="public-main-content" tabIndex={-1}><Outlet /></main>
    <footer className="public-footer"><span>© {new Date().getFullYear()} SEISMAP</span><span>Pemetaan dan analisis spasial gempa Indonesia</span><span className="footer-live"><i /> WebGIS Penelitian</span></footer>
  </div>;
}
