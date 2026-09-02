import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Storage } from './pages/Storage';
import { Recovery } from './pages/Recovery';
import { Erasure } from './pages/Erasure';
import { Verification } from './pages/Verification';
import { Audit } from './pages/Audit';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { DemoLab } from './pages/DemoLab';
import { SecureDelete } from './pages/SecureDelete';
import { ShieldOff } from 'lucide-react';

// Role → allowed page IDs
const ROLE_PAGES: Record<string, string[]> = {
  admin:            ['dashboard', 'demolab', 'storage', 'recovery', 'erasure', 'shred', 'verification', 'reports', 'audit', 'users'],
  security_admin:   ['dashboard', 'storage', 'recovery', 'erasure', 'shred', 'verification', 'reports', 'audit'],
  forensic_analyst: ['dashboard', 'storage', 'recovery', 'verification', 'reports'],
  auditor:          ['dashboard', 'storage', 'verification', 'reports', 'audit'],
  demo_user:        ['dashboard', 'demolab', 'storage', 'recovery', 'shred', 'verification', 'reports'],
};

const AccessDenied: React.FC<{ tab: string }> = ({ tab }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', gap: 16,
  }}>
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <ShieldOff size={32} color="#DC2626" />
    </div>
    <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 22, color: '#1E2229', margin: 0 }}>
      Access Restricted
    </h2>
    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: '#5E6676', textAlign: 'center', maxWidth: 380, margin: 0 }}>
      Your current role does not have permission to access the <strong style={{ color: '#DC2626' }}>{tab}</strong> page.
      Contact your administrator if you need access.
    </p>
  </div>
);

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const role = user?.role || '';
  const allowedPages = ROLE_PAGES[role] || ['dashboard'];

  // If current tab becomes inaccessible (e.g. role changed), redirect to dashboard
  useEffect(() => {
    if (user && !allowedPages.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [role]);

  const handleSetTab = (tab: string) => {
    if (allowedPages.includes(tab)) {
      setActiveTab(tab);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--c-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, border:'3px solid rgba(255,126,95,0.25)', borderTopColor:'#FF7E5F', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <span style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--c-text-muted)' }}>Initializing DataShield</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    if (!allowedPages.includes(activeTab)) {
      return <AccessDenied tab={activeTab} />;
    }
    switch (activeTab) {
      case 'dashboard':    return <Dashboard setActiveTab={handleSetTab} />;
      case 'demolab':      return <DemoLab setActiveTab={handleSetTab} />;
      case 'storage':      return <Storage setActiveTab={handleSetTab} />;
      case 'recovery':     return <Recovery />;
      case 'erasure':      return <Erasure setActiveTab={handleSetTab} />;
      case 'shred':        return <SecureDelete setActiveTab={handleSetTab} />;
      case 'verification': return <Verification setActiveTab={handleSetTab} />;
      case 'reports':      return <Reports />;
      case 'audit':        return <Audit />;
      case 'users':        return <Users />;
      default:             return <Dashboard setActiveTab={handleSetTab} />;
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--c-bg)', color:'var(--c-text)', display:'flex', flexDirection:'column' }}>
      <Navbar activeTab={activeTab} setActiveTab={handleSetTab} />
      <div style={{ display:'flex', flex:1 }}>
        <Sidebar activeTab={activeTab} setActiveTab={handleSetTab} />
        <main style={{ flex:1, padding:'24px 28px', overflowY:'auto', minWidth:0 }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
