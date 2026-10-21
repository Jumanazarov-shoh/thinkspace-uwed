import React, { useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { RoleName } from '../../types';
import { 
  User as UserIcon, 
  ShieldCheck, 
  Globe, 
  BookMarked, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Send 
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const { user, loginAs, refreshUser } = useAuth();

  // Membership Application Form State
  const [statement, setStatement] = useState('');
  const [studentId, setStudentId] = useState(user?.student_id || '');
  const [faculty, setFaculty] = useState(user?.faculty || 'School of International Economics and Management (SIEM)');
  const [selectedDirs, setSelectedDirs] = useState<string[]>([
    'Think & Read',
    'Think & Analyze'
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement || statement.length < 10) {
      alert('Iltimos, motivatsion xatingizni kamida 10 ta belgida yozing.');
      return;
    }

    setSubmitting(true);
    try {
      await api.applyForMembership({
        statement,
        chosen_directions: selectedDirs,
        student_id: studentId,
        faculty: faculty,
      });
      setApplied(true);
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDir = (dir: string) => {
    if (selectedDirs.includes(dir)) {
      setSelectedDirs(selectedDirs.filter(d => d !== dir));
    } else {
      setSelectedDirs([...selectedDirs, dir]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-serif font-bold text-lg text-navy-900 leading-tight">
          {t.profile.title}
        </h2>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-navy-900 text-white flex items-center justify-center font-serif font-bold text-lg border-2 border-blue-600/40">
            {user?.first_name ? user.first_name[0] : 'U'}
          </div>
          <div className="truncate flex-1">
            <h3 className="font-serif font-bold text-base text-navy-900 truncate">
              {user?.display_name || 'Foydalanuvchi'}
            </h3>
            <p className="text-xs text-gray-500 font-mono truncate">
              @{user?.username || `id:${user?.telegram_id}`}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
            user?.status === 'approved' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            {user?.status === 'approved' ? t.common.approved : t.common.pending}
          </span>
        </div>

        <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-400 text-[10px] uppercase font-semibold">{t.profile.studentId}</p>
            <p className="font-medium text-gray-800">{user?.student_id || 'Kiritilmagan'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-[10px] uppercase font-semibold">{t.profile.faculty}</p>
            <p className="font-medium text-gray-800 truncate">{user?.faculty || 'UWED SIEM'}</p>
          </div>
        </div>
      </div>

      {/* Membership Application Form (if pending and not applied yet) */}
      {user?.status === 'pending' && !applied && (
        <form onSubmit={handleApply} className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-1.5 text-amber-800 font-serif font-bold text-sm">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Klub a'zoligi uchun ariza</span>
          </div>
          <p className="text-xs text-gray-600 font-sans">
            ThinkSpace | UWED intellektual klubiga qo'shilish uchun qisqacha ma'lumot qoldiring:
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Talaba ID va Fakultet:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="UWED ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="text-xs p-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
              <input
                type="text"
                placeholder="Fakultet"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                className="text-xs p-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Qiziqqan yo'nalishlaringizni tanlang:
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                'Think & Read',
                'Think & Discuss',
                'Think & Analyze',
                'Think & Lead',
                'Think & Create',
                'Think & Connect'
              ].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDir(d)}
                  className={`p-1.5 rounded text-left text-[11px] font-medium border transition-colors ${
                    selectedDirs.includes(d)
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  {selectedDirs.includes(d) ? '✓ ' : '+ '} {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nega ThinkSpace'ga qo'shilmoqchisiz? (Motivatsiya):
            </label>
            <textarea
              rows={3}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Qiziqishlaringiz, maqsadlaringiz va qaysi sohada rivojlanmoqchi ekanligingiz haqida..."
              className="w-full text-xs p-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Arizani yuborish</span>
          </button>
        </form>
      )}

      {/* ThinkSpace Passport Teaser */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-950 text-white rounded-xl p-4 shadow-md space-y-2 relative overflow-hidden">
        <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-semibold">
          <BookMarked className="w-4 h-4" />
          <span>{t.profile.passportTitle}</span>
        </div>
        <h4 className="font-serif font-bold text-sm text-white">
          Sizning shaxsiy intellektual pasportingiz
        </h4>
        <p className="text-[11px] text-gray-300 font-sans leading-relaxed">
          {t.profile.passportDesc}
        </p>
      </div>

      {/* Language Preferences */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-2">
        <h4 className="font-serif font-bold text-xs text-navy-900 flex items-center space-x-1.5">
          <Globe className="w-3.5 h-3.5 text-blue-700" />
          <span>{t.profile.language}</span>
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => setLanguage('uz')}
            className={`py-2 px-3 rounded-lg font-medium border text-center transition-all ${
              language === 'uz'
                ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            O'zbekcha (UZ)
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`py-2 px-3 rounded-lg font-medium border text-center transition-all ${
              language === 'en'
                ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            English (EN)
          </button>
        </div>
      </div>

      {/* Role Switcher in Dev Mode */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-2">
        <h4 className="font-serif font-bold text-xs text-navy-900 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{t.profile.devSwitcher}</span>
        </h4>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
          {(['super_admin', 'moderator', 'senior_reviewer', 'evaluator', 'member'] as RoleName[]).map((r) => (
            <button
              key={r}
              onClick={() => loginAs(r)}
              className={`p-1.5 rounded text-center border truncate ${
                user?.roles.some(ur => ur.role_name === r)
                  ? 'bg-blue-700 text-white font-bold border-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
