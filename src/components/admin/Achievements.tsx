import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users } from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { UserAchievement, SECTORS, JOB_TITLES } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDateTime } from '../../utils/dateFormatter';
import { Pagination } from '../common/Pagination';

const START_DATE = '2000-01-01';
const REFRESH_INTERVAL_MS = 60000; // تحديث تلقائي كل دقيقة

const JOB_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'الكل' },
  ...JOB_TITLES.map((j) => ({ value: j, label: j }))
];

export function Achievements() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const filteredAchievements = achievements.filter(a => {
    const jobMatch = jobFilter === 'all' || (a.job_title || '') === jobFilter;
    const sectorMatch = sectorFilter === 'all' || (a.sector || '') === sectorFilter;
    return jobMatch && sectorMatch;
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
  }, [jobFilter, sectorFilter]);

  const getJobTitleLabel = (job: string | null | undefined) => job || '-';

  const getTotalScore = (a: UserAchievement) =>
    a.records_added + a.records_added_dashboard + a.records_completed + a.records_updated;

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
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {jobFilter === 'all'
            ? 'إنجازات جميع الموظفين من بداية النظام حتى الآن — يتحدث تلقائياً'
            : `إنجازات ${JOB_FILTER_OPTIONS.find(o => o.value === jobFilter)?.label} فقط — يتحدث تلقائياً`}
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
                      {a.records_added}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {a.records_added_dashboard}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-medium">
                      {a.records_completed}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      {a.records_refused}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {a.records_updated}
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
              {jobFilter === 'all' ? 'لا توجد إنجازات' : `لا توجد إنجازات لـ ${JOB_FILTER_OPTIONS.find(o => o.value === jobFilter)?.label}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
