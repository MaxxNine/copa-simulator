'use client';

import React, { useState, useEffect } from 'react';
import { Group, UserProfile } from '../types';
import { createGroup, joinGroup, getUserGroups, getLeaderboard } from '../lib/db';
import { Users, Plus, Key, Copy, Check, ChevronRight, Award, Trophy, UserPlus, AlertCircle, RefreshCw } from 'lucide-react';

interface GruposTabProps {
  currentUser: UserProfile | null;
}

export default function GruposTab({ currentUser }: GruposTabProps) {
  // State for user groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupLeaderboard, setGroupLeaderboard] = useState<UserProfile[]>([]);
  
  // Form states
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  
  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'my_groups' | 'create_join'>('my_groups');

  // Load user groups or seed mock groups
  useEffect(() => {
    async function loadGroups() {
      setIsLoading(true);
      try {
        if (currentUser) {
          const userGroups = await getUserGroups(currentUser.id);
          setGroups(userGroups);
          if (userGroups.length > 0) {
            setSelectedGroup(userGroups[0]);
          }
        } else {
          // Mock groups for presentation
          const mockGroups: Group[] = [
            {
              id: 'g1',
              name: 'Amigos do Futebol',
              creatorId: 'u1',
              inviteCode: 'HEXA26',
              members: ['u1', 'u2', 'u3', 'u4']
            },
            {
              id: 'g2',
              name: 'Turma do Trabalho',
              creatorId: 'u2',
              inviteCode: 'WORK26',
              members: ['u1', 'u2', 'u5']
            }
          ];
          setGroups(mockGroups);
          setSelectedGroup(mockGroups[0]);
        }
      } catch (err) {
        console.error('Error fetching groups:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadGroups();
  }, [currentUser]);

  // Load group leaderboard when selectedGroup changes
  useEffect(() => {
    async function loadLeaderboard() {
      if (!selectedGroup) return;
      setIsLeaderboardLoading(true);
      try {
        if (currentUser) {
          const board = await getLeaderboard(selectedGroup.id);
          setGroupLeaderboard(board);
        } else {
          // Mock ranking for selected mock groups
          const mockRanking: Record<string, UserProfile[]> = {
            'g1': [
              { id: 'u1', displayName: 'Gabriel Maxx', email: '', role: 'admin', totalPoints: 34, stats: { exactScores: 4, correctResults: 7 } },
              { id: 'u2', displayName: 'Alice Silva', email: '', role: 'user', totalPoints: 29, stats: { exactScores: 3, correctResults: 7 } },
              { id: 'u3', displayName: 'Bruno Santos', email: '', role: 'user', totalPoints: 28, stats: { exactScores: 2, correctResults: 9 } },
              { id: 'u4', displayName: 'Clara Costa', email: '', role: 'user', totalPoints: 24, stats: { exactScores: 2, correctResults: 7 } }
            ],
            'g2': [
              { id: 'u2', displayName: 'Alice Silva', email: '', role: 'user', totalPoints: 29, stats: { exactScores: 3, correctResults: 7 } },
              { id: 'u1', displayName: 'Gabriel Maxx', email: '', role: 'admin', totalPoints: 34, stats: { exactScores: 4, correctResults: 7 } },
              { id: 'u5', displayName: 'Diego Souza', email: '', role: 'user', totalPoints: 19, stats: { exactScores: 1, correctResults: 8 } }
            ]
          };
          
          // Sort mock rankings manually by points
          const ranking = (mockRanking[selectedGroup.id] || []).sort((a, b) => b.totalPoints - a.totalPoints);
          setGroupLeaderboard(ranking);
        }
      } catch (err) {
        console.error('Error loading group leaderboard:', err);
      } finally {
        setIsLeaderboardLoading(false);
      }
    }
    loadLeaderboard();
  }, [selectedGroup, currentUser]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setIsLoading(true);
    setMessage(null);
    try {
      if (currentUser) {
        const newGroup = await createGroup(createName, currentUser.id);
        setGroups(prev => [...prev, newGroup]);
        setSelectedGroup(newGroup);
        setMessage({ type: 'success', text: `Grupo "${createName}" criado com sucesso! Código: ${newGroup.inviteCode}` });
        setCreateName('');
        setActiveSubTab('my_groups');
      } else {
        // Mock creation
        const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newGroup: Group = {
          id: `g_${Date.now()}`,
          name: createName,
          creatorId: 'u1',
          inviteCode: mockCode,
          members: ['u1']
        };
        setGroups(prev => [...prev, newGroup]);
        setSelectedGroup(newGroup);
        setMessage({ type: 'success', text: `[MOCK] Grupo "${createName}" criado! Código: ${mockCode}` });
        setCreateName('');
        setActiveSubTab('my_groups');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao criar o grupo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setIsLoading(true);
    setMessage(null);
    try {
      if (currentUser) {
        const joined = await joinGroup(joinCode.toUpperCase(), currentUser.id);
        
        // Add to state if not already present
        setGroups(prev => {
          if (prev.some(g => g.id === joined.id)) return prev;
          return [...prev, joined];
        });
        setSelectedGroup(joined);
        setMessage({ type: 'success', text: `Você ingressou no grupo "${joined.name}"!` });
        setJoinCode('');
        setActiveSubTab('my_groups');
      } else {
        // Mock join
        const uppercaseCode = joinCode.toUpperCase().trim();
        if (uppercaseCode === 'WORLD26' || uppercaseCode === 'HEXA26' || uppercaseCode.length === 6) {
          const newGroup: Group = {
            id: `g_joined_${Date.now()}`,
            name: `Grupo Conectado (${uppercaseCode})`,
            creatorId: 'other_user',
            inviteCode: uppercaseCode,
            members: ['other_user', 'u1']
          };
          setGroups(prev => [...prev, newGroup]);
          setSelectedGroup(newGroup);
          setMessage({ type: 'success', text: `[MOCK] Ingressou no grupo do código ${uppercaseCode}!` });
          setJoinCode('');
          setActiveSubTab('my_groups');
        } else {
          throw new Error('Código do grupo inválido ou não encontrado.');
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Código do grupo não encontrado.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 bg-slate-50 min-h-screen pb-24">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="text-blue-600 h-8 w-8" />
          Grupos de Amigos
        </h1>
        <p className="text-slate-500 mt-1">
          Crie mini-ligas privadas ou junte-se aos grupos de seus amigos usando um código de convite.
        </p>
      </div>

      {/* Show warnings if not authenticated */}
      {!currentUser && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-extrabold text-amber-800">Modo de Visualização (Offline)</h4>
            <p className="text-xs text-amber-705 mt-1">
              Você não está logado. Os grupos abaixo são dados simulados. Faça login para salvar seus grupos na nuvem e convidar amigos reais.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {message && (
        <div className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-75 hover:opacity-100">Fechar</button>
        </div>
      )}

      {/* Tab Menu */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 mb-6 flex">
        <button
          onClick={() => setActiveSubTab('my_groups')}
          className={`flex-1 py-3 text-center rounded-xl text-sm font-semibold tracking-wide transition-all ${
            activeSubTab === 'my_groups'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Meus Grupos
        </button>
        <button
          onClick={() => setActiveSubTab('create_join')}
          className={`flex-1 py-3 text-center rounded-xl text-sm font-semibold tracking-wide transition-all ${
            activeSubTab === 'create_join'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Criar ou Entrar
        </button>
      </div>

      {activeSubTab === 'my_groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Groups Sidebar Selector */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lista de Grupos</h3>
            {groups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
                <Users className="mx-auto text-slate-350 h-8 w-8 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhum grupo ativo.</p>
                <button
                  onClick={() => setActiveSubTab('create_join')}
                  className="text-xs text-blue-600 font-bold hover:underline mt-2 block w-full"
                >
                  Criar ou Entrar agora
                </button>
              </div>
            ) : (
              groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between shadow-sm ${
                      isSelected
                        ? 'bg-white border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div>
                      <h4 className="font-extrabold text-slate-950 text-sm">{group.name}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase mt-1 block">
                        {group.members.length} membros
                      </span>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? 'text-blue-500 translate-x-0.5' : 'text-slate-400'}`} />
                  </button>
                );
              })
            )}
          </div>

          {/* Group details & Leaderboard */}
          <div className="lg:col-span-8">
            {selectedGroup ? (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Group Details Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{selectedGroup.name}</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Administrador: {selectedGroup.creatorId === currentUser?.id ? 'Você' : 'Outro usuário'}
                      </p>
                    </div>

                    {/* Invite Code Widget */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between gap-3 max-w-[200px] shadow-sm">
                      <div className="pl-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Código de Convite</span>
                        <span className="text-sm font-extrabold text-slate-800 tracking-wider font-mono">{selectedGroup.inviteCode}</span>
                      </div>
                      <button
                        onClick={() => handleCopyCode(selectedGroup.inviteCode)}
                        className={`p-2 rounded-xl border transition-all ${
                          copiedCode
                            ? 'bg-green-50 border-green-200 text-green-600'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Group Ranking Table */}
                <div className="p-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Classificação do Grupo
                  </h3>

                  {isLeaderboardLoading ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <RefreshCw className="animate-spin text-blue-600 h-6 w-6 mb-2" />
                      <p className="text-xs text-slate-500">Atualizando classificação do grupo...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] tracking-wider uppercase select-none">
                            <th className="py-3 px-2 text-center w-12">#</th>
                            <th className="py-3 px-3">Nome</th>
                            <th className="py-3 px-2 text-center">Exatos</th>
                            <th className="py-3 px-2 text-center">Pontos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {groupLeaderboard.map((member, index) => {
                            const isMe = member.id === currentUser?.id;
                            const isFirst = index === 0;

                            return (
                              <tr
                                key={member.id}
                                className={`hover:bg-slate-55/20 transition-colors ${
                                  isMe ? 'bg-blue-50/25 font-semibold' : ''
                                }`}
                              >
                                {/* Pos */}
                                <td className="py-4 px-2 text-center font-bold text-xs">
                                  {isFirst ? (
                                    <span className="text-sm">👑</span>
                                  ) : (
                                    <span className="text-slate-400">{index + 1}</span>
                                  )}
                                </td>
                                
                                {/* Name */}
                                <td className="py-4 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-800">{member.displayName}</span>
                                    {isMe && (
                                      <span className="text-[8px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded-sm">
                                        VOCÊ
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Stats */}
                                <td className="py-4 px-2 text-center text-xs font-bold text-slate-600">
                                  {member.stats?.exactScores || 0}
                                </td>

                                {/* Points */}
                                <td className="py-4 px-2 text-center font-extrabold text-slate-900">
                                  {member.totalPoints} <span className="text-[10px] font-normal text-slate-400">pts</span>
                                </td>
                              </tr>
                            );
                          })}
                          {groupLeaderboard.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                                Nenhum membro neste grupo.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
                <Users className="mx-auto text-slate-300 h-12 w-12 mb-4" />
                <h3 className="text-base font-extrabold text-slate-850">Nenhum Grupo Selecionado</h3>
                <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
                  Selecione um grupo na barra lateral ou vá em "Criar ou Entrar" para começar a jogar com amigos.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {activeSubTab === 'create_join' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Create Group Form */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Criar Novo Grupo</h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Gere um novo grupo de palpites e obtenha um código exclusivo para enviar aos seus amigos.
              </p>
              <form onSubmit={handleCreateGroup} className="mt-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Nome do Grupo</label>
                <input
                  type="text"
                  placeholder="Ex: Resenha da Quarta, Família..."
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  required
                />
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-2xl text-sm mt-6 hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
                >
                  <Users className="h-4.5 w-4.5" />
                  Criar e Gerar Código
                </button>
              </form>
            </div>
          </div>

          {/* Join Group Form */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-650 mb-6">
                <Key className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Ingressar com Código</h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Você recebeu um código de convite? Cole-o abaixo para entrar imediatamente no grupo do seu amigo.
              </p>

              <form onSubmit={handleJoinGroup} className="mt-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Código do Grupo</label>
                <input
                  type="text"
                  placeholder="Cole o código aqui (Ex: HEXA26)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:bg-white focus:border-blue-500 transition-colors uppercase placeholder-normal"
                  required
                />
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 text-white font-bold py-3.5 px-4 rounded-2xl text-sm mt-6 hover:bg-slate-800 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-4.5 w-4.5" />
                  Ingressar no Grupo
                </button>
              </form>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
