import React, { useState, useEffect } from 'react';
import { auth as authInstance, googleProvider } from '../firebase.ts';
import { signInWithPopup } from 'firebase/auth';
import { UserCircleIcon, SettingsIcon, ShareIcon } from './icons.tsx';

interface LoginProps {
    onGuestLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onGuestLogin }) => {
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentHostname, setCurrentHostname] = useState('');
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setCurrentHostname(window.location.hostname);
        try {
            setIsIframe(window.self !== window.top);
        } catch (e) {
            setIsIframe(true);
        }
    }
  }, []);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setUnauthorizedDomain(null);
      
      if (!authInstance || !googleProvider) {
        throw new Error("Firebase Auth not initialized.");
      }
      
      await signInWithPopup(authInstance, googleProvider);
    } catch (err: any) {
      console.error("Login failed", err);
      if (err.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError(`Failed to sign in: ${err.message} (${err.code})`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConfig = () => {
      if (confirm("This will clear the saved API keys and reload the app. You will need to enter them again. Continue?")) {
          localStorage.removeItem('firebase_config_override');
          window.location.reload();
      }
  };

  const openInNewTab = () => {
      window.open(window.location.href, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="bg-sky-100 dark:bg-sky-900/30 p-4 rounded-full">
             <UserCircleIcon className="w-16 h-16 text-sky-600 dark:text-sky-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Business Contacts Manager</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Sign in to sync your data, or continue as a guest to save data on this device.</p>

        {unauthorizedDomain && (
           <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-left animate-fadeIn">
              <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-2">Configuration Required</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                This domain is not authorized in your Firebase project.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                1. Go to Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                2. Add the following domain:
              </p>
              <div className="flex items-center mt-2">
                <code className="flex-grow p-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded text-xs font-mono select-all text-slate-700 dark:text-slate-300 break-all">
                  {unauthorizedDomain}
                </code>
              </div>
           </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-300 text-left break-words whitespace-pre-wrap">
            {error}
          </div>
        )}

        {isIframe ? (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3 font-medium">
                    Google Sign-In requires a full window to work securely.
                </p>
                <button
                    onClick={openInNewTab}
                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all"
                >
                    <ShareIcon className="w-5 h-5 mr-2" />
                    Open App in New Tab
                </button>
            </div>
        ) : (
          <>
            <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-medium border border-slate-300 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {isLoading ? (
                <span>Signing in...</span>
            ) : (
                <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-3" />
                Sign in with Google
                </>
            )}
            </button>

            <div className="my-4 flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-600"></div>
                <span className="flex-shrink mx-4 text-xs text-slate-400 dark:text-slate-500">OR</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-600"></div>
            </div>

            <button
                onClick={onGuestLogin}
                className="w-full flex items-center justify-center px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg shadow-sm transition-all"
            >
                Continue as Guest
            </button>
          </>
        )}
        
        <div className="mt-6 flex justify-between items-center text-xs text-slate-400 dark:text-slate-500">
            <span>Securely powered by Google Firebase</span>
            <button onClick={handleResetConfig} className="flex items-center hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <SettingsIcon className="w-3 h-3 mr-1" /> Reset Config
            </button>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 text-left">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-2">Setup Info</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Authorized Domain must include:</p>
            <code className="block p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono select-all text-slate-600 dark:text-slate-400 break-all text-center">
                {currentHostname}
            </code>
        </div>
      </div>
    </div>
  );
};

export default Login;