'use client';

import React, { useState } from 'react';
import { Match, UserProfile } from '../types';
import { Play, Square, Plus, ShieldAlert, Sparkles, RefreshCw, CheckCircle } from 'lucide-react';
import {
  updateMatchInSingleDoc,
  createKnockoutMatchInSingleDoc,
  startMatchWithSnapshot,
  finalizeMatchAndRecalculate
} from '../lib/db';

interface AdminTabProps {
  currentUser: UserProfile | null;
  matches: Match[];
  onMatchesUpdated?: () => void;
}

const MOCK_MATCHES: Match[] = [
  { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Suíça', homeFlag: '🇧🇷', awayFlag: '🇨🇭', group: 'Group G', matchday: 1, date: '2026-06-11T16:00:00Z', status: 'finished', homeScore: 2, awayScore: 0 },
  { id: 'm2', homeTeam: 'Espanha', awayTeam: 'Alemanha', homeFlag: '🇪🇸', awayFlag: '🇩🇪', group: 'Group E', matchday: 1, date: '2026-06-11T19:00:00Z', status: 'live', homeScore: 1, awayScore: 1 },
  { id: 'm3', homeTeam: 'EUA', awayTeam: 'México', homeFlag: '🇺🇸', awayFlag: '🇲🇽', group: 'Group A', matchday: 1, date: '2026-06-12T13:00:00Z', status: 'scheduled' },
  { id: 'm4', homeTeam: 'França', awayTeam: 'Dinamarca', homeFlag: '🇫🇷', awayFlag: '🇩🇰', group: 'Group D', matchday: 1, date: '2026-06-12T16:00:00Z', status: 'scheduled' },
];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminTab({ currentUser, matches: initialMatches, onMatchesUpdated }: AdminTabProps) {
  const [localMatches, setLocalMatches] = useState<Match[]>(MOCK_MATCHES);
  const matches = initialMatches.length > 0 ? initialMatches : localMatches;
  const [activeTab, setActiveTab] = useState<'scores' | 'knockout'>('scores');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // New Knockout Match Form State
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeFlag, setHomeFlag] = useState('🏳️');
  const [awayFlag, setAwayFlag] = useState('🏳️');
  const [matchday, setMatchday] = useState(4); // default: Round of 32
  const [matchDate, setMatchDate] = useState('2026-06-25T18:00');
  
  // Status states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Clean messaging
  const showMessage = (type: 'success' | 'error', text: string) => {
    setAdminMessage({ type, text });
    setTimeout(() => setAdminMessage(null), 5000);
  };

  // 1. Update status to LIVE
  const handleStartMatch = async (matchId: string) => {
    setActionLoading(prev => ({ ...prev, [matchId]: true }));
    try {
      if (currentUser?.role === 'admin') {
        await startMatchWithSnapshot(matchId);
        showMessage('success', 'Partida iniciada ao vivo!');
        if (onMatchesUpdated) onMatchesUpdated();
      } else {
        // Mock UI Update
        setLocalMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'live', homeScore: 0, awayScore: 0 } : m));
        showMessage('success', '[MOCK] Partida iniciada ao vivo com placar 0x0!');
      }
    } catch (error: unknown) {
      showMessage('error', getErrorMessage(error, 'Erro ao iniciar partida.'));
    } finally {
      setActionLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // 2. Adjust live match goals
  const handleAdjustGoal = async (matchId: string, side: 'home' | 'away', amount: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const currentScore = side === 'home' ? (match.homeScore ?? 0) : (match.awayScore ?? 0);
    const newScore = Math.max(0, currentScore + amount);
    
    setActionLoading(prev => ({ ...prev, [`${matchId}_score`]: true }));
    try {
      if (currentUser?.role === 'admin') {
        await updateMatchInSingleDoc(matchId, {
          [side === 'home' ? 'homeScore' : 'awayScore']: newScore
        });
        if (onMatchesUpdated) onMatchesUpdated();
      } else {
        // Mock UI Update
        setLocalMatches(prev => prev.map(m => {
          if (m.id === matchId) {
            return {
              ...m,
              [side === 'home' ? 'homeScore' : 'awayScore']: newScore
            };
          }
          return m;
        }));
      }
    } catch (error: unknown) {
      showMessage('error', getErrorMessage(error, 'Erro ao atualizar gols.'));
    } finally {
      setActionLoading(prev => ({ ...prev, [`${matchId}_score`]: false }));
    }
  };

  // 3. Finalize match (lock score, trigger point calculations if admin)
  const handleFinalizeMatch = async (matchId: string) => {
    setActionLoading(prev => ({ ...prev, [matchId]: true }));
    try {
      if (currentUser?.role === 'admin') {
        await finalizeMatchAndRecalculate(matchId);

        showMessage('success', 'Partida finalizada! Placar gravado com sucesso e pontuações recalculadas.');
        if (onMatchesUpdated) onMatchesUpdated();
      } else {
        // Mock UI update
        setLocalMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'finished' } : m));
        showMessage('success', '[MOCK] Partida finalizada! Pontos dos palpites calculados.');
      }
    } catch (error: unknown) {
      showMessage('error', getErrorMessage(error, 'Erro ao finalizar partida.'));
    } finally {
      setActionLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // 4. Create new knockout stage match
  const handleCreateKnockout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim()) return;

    const matchId = `match_knockout_${matchday}_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${awayTeam.toLowerCase().replace(/\s+/g, '_')}`;
    const dateIso = new Date(matchDate).toISOString();

    const phaseName = 
      matchday === 4 ? 'Round of 32' :
      matchday === 5 ? 'Round of 16' :
      matchday === 6 ? 'Quarter-finals' :
      matchday === 7 ? 'Semi-finals' :
      matchday === 8 ? 'Final' : 'Knockout Stage';

    const newMatch: Match = {
      id: matchId,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeFlag,
      awayFlag,
      group: 'Mata-Mata',
      matchday,
      date: dateIso,
      status: 'scheduled'
    };

    setActionLoading(prev => ({ ...prev, create: true }));
    try {
      if (currentUser?.role === 'admin') {
        await createKnockoutMatchInSingleDoc(newMatch);
        showMessage('success', `Partida de Mata-Mata (${phaseName}) criada com sucesso!`);
        if (onMatchesUpdated) onMatchesUpdated();
      } else {
        // Mock UI Update
        setLocalMatches(prev => [...prev, newMatch]);
        showMessage('success', `[MOCK] Partida criada: ${homeTeam} vs ${awayTeam} no Mata-Mata!`);
      }
      // Reset form
      setHomeTeam('');
      setAwayTeam('');
      setHomeFlag('🏳️');
      setAwayFlag('🏳️');
      setActiveTab('scores');
    } catch (error: unknown) {
      showMessage('error', getErrorMessage(error, 'Erro ao criar partida.'));
    } finally {
      setActionLoading(prev => ({ ...prev, create: false }));
    }
  };

  // Filters matches for display
  const filteredMatches = matches.filter(m => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = m.homeTeam.toLowerCase().includes(query) || m.awayTeam.toLowerCase().includes(query) || m.group.toLowerCase().includes(query);
    
    if (statusFilter === 'all') return matchesQuery;
    return matchesQuery && m.status === statusFilter;
  });

  // Helper for phase selector label
  const getMatchdayLabel = (md: number) => {
    switch(md) {
      case 1: return 'Grupo - Rodada 1';
      case 2: return 'Grupo - Rodada 2';
      case 3: return 'Grupo - Rodada 3';
      case 4: return 'Mata-Mata (16avos)';
      case 5: return 'Mata-Mata (Oitavas)';
      case 6: return 'Mata-Mata (Quartas)';
      case 7: return 'Mata-Mata (Semifinais)';
      case 8: return 'Mata-Mata (Final)';
      default: return `Fase ${md}`;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 bg-slate-50 min-h-screen pb-24">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-red-600 h-8 w-8" />
            Painel Administrativo
          </h1>
          <p className="text-slate-500 mt-1">
            Controle de partidas, gerenciamento de placares ao vivo e chaveamento da Copa 2026.
          </p>
        </div>

        {/* Status Notification banner if not admin */}
        {currentUser?.role !== 'admin' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-amber-800 text-xs font-bold flex items-center gap-1.5 shadow-sm max-w-xs">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>Modo de Teste: Ações salvam apenas localmente.</span>
          </div>
        )}
      </div>

      {/* Admin messaging */}
      {adminMessage && (
        <div className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between ${
          adminMessage.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            <span>{adminMessage.text}</span>
          </div>
        </div>
      )}

      {/* Tab Selectors */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 mb-6 flex">
        <button
          onClick={() => setActiveTab('scores')}
          className={`flex-1 py-3 text-center rounded-xl text-sm font-semibold tracking-wide transition-all ${
            activeTab === 'scores'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
          }`}
        >
          Placares ao Vivo & Resultados
        </button>
        <button
          onClick={() => setActiveTab('knockout')}
          className={`flex-1 py-3 text-center rounded-xl text-sm font-semibold tracking-wide transition-all ${
            activeTab === 'knockout'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
          }`}
        >
          Criar Jogo (Mata-Mata)
        </button>
      </div>

      {activeTab === 'scores' && (
        <div className="space-y-6">
          {/* Filters Row */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <input
              type="text"
              placeholder="Buscar por seleção..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-500"
            />
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
              {[
                { id: 'all', label: 'Todos os status' },
                { id: 'scheduled', label: 'Agendados' },
                { id: 'live', label: 'Ao Vivo' },
                { id: 'finished', label: 'Encerrados' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold border whitespace-nowrap transition-all ${
                    statusFilter === filter.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-350'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matches Panel List */}
          <div className="space-y-4">
            {filteredMatches.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-slate-500 font-semibold">Nenhuma partida atende aos filtros atuais.</p>
              </div>
            ) : (
              filteredMatches.map((match) => {
                const isLoadingStart = actionLoading[match.id] || false;
                const isLoadingScore = actionLoading[`${match.id}_score`] || false;

                return (
                  <div
                    key={match.id}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow"
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {match.group === 'Mata-Mata' ? getMatchdayLabel(match.matchday) : match.group.replace('Group ', 'Grupo ')}
                        </span>
                        <span className="text-xs text-slate-450 font-medium">
                          {new Date(match.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        {match.status === 'scheduled' && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                            Agendado
                          </span>
                        )}
                        {match.status === 'locking' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-bold">
                            Fechando palpites
                          </span>
                        )}
                        {match.status === 'live' && (
                          <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-bold animate-pulse">
                            Ao Vivo
                          </span>
                        )}
                        {match.status === 'finished' && (
                          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-bold">
                            Finalizado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Match Score Editor */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      
                      {/* Left: Score board */}
                      <div className="flex items-center justify-center gap-6 flex-1 max-w-lg">
                        {/* Home team name + flag */}
                        <div className="flex items-center gap-3 w-1/3 justify-end text-right">
                          <span className="text-sm font-extrabold text-slate-800 truncate">{match.homeTeam}</span>
                          <span className="text-2xl filter drop-shadow-sm select-none">{match.homeFlag}</span>
                        </div>

                        {/* Middle score box */}
                        <div className="flex items-center gap-3">
                          {match.status === 'live' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdjustGoal(match.id, 'home', -1)}
                                disabled={isLoadingScore}
                                className="h-7 w-7 bg-slate-100 rounded-lg font-bold flex items-center justify-center text-slate-600 hover:bg-slate-200"
                              >
                                -
                              </button>
                              <span className="text-2xl font-black text-slate-900 w-8 text-center">
                                {match.homeScore ?? 0}
                              </span>
                              <button
                                onClick={() => handleAdjustGoal(match.id, 'home', 1)}
                                disabled={isLoadingScore}
                                className="h-7 w-7 bg-slate-100 rounded-lg font-bold flex items-center justify-center text-slate-600 hover:bg-slate-200"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-2xl font-black text-slate-800">
                              {match.homeScore !== undefined ? match.homeScore : '-'}
                            </span>
                          )}

                          <span className="text-slate-400 font-bold">x</span>

                          {match.status === 'live' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdjustGoal(match.id, 'away', -1)}
                                disabled={isLoadingScore}
                                className="h-7 w-7 bg-slate-100 rounded-lg font-bold flex items-center justify-center text-slate-600 hover:bg-slate-200"
                              >
                                -
                              </button>
                              <span className="text-2xl font-black text-slate-900 w-8 text-center">
                                {match.awayScore ?? 0}
                              </span>
                              <button
                                onClick={() => handleAdjustGoal(match.id, 'away', 1)}
                                disabled={isLoadingScore}
                                className="h-7 w-7 bg-slate-100 rounded-lg font-bold flex items-center justify-center text-slate-600 hover:bg-slate-200"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-2xl font-black text-slate-800">
                              {match.awayScore !== undefined ? match.awayScore : '-'}
                            </span>
                          )}
                        </div>

                        {/* Away team flag + name */}
                        <div className="flex items-center gap-3 w-1/3 justify-start">
                          <span className="text-2xl filter drop-shadow-sm select-none">{match.awayFlag}</span>
                          <span className="text-sm font-extrabold text-slate-800 truncate">{match.awayTeam}</span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex justify-center md:justify-end gap-2 shrink-0">
                        {(match.status === 'scheduled' || match.status === 'locking') && (
                          <button
                            onClick={() => handleStartMatch(match.id)}
                            disabled={isLoadingStart}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm hover:shadow flex items-center gap-1.5 transition-all"
                          >
                            <Play className="h-3.5 w-3.5 fill-white" />
                            {match.status === 'locking' ? 'Retomar Início' : 'Iniciar Jogo'}
                          </button>
                        )}
                        {match.status === 'live' && (
                          <button
                            onClick={() => handleFinalizeMatch(match.id)}
                            disabled={isLoadingStart}
                            className="bg-red-650 hover:bg-red-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm hover:shadow flex items-center gap-1.5 transition-all"
                          >
                            <Square className="h-3.5 w-3.5 fill-white" />
                            Finalizar Jogo
                          </button>
                        )}
                        {match.status === 'finished' && (
                          <button
                            onClick={() => handleFinalizeMatch(match.id)}
                            disabled={isLoadingStart}
                            className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                          >
                            <RefreshCw className={isLoadingStart ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                            Recalcular Pontos
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'knockout' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8">
          <h3 className="text-base font-extrabold text-slate-850 mb-6 flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            Cadastrar Partida Mata-Mata
          </h3>

          <form onSubmit={handleCreateKnockout} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Home Team */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Seleção da Casa (Home)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Argentina"
                    value={homeTeam}
                    onChange={(e) => setHomeTeam(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                    required
                  />
                  <input
                    type="text"
                    placeholder="🇦🇷"
                    value={homeFlag}
                    onChange={(e) => setHomeFlag(e.target.value)}
                    className="w-16 text-center text-xl px-2 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                    maxLength={4}
                  />
                </div>
              </div>

              {/* Away Team */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Seleção Visitante (Away)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Brasil"
                    value={awayTeam}
                    onChange={(e) => setAwayTeam(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                    required
                  />
                  <input
                    type="text"
                    placeholder="🇧🇷"
                    value={awayFlag}
                    onChange={(e) => setAwayFlag(e.target.value)}
                    className="w-16 text-center text-xl px-2 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phase */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Fase do Mata-Mata</label>
                <select
                  value={matchday}
                  onChange={(e) => setMatchday(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                >
                  <option value={4}>Round of 32 (16avos de Final)</option>
                  <option value={5}>Round of 16 (Oitavas de Final)</option>
                  <option value={6}>Quarter-finals (Quartas de Final)</option>
                  <option value={7}>Semi-finals (Semifinais)</option>
                  <option value={8}>Final (Grande Final)</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Data e Horário</label>
                <input
                  type="datetime-local"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Create Button */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading['create'] || false}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl text-sm shadow-md shadow-blue-500/10 active:scale-[0.99] transition-all flex items-center gap-1.5"
              >
                {actionLoading['create'] ? (
                  <RefreshCw className="animate-spin h-4 w-4" />
                ) : (
                  <Plus className="h-4.5 w-4.5" />
                )}
                {actionLoading['create'] ? 'Criando...' : 'Criar Partida de Mata-Mata'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
