import React, { useEffect, useState } from 'react';
import { SetupStatusResponse, AuthMeResponse, User } from './types';
import { SetupGate } from './components/SetupGate';
import { LoginScreen } from './components/LoginScreen';
import { UnauthorizedScanScreen } from './components/UnauthorizedScanScreen';
import { AppShell } from './components/AppShell';
import { Coffee } from 'lucide-react';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [cafeName, setCafeName] = useState<string>('The Grove Cafe');
  const [user, setUser] = useState<User | null>(null);

  // Parse path for /scan/:card_uid
  const pathname = window.location.pathname;
  const isScanRoute = pathname.startsWith('/scan/');
  const scanCardUid = isScanRoute ? pathname.replace('/scan/', '').trim() : '';

  const [overrideShowLogin, setOverrideShowLogin] = useState(false);

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
    document.title = `${cafeName} — NFC Loyalty & Counter POS`;
  }, [cafeName]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setOverrideShowLogin(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] text-[#52525B]">
        <div className="w-14 h-14 bg-white border border-[#E6E2DA] text-[#111111] rounded-2xl flex items-center justify-center shadow-sm mb-4">
          <Coffee className="w-7 h-7 animate-pulse text-[#111111]" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#111111]">Connecting to The Grove Cafe...</p>
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
        onLoginSuccess={(loggedInUser, currentCafeName) => {
          setUser(loggedInUser);
          setCafeName(currentCafeName);
        }}
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

export default App;
