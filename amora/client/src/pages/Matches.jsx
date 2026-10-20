import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Avatar, Spinner } from '../components/ui.jsx';

export default function Matches() {
  const { t } = useI18n();
  const { user, handleError, on } = useApp();
  const [matches, setMatches] = useState(null);

  const load = useCallback(() => api.get('/matches').then((r) => setMatches(r.matches)).catch(handleError), [handleError]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const offs = ['message:new', 'match:new', 'match:removed'].map((ev) => on(ev, load));
    return () => offs.forEach((off) => off());
  }, [on, load]);

  if (!matches) return <div className="page"><Spinner /></div>;
  const fresh = matches.filter((m) => !m.lastMessage);
  const conversations = matches.filter((m) => m.lastMessage);

  return (
    <div className="page matches-page">
      <h2 className="section-title">{t('messages.newMatches')}</h2>
      {fresh.length === 0 ? (
        <p className="muted small">{t('messages.noMatches')}</p>
      ) : (
        <div className="new-matches">
          {fresh.map((m) => (
            <Link key={m.id} to={`/messages/${m.id}`} className="new-match">
              <Avatar profile={m.user} size={72} ring />
              <span>{m.user?.name}</span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="section-title">{t('messages.conversations')}</h2>
      {conversations.length === 0 && <p className="muted small">{t('messages.noConversation')}</p>}
      <ul className="conversations">
        {conversations.map((m) => (
          <li key={m.id}>
            <Link to={`/messages/${m.id}`} className={`conversation ${m.unread ? 'unread' : ''}`}>
              <Avatar profile={m.user} size={56} />
              <div className="conversation-body">
                <strong>{m.user?.name}</strong>
                <p>
                  {m.lastMessage.senderId === user.id && <span className="muted">{t('messages.you')}</span>}
                  {m.lastMessage.body}
                </p>
              </div>
              {m.unread > 0 && <span className="badge">{m.unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
