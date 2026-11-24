import { Activity, ArrowUpRight, Globe2, Layers3, LineChart, RadioTower } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { LanguageToggle } from '../components/LanguageToggle';
import { PreviewBanner } from '../components/ui';
import { useI18n } from '../i18n/LanguageContext';

export function PublicLayout() {
  const { t } = useI18n();

  return <div className="public-shell">
    <a className="skip-link" href="#public-main-content">{t.nav.skipMain}</a>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="ambient ambient-three" />
    <PreviewBanner />
    <header className="public-nav glass-nav">
      <NavLink to="/" className="brand-lockup"><span className="brand-mark"><Activity size={20} /></span><span><strong>SEISMAP</strong><small>{t.brand.publicSub}</small></span></NavLink>
      <nav className="public-links" aria-label={t.nav.mainAria}>
        <NavLink to="/" end><Globe2 size={15} />{t.nav.spotlight}</NavLink>
        <NavLink to="/peta-klaster"><Layers3 size={15} />{t.nav.clusterMap}</NavLink>
        <NavLink to="/analisis"><LineChart size={15} />{t.nav.analysis}</NavLink>
        <NavLink to="/gempa-terkini"><RadioTower size={15} />{t.nav.realtime}</NavLink>
      </nav>
      <div className="public-nav-actions">
        <LanguageToggle />
        <NavLink to="/admin/login" className="nav-admin-link">{t.nav.adminLink} <ArrowUpRight size={14} /></NavLink>
      </div>
    </header>
    <main className="public-main" id="public-main-content" tabIndex={-1}><Outlet /></main>
    <footer className="public-footer"><span>© {new Date().getFullYear()} SEISMAP</span><span>{t.brand.footerSub}</span><span className="footer-live"><i /> {t.brand.footerTag}</span></footer>
  </div>;
}
