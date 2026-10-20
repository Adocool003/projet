import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Modal, ProfileCard, ReportModal, Spinner } from '../components/ui.jsx';
import { IconBolt, IconCrown, IconFlag, IconHeart, IconPlane, IconRewind, IconStar, IconX } from '../components/Icons.jsx';

const SWIPE_X = 110;
const SWIPE_UP = 130;
const FLY_MS = 260;
const AD_EVERY = 8;

/** Carte du dessus de la pile, déplaçable au doigt ou à la souris. */
function SwipeCard({ item, leaving, onAction, onReport }) {
  const { t } = useI18n();
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const start = useRef(null);
  const moved = useRef(false);

  const onPointerDown = (e) => {
    if (leaving || e.button > 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(x) + Math.abs(y) > 6) moved.current = true;
    setDrag({ x, y });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    const { x, y } = drag;
    if (x > SWIPE_X) onAction('like');
    else if (x < -SWIPE_X) onAction('pass');
    else if (y < -SWIPE_UP) onAction('superlike');
    setDrag({ x: 0, y: 0 });
  };

  let transform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`;
  if (leaving === 'like') transform = 'translate(150%, 0) rotate(25deg)';
  if (leaving === 'pass') transform = 'translate(-150%, 0) rotate(-25deg)';
  if (leaving === 'superlike') transform = 'translate(0, -150%)';
  const dragging = start.current && !leaving;
  const likeOpacity = Math.max(0, Math.min(1, drag.x / SWIPE_X));
  const nopeOpacity = Math.max(0, Math.min(1, -drag.x / SWIPE_X));
  const superOpacity = Math.max(0, Math.min(1, -drag.y / SWIPE_UP)) * (Math.abs(drag.x) < 60 ? 1 : 0);

  return (
    <div
      className="swipe-card"
      style={{ transform, transition: dragging ? 'none' : `transform ${FLY_MS}ms ease` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="stamp stamp-like" style={{ opacity: leaving === 'like' ? 1 : likeOpacity }}>{t('discover.like')}</span>
      <span className="stamp stamp-nope" style={{ opacity: leaving === 'pass' ? 1 : nopeOpacity }}>{t('discover.nope')}</span>
      <span className="stamp stamp-super" style={{ opacity: leaving === 'superlike' ? 1 : superOpacity }}>{t('discover.super')}</span>
      {item.type === 'ad' ? (
        <AdCard />
      ) : (
        <>
          <ProfileCard profile={item} variant="swipe" onPhotoTap={() => !moved.current} />
          <button type="button" className="card-flag" aria-label={t('discover.report')} onClick={() => onReport(item)} onPointerDown={(e) => e.stopPropagation()}>
            <IconFlag size={18} />
          </button>
        </>
      )}
    </div>
  );
}

function AdCard() {
  const { t } = useI18n();
  return (
    <div className="ad-card">
      <IconCrown size={48} />
      <h2>{t('discover.adTitle')}</h2>
      <p>{t('discover.adText')}</p>
      <Link to="/abonnement?formule=plus" className="btn btn-light" onPointerDown={(e) => e.stopPropagation()}>{t('common.seePlans')}</Link>
      <small>Amora</small>
    </div>
  );
}

export default function Discover() {
  const { t } = useI18n();
  const { user, setUser, meta, handleError, setNewMatch } = useApp();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [usage, setUsage] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const swipeCount = useRef(0);
  const loadingMore = useRef(false);
  const features = user.features;

  const load = useCallback(async (append = false) => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    try {
      const res = await api.get('/discover');
      setUsage(res.usage);
      setDeck((current) => {
        if (!append || !current) return res.profiles;
        const ids = new Set(current.map((p) => p.id));
        return [...current, ...res.profiles.filter((p) => !ids.has(p.id))];
      });
    } catch (err) {
      handleError(err);
      setDeck((d) => d ?? []);
    } finally {
      loadingMore.current = false;
    }
  }, [handleError]);

  useEffect(() => { load(); }, [load]);

  const top = deck?.[0];

  const act = useCallback(async (action, withNote) => {
    if (!top || leaving) return;
    if (top.type !== 'ad' && action === 'superlike' && features.superLikeNote && withNote === undefined) {
      setNote('');
      setNoteFor(top);
      return;
    }
    setLeaving(action);
    await new Promise((r) => setTimeout(r, FLY_MS));
    setLeaving(null);
    const card = top;
    setDeck((d) => d.slice(1));

    if (card.type === 'ad') return;
    swipeCount.current += 1;
    if (!features.noAds && swipeCount.current % AD_EVERY === 0) {
      setDeck((d) => [d[0], { type: 'ad', id: `ad-${swipeCount.current}` }, ...d.slice(1)].filter(Boolean));
    }
    try {
      const res = await api.post('/swipes', { targetId: card.id, action, ...(withNote ? { note: withNote } : {}) });
      setUsage(res.usage);
      if (res.match) setNewMatch(res.match);
    } catch (err) {
      // Swipe refusé (quota…) : la carte revient sur le dessus.
      setDeck((d) => [card, ...d]);
      handleError(err);
    }
  }, [top, leaving, features, setNewMatch, handleError]);

  useEffect(() => {
    if (deck && deck.filter((p) => p.type !== 'ad').length <= 3) load(true);
  }, [deck, load]);

  useEffect(() => {
    const onKey = (e) => {
      if (noteFor || reportTarget || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowRight') act('like');
      if (e.key === 'ArrowLeft') act('pass');
      if (e.key === 'ArrowUp') act('superlike');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, noteFor, reportTarget]);

  const rewind = async () => {
    try {
      const res = await api.post('/swipes/rewind');
      setUsage(res.usage);
      if (res.profile) setDeck((d) => [res.profile, ...(d ?? []).filter((p) => p.id !== res.profile.id)]);
    } catch (err) {
      handleError(err);
    }
  };

  const boost = async () => {
    try {
      const res = await api.post('/boost');
      setUser(res.user);
    } catch (err) {
      handleError(err);
    }
  };

  const travelCity = user.travelCityId && meta?.cities.find((c) => c.id === user.travelCityId);
  const boosting = user.boostUntil && new Date(user.boostUntil) > new Date();

  return (
    <div className="discover">
      {(travelCity || boosting) && (
        <div className="discover-banners">
          {travelCity && <span className="pill"><IconPlane size={14} /> {t('discover.travelling', { city: travelCity.name })}</span>}
          {boosting && <span className="pill pill-boost"><IconBolt size={14} /> {t('discover.boostActive')}</span>}
        </div>
      )}

      <div className="deck">
        {deck === null && <Spinner />}
        {deck?.length === 0 && (
          <div className="deck-empty">
            <div className="pulse"><IconHeart size={40} /></div>
            <h2>{t('discover.empty')}</h2>
            <p className="muted">{t('discover.emptyHint')}</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/reglages')}>{t('discover.openSettings')}</button>
          </div>
        )}
        {deck?.slice(0, 2).reverse().map((item, i, arr) => {
          const isTop = i === arr.length - 1;
          return isTop ? (
            <SwipeCard key={item.id} item={item} leaving={leaving} onAction={act} onReport={setReportTarget} />
          ) : (
            <div key={item.id} className="swipe-card under">
              {item.type === 'ad' ? <AdCard /> : <ProfileCard profile={item} variant="swipe" />}
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" className="round-btn small rewind" onClick={rewind} aria-label={t('discover.rewind')}>
          <IconRewind size={20} />{!features.rewind && <IconCrown size={10} className="lock-crown" />}
        </button>
        <button type="button" className="round-btn nope" onClick={() => act('pass')} disabled={!top} aria-label={t('discover.nope')}><IconX size={30} /></button>
        <button type="button" className="round-btn small super" onClick={() => act('superlike')} disabled={!top} aria-label={t('discover.super')}>
          <IconStar size={22} />
          {usage && <i className="count">{usage.superLikesRemaining}</i>}
        </button>
        <button type="button" className="round-btn like" onClick={() => act('like')} disabled={!top} aria-label={t('discover.like')}><IconHeart size={30} /></button>
        <button type="button" className="round-btn small boost" onClick={boost} aria-label={t('discover.boost')}>
          <IconBolt size={20} />
          {features.monthlyBoosts > 0 ? <i className="count">{user.boostsRemaining}</i> : <IconCrown size={10} className="lock-crown" />}
        </button>
      </div>
      {usage?.likesRemaining != null && (
        <p className="likes-left">{t('discover.likesLeft', { n: usage.likesRemaining })}</p>
      )}

      <Modal open={Boolean(noteFor)} onClose={() => setNoteFor(null)} label={t('discover.super')}>
        <h2><IconStar size={20} className="text-super" /> {t('discover.superNotePrompt')}</h2>
        <textarea rows={3} maxLength={140} value={note} placeholder={t('discover.superNotePlaceholder')} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          className="btn btn-super btn-block"
          onClick={() => { setNoteFor(null); act('superlike', note.trim() || null); }}
        >
          {t('discover.sendSuper')}
        </button>
      </Modal>

      <ReportModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onDone={() => {
          setDeck((d) => d.filter((p) => p.id !== reportTarget.id));
          setReportTarget(null);
        }}
      />
    </div>
  );
}
