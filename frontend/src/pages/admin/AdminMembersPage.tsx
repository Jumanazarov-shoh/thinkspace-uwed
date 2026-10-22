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
  Plus
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

  const isSuperAdmin = currentUser?.roles.some(r => r.role_name === 'super_admin');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [memList, reqList] = await Promise.all([
        api.listMembers(),
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
        text: `Application successfully ${action === 'approve' ? 'approved' : 'rejected'}.`
      });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRole = async (userId: number, roleName: RoleName) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.assignRole(userId, roleName);
      setMessage({ type: 'success', text: `Role ${roleName} granted.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to grant role.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRole = async (userId: number, roleName: RoleName) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.removeRole(userId, roleName);
      setMessage({ type: 'success', text: `Role ${roleName} revoked.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to revoke role.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveMember = async (userId: number) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.approveMember(userId);
      setMessage({ type: 'success', text: "Foydalanuvchi muvaffaqiyatli tasdiqlandi (Member approved)." });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Tasdiqlashda xatolik yuz berdi.' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.display_name?.toLowerCase().includes(q) ||
      m.student_id?.toLowerCase().includes(q) ||
      m.faculty?.toLowerCase().includes(q)
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
              activeTab === 'requests' ? 'bg-white text-navy-950 shadow-xs' : 'text-gray-500 hover:text-navy-900'
            }`}
          >
            Pending Applications ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'members' ? 'bg-white text-navy-950 shadow-xs' : 'text-gray-500 hover:text-navy-900'
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
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              No pending applications. All membership requests have been reviewed!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.map((req) => (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center font-serif text-sm">
                        {req.user?.display_name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-navy-950 text-sm">{req.user?.display_name || `User #${req.user_id}`}</h3>
                        <p className="text-[11px] text-gray-400">
                          {req.faculty || req.user?.faculty || 'SIEM'} • ID: {req.student_id || req.user?.student_id || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">
                      Pending
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">
                      Chosen Directions:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {req.chosen_directions?.map((d, i) => (
                        <span key={i} className="bg-gray-100 text-navy-900 px-2 py-0.5 rounded text-[11px]">
                          {d.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">
                      Statement of Motivation:
                    </span>
                    <p className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-gray-700 italic leading-relaxed text-[11px]">
                      "{req.statement}"
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleReviewRequest(req.id, 'reject')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 font-medium rounded-lg transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReviewRequest(req.id, 'approve')}
                      disabled={actionLoading}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg shadow-sm transition"
                    >
                      Approve Membership
                    </button>
                  </div>
                </div>
              ))}
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
              placeholder="Search member by name, student ID, or faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-navy-900"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Member</th>
                  <th className="py-3.5 px-4">Faculty & Student ID</th>
                  <th className="py-3.5 px-4">Active Roles</th>
                  <th className="py-3.5 px-4">Status</th>
                  {isSuperAdmin && <th className="py-3.5 px-4 text-right">Role Management</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-navy-900">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-sm text-navy-950">{m.display_name}</div>
                      <div className="text-[11px] text-gray-400">
                        {m.username ? `@${m.username}` : `Telegram ID: ${m.telegram_id}`}
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
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
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
                                className="ml-1 text-gray-400 hover:text-red-600"
                                title="Revoke role"
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
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
                          m.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          m.status === 'suspended' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {m.status}
                        </span>
                        {m.status === 'pending' && isSuperAdmin && (
                          <button
                            onClick={() => handleApproveMember(m.id)}
                            disabled={actionLoading}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold shadow-xs transition"
                            title="Tasdiqlash (Approve)"
                          >
                            ✓ Approve
                          </button>
                        )}
                      </div>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-4 px-4 text-right">
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
                          <option value="" disabled>+ Grant Role</option>
                          {availableRoles
                            .filter(ar => !m.roles?.some(r => r.role_name === ar))
                            .map(ar => (
                              <option key={ar} value={ar}>
                                {ar.replace('_', ' ')}
                              </option>
                            ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
