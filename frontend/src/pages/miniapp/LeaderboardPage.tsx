import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LeaderboardEntry } from '../../types';
import { Trophy, Medal, Search, User as UserIcon } from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const data = await api.getLeaderboard(50);
        setEntries(data);
      } catch (e) {
        console.error('Failed to load leaderboard:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const filtered = entries.filter((e) =>
    e.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.student_id && e.student_id.toLowerCase().includes(search.toLowerCase()))
  );

  const top3 = entries.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-serif font-bold text-lg text-navy-900 leading-tight">
          {t.leaderboard.title}
        </h2>
        <p className="text-xs text-gray-500 font-sans mt-0.5">
          {t.leaderboard.subtitle}
        </p>
      </div>

      {/* Podium for Top 3 (if at least 2 entries have score > 0) */}
      {top3.length > 0 && top3[0].total_score > 0 && (
        <div className="bg-gradient-to-b from-navy-900 to-navy-950 rounded-xl p-4 text-white shadow-md">
          <div className="flex items-end justify-center space-x-2 pt-2 pb-1">
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <div className="flex flex-col items-center flex-1 max-w-[90px]">
                <div className="w-10 h-10 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center font-bold text-xs shadow-md border-2 border-slate-200">
                  🥈
                </div>
                <p className="text-[11px] font-semibold text-center mt-1 text-slate-200 truncate w-full">
                  {top3[1].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-navy-800/80 rounded-t-lg h-14 flex flex-col justify-center items-center mt-1 border border-navy-700/50">
                  <span className="text-xs font-bold text-white">{top3[1].total_score}</span>
                  <span className="text-[9px] text-gray-400">2-o'rin</span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {top3[0] && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="w-12 h-12 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-base shadow-lg border-2 border-amber-300">
                  🥇
                </div>
                <p className="text-xs font-bold text-center mt-1 text-amber-300 truncate w-full">
                  {top3[0].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-blue-700 rounded-t-lg h-20 flex flex-col justify-center items-center mt-1 shadow-md border-t border-blue-400/30">
                  <span className="text-sm font-extrabold text-white">{top3[0].total_score}</span>
                  <span className="text-[10px] text-blue-200 font-medium">1-o'rin</span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <div className="flex flex-col items-center flex-1 max-w-[90px]">
                <div className="w-10 h-10 rounded-full bg-amber-700 text-amber-100 flex items-center justify-center font-bold text-xs shadow-md border-2 border-amber-600">
                  🥉
                </div>
                <p className="text-[11px] font-semibold text-center mt-1 text-amber-200 truncate w-full">
                  {top3[2].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-navy-800/80 rounded-t-lg h-10 flex flex-col justify-center items-center mt-1 border border-navy-700/50">
                  <span className="text-xs font-bold text-white">{top3[2].total_score}</span>
                  <span className="text-[9px] text-gray-400">3-o'rin</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.common.search}
          className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-700"
        />
      </div>

      {/* Leaderboard Table / Cards */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-500">{t.common.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 text-gray-500 text-xs">
          <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p>{t.leaderboard.emptyState}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map((entry) => {
            const isMe = user?.id === entry.user_id;
            return (
              <div
                key={entry.user_id}
                className={`p-3 flex items-center justify-between text-xs transition-colors ${
                  isMe ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-6 text-center font-bold font-serif ${
                    entry.rank === 1 ? 'text-amber-500' :
                    entry.rank === 2 ? 'text-slate-500' :
                    entry.rank === 3 ? 'text-amber-700' : 'text-gray-400'
                  }`}>
                    {entry.rank}
                  </div>

                  <div className="truncate">
                    <p className={`font-semibold truncate ${isMe ? 'text-blue-900 font-bold' : 'text-navy-900'}`}>
                      {entry.display_name} {isMe && '(Siz)'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {entry.faculty || 'UWED SIEM'} • {entry.completed_assignments} {t.leaderboard.completed}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-serif font-bold text-sm text-blue-900 block">
                    {entry.total_score}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {entry.average_percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
