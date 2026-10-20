import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { LANGUAGES, useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Logo } from '../components/ui.jsx';

function errorMessage(t, err) {
  const key = `errors.${err?.code}`;
  const msg = t(key);
  return msg === key ? t('common.error') : msg;
}

/** Liste de villes groupées par pays (France en premier). */
export function CitySelect({ value, onChange, includeOff, offLabel, id }) {
  const { meta } = useApp();
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of meta?.cities ?? []) {
      if (!map.has(c.country)) map.set(c.country, []);
      map.get(c.country).push(c);
    }
    return [...map.entries()];
  }, [meta]);
  const countryName = (code) => {
    try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code); } catch { return code; }
  };
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} required={!includeOff}>
      {includeOff ? <option value="">{offLabel}</option> : <option value="" disabled>—</option>}
      {groups.map(([country, cities]) => (
        <optgroup key={country} label={countryName(country)}>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function maxBirthdate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function Signup() {
  const { t, lang, setLang } = useI18n();
  const { setUser, meta } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', name: '', birthdate: '', gender: '', showMe: [], cityId: '',
    acceptTerms: false, acceptSensitiveData: false, marketingOptIn: false,
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleShowMe = (g) => setForm((f) => ({ ...f, showMe: f.showMe.includes(g) ? f.showMe.filter((x) => x !== g) : [...f.showMe, g] }));

  const next = (e) => {
    e.preventDefault();
    setError('');
    if (step === 2 && (!form.gender || form.showMe.length === 0)) return;
    setStep((s) => s + 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await api.post('/auth/signup', { ...form, language: lang });
      setUser(user);
      navigate('/profil', { replace: true, state: { welcome: true } });
    } catch (err) {
      setError(errorMessage(t, err));
      if (['underage', 'invalid_birthdate'].includes(err.code)) setStep(1);
      if (err.code === 'email_taken') setStep(1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1>{t('auth.signupTitle')}</h1>
        <p className="muted small">{t('auth.step', { n: step, total: 3 })}</p>
        <div className="progress"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}

        {step === 1 && (
          <form onSubmit={next}>
            <label className="field"><span>{t('auth.email')}</span>
              <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
            </label>
            <label className="field"><span>{t('auth.password')}</span>
              <input type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
              <small>{t('auth.passwordHint')}</small>
            </label>
            <label className="field"><span>{t('auth.name')}</span>
              <input autoComplete="given-name" minLength={2} maxLength={40} required value={form.name} onChange={set('name')} />
            </label>
            <label className="field"><span>{t('auth.birthdate')}</span>
              <input type="date" required max={maxBirthdate()} min="1900-01-01" value={form.birthdate} onChange={set('birthdate')} />
              <small>{t('auth.birthdateHint')}</small>
            </label>
            <label className="field"><span>{t('auth.language')}</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <button className="btn btn-primary btn-block">{t('common.next')}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={next}>
            <fieldset className="field">
              <legend>{t('auth.gender')}</legend>
              <div className="segmented">
                {(meta?.genders ?? []).map((g) => (
                  <button type="button" key={g} className={form.gender === g ? 'active' : ''} onClick={() => setForm((f) => ({ ...f, gender: g }))}>
                    {t(`genders.${g}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend>{t('auth.showMe')}</legend>
              <div className="segmented">
                {(meta?.genders ?? []).map((g) => (
                  <button type="button" key={g} className={form.showMe.includes(g) ? 'active' : ''} onClick={() => toggleShowMe(g)}>
                    {t(`showMe.${g}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="field"><span>{t('auth.city')}</span>
              <CitySelect value={form.cityId} onChange={(v) => setForm((f) => ({ ...f, cityId: v }))} />
              <small>{t('auth.cityHint')}</small>
            </label>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>{t('common.back')}</button>
              <button className="btn btn-primary grow" disabled={!form.gender || form.showMe.length === 0 || !form.cityId}>{t('common.next')}</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submit}>
            <label className="check">
              <input type="checkbox" required checked={form.acceptTerms} onChange={set('acceptTerms')} />
              <span>
                {t('auth.acceptTerms', { terms: '\u0000', privacy: '\u0001' }).split(/(\u0000|\u0001)/).map((part, i) => {
                  if (part === '\u0000') return <Link key={i} to="/legal/cgu" target="_blank">{t('auth.terms')}</Link>;
                  if (part === '\u0001') return <Link key={i} to="/legal/confidentialite" target="_blank">{t('auth.privacy')}</Link>;
                  return part;
                })}
              </span>
            </label>
            <label className="check">
              <input type="checkbox" required checked={form.acceptSensitiveData} onChange={set('acceptSensitiveData')} />
              <span>{t('auth.acceptSensitive')}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.marketingOptIn} onChange={set('marketingOptIn')} />
              <span>{t('auth.marketing')}</span>
            </label>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>{t('common.back')}</button>
              <button className="btn btn-primary grow" disabled={busy || !form.acceptTerms || !form.acceptSensitiveData}>{t('auth.submitSignup')}</button>
            </div>
          </form>
        )}

        <p className="auth-switch">{t('auth.haveAccount')} <Link to="/connexion">{t('auth.submitLogin')}</Link></p>
      </div>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const { setUser, meta } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await api.post('/auth/login', { email, password });
      setUser(user);
      navigate(location.state?.from || '/decouvrir', { replace: true });
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1>{t('auth.loginTitle')}</h1>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          <label className="field"><span>{t('auth.email')}</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field"><span>{t('auth.password')}</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>{t('auth.submitLogin')}</button>
        </form>
        {meta?.paymentsMode === 'demo' && <p className="hint-box">{t('auth.demo')}</p>}
        <p className="auth-switch">{t('auth.noAccount')} <Link to="/inscription">{t('auth.submitSignup')}</Link></p>
      </div>
    </div>
  );
}
