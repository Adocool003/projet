import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { PlanBadge, ProfileCard } from '../components/ui.jsx';
import { IconCrown, IconPlus, IconX } from '../components/Icons.jsx';

const MAX_PHOTOS = 6;
const MAX_INTERESTS = 8;

export default function Profile() {
  const { t } = useI18n();
  const { user, setUser, meta, handleError, showToast } = useApp();
  const [form, setForm] = useState({
    name: user.name, bio: user.bio, job: user.job, gender: user.gender, interests: user.interests,
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef(null);

  const setPhotos = (photos) => setUser({ ...user, photos });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('photo', file);
    setBusy(true);
    try {
      const res = await api.post('/me/photos', body);
      setPhotos(res.photos);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (photoId) => {
    try {
      setPhotos((await api.del(`/me/photos/${photoId}`)).photos);
    } catch (err) {
      handleError(err);
    }
  };

  const makeMain = async (photoId) => {
    const ids = [photoId, ...user.photos.map((p) => p.id).filter((x) => x !== photoId)];
    try {
      setPhotos((await api.put('/me/photos/order', { ids })).photos);
    } catch (err) {
      handleError(err);
    }
  };

  const toggleInterest = (i) => setForm((f) => {
    if (f.interests.includes(i)) return { ...f, interests: f.interests.filter((x) => x !== i) };
    if (f.interests.length >= MAX_INTERESTS) return f;
    return { ...f, interests: [...f.interests, i] };
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.patch('/me', form);
      setUser(res.user);
      showToast(t('common.saved'));
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page profile-page">
      <div className="profile-head">
        <h1>{user.name}, {user.age}</h1>
        <PlanBadge plan={user.subscription.plan} />
        <button type="button" className="btn btn-small btn-outline" onClick={() => setPreview(true)}>{t('profile.preview')}</button>
      </div>
      {user.subscription.plan === 'free' && (
        <Link to="/abonnement" className="promo">
          <IconCrown size={20} />
          <span><strong>{t('plans.gold')}</strong> — {t('plans.taglines.gold')}</span>
        </Link>
      )}

      <section className="card">
        <h2>{t('profile.photos')}</h2>
        {user.photos.length === 0 && <p className="hint-box">{t('profile.noPhoto')}</p>}
        <div className="photo-grid">
          {user.photos.map((p, i) => (
            <div key={p.id} className="photo-slot">
              <img src={p.url} alt="" />
              {i === 0 ? <span className="photo-main">★</span> : (
                <button type="button" className="photo-action left" onClick={() => makeMain(p.id)}>{t('profile.makeMain')}</button>
              )}
              <button type="button" className="photo-remove" onClick={() => removePhoto(p.id)} aria-label={t('profile.remove')}><IconX size={14} /></button>
            </div>
          ))}
          {user.photos.length < MAX_PHOTOS && (
            <button type="button" className="photo-slot add" disabled={busy} onClick={() => fileRef.current?.click()}>
              <IconPlus /> <span>{t('profile.addPhoto')}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
        <p className="muted small">{t('profile.photosHint')}</p>
      </section>

      <form className="card" onSubmit={save}>
        <h2>{t('profile.about')}</h2>
        <label className="field"><span>{t('auth.name')}</span>
          <input value={form.name} minLength={2} maxLength={40} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field"><span>{t('profile.bio')}</span>
          <textarea rows={4} maxLength={500} value={form.bio} placeholder={t('profile.bioPlaceholder')} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <small>{form.bio.length}/500</small>
        </label>
        <label className="field"><span>{t('profile.job')}</span>
          <input value={form.job} maxLength={60} onChange={(e) => setForm({ ...form, job: e.target.value })} />
        </label>
        <fieldset className="field">
          <legend>{t('auth.gender')}</legend>
          <div className="segmented">
            {(meta?.genders ?? []).map((g) => (
              <button type="button" key={g} className={form.gender === g ? 'active' : ''} onClick={() => setForm({ ...form, gender: g })}>{t(`genders.${g}`)}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>{t('profile.interests')}</legend>
          <div className="chips selectable">
            {(meta?.interests ?? []).map((i) => (
              <button type="button" key={i} className={`chip ${form.interests.includes(i) ? 'active' : ''}`} onClick={() => toggleInterest(i)}>
                {t(`interests.${i}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <button className="btn btn-primary btn-block" disabled={busy}>{t('common.save')}</button>
      </form>

      {preview && (
        <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setPreview(false)}>
          <div className="sheet">
            <ProfileCard profile={{ ...user, ...form, distanceKm: null }} />
          </div>
        </div>
      )}
    </div>
  );
}
