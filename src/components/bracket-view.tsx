'use client';

import React, { useState } from 'react';
import { BracketLadder, BracketMatchup, BracketRound, MatchupRacer } from '@/scoring/bracket';
import { Trophy, CheckCircle, Clock, Shield, Flag } from 'lucide-react';

export function BracketView({
  ladder,
  variant = 'spectator',
  activeClassTitle,
}: {
  ladder: BracketLadder;
  variant?: 'spectator' | 'pit';
  activeClassTitle?: string;
}) {
  const isPit = variant === 'pit';
  const [activeTab, setActiveTab] = useState<'all' | 'winners' | 'losers'>('all');

  if (!ladder || (!ladder.rounds.length && !ladder.winnersRounds?.length)) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${isPit ? 'bg-black border-slate-800 text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
        <p className={isPit ? 'text-2xl font-bold' : 'text-base'}>No bracket matchups generated yet.</p>
      </div>
    );
  }

  const champ = ladder.championId ? ladder.resultsByEntryId[ladder.championId] : null;
  const runner = ladder.runnerUpId ? ladder.resultsByEntryId[ladder.runnerUpId] : null;

  return (
    <div className="space-y-6">
      {/* Champion banner if decided */}
      {champ && (
        <div className={`p-6 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
          isPit
            ? 'bg-amber-950/40 border-amber-500/50 text-white shadow-[0_0_30px_rgba(245,158,11,0.2)]'
            : 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40 text-amber-200'
        }`}>
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center ${isPit ? 'w-16 h-16' : 'w-12 h-12'}`}>
              <Trophy className={isPit ? 'w-10 h-10' : 'w-7 h-7'} />
            </div>
            <div>
              <p className={`font-bold tracking-widest uppercase ${isPit ? 'text-xl text-amber-400' : 'text-xs text-amber-400'}`}>
                Class Champion
              </p>
              <h4 className={`font-black text-white ${isPit ? 'text-4xl' : 'text-2xl'}`}>
                {champ.displayName}
                <span className="ml-2 text-amber-400 text-lg font-semibold">(Seed #{champ.seed})</span>
              </h4>
              {champ.finalRoundElapsedMs != null && (
                <p className={`font-mono text-slate-300 ${isPit ? 'text-2xl' : 'text-sm'}`}>
                  Final pass: {(champ.finalRoundElapsedMs / 1000).toFixed(3)}s
                </p>
              )}
            </div>
          </div>
          {runner && (
            <div className="text-right">
              <p className={`text-slate-400 font-bold uppercase tracking-wider ${isPit ? 'text-lg' : 'text-xs'}`}>Runner-Up</p>
              <p className={`font-bold text-slate-200 ${isPit ? 'text-2xl' : 'text-lg'}`}>{runner.displayName} (Seed #{runner.seed})</p>
              {runner.finalRoundElapsedMs != null && (
                <p className={`font-mono text-slate-400 ${isPit ? 'text-lg' : 'text-xs'}`}>{(runner.finalRoundElapsedMs / 1000).toFixed(3)}s</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Double-Elimination tab selector if losers bracket is active */}
      {ladder.hasLosersBracket && !isPit && (
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Full Tournament
          </button>
          <button
            onClick={() => setActiveTab('winners')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'winners'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Winners Bracket
          </button>
          <button
            onClick={() => setActiveTab('losers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'losers'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Losers Bracket
          </button>
        </div>
      )}

      {/* Main Bracket Sections */}
      {!ladder.hasLosersBracket ? (
        // Standard Single-Elimination
        <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2">
          <div className="flex flex-row items-stretch gap-6 min-w-max">
            {ladder.rounds.map((round) => (
              <RoundColumn
                key={round.round}
                round={round}
                isPit={isPit}
                totalRounds={ladder.totalRounds}
              />
            ))}
          </div>
        </div>
      ) : (
        // Double-Elimination Layout
        <div className="space-y-8">
          {/* Winners Bracket */}
          {(activeTab === 'all' || activeTab === 'winners') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Trophy className="w-5 h-5" />
                <h3 className={isPit ? 'text-3xl' : 'text-lg'}>Winners Bracket</h3>
              </div>
              <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2">
                <div className="flex flex-row items-stretch gap-6 min-w-max">
                  {(ladder.winnersRounds || ladder.rounds).map((round) => (
                    <RoundColumn
                      key={`W-${round.round}`}
                      round={round}
                      isPit={isPit}
                      totalRounds={ladder.winnersRounds?.length || ladder.totalRounds}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grand Finals (Shown in All or Winners view) */}
          {ladder.grandFinal && (activeTab === 'all' || activeTab === 'winners') && (
            <div className="space-y-3 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Flag className="w-5 h-5" />
                <h3 className={isPit ? 'text-3xl' : 'text-lg'}>Grand Finals (Winners Champ vs Losers Champ)</h3>
              </div>
              <div className="max-w-md">
                <MatchupCard match={ladder.grandFinal} isPit={isPit} />
              </div>
            </div>
          )}

          {/* Losers Bracket */}
          {(activeTab === 'all' || activeTab === 'losers') && ladder.losersRounds && ladder.losersRounds.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Shield className="w-5 h-5" />
                <h3 className={isPit ? 'text-3xl' : 'text-lg'}>Losers Bracket (Consolation Ladder)</h3>
              </div>
              <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2">
                <div className="flex flex-row items-stretch gap-6 min-w-max">
                  {ladder.losersRounds.map((round) => (
                    <RoundColumn
                      key={`L-${round.round}`}
                      round={round}
                      isPit={isPit}
                      totalRounds={ladder.losersRounds?.length || 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RoundColumn({
  round,
  isPit,
  totalRounds,
}: {
  round: BracketRound;
  isPit: boolean;
  totalRounds: number;
}) {
  return (
    <div className={`flex flex-col flex-1 min-w-[280px] max-w-[340px] ${isPit ? 'min-w-[340px] max-w-[420px]' : ''}`}>
      {/* Round Header */}
      <div className={`mb-4 pb-2 border-b text-center ${isPit ? 'border-slate-800' : 'border-slate-800'}`}>
        <h4 className={`font-black uppercase tracking-wider ${isPit ? 'text-2xl text-amber-400' : 'text-sm text-amber-500'}`}>
          {round.roundName}
        </h4>
        <p className={`text-slate-500 font-mono ${isPit ? 'text-base' : 'text-xs'}`}>
          {round.matchups.length} {round.matchups.length === 1 ? 'Match' : 'Matches'}
        </p>
      </div>

      {/* Matchups list */}
      <div className="flex flex-col justify-around flex-1 gap-6">
        {round.matchups.map((match) => (
          <MatchupCard
            key={match.id}
            match={match}
            isPit={isPit}
          />
        ))}
      </div>
    </div>
  );
}

function MatchupCard({
  match,
  isPit,
}: {
  match: BracketMatchup;
  isPit: boolean;
}) {
  const is1stAcross = match.isManual || match.winnerReason?.toLowerCase().includes('1st across line');

  return (
    <div
      className={`rounded-2xl border transition-all ${
        match.isComplete
          ? isPit
            ? 'bg-slate-950 border-slate-700 shadow-md'
            : 'bg-slate-900 border-slate-700/80 shadow-md'
          : isPit
          ? 'bg-black border-slate-800'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      {/* Match Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b text-xs font-mono ${isPit ? 'border-slate-800 text-slate-400 text-sm' : 'border-slate-800 text-slate-400'}`}>
        <span className="font-bold">{match.id}</span>
        {match.isComplete ? (
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Done
          </span>
        ) : (
          <span className="text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> In Progress
          </span>
        )}
      </div>

      {/* Match Competitors */}
      <div className="divide-y divide-slate-800/80">
        <RacerSlot
          racer={match.racer1}
          isWinner={match.winnerId === match.racer1?.entryId}
          isLoser={match.isComplete && match.winnerId !== match.racer1?.entryId}
          is1stAcross={is1stAcross && match.winnerId === match.racer1?.entryId}
          isPit={isPit}
        />
        <RacerSlot
          racer={match.racer2}
          isWinner={match.winnerId === match.racer2?.entryId}
          isLoser={match.isComplete && match.winnerId !== match.racer2?.entryId}
          is1stAcross={is1stAcross && match.winnerId === match.racer2?.entryId}
          isPit={isPit}
        />
      </div>

      {/* Outcome Reason Footer */}
      {match.winnerReason && (
        <div className={`px-3 py-1.5 border-t bg-slate-950/40 text-center font-mono ${isPit ? 'text-xs text-slate-400 border-slate-800' : 'text-[11px] text-slate-400 border-slate-800'}`}>
          {match.winnerReason}
        </div>
      )}
    </div>
  );
}

function RacerSlot({
  racer,
  isWinner,
  isLoser,
  is1stAcross,
  isPit,
}: {
  racer: MatchupRacer | null;
  isWinner: boolean;
  isLoser: boolean;
  is1stAcross?: boolean;
  isPit: boolean;
}) {
  if (!racer) {
    return (
      <div className={`p-3 text-slate-600 font-mono italic ${isPit ? 'text-lg p-4' : 'text-sm'}`}>
        TBD
      </div>
    );
  }

  const isBye = Boolean(racer.isBye);

  return (
    <div
      className={`flex items-center justify-between p-3 gap-3 transition ${
        isWinner
          ? isPit
            ? 'bg-amber-500/20 text-white font-bold'
            : 'bg-emerald-500/10 text-white font-bold'
          : isLoser
          ? 'text-slate-500 opacity-60'
          : isBye
          ? 'text-slate-600 italic'
          : 'text-slate-200'
      } ${isPit ? 'p-4' : ''}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {!isBye && (
          <span
            className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs ${
              isWinner
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400'
            } ${isPit ? 'text-sm px-2 py-1' : ''}`}
          >
            #{racer.seed}
          </span>
        )}
        <span
          className={`truncate font-semibold ${
            isPit ? 'text-xl' : 'text-sm'
          } ${isWinner ? 'text-amber-400 font-black' : ''}`}
        >
          {racer.displayName}
        </span>
        {is1stAcross && (
          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono uppercase tracking-wider">
            1st Across
          </span>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <span
          className={`font-mono font-bold ${
            isPit ? 'text-xl' : 'text-sm'
          } ${
            isWinner
              ? 'text-emerald-400'
              : racer.status === 'dq' || racer.status === 'dnf'
              ? 'text-red-400'
              : 'text-slate-400'
          }`}
        >
          {racer.displayScore || '-'}
        </span>
      </div>
    </div>
  );
}
