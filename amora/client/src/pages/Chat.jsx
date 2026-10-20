import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Avatar, Modal, ProfileCard, ReportModal, Spinner } from '../components/ui.jsx';
import { IconChevronLeft, IconMore, IconSend } from '../components/Icons.jsx';

export default function Chat() {
  const { id } = useParams();
  const matchId = Number(id);
  const { t, lang } = useI18n();
  const { user, handleError, on, emit, refreshUnread } = useApp();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [report, setReport] = useState(false);
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef(null);
  const typingSent = useRef(false);

  const markRead = useCallback(() => {
    api.post(`/matches/${matchId}/read`).then(refreshUnread).catch(() => {});
  }, [matchId, refreshUnread]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/matches/${matchId}`), api.get(`/matches/${matchId}/messages`)])
      .then(([m, msgs]) => {
        if (!alive) return;
        setMatch(m.match);
        setMessages(msgs.messages);
        setHasMore(msgs.hasMore);
        markRead();
      })
      .catch((err) => {
        if (err.status === 404) navigate('/messages', { replace: true });
        else handleError(err);
      });
    return () => { alive = false; };
  }, [matchId, navigate, handleError, markRead]);

  useEffect(() => {
    const offs = [
      on('message:new', (msg) => {
        if (msg.matchId !== matchId) return;
        setMessages((list) => [...list, msg]);
        setTyping(false);
        markRead();
      }),
      on('message:read', (evt) => {
        if (evt.matchId !== matchId) return;
        setMessages((list) => list.map((m) => (m.senderId === user.id && !m.readAt ? { ...m, readAt: evt.readAt } : m)));
      }),
      on('typing', (evt) => evt.matchId === matchId && setTyping(evt.typing)),
      on('match:removed', (evt) => evt.matchId === matchId && navigate('/messages', { replace: true })),
    ];
    return () => offs.forEach((off) => off());
  }, [on, matchId, user.id, navigate, markRead]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const onScroll = () => {
    const el = listRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadMore = async () => {
    const el = listRef.current;
    const prevHeight = el.scrollHeight;
    try {
      const res = await api.get(`/matches/${matchId}/messages?before=${messages[0].id}`);
      stickToBottom.current = false;
      setMessages((list) => [...res.messages, ...list]);
      setHasMore(res.hasMore);
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (err) {
      handleError(err);
    }
  };

  const onChange = (e) => {
    setText(e.target.value);
    if (!typingSent.current) {
      emit('typing', { matchId, typing: true });
      typingSent.current = true;
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      emit('typing', { matchId, typing: false });
      typingSent.current = false;
    }, 2000);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    clearTimeout(typingTimer.current);
    emit('typing', { matchId, typing: false });
    typingSent.current = false;
    stickToBottom.current = true;
    try {
      const res = await api.post(`/matches/${matchId}/messages`, { body });
      setMessages((list) => [...list, res.message]);
    } catch (err) {
      setText(body);
      handleError(err);
    }
  };

  const unmatch = async () => {
    setMenu(false);
    if (!window.confirm(t('messages.unmatchConfirm'))) return;
    try {
      await api.del(`/matches/${matchId}`);
      navigate('/messages', { replace: true });
    } catch (err) {
      handleError(err);
    }
  };

  if (!match) return <div className="page"><Spinner /></div>;
  const other = match.user;
  const lastMine = [...messages].reverse().find((m) => m.senderId === user.id);

  let lastDay = null;
  return (
    <div className="chat">
      <header className="chat-header">
        <Link to="/messages" className="icon-btn" aria-label={t('common.back')}><IconChevronLeft /></Link>
        <button type="button" className="chat-peer" onClick={() => setShowProfile(true)}>
          <Avatar profile={other} size={40} />
          <strong>{other?.name}</strong>
        </button>
        <div className="menu-wrap">
          <button type="button" className="icon-btn" aria-label="Menu" onClick={() => setMenu((v) => !v)}><IconMore /></button>
          {menu && (
            <div className="menu">
              <button type="button" onClick={unmatch}>{t('messages.unmatch')}</button>
              <button type="button" className="danger" onClick={() => { setMenu(false); setReport(true); }}>{t('discover.report')}</button>
            </div>
          )}
        </div>
      </header>

      <div className="chat-messages" ref={listRef} onScroll={onScroll}>
        {hasMore && <button type="button" className="btn btn-ghost btn-small load-more" onClick={loadMore}>{t('messages.loadMore')}</button>}
        {messages.length === 0 && (
          <div className="chat-empty">
            <Avatar profile={other} size={96} />
            <p>{t('messages.startConversation', { name: other?.name })}</p>
            <p className="muted small">{t('messages.safetyTip')}</p>
          </div>
        )}
        {messages.map((m) => {
          const day = m.createdAt.slice(0, 10);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.senderId === user.id;
          return (
            <div key={m.id}>
              {showDay && <div className="day-sep">{formatDate(m.createdAt, lang, { dateStyle: 'medium' })}</div>}
              <div className={`bubble-row ${mine ? 'mine' : ''}`}>
                <div className="bubble" title={formatDate(m.createdAt, lang, { timeStyle: 'short' })}>{m.body}</div>
              </div>
              {mine && m === lastMine && user.features.readReceipts && (
                <div className="receipt">{m.readAt ? `${t('messages.read')} · ${formatDate(m.readAt, lang, { timeStyle: 'short' })}` : t('messages.sent')}</div>
              )}
            </div>
          );
        })}
        {typing && <div className="typing">{t('messages.typing', { name: other?.name })}<span className="dots"><i /><i /><i /></span></div>}
      </div>

      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={onChange} maxLength={2000} placeholder={t('messages.placeholder')} aria-label={t('messages.placeholder')} />
        <button type="submit" className="send-btn" disabled={!text.trim()} aria-label={t('common.send')}><IconSend size={20} /></button>
      </form>

      <Modal open={showProfile} onClose={() => setShowProfile(false)} label={other?.name} className="modal-profile">
        {other && <ProfileCard profile={other} />}
      </Modal>
      {report && (
        <ReportModal target={other} onClose={() => setReport(false)} onDone={() => navigate('/messages', { replace: true })} />
      )}
    </div>
  );
}
