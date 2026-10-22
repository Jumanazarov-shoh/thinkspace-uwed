import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { 
  AdminAnalyticsOverview, 
  DirectionAnalyticsItem, 
  AdminMemberPerformanceItem, 
  AdminMemberDetail,
  PointTransaction
} from '../../types';
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  FileCheck2, 
  CheckCircle2, 
  Compass, 
  BookOpen, 
  MessageSquare, 
  BarChart2, 
  Zap, 
  Lightbulb, 
  Network,
  Users,
  Clock,
  AlertTriangle,
  PlusCircle,
  Search,
  ArrowUpDown,
  X,
  History,
  ShieldCheck,
  Check,
  ChevronRight
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Data States
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'all_time' | 'last_30_days'>('all_time');
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [directionAnalytics, setDirectionAnalytics] = useState<DirectionAnalyticsItem[]>([]);
  const [members, setMembers] = useState<AdminMemberPerformanceItem[]>([]);
  
  // Table Filters
  const [memberSearch, setMemberSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberDetail, setMemberDetail] = useState<AdminMemberDetail | null>(null);
  const [loadingMemberDetail, setLoadingMemberDetail] = useState(false);

  // Manual Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState<number | ''>('');
  const [adjustPoints, setAdjustPoints] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // Fetch overview & directions
  const fetchOverviewData = async () => {
    try {
      const [ovData, dirData] = await Promise.all([
        api.getAdminAnalyticsOverview(dateRange),
        api.getAdminDirectionAnalytics()
      ]);
      setOverview(ovData);
      setDirectionAnalytics(dirData);
    } catch (err) {
      console.error('Failed to load analytics overview:', err);
    }
  };

  // Fetch members table
  const fetchMembersTable = async () => {
    try {
      const data = await api.getAdminMembersAnalytics(memberSearch, sortBy, sortOrder);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members analytics table:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchOverviewData(), fetchMembersTable()]);
      setLoading(false);
    };
    init();
  }, [dateRange]);

  useEffect(() => {
    fetchMembersTable();
  }, [memberSearch, sortBy, sortOrder]);

  // Open Member Detail Modal
  const handleOpenMemberDetail = async (userId: number) => {
    setSelectedMemberId(userId);
    setLoadingMemberDetail(true);
    try {
      const data = await api.getAdminMemberDetail(userId);
      setMemberDetail(data);
    } catch (err) {
      console.error('Failed to load member detail:', err);
    } finally {
      setLoadingMemberDetail(false);
    }
  };

  // Submit Manual Point Adjustment
  const handleManualAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId || !adjustPoints || !adjustReason) {
      setAdjustError('Barcha maydonlarni to\'ldirish shart.');
      return;
    }
    const pts = parseFloat(adjustPoints);
    if (isNaN(pts)) {
      setAdjustError('Ball haqiqiy son bo\'lishi kerak.');
      return;
    }
    if (adjustReason.trim().length < 5) {
      setAdjustError('Asos / sabab kamida 5 belgidan iborat bo\'lishi kerak.');
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError(null);
    try {
      await api.adjustMemberPoints({
        user_id: Number(adjustUserId),
        points: pts,
        reason: adjustReason.trim()
      });
      setAdjustSuccess('Ball muvaffaqiyatli o\'zgartirildi va hisobotga kiritildi.');
      
      // Refresh data
      await Promise.all([fetchOverviewData(), fetchMembersTable()]);
      if (selectedMemberId === Number(adjustUserId)) {
        const updatedDetail = await api.getAdminMemberDetail(Number(adjustUserId));
        setMemberDetail(updatedDetail);
      }

      setTimeout(() => {
        setShowAdjustModal(false);
        setAdjustSuccess(null);
        setAdjustPoints('');
        setAdjustReason('');
      }, 1200);
    } catch (err: any) {
      setAdjustError(err.message || 'Ball o\'zgartirishda xatolik yuz berdi.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Helper for direction icons
  const getDirectionIcon = (directionName: string) => {
    switch (directionName) {
      case 'Think & Read':
        return { icon: BookOpen, color: 'text-blue-600 bg-blue-50' };
      case 'Think & Discuss':
        return { icon: MessageSquare, color: 'text-teal-600 bg-teal-50' };
      case 'Think & Analyze':
        return { icon: BarChart2, color: 'text-indigo-600 bg-indigo-50' };
      case 'Think & Lead':
        return { icon: Zap, color: 'text-amber-600 bg-amber-50' };
      case 'Think & Create':
        return { icon: Lightbulb, color: 'text-purple-600 bg-purple-50' };
      case 'Think & Connect':
        return { icon: Network, color: 'text-emerald-600 bg-emerald-50' };
      default:
        return { icon: Compass, color: 'text-gray-600 bg-gray-50' };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header with Date Range & Operations */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              ThinkSpace Academic Operations
            </span>
            <span className="text-xs text-gray-400">• Analytics & Points Ledger</span>
          </div>
          <h1 className="text-xl font-serif font-bold text-navy-950 mt-1">
            Admin Analytics & Member Performance Hub
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Shaffof ballar tizimi, 6 yo'nalish tahlili va talabalar faolligi
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Date Range Selector */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center space-x-1 border border-gray-200">
            <button
              onClick={() => setDateRange('all_time')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                dateRange === 'all_time'
                  ? 'bg-white text-navy-950 shadow-sm'
                  : 'text-gray-600 hover:text-navy-950'
              }`}
            >
              Barcha davr
            </button>
            <button
              onClick={() => setDateRange('last_30_days')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                dateRange === 'last_30_days'
                  ? 'bg-white text-navy-950 shadow-sm'
                  : 'text-gray-600 hover:text-navy-950'
              }`}
            >
              Oxirgi 30 kun
            </button>
          </div>

          {/* Manual Adjustment Action */}
          <button
            onClick={() => {
              setAdjustUserId(members.length > 0 ? members[0].user_id : '');
              setShowAdjustModal(true);
            }}
            className="inline-flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Ball kiritish / tuzatish</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs bg-white rounded-2xl border border-gray-200">
          Tahliliy ko'rsatkichlar yuklanmoqda...
        </div>
      ) : (
        <>
          {/* Top Executive KPI Cards */}
          {overview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Members */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">A'zolar faolligi</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-navy-950">
                  {overview.active_members} <span className="text-sm font-sans font-normal text-gray-400">/ {overview.total_members}</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Faol topshiruvchilar nisbati: {overview.total_members > 0 ? Math.round((overview.active_members / overview.total_members) * 100) : 0}%
                </p>
              </div>

              {/* Card 2: Submissions & On-time */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">O'z vaqtida topshirish</span>
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-navy-950">
                  {overview.on_time_rate}%
                </div>
                <p className="text-[11px] text-gray-400">
                  {overview.on_time_submissions} ta o'z vaqtida ({overview.late_submissions} ta kechikkan)
                </p>
              </div>

              {/* Card 3: Average Finalized Score */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">O'rtacha o'zlashtirish</span>
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-serif font-bold text-navy-950">
                  {overview.average_finalized_score}%
                </div>
                <p className="text-[11px] text-gray-400">
                  Yakuniy baholangan topshiriqlar bo'yicha
                </p>
              </div>

              {/* Card 4: Total Points Ledger */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Tarqatilgan ballar</span>
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-navy-950">
                  {(overview.total_points_distributed ?? 0).toFixed(1)} <span className="text-sm font-sans font-normal text-gray-400">ball</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Natija + topshirish + intizom bonuslari
                </p>
              </div>
            </div>
          )}

          {/* Operational Alerts Row if discrepancies or pending evaluations */}
          {overview && (overview.discrepancies_count > 0 || overview.pending_evaluations_count > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Diqqat: Ko'rib chiqilishi kerak bo'lgan jarayonlar mavjud.</span>
                  <p className="text-amber-700 text-[11px] mt-0.5">
                    {overview.pending_evaluations_count} ta topshiriq yakuniy tasdiqlanishini kutmoqda, {overview.discrepancies_count} ta holatda baholovchilar tafovuti aniqlangan.
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-semibold px-2 py-1 rounded-lg">
                Moderatsiya talab etiladi
              </span>
            </div>
          )}

          {/* 6 ThinkSpace Directions Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-serif font-bold text-navy-950">
                6 ThinkSpace Yo'nalishi Bo'yicha Tahlil
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Har bir intellektual yo'nalish bo'yicha yuklama, qatnashish foizi va o'rtacha natijalar
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {directionAnalytics.map((dir) => {
                const { icon: Icon, color } = getDirectionIcon(dir.direction);
                return (
                  <div key={dir.direction} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-navy-950 text-xs">{dir.direction}</h3>
                        <p className="text-[10px] text-gray-400">
                          {dir.total_assignments} topshiriq • {dir.active_participants} faol a'zo
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Topshirilgan:</span>
                        <span className="font-semibold text-navy-950">{dir.total_submissions} ta</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">O'rtacha ball:</span>
                        <span className="font-semibold text-blue-700">{dir.average_score}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Member Performance & Points Ledger Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-serif font-bold text-navy-950">
                  A'zolar Reytingi va Ballar Jurnali
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Barcha a'zolarning jamlangan ko'rsatkichlari va shaxsiy hisob-kitoblari
                </p>
              </div>

              {/* Filters & Sorting */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Qidirish (ism, ID)..."
                    className="pl-8 pr-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-700 w-44"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none"
                >
                  <option value="points">Jami ball bo'yicha</option>
                  <option value="rank">O'rin bo'yicha</option>
                  <option value="name">Ism bo'yicha</option>
                  <option value="completion">Topshiriq soni</option>
                  <option value="score">O'rtacha foiz</option>
                </select>

                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
                  title="Tartibni o'zgartirish"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Table */}
            {members.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                A'zolar topilmadi.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px] border-y border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">O'rin</th>
                      <th className="py-2.5 px-3">A'zo</th>
                      <th className="py-2.5 px-3">Jami Ball</th>
                      <th className="py-2.5 px-3">Bajarilgan</th>
                      <th className="py-2.5 px-3">O'rtacha Sifat</th>
                      <th className="py-2.5 px-3">O'z Vaqtida / Kech</th>
                      <th className="py-2.5 px-3 text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map((m) => (
                      <tr key={m.user_id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-3 font-serif font-bold text-navy-950">
                          #{m.rank}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-navy-950">{m.display_name}</div>
                          <div className="text-[10px] text-gray-400">
                            {m.student_id ? `ID: ${m.student_id}` : ''} {m.faculty ? `• ${m.faculty}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-900">
                          {(m.total_points ?? 0).toFixed(1)} ball
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {m.completed_count ?? 0} topshiriq
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-700">
                          {(m.average_score ?? 0).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-gray-500">
                          <span className="text-emerald-700 font-semibold">{m.on_time_count ?? 0}</span>
                          <span className="mx-1">/</span>
                          <span className={(m.late_count ?? 0) > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}>
                            {m.late_count ?? 0}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenMemberDetail(m.user_id)}
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors border border-blue-200"
                          >
                            <span>Jurnal</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL 1: Member Detail & Points Ledger */}
      {selectedMemberId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-navy-950 text-white">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-400" />
                <h3 className="font-serif font-bold text-sm">
                  {memberDetail ? `${memberDetail.display_name || memberDetail.member?.display_name || 'A\'zo'} — Ballar Jurnali` : 'A\'zo Ma\'lumotlari'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMemberId(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingMemberDetail || !memberDetail ? (
                <div className="py-8 text-center text-xs text-gray-500">Ma'lumotlar yuklanmoqda...</div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Umumiy o'rin</span>
                      <span className="font-serif font-bold text-sm text-navy-950">
                        {memberDetail.rank || memberDetail.overall_rank ? `#${memberDetail.rank || memberDetail.overall_rank}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Jami ballar</span>
                      <span className="font-serif font-bold text-sm text-blue-900">
                        {(memberDetail.total_points ?? 0).toFixed(1)} ball
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">O'rtacha natija</span>
                      <span className="font-serif font-bold text-sm text-emerald-700">
                        {(((memberDetail as any).performance?.average_score) ?? memberDetail.average_percentage ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Direction Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-navy-950 mb-2">Yo'nalishlar bo'yicha ko'rsatkichlar</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Array.isArray(memberDetail.direction_breakdown) ? (
                        memberDetail.direction_breakdown.map((dirItem: any) => (
                          <div key={dirItem.direction} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-xs">
                            <span className="font-semibold text-gray-900 block truncate">{dirItem.direction}</span>
                            <span className="text-[11px] text-gray-500 block">
                              {((dirItem.total_score ?? dirItem.points) ?? 0).toFixed(1)} ball • {dirItem.assignments_completed ?? dirItem.completed ?? 0} ish
                            </span>
                          </div>
                        ))
                      ) : (
                        Object.entries(memberDetail.direction_breakdown || {}).map(([dirName, stat]: [string, any]) => (
                          <div key={dirName} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-xs">
                            <span className="font-semibold text-gray-900 block truncate">{dirName}</span>
                            <span className="text-[11px] text-gray-500 block">
                              {(stat?.points ?? 0).toFixed(1)} ball • {stat?.completed ?? 0} ish
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Transactions Ledger */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-navy-950">Ball operatsiyalari jurnali (Ledger)</h4>
                      <button
                        onClick={() => {
                          setAdjustUserId(selectedMemberId);
                          setShowAdjustModal(true);
                        }}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>Ball kiritish</span>
                      </button>
                    </div>

                    {((memberDetail.points_history || memberDetail.point_history) || []).length === 0 ? (
                      <div className="py-6 text-center text-xs text-gray-400">
                        Ball tranzaksiyalari mavjud emas.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {((memberDetail.points_history || memberDetail.point_history) || []).map((tx) => (
                          <div
                            key={tx.id}
                            className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                                {tx.transaction_type}
                              </span>
                              {tx.reason && <p className="text-[11px] text-gray-700">{tx.reason}</p>}
                              <p className="text-[9px] text-gray-400">
                                {new Date(tx.created_at).toLocaleString('uz-UZ')}
                              </p>
                            </div>
                            <span className={`font-mono font-bold ${(tx.points ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {(tx.points ?? 0) >= 0 ? `+${(tx.points ?? 0).toFixed(1)}` : (tx.points ?? 0).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => setSelectedMemberId(null)}
                className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Manual Point Adjustment Form */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-navy-950 text-white">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-sm">Ball kiritish / tuzatish</h3>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleManualAdjustmentSubmit} className="p-5 space-y-4 text-xs">
              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {adjustError}
                </div>
              )}
              {adjustSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{adjustSuccess}</span>
                </div>
              )}

              {/* Select Member */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">A'zoni tanlang</label>
                <select
                  value={adjustUserId}
                  onChange={(e) => setAdjustUserId(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-blue-700"
                  required
                >
                  <option value="">A'zoni tanlang...</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name} ({m.student_id || 'ID yo\'q'}) — Joriy: {(m.total_points ?? 0).toFixed(1)} ball
                    </option>
                  ))}
                </select>
              </div>

              {/* Points Delta */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Ball miqdori (+ qo'shish, - ayirish)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  placeholder="Masalan: 10 yoki -5"
                  className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-blue-700 font-mono"
                  required
                />
              </div>

              {/* Reason / Rationale */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Asos / Sabab (Audit jurnali uchun)
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Masalan: Faol intellektual ishtirok uchun rag'batlantirish..."
                  rows={3}
                  className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-blue-700"
                  required
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-4 py-2 bg-navy-900 text-white rounded-xl font-semibold hover:bg-navy-800 transition-colors disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Saqlanmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
