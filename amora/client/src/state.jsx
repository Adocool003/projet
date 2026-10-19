import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';
import { useI18n } from './i18n/index.jsx';

const AppContext = createContext(null);

/** Formule la moins chère qui débloque une fonctionnalité donnée. */
export function planFor(feature, plans) {
  const free = plans.find((p) => p.id === 'free');
  return plans
    .filter((p) => p.id !== 'free')
    .sort((a, b) => a.rank - b.rank)
    .find((p) => {
      const v = p.features[feature];
      const base = free.features[feature];
      if (typeof v === 'boolean') return v;
      if (v === null) return true;
      return typeof v === 'number' && v > (base ?? 0);
    })?.id ?? 'platinum';
}

export function AppProvider({ children }) {
  const { t, setLang } = useI18n();
  const [meta, setMeta] = useState(null);
  const [user, setUserState] = useState(undefined); // undefined = chargement, null = visiteur
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const [upsell, setUpsell] = useState(null);
  const [newMatch, setNewMatch] = useState(null);
  const listeners = useRef(new Map());
  const socketRef = useRef(null);
  const toastTimer = useRef(null);

  const setUser = useCallback((u) => {
    setUserState(u);
    if (u?.language) setLang(u.language);
  }, [setLang]);

  const showToast = useCallback((message, kind = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /** Gestion centralisée des erreurs d'API (402 → proposition d'abonnement). */
  const handleError = useCallback((err) => {
    if (err?.status === 402) {
      setUpsell(err.data.feature || 'dailyLikes');
      return;
    }
    if (err?.status === 401) {
      setUserState(null);
      return;
    }
    const key = `errors.${err?.code}`;
    const msg = t(key);
    showToast(msg === key ? t('common.error') : msg, 'error');
  }, [t, showToast]);

  useEffect(() => {
    api.get('/meta').then(setMeta).catch(() => setMeta(null));
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
  }, [setUser]);

  const refreshUnread = useCallback(() => {
    api.get('/matches')
      .then((r) => setUnread(r.matches.reduce((sum, m) => sum + m.unread, 0)))
      .catch(() => {});
  }, []);

  /** Abonnement aux événements temps réel (renvoie la fonction de désinscription). */
  const on = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  const emit = useCallback((event, payload) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    refreshUnread();
    const socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const dispatch = (event) => (payload) => listeners.current.get(event)?.forEach((fn) => fn(payload));
    ['message:new', 'message:read', 'typing', 'match:removed', 'like:new'].forEach((ev) => socket.on(ev, dispatch(ev)));
    socket.on('message:new', () => refreshUnread());
    socket.on('match:new', (match) => {
      setNewMatch(match);
      dispatch('match:new')(match);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, refreshUnread]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUserState(null);
  }, []);

  const value = useMemo(() => ({
    meta, user, setUser, logout, unread, refreshUnread, toast, showToast, handleError,
    upsell, setUpsell, newMatch, setNewMatch, on, emit,
  }), [meta, user, setUser, logout, unread, refreshUnread, toast, showToast, handleError, upsell, newMatch, on, emit]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
