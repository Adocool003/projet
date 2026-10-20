import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { ProfileCard, Spinner } from '../components/ui.jsx';
import { IconCrown, IconHeart, IconLock, IconStar, IconX } from '../components/Icons.jsx';

export default function Likes() {
  const { t } = useI18n();
  const { handleError, setNewMatch, on } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = () => api.get('/likes').then(setData).catch(handleError);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => on('like:new', load), [on]); // eslint-disable-line react-hooks/exhaustive-deps

  const respond = async (profile, action) => {
    try {
      const res = await api.post('/swipes', { targetId: profile.id, action });
      setData((d) => ({ ...d, count: d.count - 1, profiles: d.profiles.filter((p) => p.id !== profile.id) }));
      setSelected(null);
      if (res.match) setNewMatch(res.match);
    } catch (err) {
      handleError(err);
    }
  };

  if (!data) return <div className="page"><Spinner /></div>;

  if (data.locked) {
    return (
      <div className="page likes-page">
        <h1>{t('likes.title')}</h1>
        <p className="muted">{t('likes.count', { n: data.count })}</p>
        <div className="likes-grid blurred" aria-hidden="true">
          {Array.from({ length: Math.max(4, Math.min(data.count, 8)) }).map((_, i) => (
            <div key={i} className="like-tile ghost"><IconHeart size={28} /></div>
          ))}
        </div>
        <div className="locked-panel">
          <IconLock size={28} />
          <h2>{t('likes.lockedTitle')}</h2>
          <p>{t('likes.lockedText')}</p>
          <button type="button" className="btn btn-gold" onClick={() => navigate('/abonnement?formule=gold')}>
            <IconCrown size={16} /> {t('common.upgrade', { plan: t('plans.gold') })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page likes-page">
      <h1>{t('likes.title')}</h1>
      <p className="muted">{t('likes.count', { n: data.count })}</p>
      {data.profiles.length === 0 && <p className="empty">{t('likes.empty')}</p>}
      <div className="likes-grid">
        {data.profiles.map((p) => (
          <button type="button" key={p.id} className="like-tile" onClick={() => setSelected(p)}>
            {p.photos[0] ? <img src={p.photos[0].url} alt="" loading="lazy" /> : <span className="photo-placeholder">{p.name[0]}</span>}
            {p.superLikedMe && <span className="tile-super"><IconStar size={14} /></span>}
            <span className="tile-name">{p.name}, {p.age}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="sheet">
            <ProfileCard profile={selected}>
              <div className="sheet-actions">
                <button type="button" className="round-btn nope" onClick={() => respond(selected, 'pass')} aria-label={t('discover.nope')}><IconX size={28} /></button>
                <button type="button" className="round-btn like" onClick={() => respond(selected, 'like')} aria-label={t('likes.likeBack')}><IconHeart size={28} /></button>
              </div>
            </ProfileCard>
          </div>
        </div>
      )}
    </div>
  );
}
