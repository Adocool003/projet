import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Modal, PlanBadge, PlanCards, Spinner } from '../components/ui.jsx';

export default function Subscription() {
  const { t, lang } = useI18n();
  const { user, setUser, meta, handleError, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [immediate, setImmediate] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const sub = user.subscription;

  const load = () => api.get('/subscription').then(setInfo).catch(handleError);

  useEffect(() => {
    load();
    // Retour depuis Stripe Checkout
    const status = params.get('statut');
    if (status === 'succes') {
      api.get('/me').then((r) => {
        setUser(r.user);
        showToast(t('subscription.success', { plan: t(`plans.${r.user.subscription.plan}`) }));
      });
    } else if (status === 'annule') {
      showToast(t('subscription.canceled'));
    }
    const wanted = params.get('formule');
    if (wanted && meta) {
      const plan = meta.plans.find((p) => p.id === wanted);
      if (plan && plan.id !== 'free' && plan.id !== sub.plan) openCheckout(plan);
    }
    if (status || wanted) setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCheckout(plan) {
    setImmediate(false);
    setCheckout(plan);
  }

  const pay = async () => {
    setBusy(true);
    try {
      const res = await api.post('/subscription/checkout', { plan: checkout.id, immediateExecution: true });
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      setUser(res.user);
      setCheckout(null);
      showToast(t('subscription.success', { plan: t(`plans.${checkout.id}`) }));
      load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const call = async (path) => {
    setBusy(true);
    try {
      const res = await api.post(path);
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      setUser(res.user);
      setConfirmCancel(false);
      load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!meta) return <div className="page"><Spinner /></div>;

  return (
    <div className="page subscription-page">
      <h1>{t('subscription.title')}</h1>
      <p className="muted">{t('subscription.subtitle')}</p>
      {meta.paymentsMode === 'demo' && <p className="hint-box">{t('subscription.demoMode')}</p>}

      {sub.plan !== 'free' && (
        <section className="card current-sub">
          <div className="row between">
            <h2>{t('subscription.current', { plan: '' })} <PlanBadge plan={sub.plan} /></h2>
          </div>
          <p>
            {sub.cancelAtPeriodEnd
              ? t('subscription.endsOn', { date: formatDate(sub.expiresAt, lang) })
              : t('subscription.renews', { date: formatDate(sub.expiresAt, lang) })}
          </p>
          <div className="stack">
            {sub.cancelAtPeriodEnd ? (
              <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => call('/subscription/resume')}>{t('subscription.resume')}</button>
            ) : (
              <button type="button" className="btn btn-danger-ghost btn-block" disabled={busy} onClick={() => setConfirmCancel(true)}>{t('subscription.cancel')}</button>
            )}
            {sub.provider === 'stripe' && (
              <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => call('/subscription/portal')}>{t('subscription.manage')}</button>
            )}
          </div>
        </section>
      )}

      <PlanCards plans={meta.plans} currentPlan={sub.plan} onChoose={openCheckout} busy={busy} />

      <p className="muted small center">{t('subscription.withdrawal')} <Link to="/legal/cgv">{t('footer.sales')}</Link></p>

      {info?.history?.length > 0 && (
        <section className="card">
          <h2>{t('subscription.history')}</h2>
          <ul className="plain-list history">
            {info.history.map((h, i) => (
              <li key={i}>
                <span>
                  {t(`subscription.events.${h.type}`)}{h.plan ? ` · ${t(`plans.${h.plan}`)}` : ''}
                  <small className="muted"> — {formatDate(h.createdAt, lang, { dateStyle: 'medium' })}</small>
                </span>
                {h.amountCents > 0 && <strong>{formatPrice(h.amountCents, lang)}</strong>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={Boolean(checkout)} onClose={() => setCheckout(null)} label={checkout ? t('subscription.checkoutTitle', { plan: t(`plans.${checkout.id}`) }) : ''}>
        {checkout && (
          <>
            <h2>{t('subscription.checkoutTitle', { plan: t(`plans.${checkout.id}`) })}</h2>
            <p>{t('subscription.checkoutPrice', { price: formatPrice(checkout.priceCents, lang) })}</p>
            <label className="check">
              <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
              <span>{t('subscription.immediate')}</span>
            </label>
            <p className="muted small">
              <Link to="/legal/cgv" target="_blank">{t('footer.sales')}</Link>
            </p>
            <button type="button" className="btn btn-primary btn-block" disabled={!immediate || busy} onClick={pay}>
              {t('subscription.pay', { price: formatPrice(checkout.priceCents, lang) })}
            </button>
          </>
        )}
      </Modal>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} label={t('subscription.cancel')}>
        <h2>{t('subscription.cancel')}</h2>
        <p>{t('subscription.cancelText', { date: sub.expiresAt ? formatDate(sub.expiresAt, lang) : '' })}</p>
        <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={() => call('/subscription/cancel')}>{t('subscription.cancelConfirm')}</button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmCancel(false)}>{t('common.cancel')}</button>
      </Modal>
    </div>
  );
}
