'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserProfile } from '../lib/db';
import { Trophy, Mail, Lock, User, Sparkles, RefreshCw, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const registrationInProgress = useRef(false);
  
  // Tab states: 'login' | 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Auto-redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (registrationInProgress.current) {
          return;
        }
        router.push('/dashboard');
      } else {
        setAuthChecking(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (mode === 'login') {
        // Sign In
        await signInWithEmailAndPassword(auth, email.trim(), password);
        localStorage.setItem('simwc_session_expiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());
        router.push('/dashboard');
      } else {
        // Sign Up
        if (!name.trim()) {
          throw new Error('Por favor, informe seu nome.');
        }

        registrationInProgress.current = true;
        
        // 1. Create firebase auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // 2. Set Firebase Auth display name
        await updateProfile(user, {
          displayName: name.trim()
        });

        // 3. Create profile document in Firestore
        await createUserProfile(user.uid, name.trim(), email.trim());

        localStorage.setItem('simwc_session_expiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());
        router.push('/dashboard');
      }
    } catch (err: any) {
      registrationInProgress.current = false;
      console.error(err);
      let translatedError = 'Ocorreu um erro ao processar. Tente novamente.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        translatedError = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/invalid-credential') {
        translatedError = 'E-mail ou senha inválidos.';
      } else if (err.code === 'auth/email-already-in-use') {
        translatedError = 'Este endereço de e-mail já está sendo utilizado.';
      } else if (err.code === 'auth/weak-password') {
        translatedError = 'A senha precisa ter pelo menos 6 caracteres.';
      } else if (err.code === 'auth/invalid-email') {
        translatedError = 'Formato de e-mail inválido.';
      } else if (err.message) {
        translatedError = err.message;
      }
      setErrorMessage(translatedError);
      setIsLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4" />
        <p className="font-bold text-sm text-slate-500 uppercase tracking-widest">Acessando Copa 2026...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12 select-none">
      
      {/* Header Container */}
      <div className="text-center mb-8 max-w-sm">
        <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-3xl shadow-lg shadow-blue-500/20 mx-auto mb-4 active:scale-95 transition-transform">
          🏆
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
          Copa 2026 <span className="text-blue-600">Simulador</span>
        </h1>
        <p className="text-slate-500 text-xs mt-2 font-medium">
          Dê seus palpites, acumule pontos e dispute a liderança geral com seus amigos!
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-white border border-slate-100 w-full max-w-md rounded-3xl shadow-sm overflow-hidden p-6 sm:p-8">
        
        {/* Toggle Mode menu */}
        <div className="flex bg-slate-50 border border-slate-200/50 rounded-2xl p-1 mb-6">
          <button
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Input Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Nome Completo</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Endereço de E-mail</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Senha de Acesso</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-2xl text-sm mt-6 active:scale-[0.99] transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4" />
                <span>Carregando...</span>
              </>
            ) : (
              <span>{mode === 'login' ? 'Entrar no Simulador' : 'Cadastrar e Entrar'}</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer Info */}
      <div className="text-center mt-8 text-[10px] text-slate-400 font-semibold uppercase tracking-widest flex items-center gap-1.5 justify-center">
        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
        <span>Fase de Classificação • Copa do Mundo 2026</span>
      </div>

    </div>
  );
}
