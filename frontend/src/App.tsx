import React, { useState } from 'react';
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

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  if (isLoading) {
    return (
      <div style={{ minHeight:'100vh', background:'#0a0c10', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, border:'2px solid #2d7ff9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'#8b96a8' }}>Initializing DataShield</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0c10', color:'#f0f4ff', display:'flex', flexDirection:'column' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={{ display:'flex', flex:1 }}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main style={{ flex:1, padding:'24px 28px', overflowY:'auto', minWidth:0 }}>
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'demolab' && <DemoLab setActiveTab={setActiveTab} />}
          {activeTab === 'storage' && <Storage setActiveTab={setActiveTab} />}
          {activeTab === 'recovery' && <Recovery />}
          {activeTab === 'erasure' && <Erasure setActiveTab={setActiveTab} />}
          {activeTab === 'shred' && <SecureDelete />}
          {activeTab === 'verification' && <Verification setActiveTab={setActiveTab} />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'audit' && <Audit />}
          {activeTab === 'users' && <Users />}
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
