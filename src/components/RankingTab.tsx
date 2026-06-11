'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { getLeaderboard } from '../lib/db';
import { Trophy, Award, Search, Sparkles, RefreshCw, Star, Zap } from 'lucide-react';

interface RankingTabProps {
  groupId?: string;
  currentUser: UserProfile | null;
  leaderboard?: UserProfile[];
  isLoading?: boolean;
}

export default function RankingTab({
  groupId,
  currentUser,
  leaderboard: initialLeaderboard,
  isLoading: externalLoading = false,
}: RankingTabProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialLeaderboard && initialLeaderboard.length > 0) {
      setUsers(initialLeaderboard);
    } else {
      // Mock leaderboard
      const mockLeaderboard: UserProfile[] = [
        {
          id: 'u1',
          displayName: 'Gabriel Maxx',
          email: 'gabriel@email.com',
          role: 'admin',
          totalPoints: 34,
          stats: { exactScores: 4, correctResults: 7 }
        },
        {
          id: 'u2',
          displayName: 'Alice Silva',
          email: 'alice@email.com',
          role: 'user',
          totalPoints: 29,
          stats: { exactScores: 3, correctResults: 7 }
        },
        {
          id: 'u3',
          displayName: 'Bruno Santos',
          email: 'bruno@email.com',
          role: 'user',
          totalPoints: 28,
          stats: { exactScores: 2, correctResults: 9 }
        },
        {
          id: 'u4',
          displayName: 'Clara Costa',
          email: 'clara@email.com',
          role: 'user',
          totalPoints: 24,
          stats: { exactScores: 2, correctResults: 7 }
        },
        {
          id: 'u5',
          displayName: 'Diego Souza',
          email: 'diego@email.com',
          role: 'user',
          totalPoints: 19,
          stats: { exactScores: 1, correctResults: 8 }
        },
        {
          id: 'u6',
          displayName: 'Eduarda Rocha',
          email: 'eduarda@email.com',
          role: 'user',
          totalPoints: 15,
          stats: { exactScores: 1, correctResults: 6 }
        }
      ];
      setUsers(mockLeaderboard);
    }
  }, [initialLeaderboard]);

  // Handle loading leaderboard (global or group-specific)
  useEffect(() => {
    async function loadData() {
      if (!initialLeaderboard) {
        setIsLoading(true);
        try {
          const board = await getLeaderboard(groupId);
          setUsers(board);
        } catch (e) {
          console.error('Error fetching leaderboard:', e);
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadData();
  }, [groupId, initialLeaderboard]);

  const filteredUsers = users.filter((u) =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate top 3 for the podium
  const podiumUsers = users.slice(0, 3);
  const tableUsers = filteredUsers.slice(3);

  // Render podium spot styling helpers
  const getPodiumColor = (index: number) => {
    switch (index) {
      case 0: // 1st
        return {
          border: 'border-amber-400 bg-amber-50/50',
          text: 'text-amber-700',
          bg: 'bg-amber-400',
          ring: 'ring-amber-200',
          accent: 'from-amber-400 to-amber-500',
          height: 'h-48 md:h-56',
          title: 'Campeão',
          badge: '🥇'
        };
      case 1: // 2nd
        return {
          border: 'border-slate-350 bg-slate-50/50',
          text: 'text-slate-700',
          bg: 'bg-slate-300',
          ring: 'ring-slate-200',
          accent: 'from-slate-300 to-slate-400',
          height: 'h-40 md:h-48',
          title: 'Vice-Campeão',
          badge: '🥈'
        };
      case 2: // 3rd
        return {
          border: 'border-amber-700 bg-amber-50/10',
          text: 'text-amber-800 border-amber-600/20',
          bg: 'bg-amber-600',
          ring: 'ring-amber-550/10',
          accent: 'from-amber-600 to-amber-700',
          height: 'h-36 md:h-40',
          title: '3º Lugar',
          badge: '🥉'
        };
      default:
        return {
          border: '',
          text: '',
          bg: '',
          ring: '',
          accent: '',
          height: '',
          title: '',
          badge: ''
        };
    }
  };

  // Re-arrange for standard podium view (2nd, 1st, 3rd) on medium screens+
  const renderPodiumOrder = () => {
    if (podiumUsers.length === 0) return null;
    const ordered = [];
    if (podiumUsers[1]) ordered.push({ user: podiumUsers[1], originalIdx: 1 });
    if (podiumUsers[0]) ordered.push({ user: podiumUsers[0], originalIdx: 0 });
    if (podiumUsers[2]) ordered.push({ user: podiumUsers[2], originalIdx: 2 });
    return ordered;
  };

  const isUserLoading = externalLoading || isLoading;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 bg-slate-50 min-h-screen pb-24">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Trophy className="text-blue-600 h-8 w-8" />
            Classificação Geral
          </h1>
          <p className="text-slate-500 mt-1">
            {groupId ? 'Ranking dos membros deste grupo' : 'Acompanhe a liderança dos palpites na Copa do Mundo 2026.'}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar participante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-sm text-slate-850 focus:outline-none focus:border-blue-500 shadow-sm"
          />
        </div>
      </div>

      {isUserLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <RefreshCw className="animate-spin text-blue-600 h-10 w-10 mb-4" />
          <p className="text-slate-500 font-medium">Carregando classificação...</p>
        </div>
      ) : (
        <>
          {/* Visual Podium Section */}
          {podiumUsers.length > 0 && searchQuery === '' && (
            <div className="mb-12">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-1.5 justify-center">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                Líderes do Bolão
              </h2>
              
              {/* Podium container */}
              <div className="flex flex-col md:flex-row items-end justify-center gap-4 max-w-2xl mx-auto px-4">
                {renderPodiumOrder()?.map(({ user, originalIdx }) => {
                  const style = getPodiumColor(originalIdx);
                  const isMe = currentUser?.id === user.id;

                  // Dynamic live vs base points from database
                  const livePoints = user.livePoints || 0;
                  const basePoints = user.totalPoints - livePoints;

                  return (
                    <div
                      key={user.id}
                      className={`w-full md:w-1/3 bg-white border rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md ${style.border} ${
                        isMe ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                      } ${originalIdx === 0 ? 'order-1 md:order-2 z-10' : originalIdx === 1 ? 'order-2 md:order-1' : 'order-3'}`}
                    >
                      {/* Accent header */}
                      <div className={`h-1.5 w-full bg-gradient-to-r ${style.accent}`} />
                      
                      {/* Card Content */}
                      <div className="p-5 flex-1 flex flex-col items-center text-center">
                        <span className="text-3xl mb-2">{style.badge}</span>
                        <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-full">
                          {user.displayName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {style.title}
                        </span>

                        <div className="mt-4 flex flex-col items-center justify-center">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-900">{user.totalPoints}</span>
                            <span className="text-xs font-bold text-slate-400">pts</span>
                          </div>
                          {livePoints > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] bg-red-50 text-red-650 px-2 py-0.5 rounded-full font-bold animate-pulse">
                              <Zap className="h-2.5 w-2.5 fill-red-650" />
                              +{livePoints} ao vivo
                            </div>
                          )}
                        </div>

                        {/* Mini statistics */}
                        <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-50 text-slate-500 text-xs">
                          <div className="text-center">
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase">Exatos</span>
                            <span className="font-bold text-slate-800">{user.stats.exactScores}</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase">Acertos</span>
                            <span className="font-bold text-slate-800">{user.stats.correctResults}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Card Footer spot rank */}
                      <div className="bg-slate-50 border-t border-slate-100 py-2.5 text-center text-xs font-bold text-slate-500">
                        {isMe ? <span className="text-blue-600">Você</span> : `Posição #${originalIdx + 1}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50">
              <h3 className="font-extrabold text-slate-850 text-sm tracking-wider uppercase">Tabela de Classificação</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] tracking-wider uppercase select-none">
                    <th className="px-6 py-4 text-center w-16">Pós</th>
                    <th className="px-6 py-4">Participante</th>
                    <th className="px-4 py-4 text-center">Placares Exatos (5pts)</th>
                    <th className="px-4 py-4 text-center">Resultados (2-3pts)</th>
                    <th className="px-4 py-4 text-center">Pontos Base</th>
                    <th className="px-4 py-4 text-center">Pontos Live</th>
                    <th className="px-6 py-4 text-center font-extrabold text-slate-700 bg-slate-50/50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {/* Render podium users in table if filtered, otherwise render all */}
                  {filteredUsers.map((user, idx) => {
                    const rank = idx + 1;
                    const isMe = currentUser?.id === user.id;
                    
                    // Dynamic live vs base points from database
                    const livePoints = user.livePoints || 0;
                    const basePoints = user.totalPoints - livePoints;

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isMe ? 'bg-blue-50/20 font-medium' : ''
                        }`}
                      >
                        {/* Position */}
                        <td className="px-6 py-4 text-center">
                          {rank <= 3 ? (
                            <span className="text-base font-bold">
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="font-bold text-slate-400 text-xs">{rank}</span>
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-850">
                              {user.displayName}
                            </span>
                            {isMe && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-md">
                                VOCÊ
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Exact Scores stats */}
                        <td className="px-4 py-4 text-center text-slate-650">
                          <span className="bg-slate-100 font-bold px-2.5 py-1 rounded-lg text-xs text-slate-705">
                            {user.stats.exactScores}
                          </span>
                        </td>

                        {/* Correct Outcomes stats */}
                        <td className="px-4 py-4 text-center text-slate-500 font-semibold">
                          {user.stats.correctResults}
                        </td>

                        {/* Base Points */}
                        <td className="px-4 py-4 text-center text-slate-500 font-medium">
                          {basePoints}
                        </td>

                        {/* Live Points */}
                        <td className="px-4 py-4 text-center">
                          {livePoints > 0 ? (
                            <span className="text-red-600 font-bold text-xs bg-red-50 border border-red-100 px-2 py-0.5 rounded-full animate-pulse flex items-center justify-center gap-1 max-w-[70px] mx-auto">
                              <Zap className="h-3 w-3 fill-red-500" />
                              +{livePoints}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Total Points */}
                        <td className="px-6 py-4 text-center font-extrabold text-slate-900 bg-slate-50/35">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-base">{user.totalPoints}</span>
                            <span className="text-[10px] text-slate-400">pts</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        Nenhum participante encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
