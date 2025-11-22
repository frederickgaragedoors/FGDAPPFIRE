
import React, { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.ts';
import { UserCircleIcon, ClipboardListIcon } from './icons.tsx';

const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentHostname, setCurrentHostname] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setCurrentHostname(window.location.hostname);
    }
  }, []);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setUnauthorizedDomain(null);
      
      if (!auth || !googleProvider) {
        throw new Error("Firebase Auth not initialized.");
      }
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login failed", err);
      if (err.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        // Show full error for debugging if it's not the specific domain issue
        setError(`Failed to sign in: ${err.message} (${err.code})`);
      }
    } finally {
      setIsLoading(false);
    }
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
        <p className="text-slate-500 dark:text-slate-400 mb-8">Sign in to sync your contacts, jobs, and files across all your devices.</p>

        {/* Specific Instruction Block for Domain Error */}
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
        
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
            Securely powered by Google Firebase
        </p>

        {/* Permanent Domain Display for Troubleshooting */}
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
