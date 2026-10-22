import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LeaderboardEntry, PersonalRanking, PointTransaction, AssignmentDirection } from '../../types';
import { 
  Trophy, 
  Search, 
  HelpCircle, 
  History, 
  X, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  ChevronRight,
  Award,
  Sparkles
} from 'lucide-react';

const DIRECTIONS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Barchasi (Umumiy)' },
  { key: 'Think & Read', label: 'Think & Read' },
  { key: 'Think & Discuss', label: 'Think & Discuss' },
  { key: 'Think & Analyze', label: 'Think & Analyze' },
  { key: 'Think & Lead', label: 'Think & Lead' },
  { key: 'Think & Create', label: 'Think & Create' },
  { key: 'Think & Connect', label: 'Think & Connect' },
];

export const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<PersonalRanking | null>(null);
  const [pointsHistory, setPointsHistory] = useState<PointTransaction[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchLeaderboardData = async (directionKey: string) => {
    setLoading(true);
    try {
      const [lbData, rankData] = await Promise.all([
        api.getLeaderboard(directionKey || undefined, 100),
        api.getMyRank().catch(() => null)
      ]);
      setEntries(lbData);
      if (rankData) {
        setMyRank(rankData);
      }
    } catch (e) {
      console.error('Failed to load leaderboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData(selectedDirection);
  }, [selectedDirection]);

  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const data = await api.getMyPointsHistory();
      setPointsHistory(data);
    } catch (err) {
      console.error('Failed to load points history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filtered = entries.filter((e) =>
    e.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.student_id && e.student_id.toLowerCase().includes(search.toLowerCase())) ||
    (e.faculty && e.faculty.toLowerCase().includes(search.toLowerCase()))
  );

  const top3 = entries.filter(e => (e.total_points ?? e.total_score ?? 0) > 0).slice(0, 3);

  // Helper for transaction badges
  const getTransactionBadge = (txType: string, points: number) => {
    switch (txType) {
      case 'performance':
        return { label: 'Topshiriq bahosi', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'completion_bonus':
        return { label: 'Topshirish bonusi (+10)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'ontime_bonus':
        return { label: "O'z vaqtida bonusi (+5)", color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'score_correction':
        return { label: 'Qayta baholash', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'manual_adjustment':
        return { label: 'Admin kiritmasi', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      default:
        return { label: txType, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif font-bold text-xl text-navy-950 leading-tight">
            {t.leaderboard.title}
          </h2>
          <p className="text-xs text-gray-500 font-sans mt-0.5">
            {t.leaderboard.subtitle}
          </p>
        </div>
        <button
          onClick={() => setShowRulesModal(true)}
          className="inline-flex items-center space-x-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors border border-blue-200"
          title="Ballar hisoblash qoidalari"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Qoidalar</span>
        </button>
      </div>

      {/* Personal Rank Overview Card */}
      {myRank && (
        <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 rounded-2xl p-4 text-white shadow-lg border border-navy-700/60 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-navy-700/70 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-blue-200/80 font-semibold block">
                  Shaxsiy reyting
                </span>
                <span className="text-sm font-serif font-bold text-white">
                  {user?.display_name || 'ThinkSpace A\'zosi'}
                </span>
              </div>
            </div>

            <button
              onClick={handleOpenHistory}
              className="inline-flex items-center space-x-1 text-[11px] font-medium bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg text-blue-100 transition-colors border border-white/10"
            >
              <History className="w-3 h-3 text-blue-300" />
              <span>Ballar tarixi</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="bg-navy-950/40 rounded-xl p-2 border border-navy-700/40">
              <span className="text-[10px] text-gray-400 block">Joriy o'rin</span>
              <span className="text-base font-serif font-bold text-amber-300">
                {myRank.current_rank ? `#${myRank.current_rank}` : '—'}
              </span>
              <span className="text-[9px] text-gray-500 block">
                {myRank.total_ranked_members > 0 ? `${myRank.total_ranked_members} a'zodan` : 'Baholanmagan'}
              </span>
            </div>

            <div className="bg-navy-950/40 rounded-xl p-2 border border-navy-700/40">
              <span className="text-[10px] text-gray-400 block">Jami ballar</span>
              <span className="text-base font-serif font-bold text-white">
                {(myRank.total_points ?? 0).toFixed(1)}
              </span>
              <span className="text-[9px] text-emerald-400 block font-medium">
                {myRank.completed_assignments} topshiriq
              </span>
            </div>

            <div className="bg-navy-950/40 rounded-xl p-2 border border-navy-700/40">
              <span className="text-[10px] text-gray-400 block">O'rtacha natija</span>
              <span className="text-base font-serif font-bold text-blue-300">
                {(myRank.average_percentage ?? 0).toFixed(1)}%
              </span>
              <span className="text-[9px] text-gray-500 block">Sifat ko'rsatkichi</span>
            </div>
          </div>
        </div>
      )}

      {/* Direction Filter Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
        {DIRECTIONS.map((dir) => {
          const isActive = selectedDirection === dir.key;
          return (
            <button
              key={dir.key}
              onClick={() => setSelectedDirection(dir.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                isActive
                  ? 'bg-navy-900 text-white shadow-sm ring-1 ring-navy-900'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {dir.label}
            </button>
          );
        })}
      </div>

      {/* Podium for Top 3 in current view */}
      {top3.length > 0 && (
        <div className="bg-gradient-to-b from-navy-900 to-navy-950 rounded-2xl p-4 text-white shadow-md border border-navy-800">
          <div className="flex items-end justify-center space-x-2 pt-2 pb-1">
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <div className="flex flex-col items-center flex-1 max-w-[95px]">
                <div className="w-10 h-10 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center font-bold text-sm shadow-md border-2 border-slate-200">
                  🥈
                </div>
                <p className="text-[11px] font-semibold text-center mt-1 text-slate-200 truncate w-full">
                  {top3[1].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-navy-800/80 rounded-t-xl h-14 flex flex-col justify-center items-center mt-1 border border-navy-700/50">
                  <span className="text-xs font-bold text-white">
                    {(top3[1].total_points ?? top3[1].total_score ?? 0).toFixed(1)}
                  </span>
                  <span className="text-[9px] text-gray-400">2-o'rin</span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {top3[0] && (
              <div className="flex flex-col items-center flex-1 max-w-[105px]">
                <div className="w-12 h-12 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-lg shadow-lg border-2 border-amber-300">
                  🥇
                </div>
                <p className="text-xs font-bold text-center mt-1 text-amber-300 truncate w-full">
                  {top3[0].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-blue-700 rounded-t-xl h-20 flex flex-col justify-center items-center mt-1 shadow-md border-t border-blue-400/30">
                  <span className="text-sm font-extrabold text-white">
                    {(top3[0].total_points ?? top3[0].total_score ?? 0).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-blue-200 font-medium">1-o'rin</span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <div className="flex flex-col items-center flex-1 max-w-[95px]">
                <div className="w-10 h-10 rounded-full bg-amber-700 text-amber-100 flex items-center justify-center font-bold text-sm shadow-md border-2 border-amber-600">
                  🥉
                </div>
                <p className="text-[11px] font-semibold text-center mt-1 text-amber-200 truncate w-full">
                  {top3[2].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-navy-800/80 rounded-t-xl h-11 flex flex-col justify-center items-center mt-1 border border-navy-700/50">
                  <span className="text-xs font-bold text-white">
                    {(top3[2].total_points ?? top3[2].total_score ?? 0).toFixed(1)}
                  </span>
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
          placeholder="A'zoni qidirish (ism, talaba ID, fakultet)..."
          className="w-full pl-8 pr-3 py-2 bg-white rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-700 shadow-sm"
        />
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
          Reyting ma'lumotlari yuklanmoqda...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 text-gray-500 text-xs">
          <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p>{t.leaderboard.emptyState}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map((entry) => {
            const isMe = user?.id === entry.user_id;
            const pts = entry.total_points ?? entry.total_score ?? 0;
            return (
              <div
                key={entry.user_id}
                className={`p-3.5 flex items-center justify-between text-xs transition-colors ${
                  isMe ? 'bg-blue-50/80 border-l-4 border-l-blue-700' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-7 text-center font-bold font-serif text-sm ${
                    entry.rank === 1 ? 'text-amber-500' :
                    entry.rank === 2 ? 'text-slate-500' :
                    entry.rank === 3 ? 'text-amber-700' : 'text-gray-400'
                  }`}>
                    #{entry.rank}
                  </div>

                  <div className="truncate">
                    <p className={`font-semibold truncate ${isMe ? 'text-blue-900 font-bold' : 'text-navy-950'}`}>
                      {entry.display_name} {isMe && '(Siz)'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {entry.faculty || 'UWED SIEM'} • {entry.completed_assignments} {t.leaderboard.completed}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-serif font-bold text-sm text-blue-900 block">
                    {pts.toFixed(1)} ball
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {(entry.average_percentage ?? 0).toFixed(1)}% o'rtacha
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Points History Ledger */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-navy-950 text-white">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-400" />
                <h3 className="font-serif font-bold text-sm">Shaxsiy ballar tarixi</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-gray-500">Tarix yuklanmoqda...</div>
              ) : pointsHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  Hozircha hisoblangan ballar mavjud emas.
                </div>
              ) : (
                pointsHistory.map((tx) => {
                  const badge = getTransactionBadge(tx.transaction_type, tx.points);
                  const isPositive = tx.points >= 0;
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-gray-100/60 transition-colors flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        {tx.reason && (
                          <p className="text-xs text-gray-700 font-medium">{tx.reason}</p>
                        )}
                        <p className="text-[10px] text-gray-400">
                          {new Date(tx.created_at).toLocaleString('uz-UZ', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>

                      <div className="text-right pl-3">
                        <span className={`font-mono font-bold text-sm ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {isPositive ? `+${tx.points.toFixed(1)}` : tx.points.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-gray-400 block">ball</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Points Rules & Formula Explanation */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-navy-950 text-white">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-sm">ThinkSpace Ballar Tizimi Qoidalari</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-gray-700 flex-1">
              <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200">
                <h4 className="font-bold text-blue-900 text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span>Shaffof va Adolatli Baholash</span>
                </h4>
                <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
                  ThinkSpace klubida har bir topshiriq professional rubrikalar va ko'p bosqichli tekshiruv (Evaluator + Moderator) asosida baholanadi.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-navy-950 text-xs">Ball qanday shakllanadi?</h4>

                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">1. Sifat / Natija bali:</span>
                    <span className="font-mono font-bold text-navy-900">Maks. 100 ball</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Olingan yakuniy ball 100 foizlik shkalaga keltiriladi:
                    <span className="font-mono block mt-0.5 text-navy-950">Ball = (To'plangan ball / Maksimal ball) × 100</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-900">2. Topshirish bonusi:</span>
                    <span className="font-mono font-bold text-emerald-700">+10 ball</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Har bir to'liq yakunlangan va baholangan topshiriq uchun qo'shiladi.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-900">3. O'z vaqtida topshirish bonusi:</span>
                    <span className="font-mono font-bold text-purple-700">+5 ball</span>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    Belgilangan oxirgi muddat (deadline)dan kechikmagan ishlar uchun qo'shiladi.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">4. Qayta baholash va tuzatishlar:</span>
                    <span className="font-mono font-bold text-amber-700">Delta farqi</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Apellyatsiya yoki qayta ko'rib chiqishda faqat farq (delta) qo'shiladi yoki ayirib tashlanadi.
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <h4 className="font-bold text-navy-950 text-xs mb-1">Tenglikni hal qilish qoidasi:</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Agar a'zolarning ballari teng bo'lib qolsa, o'rinlar bir xil hisoblanadi (masalan, 1, 2, 2, 4) va ketma-ketlik: 1) Jami ballar, 2) O'rtacha foiz, 3) Bajarilgan ishlar soni bo'yicha aniqlanadi.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition-colors"
              >
                Tushunarli
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
