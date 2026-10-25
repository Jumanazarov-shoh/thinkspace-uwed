import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, MembershipRequest, RoleName } from '../../types';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Award,
  Filter,
  Plus,
  Clock,
  Send,
  Calendar,
  BookOpen,
  Mail,
  X
} from 'lucide-react';

export const AdminMembersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'members'>('requests');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Messaging Modal State
  const [messagingUser, setMessagingUser] = useState<{ id: number; name: string; username?: string } | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const isSuperAdmin = currentUser?.roles.some(r => r.role_name === 'super_admin');
  const canReview = currentUser?.roles.some(r => r.role_name === 'super_admin' || r.role_name === 'moderator');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [memList, reqList] = await Promise.all([
        api.listMembers('approved'),
        api.listMembershipRequests('pending').catch(() => [])
      ]);
      setMembers(memList);
      setRequests(reqList);
    } catch (err) {
      console.error('Error fetching members data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReviewRequest = async (requestId: number, action: 'approve' | 'reject') => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.reviewMembershipRequest(requestId, action);
      setMessage({
        type: 'success',
        text: action === 'approve'
          ? "A'zolik arizasi muvaffaqiyatli tasdiqlandi (Talabaga Telegram orqali xabar yuborildi)."
          : "A'zolik arizasi rad etildi (Talabaga xabar berildi)."
      });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Harakatni bajarishda xatolik yuz berdi.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRole = async (userId: number, roleName: RoleName) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.assignRole(userId, roleName);
      setMessage({ type: 'success', text: `Rol ${roleName} muvaffaqiyatli berildi.` });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Rolni biriktirishda xatolik.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRole = async (userId: number, roleName: RoleName) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.removeRole(userId, roleName);
      setMessage({ type: 'success', text: `Rol ${roleName} olib tashlandi.` });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Rolni bekor qilishda xatolik.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectApprove = async (userId: number) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.approveMember(userId);
      setMessage({ type: 'success', text: "Foydalanuvchi muvaffaqiyatli tasdiqlandi va unga Telegram xabari yetkazildi." });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Tasdiqlashda xatolik yuz berdi.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messagingUser || !messageBody.trim()) return;
    setIsSendingMessage(true);
    try {
      await api.sendMessageToMember(messagingUser.id, messageBody.trim());
      setMessage({
        type: 'success',
        text: `Xabar ${messagingUser.name} (${messagingUser.username ? '@' + messagingUser.username : 'ID: ' + messagingUser.id}) ning Telegramiga yetkazildi!`
      });
      setMessagingUser(null);
      setMessageBody('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Xabar yuborishda xatolik yuz berdi.' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.display_name?.toLowerCase().includes(q) ||
      m.student_id?.toLowerCase().includes(q) ||
      m.faculty?.toLowerCase().includes(q) ||
      (m.username && m.username.toLowerCase().includes(q))
    );
  });

  const availableRoles: RoleName[] = ['evaluator', 'senior_reviewer', 'moderator', 'super_admin'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              Academic Membership
            </span>
            <span className="text-xs text-gray-400">• SIEM & UWED Community</span>
          </div>
          <h1 className="text-xl font-serif font-bold text-navy-950 mt-1">
            Club Members & Role Permissions
          </h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-gray-100 p-1 text-xs shrink-0 font-medium">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'requests' ? 'bg-white text-navy-950 shadow-xs font-semibold' : 'text-gray-500 hover:text-navy-900'
            }`}
          >
            Pending Applications ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'members' ? 'bg-white text-navy-950 shadow-xs font-semibold' : 'text-gray-500 hover:text-navy-900'
            }`}
          >
            Member Directory ({members.length})
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tab 1: Pending Membership Applications */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              Arizalar yuklanmoqda (Loading requests)...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
              <p className="font-medium text-navy-900">Ko'rib chiqilishi kerak bo'lgan arizalar mavjud emas</p>
              <p className="text-xs text-gray-400">All membership requests have been reviewed!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.map((req) => {
                const applicantName = req.user?.display_name || `Foydalanuvchi #${req.user_id}`;
                const applicantFaculty = req.faculty || req.user?.faculty || 'SIEM Fakulteti';
                const applicantStudentId = req.student_id || req.user?.student_id || 'N/A';
                const applicantUsername = req.user?.username 
                  ? `@${req.user.username}` 
                  : (req.user?.telegram_id ? `ID: ${req.user.telegram_id}` : 'Noma\'lum');
                const appDate = req.created_at ? new Date(req.created_at).toLocaleDateString('uz-UZ', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Yaqinda';

                return (
                  <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 text-xs">
                    <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center font-serif text-sm">
                          {applicantName.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-navy-950 text-sm">{applicantName}</h3>
                          <div className="flex items-center space-x-2 text-[11px] text-gray-500 mt-0.5">
                            <span className="text-blue-700 font-medium">{applicantUsername}</span>
                            <span>•</span>
                            <span>{applicantFaculty}</span>
                            <span>•</span>
                            <span className="font-mono text-gray-400">ID: {applicantStudentId}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
                        Pending
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Ariza sanasi: <b className="text-gray-600 font-medium">{appDate}</b></span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">
                        Tanlangan yo'nalishlar:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {req.chosen_directions && req.chosen_directions.length > 0 ? (
                          req.chosen_directions.map((d, i) => (
                            <span key={i} className="bg-blue-50 text-blue-900 border border-blue-100 px-2 py-0.5 rounded text-[11px] font-medium">
                              {d.replace('_', ' ')}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic">Tanlanmagan</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">
                        Ariza izohi / Motivatsiya:
                      </span>
                      <p className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-gray-700 italic leading-relaxed text-[11px]">
                        "{req.statement || 'Platforma a\'zoligi uchun ariza topshirildi.'}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        onClick={() => setMessagingUser({ id: req.user_id, name: applicantName, username: req.user?.username })}
                        className="px-3 py-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 font-medium rounded-lg transition flex items-center space-x-1"
                        title="Talabaga to'g'ridan-to'g'ri Telegram xabari yozish"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Xabar yozish</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleReviewRequest(req.id, 'reject')}
                          disabled={actionLoading || !canReview}
                          className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 font-medium rounded-lg transition disabled:opacity-50"
                        >
                          Rad etish
                        </button>
                        <button
                          onClick={() => handleReviewRequest(req.id, 'approve')}
                          disabled={actionLoading || !canReview}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Tasdiqlash (Approve)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Member Directory */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center space-x-3 text-xs">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="A'zoni ismi, talaba ID yoki fakultet bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-navy-900"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Klub A'zosi</th>
                  <th className="py-3.5 px-4">Fakultet & Student ID</th>
                  <th className="py-3.5 px-4">Biriktirilgan Rollar</th>
                  <th className="py-3.5 px-4">Holati</th>
                  <th className="py-3.5 px-4 text-right">Amallar & Rol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-navy-900">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      Hech qanday a'zo topilmadi (No approved members found).
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="font-semibold text-sm text-navy-950">{m.display_name}</div>
                            <div className="text-[11px] text-gray-400">
                              {m.username ? `@${m.username}` : `Telegram ID: ${m.telegram_id}`}
                            </div>
                          </div>
                          <button
                            onClick={() => setMessagingUser({ id: m.id, name: m.display_name, username: m.username })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Telegram orqali xabar yuborish"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        <div>{m.faculty || 'SIEM'}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{m.student_id || 'N/A'}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {m.roles?.map((r) => (
                            <span
                              key={r.id}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center ${
                                r.role_name === 'super_admin' ? 'bg-purple-100 text-purple-800 font-bold' :
                                r.role_name === 'moderator' ? 'bg-indigo-100 text-indigo-800' :
                                r.role_name === 'senior_reviewer' ? 'bg-blue-100 text-blue-800' :
                                r.role_name === 'evaluator' ? 'bg-teal-100 text-teal-800' :
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {r.role_name.replace('_', ' ')}
                              {isSuperAdmin && r.role_name !== 'member' && (
                                <button
                                  onClick={() => handleRemoveRole(m.id, r.role_name as RoleName)}
                                  className="ml-1 text-gray-400 hover:text-red-600 font-bold"
                                  title="Rolni bekor qilish"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                            m.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            m.status === 'suspended' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {m.status}
                          </span>
                          {m.status === 'pending' && isSuperAdmin && (
                            <button
                              onClick={() => handleDirectApprove(m.id)}
                              disabled={actionLoading}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold shadow-xs transition"
                              title="Tasdiqlash (Approve)"
                            >
                              ✓ Approve
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isSuperAdmin && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignRole(m.id, e.target.value as RoleName);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            className="px-2.5 py-1 border border-gray-300 rounded text-[11px] bg-white text-navy-900 font-medium focus:outline-none"
                          >
                            <option value="" disabled>+ Rol biriktirish</option>
                            {availableRoles
                              .filter(ar => !m.roles?.some(r => r.role_name === ar))
                              .map(ar => (
                                <option key={ar} value={ar}>
                                  {ar.replace('_', ' ')}
                                </option>
                              ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Direct Telegram Message Modal */}
      {messagingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy-950 text-sm">Shaxsiy Telegram xabari</h3>
                  <p className="text-xs text-gray-500">
                    Qabul qiluvchi: <b className="text-navy-900">{messagingUser.name}</b> {messagingUser.username ? `(@${messagingUser.username})` : ''}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setMessagingUser(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Xabar matni:
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={5}
                placeholder="Talabaga yuboriladigan ko'rsatma, eslatma yoki shaxsiy xabarni kiriting..."
                className="w-full p-3.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed text-navy-900"
              />
              <p className="text-[11px] text-gray-400">
                Ushbu xabar to'g'ridan-to'g'ri talabaning Telegram botiga ThinkSpace ma'muriyati nomidan yetkaziladi.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t">
              <button
                onClick={() => setMessagingUser(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg transition"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isSendingMessage || !messageBody.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingMessage ? "Yuborilmoqda..." : "Telegramga yuborish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
