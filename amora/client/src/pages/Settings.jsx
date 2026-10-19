import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { LANGUAGES, useI18n } from '../i18n/index.jsx';
import { planFor, useApp } from '../state.jsx';
import { Modal } from '../components/ui.jsx';
import { CitySelect } from './Auth.jsx';
import { IconCrown } from '../components/Icons.jsx';

function Toggle({ checked, onChange, disabled, label, hint, locked }) {
  return (
    <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
      <span>
        <strong>{label} {locked && <span className="lock-tag"><IconCrown size={11} /> {locked}</span>}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function Settings() {
  const { t, setLang } = useI18n();
  const { user, setUser, meta, handleError, showToast, setUpsell, logout } = useApp();
  const navigate = useNavigate();
  const f = user.features;
  const [prefs, setPrefs] = useState({
    showMe: user.showMe, ageMin: user.ageMin, ageMax: user.ageMax, maxDistance: user.maxDistance, cityId: user.cityId,
  });
  const [blocks, setBlocks] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    api.get('/blocks').then((r) => setBlocks(r.blocks)).catch(handleError);
  }, [handleError]);

  const patch = async (data, toast = true) => {
    try {
      const res = await api.patch('/me', data);
      setUser(res.user);
      if (toast) showToast(t('common.saved'));
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const gated = (feature, fn) => (value) => {
    if (!f[feature] && value) return setUpsell(feature);
    return fn(value);
  };
  const lockLabel = (feature) => (f[feature] ? null : t(`plans.${planFor(feature, meta?.plans ?? [])}`));

  const toggleShowMe = (g) => setPrefs((p) => ({
    ...p,
    showMe: p.showMe.includes(g) ? (p.showMe.length > 1 ? p.showMe.filter((x) => x !== g) : p.showMe) : [...p.showMe, g],
  }));

  const unblock = async (userId) => {
    try {
      await api.del(`/blocks/${userId}`);
      setBlocks((b) => b.filter((x) => x.userId !== userId));
    } catch (err) {
      handleError(err);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    try {
      await api.del('/me', { password });
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <div className="page settings-page">
      <h1>{t('settings.title')}</h1>

      <section className="card">
        <h2>{t('settings.discovery')}</h2>
        <label className="field"><span>{t('auth.city')}</span>
          <CitySelect value={prefs.cityId} onChange={(v) => setPrefs({ ...prefs, cityId: v })} />
        </label>
        <fieldset className="field">
          <legend>{t('auth.showMe')}</legend>
          <div className="segmented">
            {(meta?.genders ?? []).map((g) => (
              <button type="button" key={g} className={prefs.showMe.includes(g) ? 'active' : ''} onClick={() => toggleShowMe(g)}>{t(`showMe.${g}`)}</button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <span>{t('settings.ageRange', { min: prefs.ageMin, max: prefs.ageMax })}</span>
          <input type="range" min="18" max="99" value={prefs.ageMin} aria-label={t('settings.minAge')}
            onChange={(e) => setPrefs({ ...prefs, ageMin: Math.min(Number(e.target.value), prefs.ageMax) })} />
          <input type="range" min="18" max="99" value={prefs.ageMax} aria-label={t('settings.maxAge')}
            onChange={(e) => setPrefs({ ...prefs, ageMax: Math.max(Number(e.target.value), prefs.ageMin) })} />
        </div>
        <label className="field">
          <span>{t('settings.distance', { n: prefs.maxDistance })}</span>
          <input type="range" min="1" max="500" value={prefs.maxDistance} onChange={(e) => setPrefs({ ...prefs, maxDistance: Number(e.target.value) })} />
        </label>
        <button type="button" className="btn btn-primary btn-block" onClick={() => patch(prefs)}>{t('common.save')}</button>
      </section>

      <section className="card">
        <h2>{t('settings.advanced')}</h2>
        {['requireBio', 'sharedInterests', 'activeRecently'].map((key) => (
          <Toggle
            key={key}
            label={t(`settings.${key}`)}
            locked={lockLabel('advancedFilters')}
            checked={Boolean(user.filters[key]) && f.advancedFilters}
            onChange={gated('advancedFilters', (v) => patch({ filters: { ...user.filters, [key]: v } }))}
          />
        ))}
      </section>

      <section className="card">
        <h2>{t('settings.travel')} {!f.travel && <span className="lock-tag"><IconCrown size={11} /> {lockLabel('travel')}</span>}</h2>
        <p className="muted small">{t('settings.travelHint')}</p>
        <CitySelect
          includeOff
          offLabel={t('settings.travelOff')}
          value={user.travelCityId}
          onChange={(v) => (v && !f.travel ? setUpsell('travel') : patch({ travelCityId: v }))}
        />
        <Toggle
          label={t('settings.incognito')}
          hint={t('settings.incognitoHint')}
          locked={lockLabel('incognito')}
          checked={user.incognito}
          onChange={gated('incognito', (v) => patch({ incognito: v }))}
        />
      </section>

      <section className="card">
        <h2>{t('settings.account')}</h2>
        <p className="muted small">{user.email}</p>
        <label className="field"><span>{t('settings.language')}</span>
          <select value={user.language} onChange={(e) => { setLang(e.target.value); patch({ language: e.target.value }, false); }}>
            {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <Toggle label={t('settings.marketing')} checked={user.marketingOptIn} onChange={(v) => patch({ marketingOptIn: v })} />
        <Link to="/abonnement" className="btn btn-outline btn-block">{t('nav.subscription')}</Link>
        <button type="button" className="btn btn-ghost btn-block" onClick={async () => { await logout(); navigate('/'); }}>{t('common.logout')}</button>
      </section>

      <section className="card">
        <h2>{t('settings.blocked')}</h2>
        {blocks.length === 0 && <p className="muted small">{t('settings.noBlocked')}</p>}
        <ul className="plain-list">
          {blocks.map((b) => (
            <li key={b.userId}>
              <span>{b.name}</span>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => unblock(b.userId)}>{t('settings.unblock')}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{t('settings.privacy')}</h2>
        <p className="muted small">{t('settings.privacyText')}</p>
        <a className="btn btn-outline btn-block" href="/api/me/export" download>{t('settings.export')}</a>
        <button type="button" className="btn btn-danger-ghost btn-block" onClick={() => setDeleting(true)}>{t('settings.deleteAccount')}</button>
      </section>

      <section className="card">
        <h2>{t('settings.legal')}</h2>
        <ul className="plain-list links">
          <li><Link to="/legal/cgu">{t('footer.terms')}</Link></li>
          <li><Link to="/legal/cgv">{t('footer.sales')}</Link></li>
          <li><Link to="/legal/confidentialite">{t('footer.privacy')}</Link></li>
          <li><Link to="/legal/mentions-legales">{t('footer.legal')}</Link></li>
          <li><Link to="/legal/cookies">{t('footer.cookies')}</Link></li>
        </ul>
      </section>

      <Modal open={deleting} onClose={() => setDeleting(false)} label={t('settings.deleteAccount')}>
        <h2>{t('settings.deleteAccount')}</h2>
        <p>{t('settings.deleteConfirm')}</p>
        <form onSubmit={deleteAccount}>
          <label className="field"><span>{t('auth.password')}</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn btn-danger btn-block">{t('settings.deleteSubmit')}</button>
        </form>
      </Modal>
    </div>
  );
}
