'use client';

import React, { useState, useEffect } from 'react';
import { Match, Prediction, UserProfile } from '../types';
import { calculatePoints } from '../utils/points';
import { Calendar, Search, Award, Check, RefreshCw, ChevronRight, AlertCircle, Plus, Minus, Lock, Unlock, Users } from 'lucide-react';
import { savePrediction, getUserPredictions, getUserGroups, getGroupMembers, getFriendPredictionForMatch } from '../lib/db';
import { generateGroupStageMatches } from '../utils/seeds/matchesSeed';

interface PalpitesTabProps {
  currentUser: UserProfile | null;
  matches: Match[];
  predictions: Record<string, Prediction>;
  onPredictionSaved?: (matchId: string, homeScore: number, awayScore: number, locked?: boolean) => void;
  isLoading?: boolean;
}

export default function PalpitesTab({
  currentUser,
  matches: initialMatches,
  predictions: initialPredictions,
  onPredictionSaved,
  isLoading: externalLoading = false,
}: PalpitesTabProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [activeTab, setActiveTab] = useState<number>(1); // 1, 2, 3 for group stage, 4 for Mata-Mata
  const [selectedGroup, setSelectedGroup] = useState<string>('Todos');
  const [localScores, setLocalScores] = useState<Record<string, { home: number; away: number }>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  // Group friends predictions states
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [expandedMatchPredictions, setExpandedMatchPredictions] = useState<Record<string, boolean>>({});
  const [friendPredictions, setFriendPredictions] = useState<Record<string, Record<string, Prediction | null>>>({});
  const [loadingFriendPreds, setLoadingFriendPreds] = useState<Record<string, boolean>>({});

  // Confirmation Modal State
  const [lockConfirmModal, setLockConfirmModal] = useState<{
    isOpen: boolean;
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    homeScore: number;
    awayScore: number;
  } | null>(null);

  const promptLockMatch = (match: Match) => {
    const score = localScores[match.id] || { home: 0, away: 0 };
    setLockConfirmModal({
      isOpen: true,
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeFlag: match.homeFlag,
      awayFlag: match.awayFlag,
      homeScore: score.home,
      awayScore: score.away
    });
  };

  // Load friends (members of groups user belongs to)
  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUser) return;
      setLoadingFriends(true);
      try {
        const groups = await getUserGroups(currentUser.id);
        const membersMap: Record<string, UserProfile> = {};
        for (const grp of groups) {
          const members = await getGroupMembers(grp.id);
          members.forEach((m) => {
            if (m.id !== currentUser.id) {
              membersMap[m.id] = m;
            }
          });
        }
        setFriends(Object.values(membersMap));
      } catch (err) {
        console.error('Error loading friends list:', err);
      } finally {
        setLoadingFriends(false);
      }
    };
    loadFriends();
  }, [currentUser]);

  // Toggle show/hide of friend predictions
  const toggleMatchPredictions = async (matchId: string) => {
    const isCurrentlyExpanded = expandedMatchPredictions[matchId];
    
    // Toggle
    setExpandedMatchPredictions(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));

    // If expanding and we haven't loaded predictions for this match yet
    if (!isCurrentlyExpanded && !friendPredictions[matchId] && friends.length > 0) {
      setLoadingFriendPreds(prev => ({ ...prev, [matchId]: true }));
      try {
        const preds: Record<string, Prediction | null> = {};
        await Promise.all(
          friends.map(async (friend) => {
            const pred = await getFriendPredictionForMatch(friend.id, matchId);
            preds[friend.id] = pred;
          })
        );
        setFriendPredictions(prev => ({
          ...prev,
          [matchId]: preds
        }));
      } catch (err) {
        console.error('Error loading friend predictions:', err);
      } finally {
        setLoadingFriendPreds(prev => ({ ...prev, [matchId]: false }));
      }
    }
  };

  // Populate state with props or fallback mock data
  useEffect(() => {
    if (initialMatches && initialMatches.length > 0) {
      setMatches(initialMatches);
    } else {
      // Load generated Portuguese group stage matches as mock if none provided
      const mockMatches = generateGroupStageMatches();
      setMatches(mockMatches);
    }
  }, [initialMatches]);

  useEffect(() => {
    if (initialPredictions && Object.keys(initialPredictions).length > 0) {
      setPredictions(initialPredictions);
      // Initialize local scores
      const scores: Record<string, { home: number; away: number }> = {};
      Object.entries(initialPredictions).forEach(([matchId, pred]) => {
        scores[matchId] = { home: pred.homeScore, away: pred.awayScore };
      });
      setLocalScores(scores);
    } else {
      // Mock empty predictions
      setPredictions({});
      setLocalScores({});
    }
  }, [initialPredictions]);

  // Adjust score handlers
  const handleScoreChange = (matchId: string, side: 'home' | 'away', amount: number) => {
    setLocalScores(prev => {
      const current = prev[matchId] || { home: 0, away: 0 };
      const newValue = Math.max(0, current[side] + amount);
      return {
        ...prev,
        [matchId]: {
          ...current,
          [side]: newValue
        }
      };
    });
    // Set status back to idle if they modify it
    if (savingStatus[matchId] === 'saved' || savingStatus[matchId] === 'error') {
      setSavingStatus(prev => ({ ...prev, [matchId]: 'idle' }));
    }
  };

  const handleInputChange = (matchId: string, side: 'home' | 'away', val: string) => {
    const parsed = parseInt(val, 10);
    const scoreVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setLocalScores(prev => {
      const current = prev[matchId] || { home: 0, away: 0 };
      return {
        ...prev,
        [matchId]: {
          ...current,
          [side]: scoreVal
        }
      };
    });
    if (savingStatus[matchId] === 'saved' || savingStatus[matchId] === 'error') {
      setSavingStatus(prev => ({ ...prev, [matchId]: 'idle' }));
    }
  };

  const handleSave = async (matchId: string, lock?: boolean) => {
    const score = localScores[matchId] || { home: 0, away: 0 };
    
    setSavingStatus(prev => ({ ...prev, [matchId]: 'saving' }));

    try {
      if (currentUser) {
        // Save to Firebase using db function
        await savePrediction(currentUser.id, matchId, score.home, score.away, lock);
        if (onPredictionSaved) {
          onPredictionSaved(matchId, score.home, score.away, lock || predictions[matchId]?.locked);
        }
      } else {
        // Mock save if not logged in
        console.log(`Mock save prediction for match ${matchId}: ${score.home} - ${score.away} (locked: ${lock})`);
      }

      setSavingStatus(prev => ({ ...prev, [matchId]: 'saved' }));
      // Keep "Saved" state for 2.5 seconds, then go back to idle
      setTimeout(() => {
        setSavingStatus(prev => {
          if (prev[matchId] === 'saved') {
            return { ...prev, [matchId]: 'idle' };
          }
          return prev;
        });
      }, 2500);
    } catch (error) {
      console.error(error);
      setSavingStatus(prev => ({ ...prev, [matchId]: 'error' }));
    }
  };

  // Group list A to L
  const groupsList = ['Todos', 'Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F', 'Grupo G', 'Grupo H', 'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'];

  // Filter matches based on active tab and selected group
  const filteredMatches = matches.filter(match => {
    // Check matchday tab
    const matchdayMatch = activeTab === 4 
      ? match.matchday >= 4 
      : match.matchday === activeTab;
    
    // Check group
    const groupMatch = selectedGroup === 'Todos' || match.group === selectedGroup;
    
    return matchdayMatch && groupMatch;
  });

  // Helper to format date
  const formatMatchTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 bg-slate-50 min-h-screen pb-24">
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="text-blue-600 h-8 w-8" />
            Meus Palpites
          </h1>
          <p className="text-slate-500 mt-1">Palpite nos placares dos jogos. Pontuação atualizada em tempo real!</p>
        </div>
        
        {currentUser && (
          <div className="mt-4 md:mt-0 bg-white shadow-sm border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pontuação Total</p>
              <p className="text-xl font-bold text-slate-900">{currentUser.totalPoints} pts</p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Placares Cheios</p>
              <p className="text-xl font-bold text-blue-600">{currentUser.stats?.exactScores || 0}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 mb-6 flex overflow-x-auto whitespace-nowrap scrollbar-none">
        {[
          { id: 1, label: 'Rodada 1' },
          { id: 2, label: 'Rodada 2' },
          { id: 3, label: 'Rodada 3' },
          { id: 4, label: 'Mata-Mata' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold tracking-wide transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Group Quick Filter */}
      {activeTab < 4 && (
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Filtrar por Grupo</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {groupsList.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`py-1.5 px-4 rounded-full text-xs font-semibold border transition-all ${
                  selectedGroup === g
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matches Grid/List */}
      {externalLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <RefreshCw className="animate-spin text-blue-600 h-10 w-10 mb-4" />
          <p className="text-slate-500 font-medium">Carregando partidas...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm px-6">
          <AlertCircle className="mx-auto text-slate-300 h-12 w-12 mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Nenhum jogo encontrado</h3>
          <p className="text-slate-500 mt-1 max-w-md mx-auto">Não há partidas agendadas para esta seleção de filtros no momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => {
            const pred = predictions[match.id];
            const score = localScores[match.id] || { home: 0, away: 0 };
            const status = savingStatus[match.id] || 'idle';
            const isFinished = match.status === 'finished';
            const isLive = match.status === 'live';
            const isLockedBySelf = pred?.locked === true;
            const isDisabled = isFinished || isLive || isLockedBySelf;

            // Calculate live/earned points if possible
            let pointsText = null;
            if (isFinished && pred) {
              const pts = calculatePoints(pred.homeScore, pred.awayScore, match.homeScore || 0, match.awayScore || 0);
              pointsText = (
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  pts === 5 ? 'bg-green-100 text-green-700' :
                  pts >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  +{pts} pts
                </span>
              );
            } else if (isLive && pred) {
              const pts = calculatePoints(pred.homeScore, pred.awayScore, match.homeScore || 0, match.awayScore || 0);
              pointsText = (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md animate-pulse">
                  +{pts} pts (Live)
                </span>
              );
            }

            return (
              <div
                key={match.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5 md:p-6"
              >
                {/* Match Info Header */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                      {match.group.replace('Group ', 'Grupo ')}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {formatMatchTime(match.date)}
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {pointsText}
                    {isFinished && (
                      <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                        Encerrado
                      </span>
                    )}
                    {isLive && (
                      <span className="text-xs font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                        Ao Vivo
                      </span>
                    )}
                    {match.status === 'scheduled' && !isLockedBySelf && (
                      <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-full border border-green-200/50">
                        Aberto
                      </span>
                    )}
                    {match.status === 'scheduled' && isLockedBySelf && (
                      <span className="text-xs font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full border border-amber-200/50 flex items-center gap-1 select-none">
                        <Lock className="h-3 w-3" /> Trancado
                      </span>
                    )}
                  </div>
                </div>

                {/* Score Predictor Area */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  
                  {/* Home Team */}
                  <div className="col-span-1 md:col-span-4 flex items-center justify-between md:justify-end gap-3 order-1">
                    <span className="text-base font-bold text-slate-800 order-2 md:order-1">{match.homeTeam}</span>
                    <span className="text-2xl md:text-3xl order-1 md:order-2 filter drop-shadow-sm select-none">{match.homeFlag}</span>
                  </div>

                  {/* Input Fields / Score display */}
                  <div className="col-span-1 md:col-span-4 flex items-center justify-center gap-3 py-2 order-3 md:order-2">
                    {/* Home Input Control */}
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                      {!isDisabled && (
                        <button
                          onClick={() => handleScoreChange(match.id, 'home', -1)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <input
                        type="number"
                        min="0"
                        disabled={isDisabled}
                        value={score.home}
                        onChange={(e) => handleInputChange(match.id, 'home', e.target.value)}
                        className="w-12 text-center font-extrabold text-lg text-slate-800 bg-transparent focus:outline-none disabled:opacity-85 select-none"
                      />
                      {!isDisabled && (
                        <button
                          onClick={() => handleScoreChange(match.id, 'home', 1)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Separator / Real Score If Live/Finished */}
                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-slate-400 font-bold text-sm">x</span>
                      {(isLive || isFinished) && (match.homeScore !== undefined && match.awayScore !== undefined) && (
                        <div className="absolute -mt-10 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">
                          Real: {match.homeScore} - {match.awayScore}
                        </div>
                      )}
                    </div>

                    {/* Away Input Control */}
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                      {!isDisabled && (
                        <button
                          onClick={() => handleScoreChange(match.id, 'away', -1)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <input
                        type="number"
                        min="0"
                        disabled={isDisabled}
                        value={score.away}
                        onChange={(e) => handleInputChange(match.id, 'away', e.target.value)}
                        className="w-12 text-center font-extrabold text-lg text-slate-800 bg-transparent focus:outline-none disabled:opacity-85 select-none"
                      />
                      {!isDisabled && (
                        <button
                          onClick={() => handleScoreChange(match.id, 'away', 1)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="col-span-1 md:col-span-4 flex items-center justify-between md:justify-start gap-3 order-2 md:order-3">
                    <span className="text-2xl md:text-3xl filter drop-shadow-sm select-none">{match.awayFlag}</span>
                    <span className="text-base font-bold text-slate-800">{match.awayTeam}</span>
                  </div>

                </div>

                {/* Buttons section for scheduled & unlocked matches */}
                {!isDisabled && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                    {/* Collapsible predictions button */}
                    {friends.length > 0 ? (
                      <button
                        onClick={() => toggleMatchPredictions(match.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        👥 Palpites do Grupo
                        <ChevronRight className={`h-3 w-3 transform transition-transform ${expandedMatchPredictions[match.id] ? 'rotate-90' : ''}`} />
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(match.id, false)}
                        disabled={status === 'saving'}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 border ${
                          status === 'saving'
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                            : status === 'saved'
                            ? 'bg-green-600 text-white border-green-600 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                        }`}
                      >
                        {status === 'saving' && <RefreshCw className="animate-spin h-3.5 w-3.5" />}
                        {status === 'saved' && <Check className="h-3.5 w-3.5" />}
                        {status === 'saving' ? 'Salvando...' : status === 'saved' ? 'Salvo!' : 'Salvar Rascunho'}
                      </button>

                      <button
                        onClick={() => promptLockMatch(match)}
                        disabled={status === 'saving'}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/10 cursor-pointer"
                      >
                        Trancar 🔒
                      </button>
                    </div>
                  </div>
                )}

                {/* Legend / Info for closed or locked matches */}
                {isDisabled && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>
                        {pred ? (
                          <p className="font-medium">
                            Seu palpite: <strong className="text-slate-800 font-bold">{pred.homeScore} - {pred.awayScore}</strong>
                            {isLockedBySelf && !isFinished && !isLive && (
                              <span className="ml-2 font-semibold text-amber-605 bg-amber-50 border border-amber-100/50 px-2.5 py-0.5 rounded-md select-none inline-flex items-center gap-1">
                                <Lock className="h-3 w-3" /> Trancado
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-red-500 font-semibold">Sem palpite registrado.</p>
                        )}
                      </div>

                      {friends.length > 0 && (
                        <button
                          onClick={() => toggleMatchPredictions(match.id)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          👥 Palpites do Grupo
                          <ChevronRight className={`h-3 w-3 transform transition-transform ${expandedMatchPredictions[match.id] ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Expanded Group Predictions list */}
                {expandedMatchPredictions[match.id] && (
                  <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-xl p-3 text-slate-850">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Palpites dos Amigos
                      </h4>
                      {!isLockedBySelf && !isFinished && !isLive && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                          Modo Anti-Cola Ativo 🛡️
                        </span>
                      )}
                    </div>

                    {loadingFriendPreds[match.id] ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <RefreshCw className="animate-spin h-3.5 w-3.5 text-blue-600" />
                        Carregando palpites...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {friends.map((friend) => {
                          const fPred = friendPredictions[match.id]?.[friend.id];
                          const hasUserLocked = pred?.locked === true;
                          const isMatchClosed = isFinished || isLive;
                          
                          let displayValue = "";
                          let badgeStyle = "text-slate-500 bg-slate-100";
                          
                          if (isMatchClosed || (hasUserLocked && fPred?.locked)) {
                            if (fPred) {
                              displayValue = `${fPred.homeScore} x ${fPred.awayScore}`;
                              badgeStyle = "text-slate-850 bg-blue-50 font-bold border border-blue-150/50";
                            } else {
                              displayValue = "Sem palpite";
                              badgeStyle = "text-slate-400 italic bg-slate-100";
                            }
                          } else {
                            if (!hasUserLocked) {
                              displayValue = "🔒 Tranque o seu primeiro";
                              badgeStyle = "text-amber-700 bg-amber-50 border border-amber-100/60 font-semibold";
                            } else {
                              displayValue = "🔒 Amigo não trancou";
                              badgeStyle = "text-slate-450 bg-slate-100/60 border border-slate-200/50";
                            }
                          }
                          
                          return (
                            <div key={friend.id} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                              <span className="text-xs font-semibold text-slate-700">{friend.displayName}</span>
                              <span className={`text-[11px] px-2 py-0.5 rounded-md ${badgeStyle}`}>
                                {displayValue}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
         </div>
       )}

      {/* Dynamic Trophy Lock Confirmation Modal */}
      {lockConfirmModal && lockConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setLockConfirmModal(null)}
          />
          
          {/* Modal Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-md w-full relative z-10 transform transition-all scale-100 duration-300 flex flex-col items-center text-center">
            
            {/* Header Lock Icon */}
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-4 text-amber-600 shadow-sm shadow-amber-500/5 select-none">
              <Lock className="h-6 w-6 animate-pulse" />
            </div>
            
            {/* Title */}
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight mb-2">
              Trancar Palpite?
            </h3>
            
            {/* Warning Message */}
            <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
              Você está prestes a trancar o seu palpite. Uma vez trancado, <strong className="text-slate-800 font-bold">não será possível alterá-lo</strong>. Em contrapartida, você liberará a visualização dos palpites dos seus amigos para esta partida!
            </p>
            
            {/* Match Preview Card */}
            <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 flex items-center justify-center gap-6 select-none">
              <div className="flex flex-col items-center gap-1 w-24">
                <span className="text-2xl filter drop-shadow-sm">{lockConfirmModal.homeFlag}</span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-full">{lockConfirmModal.homeTeam}</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-150 rounded-xl shadow-2xs">
                <span className="text-lg font-black text-slate-800">{lockConfirmModal.homeScore}</span>
                <span className="text-slate-400 font-bold text-xs">x</span>
                <span className="text-lg font-black text-slate-800">{lockConfirmModal.awayScore}</span>
              </div>
              
              <div className="flex flex-col items-center gap-1 w-24">
                <span className="text-2xl filter drop-shadow-sm">{lockConfirmModal.awayFlag}</span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-full">{lockConfirmModal.awayTeam}</span>
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setLockConfirmModal(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-650 hover:text-slate-800 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  if (lockConfirmModal) {
                    handleSave(lockConfirmModal.matchId, true);
                    setLockConfirmModal(null);
                  }
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm shadow-blue-500/10 cursor-pointer"
              >
                Trancar Palpite 🔒
              </button>
            </div>
            
          </div>
        </div>
      )}
     </div>
   );
 }
