'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Match, Prediction } from '../../types';
import { createUserProfile, checkAndSeedMatches, getMatches, getUserPredictions } from '../../lib/db';
import PalpitesTab from '../../components/PalpitesTab';
import ClassificacaoTab from '../../components/ClassificacaoTab';
import RankingTab from '../../components/RankingTab';
import GruposTab from '../../components/GruposTab';
import AdminTab from '../../components/AdminTab';
import { Trophy, Award, Users, ShieldAlert, LogOut, Compass, Menu, X, AlertCircle } from 'lucide-react';

const DATA_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), DATA_TIMEOUT_MS);
    }),
  ]);
}

export default function Dashboard() {
  const router = useRouter();
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // App data state
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // UI Navigation
  const [activeTab, setActiveTab] = useState<'palpites' | 'classificacao' | 'ranking' | 'grupos' | 'admin'>('palpites');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Listen to Authentication State
  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | undefined;
    let disposed = false;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeUserDoc?.();
      unsubscribeUserDoc = undefined;

      if (!firebaseUser) {
        setAuthLoading(false);
        router.push("/");
        return;
      }

      const now = Date.now();
      const savedExpiry = localStorage.getItem("simwc_session_expiry");
      if (savedExpiry) {
        const expiry = parseInt(savedExpiry, 10);
        if (now > expiry) {
          await signOut(auth);
          localStorage.removeItem("simwc_session_expiry");
          setAuthLoading(false);
          router.push("/");
          return;
        }
        localStorage.setItem(
          "simwc_session_expiry",
          (now + 15 * 24 * 60 * 60 * 1000).toString()
        );
      } else {
        localStorage.setItem(
          "simwc_session_expiry",
          (now + 30 * 24 * 60 * 60 * 1000).toString()
        );
      }

      try {
        setAuthError(null);
        const profile = await withTimeout(
          createUserProfile(
            firebaseUser.uid,
            firebaseUser.displayName || "Usuário Copa",
            firebaseUser.email || ""
          ),
          "Tempo limite ao carregar o perfil."
        );

        if (disposed) return;
        setCurrentUser(profile);
        setAuthLoading(false);

        const userRef = doc(db, "users", firebaseUser.uid);
        unsubscribeUserDoc = onSnapshot(userRef, (docSnap) => {
          if (!disposed && docSnap.exists()) {
            setCurrentUser(docSnap.data() as UserProfile);
          }
        });

        void (async () => {
          setIsDataLoading(true);
          try {
            if (profile.role === "admin") {
              await withTimeout(
                checkAndSeedMatches(),
                "Tempo limite ao verificar partidas."
              );
            }

            const [allMatches, userPreds] = await withTimeout(
              Promise.all([
                getMatches(),
                getUserPredictions(firebaseUser.uid),
              ]),
              "Tempo limite ao carregar os dados."
            );

            if (!disposed) {
              setMatches(allMatches);
              setPredictions(userPreds);
            }
          } catch (error) {
            console.error("Error loading matches/predictions:", error);
          } finally {
            if (!disposed) setIsDataLoading(false);
          }
        })();
      } catch (err) {
        console.error("Error in authentication sync:", err);
        if (!disposed) {
          setAuthError(
            err instanceof Error
              ? err.message
              : "Não foi possível conectar ao servidor."
          );
          setAuthLoading(false);
        }
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeUserDoc?.();
    };
  }, [router]);

  // Sync predictions after saving in child components
  const handlePredictionSaved = (matchId: string, homeScore: number, awayScore: number, locked?: boolean) => {
    if (!currentUser) return;
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        id: `${currentUser.id}_${matchId}`,
        userId: currentUser.id,
        matchId,
        homeScore,
        awayScore,
        locked
      }
    }));
  };

  // Refetch matches when updated by admin
  const handleMatchesUpdated = async () => {
    try {
      const allMatches = await getMatches();
      setMatches(allMatches);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <AlertCircle className="mb-3 h-9 w-9 text-red-500" />
        <h1 className="text-lg font-black text-slate-900">Falha ao carregar sua conta</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">{authError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4" />
        <p className="font-bold text-sm text-slate-500 uppercase tracking-widest">Iniciando simulador...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* DESKTOP HEADER */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40 select-none">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/25">
              🏆
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-none">COPA 2026</h1>
              <span className="text-[10px] text-blue-600 font-extrabold tracking-widest uppercase">Simulador</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            {[
              { id: 'palpites', label: 'Palpites', icon: Award },
              { id: 'classificacao', label: 'Classificação', icon: Compass },
              { id: 'ranking', label: 'Ranking', icon: Trophy },
              { id: 'grupos', label: 'Grupos', icon: Users },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-650 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </button>
              );
            })}

            {/* Admin Tab link */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-red-50 text-red-700'
                    : 'text-slate-650 hover:text-red-700 hover:bg-red-50/50'
                }`}
              >
                <ShieldAlert className="h-4.5 w-4.5" />
                Painel Admin
              </button>
            )}
          </nav>

          {/* Right User menu */}
          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-black text-slate-900">{currentUser.displayName}</span>
                <span className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">
                  {currentUser.totalPoints} pontos • {currentUser.role === 'admin' ? 'Admin' : 'Participante'}
                </span>
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm bg-white"
              title="Sair do simulador"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>

        </div>
      </header>

      {/* MOBILE PAGE HEADER */}
      <div className="md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="text-xl">🏆</div>
          <div>
            <h1 className="text-xs font-black text-slate-950 uppercase leading-none">Copa 2026</h1>
            <span className="text-[8px] text-blue-600 font-extrabold uppercase tracking-wide">Simulador</span>
          </div>
        </div>
        
        {currentUser && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-650">
            Pontos: <strong className="text-slate-900 font-extrabold">{currentUser.totalPoints}</strong>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 pb-24 md:pb-6">
        {activeTab === 'palpites' && (
          <PalpitesTab
            currentUser={currentUser}
            matches={matches}
            predictions={predictions}
            onPredictionSaved={handlePredictionSaved}
            isLoading={isDataLoading}
          />
        )}
        {activeTab === 'classificacao' && (
          <ClassificacaoTab
            matches={matches}
            isLoading={isDataLoading}
          />
        )}
        {activeTab === 'ranking' && (
          <RankingTab
            currentUser={currentUser}
            isLoading={isDataLoading}
          />
        )}
        {activeTab === 'grupos' && (
          <GruposTab
            currentUser={currentUser}
          />
        )}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <AdminTab
            currentUser={currentUser}
            matches={matches}
            onMatchesUpdated={handleMatchesUpdated}
          />
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 flex justify-around items-center py-2 pb-safe-bottom shadow-lg select-none">
        {[
          { id: 'palpites', label: 'Palpites', icon: Award },
          { id: 'classificacao', label: 'Classif.', icon: Compass },
          { id: 'ranking', label: 'Ranking', icon: Trophy },
          { id: 'grupos', label: 'Grupos', icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-center transition-all ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </button>
          );
        })}

        {/* Admin on Mobile Bottom Nav */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 py-1 px-3 text-center transition-all ${
              activeTab === 'admin' ? 'text-red-600' : 'text-slate-400 hover:text-red-500'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
            <span className="text-[10px] font-bold tracking-wide">Admin</span>
          </button>
        )}
      </div>

    </div>
  );
}
