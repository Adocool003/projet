import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Logo, PlanCards } from '../components/ui.jsx';
import { IconChat, IconHeart, IconPin, IconShield, IconStar, IconX } from '../components/Icons.jsx';

export default function Landing() {
  const { t } = useI18n();
  const { meta } = useApp();

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <Link to="/connexion" className="btn btn-small btn-outline-light">{t('auth.submitLogin')}</Link>
      </header>

      <section className="hero">
        <div className="hero-text">
          <h1>{t('landing.title')}</h1>
          <p>{t('landing.subtitle')}</p>
          <div className="hero-actions">
            <Link to="/inscription" className="btn btn-light">{t('landing.cta')}</Link>
            <Link to="/connexion" className="btn btn-outline-light">{t('landing.login')}</Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-card hero-card-back" />
          <div className="hero-card">
            <div className="hero-card-photo">C</div>
            <div className="hero-card-info"><strong>Camille, 27</strong><span>Lyon · 3 km</span></div>
          </div>
          <div className="hero-buttons">
            <span className="round-btn nope"><IconX /></span>
            <span className="round-btn super"><IconStar /></span>
            <span className="round-btn like"><IconHeart /></span>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="feature"><IconPin size={28} /><h3>{t('landing.f1t')}</h3><p>{t('landing.f1')}</p></div>
        <div className="feature"><IconChat size={28} /><h3>{t('landing.f2t')}</h3><p>{t('landing.f2')}</p></div>
        <div className="feature"><IconShield size={28} /><h3>{t('landing.f3t')}</h3><p>{t('landing.f3')}</p></div>
      </section>

      {meta && (
        <section className="pricing">
          <h2>{t('landing.pricingTitle')}</h2>
          <p className="muted">{t('landing.pricingSubtitle')}</p>
          <PlanCards plans={meta.plans} />
          <Link to="/inscription" className="btn btn-primary">{t('landing.cta')}</Link>
        </section>
      )}
    </div>
  );
}
