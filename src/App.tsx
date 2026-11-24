import React, { useEffect, useState } from 'react';
import { SetupStatusResponse, AuthMeResponse, User } from './types';
import { SetupGate } from './components/SetupGate';
import { LoginScreen } from './components/LoginScreen';
import { UnauthorizedScanScreen } from './components/UnauthorizedScanScreen';
import { AppShell } from './components/AppShell';
import { RouterProvider, useRouter } from './utils/router';
import { Coffee } from 'lucide-react';

const AppContent: React.FC = () => {
  const { path, navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [cafeName, setCafeName] = useState<string>('Kimmo’s Kitchen');
  const [user, setUser] = useState<User | null>(null);
  const [overrideShowLogin, setOverrideShowLogin] = useState(false);

  // Parse path for /scan/:card_uid
  const isScanRoute = path.startsWith('/scan/');
  const scanCardUid = isScanRoute ? path.replace('/scan/', '').trim() : '';

  const checkStatusAndAuth = async () => {
    try {
      setLoading(true);
      // 1. Check system setup status
      const statusRes = await fetch('/api/setup/status');
      const statusData: SetupStatusResponse = await statusRes.json();

      setIsInitialized(statusData.isInitialized);
      if (statusData.cafe_name) {
        setCafeName(statusData.cafe_name);
      }

      // 2. If initialized, check auth
      if (statusData.isInitialized) {
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const authData: AuthMeResponse = await authRes.json();
          setUser(authData.user);
          if (authData.cafe_name) {
            setCafeName(authData.cafe_name);
          }

          // Smart post-auth redirect if landing on root or login
          if ((path === '/' || path === '/login') && authData.user) {
            if (authData.user.role === 'waiter') {
              navigate('/tables', true);
            } else if (authData.user.role === 'staff') {
              navigate('/pos', true);
            } else if (authData.user.role === 'manager') {
              navigate('/tables', true);
            } else {
              navigate('/owner/reports', true);
            }
          }
        } else {
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Failed to load system status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatusAndAuth();
  }, []);

  useEffect(() => {
    document.title = `${cafeName} — NFC Loyalty, POS & Floor Management`;
  }, [cafeName]);

  const handleLoginSuccess = (loggedInUser: User, currentCafeName: string) => {
    setUser(loggedInUser);
    setCafeName(currentCafeName);

    // Smart redirect based on role
    if (isScanRoute && scanCardUid) {
      navigate('/pos', true);
    } else if (loggedInUser.role === 'waiter') {
      navigate('/tables', true);
    } else if (loggedInUser.role === 'staff') {
      navigate('/pos', true);
    } else if (loggedInUser.role === 'manager') {
      navigate('/tables', true);
    } else {
      navigate('/owner/reports', true);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setOverrideShowLogin(true);
      navigate('/login', true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] text-[#52525B]">
        <div className="w-14 h-14 bg-white border border-[#E6E2DA] text-[#111111] rounded-2xl flex items-center justify-center shadow-sm mb-4">
          <Coffee className="w-7 h-7 animate-pulse text-[#111111]" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#111111]">Connecting to Kimmo’s Kitchen...</p>
        <p className="text-xs text-[#71717A] mt-1">Initializing Secure Terminal</p>
      </div>
    );
  }

  // 1. Not initialized -> Show Setup Gate (Fresh or Restore)
  if (isInitialized === false) {
    return (
      <SetupGate
        onSetupComplete={(newUser, newCafeName) => {
          setIsInitialized(true);
          setUser(newUser);
          setCafeName(newCafeName);
          navigate('/owner/reports', true);
        }}
        onRestoreComplete={() => {
          checkStatusAndAuth();
        }}
      />
    );
  }

  // 2. Initialized but unauthenticated
  if (!user) {
    // If scanning a card URL without being logged in, show lock screen
    if (isScanRoute && scanCardUid && !overrideShowLogin) {
      return (
        <UnauthorizedScanScreen
          cardUid={scanCardUid}
          cafeName={cafeName}
          onGoToLogin={() => setOverrideShowLogin(true)}
        />
      );
    }

    return (
      <LoginScreen
        cafeName={cafeName}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // 3. Authenticated -> Render App Shell
  return (
    <AppShell
      user={user}
      cafeName={cafeName}
      initialCardUid={isScanRoute ? scanCardUid : undefined}
      onLogout={handleLogout}
      onCafeNameChange={(newName) => setCafeName(newName)}
    />
  );
};

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
};

export default App;
