import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.ts';
import { UserCircleIcon } from './icons.tsx';

const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login failed", err);
      setError("Failed to sign in. Please check your internet connection or Firebase configuration.");
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

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-300">
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
      </div>
    </div>
  );
};

export default Login;
