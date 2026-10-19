import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useI18n } from './i18n/index.jsx';
import { useApp } from './state.jsx';
import { CookieNotice, Footer, Logo, MatchModal, PlanBadge, Spinner, Toast, UpsellModal } from './components/ui.jsx';
import { IconChat, IconFlame, IconSettings, IconShield, IconStar, IconUser } from './components/Icons.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Discover from './pages/Discover.jsx';
import Likes from './pages/Likes.jsx';
import Matches from './pages/Matches.jsx';
import Chat from './pages/Chat.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import Subscription from './pages/Subscription.jsx';
import Legal from './pages/Legal.jsx';
import Admin from './pages/Admin.jsx';

function AppShell() {
  const { user, unread } = useApp();
  const { t } = useI18n();
  const location = useLocation();
  if (user === undefined) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  const inChat = /^\/messages\/\d+/.test(location.pathname);

  return (
    <div className={`shell ${inChat ? 'shell-chat' : ''}`}>
      {!inChat && (
        <header className="topbar">
          <Logo to="/decouvrir" />
          <div className="topbar-right">
            <NavLink to="/abonnement" className="topbar-plan">
              {user.subscription.plan === 'free'
                ? <span className="plan-badge plan-cta">{t('common.seePlans')}</span>
                : <PlanBadge plan={user.subscription.plan} />}
            </NavLink>
            {user.role === 'admin' && <NavLink to="/admin" className="icon-btn" aria-label={t('nav.admin')}><IconShield size={22} /></NavLink>}
            <NavLink to="/reglages" className="icon-btn" aria-label={t('nav.settings')}><IconSettings size={22} /></NavLink>
          </div>
        </header>
      )}
      <main className="content">
        <Outlet />
      </main>
      {!inChat && (
        <nav className="tabbar" aria-label="Navigation">
          <NavLink to="/decouvrir"><IconFlame /><span>{t('nav.discover')}</span></NavLink>
          <NavLink to="/likes"><IconStar /><span>{t('nav.likes')}</span></NavLink>
          <NavLink to="/messages">
            <span className="tab-icon"><IconChat />{unread > 0 && <i className="badge">{unread > 99 ? '99+' : unread}</i>}</span>
            <span>{t('nav.messages')}</span>
          </NavLink>
          <NavLink to="/profil"><IconUser /><span>{t('nav.profile')}</span></NavLink>
        </nav>
      )}
      <MatchModal />
    </div>
  );
}

function PublicLayout() {
  return (
    <div className="public">
      <Outlet />
      <Footer />
    </div>
  );
}

function GuestOnly({ children }) {
  const { user } = useApp();
  if (user === undefined) return <div className="center-screen"><Spinner /></div>;
  if (user) return <Navigate to="/decouvrir" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
          <Route path="/inscription" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route path="/connexion" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/legal/:doc" element={<Legal />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="/decouvrir" element={<Discover />} />
          <Route path="/likes" element={<Likes />} />
          <Route path="/messages" element={<Matches />} />
          <Route path="/messages/:id" element={<Chat />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="/abonnement" element={<Subscription />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpsellModal />
      <Toast />
      <CookieNotice />
    </>
  );
}
