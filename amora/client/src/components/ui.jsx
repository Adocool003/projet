import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { planFor, useApp } from '../state.jsx';
import { IconCheck, IconCrown, IconHeart, IconStar, IconX } from './Icons.jsx';

export function Modal({ open, onClose, children, label, className = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {onClose && (
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><IconX size={20} /></button>
        )}
        {children}
      </div>
    </div>
  );
}

export function PlanBadge({ plan, small }) {
  const { t } = useI18n();
  if (!plan || plan === 'free') return null;
  return (
    <span className={`plan-badge plan-${plan} ${small ? 'small' : ''}`}>
      <IconCrown size={small ? 11 : 13} /> {t(`plans.${plan}`)}
    </span>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return <div className={`toast toast-${toast.kind}`} role="status">{toast.message}</div>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Chargement" />;
}

/** Fenêtre affichée quand une action nécessite une formule supérieure (HTTP 402). */
export function UpsellModal() {
  const { upsell, setUpsell, meta } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!upsell || !meta) return null;
  const planId = planFor(upsell, meta.plans);
  const plan = meta.plans.find((p) => p.id === planId);
  const text = t(`upsell.${upsell}`);
  return (
    <Modal open onClose={() => setUpsell(null)} label={t('upsell.title')} className="upsell">
      <div className={`upsell-hero plan-bg-${planId}`}>
        <IconCrown size={36} />
        <h2>{t(`plans.${planId}`)}</h2>
        <p>{t(`plans.taglines.${planId}`)}</p>
      </div>
      <p className="upsell-text">{text.startsWith('upsell.') ? t('upsell.title') : text}</p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => { setUpsell(null); navigate(`/abonnement?formule=${planId}`); }}
      >
        {t('common.upgrade', { plan: t(`plans.${planId}`) })} · {formatPrice(plan.priceCents)}{t('common.perMonth')}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setUpsell(null)}>{t('common.close')}</button>
    </Modal>
  );
}

export function MatchModal() {
  const { newMatch, setNewMatch, user } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!newMatch?.user || !user) return null;
  const other = newMatch.user;
  return (
    <Modal open onClose={() => setNewMatch(null)} label={t('match.title')} className="match-modal">
      <h2 className="match-title">{t('match.title')}</h2>
      <p>{t('match.text', { name: other.name })}</p>
      <div className="match-avatars">
        <Avatar profile={user} size={110} />
        <span className="match-heart"><IconHeart size={28} /></span>
        <Avatar profile={other} size={110} />
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={() => { setNewMatch(null); navigate(`/messages/${newMatch.id}`); }}>
        {t('match.sendMessage')}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setNewMatch(null)}>{t('match.keepSwiping')}</button>
    </Modal>
  );
}

export function Avatar({ profile, size = 48, ring }) {
  const url = profile?.photos?.[0]?.url;
  return (
    <span className={`avatar ${ring ? 'avatar-ring' : ''}`} style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" loading="lazy" /> : <span>{profile?.name?.[0] ?? '?'}</span>}
    </span>
  );
}

function featureValue(t, key, value) {
  if (typeof value === 'boolean') return value ? <IconCheck size={18} className="ok" /> : <IconX size={16} className="ko" />;
  if (value === null) return t('common.unlimited');
  return value;
}

const FEATURE_ORDER = ['dailyLikes', 'dailySuperLikes', 'noAds', 'rewind', 'travel', 'seeLikes', 'readReceipts', 'advancedFilters', 'monthlyBoosts', 'incognito', 'superLikeNote', 'priority'];

/** Grille comparative des formules (page d'accueil et page abonnement). */
export function PlanCards({ plans, currentPlan, onChoose, busy }) {
  const { t, lang } = useI18n();
  return (
    <div className="plans">
      {plans.map((p) => {
        const isCurrent = currentPlan === p.id;
        return (
          <article key={p.id} className={`plan-card plan-card-${p.id} ${p.popular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}>
            {p.popular && <div className="plan-ribbon">{t('plans.popular')}</div>}
            <header>
              <h3>{p.id !== 'free' && <IconCrown size={18} />} {t(`plans.${p.id}`)}</h3>
              <p className="tagline">{t(`plans.taglines.${p.id}`)}</p>
              <p className="price">
                <strong>{formatPrice(p.priceCents, lang)}</strong>
                {p.priceCents > 0 && <span>{t('common.perMonth')}</span>}
              </p>
            </header>
            <ul>
              {FEATURE_ORDER.map((key) => {
                const v = p.features[key];
                const off = v === false || v === 0;
                return (
                  <li key={key} className={off ? 'off' : ''}>
                    <span>{t(`features.${key}`)}</span>
                    <b>{featureValue(t, key, v)}</b>
                  </li>
                );
              })}
            </ul>
            {onChoose && (
              isCurrent ? (
                <div className="btn btn-outline btn-block disabled">{t('plans.current')}</div>
              ) : p.id !== 'free' ? (
                <button type="button" className={`btn btn-block ${p.popular ? 'btn-primary' : 'btn-outline'}`} disabled={busy} onClick={() => onChoose(p)}>
                  {currentPlan && currentPlan !== 'free' ? t('subscription.switchTo', { plan: t(`plans.${p.id}`) }) : t('subscription.choose', { plan: t(`plans.${p.id}`) })}
                </button>
              ) : null
            )}
          </article>
        );
      })}
    </div>
  );
}

/**
 * Carte de profil avec carrousel de photos (tap gauche / droite).
 * variant : 'full' (détails sous la photo), 'swipe' (détails en surimpression)
 * ou 'compact' (photo + nom uniquement).
 */
export function ProfileCard({ profile, children, variant = 'full', onPhotoTap }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const photos = profile.photos?.length ? profile.photos : [null];
  const photo = photos[Math.min(index, photos.length - 1)];
  useEffect(() => setIndex(0), [profile.id]);

  const onTap = (e) => {
    if (onPhotoTap && onPhotoTap(e) === false) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const right = e.clientX - rect.left > rect.width / 2;
    setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + (right ? 1 : -1))));
  };

  const info = (
    <>
      <h2>
        {profile.name}, <span>{profile.age}</span>
        {profile.premium && <IconCrown size={16} className="premium-crown" />}
      </h2>
      <p className="meta">
        {profile.job && <span>{profile.job}</span>}
        {profile.city && <span>{profile.city}{profile.distanceKm ? ` · ${t('common.km', { n: profile.distanceKm })}` : ''}</span>}
      </p>
    </>
  );

  return (
    <div className={`profile-card variant-${variant}`}>
      <div className="profile-photo" onClick={onTap}>
        {photo ? <img src={photo.url} alt={profile.name} draggable="false" /> : <div className="photo-placeholder">{profile.name[0]}</div>}
        {photos.length > 1 && (
          <div className="photo-dots">
            {photos.map((_, i) => <span key={i} className={i === index ? 'active' : ''} />)}
          </div>
        )}
        {profile.superLikedMe && (
          <div className="super-badge"><IconStar size={14} /> {t('discover.superLikedYou', { name: profile.name })}</div>
        )}
        <div className="profile-overlay">
          {info}
          {variant === 'swipe' && (
            <>
              {profile.superLikeNote && <p className="super-note">« {profile.superLikeNote} »</p>}
              {profile.bio && <p className="bio clamp">{profile.bio}</p>}
              {profile.interests?.length > 0 && (
                <div className="chips">
                  {profile.interests.slice(0, 4).map((i) => <span key={i} className="chip chip-glass">{t(`interests.${i}`)}</span>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {variant === 'full' && (
        <div className="profile-details">
          {profile.superLikeNote && <blockquote className="super-note">« {profile.superLikeNote} »</blockquote>}
          {profile.bio && <p className="bio">{profile.bio}</p>}
          {profile.interests?.length > 0 && (
            <div className="chips">
              {profile.interests.map((i) => <span key={i} className="chip">{t(`interests.${i}`)}</span>)}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export function ReportModal({ target, onClose, onDone }) {
  const { t } = useI18n();
  const { meta, showToast, handleError } = useApp();
  const [reason, setReason] = useState('fake_profile');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  if (!target) return null;

  const submit = async (reportIt) => {
    setBusy(true);
    try {
      if (reportIt) await api.post('/reports', { userId: target.id, reason, details });
      else await api.post('/blocks', { userId: target.id });
      showToast(reportIt ? t('report.done') : '✓');
      onDone?.();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} label={t('report.title', { name: target.name })}>
      <h2>{t('report.title', { name: target.name })}</h2>
      <label className="field">
        <span>{t('report.reason')}</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {(meta?.reportReasons ?? []).map((r) => <option key={r} value={r}>{t(`report.reasons.${r}`)}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('report.details')}</span>
        <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
      <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={() => submit(true)}>{t('report.submit')}</button>
      <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => submit(false)}>{t('report.blockOnly')}</button>
    </Modal>
  );
}

export function CookieNotice() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem('amora_cookie_notice'); } catch { return true; }
  });
  if (!visible) return null;
  const dismiss = () => {
    try { localStorage.setItem('amora_cookie_notice', '1'); } catch { /* ignoré */ }
    setVisible(false);
  };
  return (
    <div className="cookie-notice" role="region" aria-label="Cookies">
      <p>{t('cookie.text')} <Link to="/legal/cookies">{t('cookie.more')}</Link></p>
      <button type="button" className="btn btn-small btn-primary" onClick={dismiss}>{t('cookie.ok')}</button>
    </div>
  );
}

export function Footer() {
  const { t, lang, setLang } = useI18n();
  return (
    <footer className="footer">
      <nav>
        <Link to="/legal/cgu">{t('footer.terms')}</Link>
        <Link to="/legal/cgv">{t('footer.sales')}</Link>
        <Link to="/legal/confidentialite">{t('footer.privacy')}</Link>
        <Link to="/legal/mentions-legales">{t('footer.legal')}</Link>
        <Link to="/legal/cookies">{t('footer.cookies')}</Link>
      </nav>
      <p>
        © {new Date().getFullYear()} Amora · {t('footer.adults')}
        {' · '}
        <button type="button" className="link" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}>
          {lang === 'fr' ? 'English' : 'Français'}
        </button>
      </p>
    </footer>
  );
}

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="Amora">
      <img src="/icon.svg" alt="" width="30" height="30" />
      <span>amora</span>
    </Link>
  );
}
