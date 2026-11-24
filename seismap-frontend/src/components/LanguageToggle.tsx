import { useI18n } from '../i18n/LanguageContext';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      className={`lang-toggle ${className}`.trim()}
      role="group"
      aria-label={t.nav.langSwitchAria}
    >
      <button
        type="button"
        className={`lang-toggle-btn ${lang === 'id' ? 'is-active' : ''}`}
        aria-pressed={lang === 'id'}
        onClick={() => setLang('id')}
      >
        ID
      </button>
      <button
        type="button"
        className={`lang-toggle-btn ${lang === 'en' ? 'is-active' : ''}`}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
}
