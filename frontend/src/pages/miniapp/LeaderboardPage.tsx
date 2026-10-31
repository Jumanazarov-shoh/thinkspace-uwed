import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LeaderboardEntry, PersonalRanking, PointTransaction } from '../../types';
import { 
  Trophy, 
  Search, 
  HelpCircle, 
  History, 
  X, 
  ShieldCheck
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

  const getTransactionBadge = (txType: string) => {
    switch (txType) {
      case 'performance':
        return { label: 'Topshiriq bahosi', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'completion_bonus':
        return { label: 'Topshirish bonusi (+10)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'ontime_bonus':
        return { label: "O'z vaqtida bonusi (+5)", color: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'score_correction':
        return { label: 'Qayta baholash', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'manual_adjustment':
      default:
        return { label: 'Tuzatish', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif font-semibold text-lg text-slate-900 leading-tight">
            {t.leaderboard.title}
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            {t.leaderboard.subtitle}
          </p>
        </div>

        <button
          onClick={() => setShowRulesModal(true)}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-md font-medium transition-colors border border-slate-200 shadow-2xs"
          title="Ballar hisoblash qoidalari"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
          <span>Qoidalar</span>
        </button>
      </div>

      {/* Personal Rank Overview Card - Quiet Oxford Navy */}
      {myRank && (
        <div className="bg-[#0B192C] rounded-lg p-4 text-white shadow-xs border border-white/10 relative">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-slate-300">
                <Trophy className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-medium block">
                  Shaxsiy reyting
                </span>
                <span className="text-sm font-serif font-semibold text-slate-100">
                  {user?.display_name || 'ThinkSpace A\'zosi'}
                </span>
              </div>
            </div>

            <button
              onClick={handleOpenHistory}
              className="inline-flex items-center space-x-1.5 text-[11px] font-medium bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-md text-slate-200 transition-colors border border-white/10"
            >
              <History className="w-3 h-3 text-slate-300 stroke-[1.75]" />
              <span>Ballar tarixi</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="bg-white/5 rounded-md p-2 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-sans">Joriy o'rin</span>
              <span className="text-base font-serif font-semibold text-amber-300 tabular-nums">
                {myRank.current_rank ? `#${myRank.current_rank}` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block tabular-nums">
                {myRank.total_ranked_members > 0 ? `${myRank.total_ranked_members} a'zodan` : 'Baholanmagan'}
              </span>
            </div>

            <div className="bg-white/5 rounded-md p-2 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-sans">Jami ballar</span>
              <span className="text-base font-serif font-semibold text-slate-100 tabular-nums">
                {(myRank.total_points ?? 0).toFixed(1)}
              </span>
              <span className="text-[10px] text-emerald-400 block font-medium tabular-nums">
                {myRank.completed_assignments} topshiriq
              </span>
            </div>

            <div className="bg-white/5 rounded-md p-2 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-sans">O'rtacha natija</span>
              <span className="text-base font-serif font-semibold text-slate-100 tabular-nums">
                {(myRank.average_percentage ?? 0).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 block">Sifat ko'rsatkichi</span>
            </div>
          </div>
        </div>
      )}

      {/* Direction Filter Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
        {DIRECTIONS.map((dir) => {
          const isActive = selectedDirection === dir.key;
          return (
            <button
              key={dir.key}
              onClick={() => setSelectedDirection(dir.key)}
              className={`shrink-0 text-xs px-3 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {dir.label}
            </button>
          );
        })}
      </div>

      {/* Podium for Top 3 in current view - Scholarly Craft */}
      {top3.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-end justify-center space-x-2 pt-2 pb-1">
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <div className="flex flex-col items-center flex-1 max-w-[95px]">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-serif font-semibold text-xs flex items-center justify-center border border-slate-300">
                  II
                </div>
                <p className="text-[11px] font-medium text-center mt-1 text-slate-800 truncate w-full">
                  {top3[1].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-slate-50 rounded-t-md h-12 flex flex-col justify-center items-center mt-1 border border-slate-200">
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">
                    {(top3[1].total_points ?? top3[1].total_score ?? 0).toFixed(1)}
                  </span>
                  <span className="text-[9px] text-slate-400">2-o'rin</span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {top3[0] && (
              <div className="flex flex-col items-center flex-1 max-w-[105px]">
                <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-900 font-serif font-semibold text-sm flex items-center justify-center border border-amber-300">
                  I
                </div>
                <p className="text-xs font-semibold text-center mt-1 text-slate-900 truncate w-full">
                  {top3[0].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-amber-50/60 rounded-t-md h-16 flex flex-col justify-center items-center mt-1 border border-amber-200/80">
                  <span className="text-sm font-serif font-semibold text-amber-950 tabular-nums">
                    {(top3[0].total_points ?? top3[0].total_score ?? 0).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-amber-800 font-medium">1-o'rin</span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <div className="flex flex-col items-center flex-1 max-w-[95px]">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-serif font-semibold text-xs flex items-center justify-center border border-slate-300">
                  III
                </div>
                <p className="text-[11px] font-medium text-center mt-1 text-slate-800 truncate w-full">
                  {top3[2].display_name.split(' ')[0]}
                </p>
                <div className="w-full bg-slate-50 rounded-t-md h-10 flex flex-col justify-center items-center mt-1 border border-slate-200">
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">
                    {(top3[2].total_points ?? top3[2].total_score ?? 0).toFixed(1)}
                  </span>
                  <span className="text-[9px] text-slate-400">3-o'rin</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 stroke-[1.75]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="A'zoni qidirish (ism, talaba ID, fakultet)..."
          className="w-full pl-8 pr-3 py-2 bg-white rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-navy-900 shadow-2xs font-sans"
        />
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200 font-sans">
          Reyting ma'lumotlari yuklanmoqda...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center border border-slate-200 text-slate-500 text-xs font-sans">
          <Trophy className="w-7 h-7 text-slate-300 mx-auto mb-2 stroke-[1.75]" />
          <p>{t.leaderboard.emptyState}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">
          {filtered.map((entry) => {
            const isMe = user?.id === entry.user_id;
            const pts = entry.total_points ?? entry.total_score ?? 0;
            return (
              <div
                key={entry.user_id}
                className={`p-3 flex items-center justify-between text-xs transition-colors ${
                  isMe ? 'bg-blue-50/60 border-l-2 border-l-blue-700' : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-6 text-center font-serif font-semibold text-xs tabular-nums ${
                    entry.rank === 1 ? 'text-amber-700' :
                    entry.rank === 2 ? 'text-slate-600' :
                    entry.rank === 3 ? 'text-amber-800' : 'text-slate-400'
                  }`}>
                    #{entry.rank}
                  </div>

                  <div className="truncate">
                    <p className={`truncate ${isMe ? 'text-blue-900 font-semibold' : 'text-slate-900 font-medium'}`}>
                      {entry.display_name} {isMe && '(Siz)'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {entry.faculty || 'UWED SIEM'} • {entry.completed_assignments} {t.leaderboard.completed}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-serif font-semibold text-xs text-slate-900 block tabular-nums">
                    {pts.toFixed(1)} ball
                  </span>
                  <span className="text-[10px] text-slate-400 block tabular-nums">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0B192C] text-white">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-300 stroke-[1.75]" />
                <h3 className="font-serif font-semibold text-sm">Shaxsiy ballar tarixi</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">Tarix yuklanmoqda...</div>
              ) : pointsHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Hozircha hisoblangan ballar mavjud emas.
                </div>
              ) : (
                pointsHistory.map((tx) => {
                  const badge = getTransactionBadge(tx.transaction_type);
                  const isPositive = tx.points >= 0;
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-md border border-slate-100 bg-slate-50/70 hover:bg-slate-100/60 transition-colors flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        {tx.reason && (
                          <p className="text-xs text-slate-700 font-medium">{tx.reason}</p>
                        )}
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          {new Date(tx.created_at).toLocaleString('uz-UZ', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>

                      <div className="text-right pl-3">
                        <span className={`font-mono font-semibold text-xs tabular-nums ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {isPositive ? `+${tx.points.toFixed(1)}` : tx.points.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">ball</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 bg-navy-900 text-white rounded-md text-xs font-medium hover:bg-navy-800 transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Points Rules & Formula Explanation */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0B192C] text-white">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-slate-300 stroke-[1.75]" />
                <h3 className="font-serif font-semibold text-sm">ThinkSpace Ballar Tizimi Qoidalari</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
              <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200">
                <h4 className="font-semibold text-slate-900 text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700 stroke-[1.75]" />
                  <span>Shaffof va Adolatli Baholash</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  ThinkSpace klubida har bir topshiriq professional rubrikalar va ko'p bosqichli tekshiruv (Evaluator + Moderator) asosida baholanadi.
                </p>
              </div>

              <div className="space-y-2.5">
                <h4 className="font-semibold text-slate-900 text-xs">Ball qanday shakllanadi?</h4>

                <div className="p-3 rounded-md border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">1. Sifat / Natija bali:</span>
                    <span className="font-mono text-slate-900">Maks. 100 ball</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Olingan yakuniy ball 100 foizlik shkalaga keltiriladi:
                    <span className="font-mono block mt-0.5 text-slate-900">Ball = (To'plangan ball / Maksimal ball) × 100</span>
                  </p>
                </div>

                <div className="p-3 rounded-md border border-emerald-200/80 bg-emerald-50/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-950">2. Topshirish bonusi:</span>
                    <span className="font-mono text-emerald-800">+10 ball</span>
                  </div>
                  <p className="text-[11px] text-emerald-900">
                    Har bir to'liq yakunlangan va baholangan topshiriq uchun qo'shiladi.
                  </p>
                </div>

                <div className="p-3 rounded-md border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">3. O'z vaqtida topshirish bonusi:</span>
                    <span className="font-mono text-slate-800">+5 ball</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Belgilangan oxirgi muddat (deadline)dan kechikmagan ishlar uchun qo'shiladi.
                  </p>
                </div>

                <div className="p-3 rounded-md border border-amber-200/80 bg-amber-50/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-950">4. Qayta baholash va tuzatishlar:</span>
                    <span className="font-mono text-amber-800">Delta farqi</span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Apellyatsiya yoki qayta ko'rib chiqishda faqat farq (delta) qo'shiladi yoki ayirib tashlanadi.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-semibold text-slate-900 text-xs mb-1">Tenglikni hal qilish qoidasi:</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Agar a'zolarning ballari teng bo'lib qolsa, o'rinlar bir xil hisoblanadi va ketma-ketlik: 1) Jami ballar, 2) O'rtacha foiz, 3) Bajarilgan ishlar soni bo'yicha aniqlanadi.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2 bg-navy-900 text-white rounded-md text-xs font-medium hover:bg-navy-800 transition-colors"
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
