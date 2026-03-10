import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Download, X, FileText } from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { UserAchievement, SECTORS, JOB_TITLES } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDateTime } from '../../utils/dateFormatter';
import { formatNumberEn } from '../../utils/numberFormatter';
import { Pagination } from '../common/Pagination';

export type AchievementRecordType = 'records_added' | 'records_added_dashboard' | 'records_completed' | 'records_refused' | 'records_updated' | 'records_verified';

const ACHIEVEMENT_TYPE_LABELS: Record<AchievementRecordType, string> = {
  records_added: 'سجلات ميدانية',
  records_added_dashboard: 'سجلات من الداشبورد',
  records_completed: 'سجلات مكتملة',
  records_refused: 'سجلات امتناع',
  records_updated: 'تحديثات',
  records_verified: 'تدقيق'
};

function escapeCsvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const START_DATE = '2000-01-01';
const REFRESH_INTERVAL_MS = 60000; // تحديث تلقائي كل دقيقة

const JOB_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'الكل' },
  ...JOB_TITLES.map((j) => ({ value: j, label: j }))
];

const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'records_added', label: 'سجلات ميدانية' },
  { value: 'records_added_dashboard', label: 'سجلات من الداشبورد' },
  { value: 'records_completed', label: 'سجلات مكتملة' },
  { value: 'records_refused', label: 'سجلات امتناع' },
  { value: 'records_updated', label: 'تحديثات' },
  { value: 'records_verified', label: 'تدقيق' },
  { value: 'total', label: 'الإجمالي' }
];

function CountCell({ count, onClick }: { count: number; onClick: () => void }) {
  if (count === 0) return <span>0</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="underline decoration-dotted hover:decoration-solid focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-0.5"
      title="عرض قائمة السجلات"
    >
      {count}
    </button>
  );
}

export function Achievements() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [recordsModal, setRecordsModal] = useState<{
    open: boolean;
    userName: string;
    type: AchievementRecordType;
    typeLabel: string;
    count: number;
    userId: string;
  } | null>(null);
  const [recordsList, setRecordsList] = useState<{ record_id: string; account_number: string | null; subscriber_name: string | null; action_at: string }[]>([]);
  const [recordsListLoading, setRecordsListLoading] = useState(false);
  const { addNotification } = useNotifications();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getTotalScore = (a: UserAchievement) =>
    a.records_added + a.records_added_dashboard + a.records_completed + a.records_updated + (a.records_verified || 0);

  const filteredAchievements = achievements.filter(a => {
    const jobMatch = jobFilter === 'all' || (a.job_title || '') === jobFilter;
    const sectorMatch = sectorFilter === 'all' || (a.sector || '') === sectorFilter;
    const typeMatch =
      typeFilter === 'all' ||
      (typeFilter === 'records_added' && (a.records_added || 0) > 0) ||
      (typeFilter === 'records_added_dashboard' && (a.records_added_dashboard || 0) > 0) ||
      (typeFilter === 'records_completed' && (a.records_completed || 0) > 0) ||
      (typeFilter === 'records_refused' && (a.records_refused || 0) > 0) ||
      (typeFilter === 'records_updated' && (a.records_updated || 0) > 0) ||
      (typeFilter === 'records_verified' && (a.records_verified || 0) > 0) ||
      (typeFilter === 'total' && getTotalScore(a) > 0);
    return jobMatch && sectorMatch && typeMatch;
  });

  const loadAchievements = async () => {
    const endDate = new Date().toISOString().slice(0, 10);
    setLoading(true);
    try {
      const data = await dbOperations.getUsersAchievements(START_DATE, endDate);
      setAchievements(data);
      setCurrentPage(1);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'خطأ',
        message: error instanceof Error ? error.message : 'فشل في تحميل الإنجازات'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
    refreshIntervalRef.current = setInterval(loadAchievements, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [jobFilter, sectorFilter, typeFilter]);

  const endDate = new Date().toISOString().slice(0, 10);

  const openRecordsModal = async (a: UserAchievement, type: AchievementRecordType, count: number) => {
    if (count === 0) return;
    setRecordsModal({
      open: true,
      userName: a.full_name || a.username || '—',
      type,
      typeLabel: ACHIEVEMENT_TYPE_LABELS[type],
      count,
      userId: a.user_id
    });
    setRecordsList([]);
    setRecordsListLoading(true);
    try {
      const list = await dbOperations.getAchievementRecords(a.user_id, type, START_DATE, endDate);
      setRecordsList(list);
    } catch (e) {
      addNotification({ type: 'error', title: 'خطأ', message: 'فشل في جلب قائمة السجلات' });
    } finally {
      setRecordsListLoading(false);
    }
  };

  const getJobTitleLabel = (job: string | null | undefined) => job || '-';

  const exportAchievementsToCsv = () => {
    const headers = ['#', 'المستخدم', 'اسم المستخدم', 'الوظيفة', 'القطاع', 'سجلات ميدانية', 'سجلات من الداشبورد', 'سجلات مكتملة', 'سجلات امتناع', 'تحديثات', 'تدقيق', 'الإجمالي', 'آخر نشاط'];
    const rows: string[][] = [headers.map(escapeCsvCell)];
    filteredAchievements.forEach((a, i) => {
      rows.push([
        i + 1,
        a.full_name ?? '',
        a.username ?? '',
        getJobTitleLabel(a.job_title),
        a.sector ?? '-',
        String(a.records_added ?? 0),
        String(a.records_added_dashboard ?? 0),
        String(a.records_completed ?? 0),
        String(a.records_refused ?? 0),
        String(a.records_updated ?? 0),
        String(a.records_verified ?? 0),
        String(getTotalScore(a)),
        a.last_activity ? formatDateTime(a.last_activity) : '—'
      ].map(escapeCsvCell));
    });
    const sumAdded = filteredAchievements.reduce((s, a) => s + (a.records_added ?? 0), 0);
    const sumDashboard = filteredAchievements.reduce((s, a) => s + (a.records_added_dashboard ?? 0), 0);
    const sumCompleted = filteredAchievements.reduce((s, a) => s + (a.records_completed ?? 0), 0);
    const sumRefused = filteredAchievements.reduce((s, a) => s + (a.records_refused ?? 0), 0);
    const sumUpdated = filteredAchievements.reduce((s, a) => s + (a.records_updated ?? 0), 0);
    const sumVerified = filteredAchievements.reduce((s, a) => s + (a.records_verified ?? 0), 0);
    const sumTotal = filteredAchievements.reduce((s, a) => s + getTotalScore(a), 0);
    rows.push(['', 'المجموع', '', '', '', String(sumAdded), String(sumDashboard), String(sumCompleted), String(sumRefused), String(sumUpdated), String(sumVerified), String(sumTotal), ''].map(escapeCsvCell));
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_الانجازات_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification({ type: 'success', title: 'تم التصدير', message: `تم تصدير ${formatNumberEn(filteredAchievements.length)} مستخدم مع صف المجموع` });
  };

  const totalItems = filteredAchievements.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAchievements = filteredAchievements.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center">
          <Trophy className="w-6 h-6 text-amber-500 ml-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">الانجازات</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">الوظيفة:</label>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
          >
            {JOB_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">القطاع:</label>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">الكل</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">حسب النوع:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
            title="عرض من لديهم إنجاز في هذا النوع فقط"
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportAchievementsToCsv}
            disabled={filteredAchievements.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير التقرير (CSV)
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {jobFilter === 'all' && typeFilter === 'all'
            ? 'إنجازات جميع الموظفين من بداية النظام حتى الآن — يتحدث تلقائياً'
            : typeFilter === 'all'
              ? `إنجازات ${JOB_FILTER_OPTIONS.find(o => o.value === jobFilter)?.label} فقط — يتحدث تلقائياً`
              : `عرض من لديهم إنجاز في: ${TYPE_FILTER_OPTIONS.find(o => o.value === typeFilter)?.label}${jobFilter !== 'all' ? ` (وظيفة: ${JOB_FILTER_OPTIONS.find(o => o.value === jobFilter)?.label})` : ''} — يتحدث تلقائياً`}
        </p>

        {filteredAchievements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">#</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المستخدم</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الوظيفة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">القطاع</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">سجلات ميدانية</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">سجلات من الداشبورد</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">سجلات مكتملة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">سجلات امتناع</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">تحديثات</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">تدقيق</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الإجمالي</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">آخر نشاط</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedAchievements.map((a, i) => {
                  const rank = startIndex + i + 1;
                  return (
                  <tr key={a.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {rank <= 3 && getTotalScore(a) > 0 ? (
                        <span className={`font-bold ${rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-gray-400' : 'text-amber-700'}`}>
                          {rank}
                        </span>
                      ) : (
                        rank
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {a.full_name}
                      <span className="block text-xs text-gray-500">{a.username}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {getJobTitleLabel(a.job_title)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {a.sector || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <CountCell count={a.records_added} onClick={() => openRecordsModal(a, 'records_added', a.records_added)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <CountCell count={a.records_added_dashboard} onClick={() => openRecordsModal(a, 'records_added_dashboard', a.records_added_dashboard)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-medium">
                      <CountCell count={a.records_completed} onClick={() => openRecordsModal(a, 'records_completed', a.records_completed)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      <CountCell count={a.records_refused} onClick={() => openRecordsModal(a, 'records_refused', a.records_refused)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <CountCell count={a.records_updated} onClick={() => openRecordsModal(a, 'records_updated', a.records_updated)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
                      <CountCell count={a.records_verified ?? 0} onClick={() => openRecordsModal(a, 'records_verified', a.records_verified ?? 0)} />
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">
                      {getTotalScore(a)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {a.last_activity ? formatDateTime(a.last_activity) : '—'}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}

        {filteredAchievements.length > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => {
                setItemsPerPage(n);
                setCurrentPage(1);
              }}
              loading={loading}
            />
          </div>
        )}

        {filteredAchievements.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {typeFilter === 'all'
                ? (jobFilter === 'all' ? 'لا توجد إنجازات' : `لا توجد إنجازات لـ ${JOB_FILTER_OPTIONS.find(o => o.value === jobFilter)?.label}`)
                : `لا يوجد من لديه إنجاز في "${TYPE_FILTER_OPTIONS.find(o => o.value === typeFilter)?.label}"${jobFilter !== 'all' ? ` لـ ${JOB_FILTER_OPTIONS.find(o => o.value === jobFilter)?.label}` : ''}`}
            </p>
          </div>
        )}
      </div>

      {/* مودال قائمة السجلات عند النقر على الرقم */}
      {recordsModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setRecordsModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {recordsModal.typeLabel} — {recordsModal.userName}
                </h3>
              </div>
              <button type="button" onClick={() => setRecordsModal(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {recordsListLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل السجلات...</p>
              ) : recordsList.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد سجلات.</p>
              ) : (
                <ul className="space-y-2">
                  {recordsList.map((r, i) => (
                    <li key={r.record_id || i} className="flex items-center justify-between gap-4 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 dark:text-white block truncate">{r.subscriber_name || '—'}</span>
                        <span className="text-gray-500 dark:text-gray-400">رقم الحساب: {r.account_number || '—'}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                        {r.action_at ? formatDateTime(r.action_at) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
              عدد السجلات: {formatNumberEn(recordsList.length)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
