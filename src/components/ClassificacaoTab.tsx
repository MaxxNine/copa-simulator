'use client';

import React, { useState, useEffect } from 'react';
import { Match, Prediction } from '../types';
import { calculateGroupStandings, GroupStandingTeam } from '../utils/points';
import { Table, Search, Award, Compass, RefreshCw, Trophy } from 'lucide-react';
import { generateGroupStageMatches } from '../utils/seeds/matchesSeed';

interface ClassificacaoTabProps {
  matches: Match[];
  predictions?: Record<string, Prediction>;
  isLoading?: boolean;
}

export default function ClassificacaoTab({
  matches: initialMatches,
  predictions = {},
  isLoading = false,
}: ClassificacaoTabProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('Todos');

  useEffect(() => {
    if (initialMatches && initialMatches.length > 0) {
      setMatches(initialMatches);
    } else {
      // Load generated Portuguese group stage matches as mock if none provided
      const mockMatches = generateGroupStageMatches();
      setMatches(mockMatches);
    }
  }, [initialMatches]);

  // Group list A to L (Portuguese matches)
  const groups = [
    'Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F',
    'Grupo G', 'Grupo H', 'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'
  ];

  // Merge predictions into matches if provided, to simulate standings
  const simulatedMatches = matches.map((m) => {
    if (m.status === 'scheduled' && predictions && predictions[m.id]) {
      const pred = predictions[m.id];
      return {
        ...m,
        // Treat it as finished/played for the sake of the simulation!
        status: 'finished' as const,
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
      };
    }
    return m;
  });

  // Map to store flags of teams dynamically from simulated match list
  const flagMap: Record<string, string> = {};
  simulatedMatches.forEach((m) => {
    flagMap[m.homeTeam] = m.homeFlag;
    flagMap[m.awayTeam] = m.awayFlag;
  });

  // Calculate standings for each group
  const standingsByGroup: Record<string, GroupStandingTeam[]> = {};
  groups.forEach((g) => {
    standingsByGroup[g] = calculateGroupStandings(simulatedMatches, g);
  });

  // Filter groups if a specific group is selected or search query matches a team
  const filteredGroups = groups.filter((g) => {
    if (selectedGroup !== 'Todos' && g !== selectedGroup) return false;
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const teamsInGroup = standingsByGroup[g].map(t => t.team.toLowerCase());
      return teamsInGroup.some(t => t.includes(query)) || g.toLowerCase().includes(query);
    }
    
    return true;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 bg-slate-50 min-h-screen pb-24">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Trophy className="text-blue-600 h-8 w-8" />
            Classificação dos Grupos
          </h1>
          <p className="text-slate-500 mt-1">
            Tabelas atualizadas dos Grupos A a L da Copa do Mundo 2026.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar seleção ou grupo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Group Navigation Filters */}
      <div className="mb-8">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Ir para o Grupo</span>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedGroup('Todos')}
            className={`py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedGroup === 'Todos'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Todos os Grupos
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedGroup === g
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <RefreshCw className="animate-spin text-blue-600 h-10 w-10 mb-4" />
          <p className="text-slate-500 font-medium">Carregando tabelas de classificação...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm px-6">
          <Search className="mx-auto text-slate-300 h-12 w-12 mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Nenhum grupo encontrado</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">
            Tente buscar com termos diferentes ou mude o filtro de grupo selecionado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {filteredGroups.map((groupName) => {
            const standings = standingsByGroup[groupName];

            return (
              <div
                key={groupName}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              >
                {/* Table Header Group Title */}
                <div className="bg-slate-50/75 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-850 text-base tracking-wide flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    {groupName.replace('Group ', 'Grupo ')}
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Copa 2026</span>
                </div>

                {/* Table Container with Horizontal Scroll */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold text-[11px] tracking-wider uppercase bg-white select-none">
                        <th className="px-6 py-4 text-center w-12">#</th>
                        <th className="px-4 py-4 min-w-[140px]">Seleção</th>
                        <th className="px-3 py-4 text-center font-extrabold text-slate-700 bg-slate-50/50">P</th>
                        <th className="px-3 py-4 text-center">J</th>
                        <th className="px-3 py-4 text-center">V</th>
                        <th className="px-3 py-4 text-center">E</th>
                        <th className="px-3 py-4 text-center">D</th>
                        <th className="px-3 py-4 text-center">GP</th>
                        <th className="px-3 py-4 text-center">GC</th>
                        <th className="px-3 py-4 text-center">SG</th>
                        <th className="px-4 py-4 text-center">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {standings.map((teamRow, idx) => {
                        const isTop2 = idx < 2;
                        const is3rd = idx === 2;
                        const posClass = isTop2 
                          ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' 
                          : is3rd 
                          ? 'bg-slate-50/75 text-slate-600 font-medium' 
                          : 'text-slate-400';

                        return (
                          <tr
                            key={teamRow.team}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            {/* Position */}
                            <td className={`px-6 py-4 text-center font-bold text-xs ${posClass}`}>
                              {idx + 1}
                            </td>
                            {/* Team Name + Flag */}
                            <td className="px-4 py-4 font-semibold text-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="text-xl filter drop-shadow-sm select-none">
                                  {flagMap[teamRow.team] || '🏳️'}
                                </span>
                                <span>{teamRow.team}</span>
                              </div>
                            </td>
                            {/* Points */}
                            <td className="px-3 py-4 text-center font-extrabold text-slate-900 bg-slate-50/30">
                              {teamRow.P}
                            </td>
                            {/* Played */}
                            <td className="px-3 py-4 text-center text-slate-600">{teamRow.J}</td>
                            {/* Wins */}
                            <td className="px-3 py-4 text-center text-slate-500">{teamRow.V}</td>
                            {/* Draws */}
                            <td className="px-3 py-4 text-center text-slate-500">{teamRow.E}</td>
                            {/* Losses */}
                            <td className="px-3 py-4 text-center text-slate-500">{teamRow.D}</td>
                            {/* Goals For */}
                            <td className="px-3 py-4 text-center text-slate-500">{teamRow.GP}</td>
                            {/* Goals Against */}
                            <td className="px-3 py-4 text-center text-slate-500">{teamRow.GC}</td>
                            {/* Goal Difference */}
                            <td className={`px-3 py-4 text-center font-semibold ${
                              teamRow.SG > 0 ? 'text-green-600' : teamRow.SG < 0 ? 'text-red-500' : 'text-slate-500'
                            }`}>
                              {teamRow.SG > 0 ? `+${teamRow.SG}` : teamRow.SG}
                            </td>
                            {/* Percentage */}
                            <td className="px-4 py-4 text-center text-slate-500 font-medium">
                              {teamRow['%']}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer legend */}
                <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-3 flex gap-4 text-[10px] text-slate-450 font-semibold select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-blue-50 border border-blue-200 rounded-sm" />
                    <span>Classifica (Top 2)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-50/75 border border-slate-200 rounded-sm" />
                    <span>Vaga repescagem (3º lugar)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
