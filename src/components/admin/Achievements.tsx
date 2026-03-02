import React, { useState } from 'react';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { UserAchievement } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDateTime } from '../../utils/dateFormatter';
import { Pagination } from '../common/Pagination';

export function Achievements() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { addNotification } = useNotifications();

  const loadAchievements = async () => {
    if (!startDate || !endDate) {
      addNotification({ type: 'error', title: 'خطأ', message: 'حدد تاريخ البداية والنهاية' });
      return;
    }
    if (startDate > endDate) {
      addNotification({ type: 'error', title: 'خطأ', message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await dbOperations.getUsersAchievements(startDate, endDate);
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

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'مدير',
      employee: 'موظف',
      field_agent: 'محصل ميداني',
      branch_manager: 'مدير فرع'
    };
    return labels[role] || role;
  };

  const getTotalScore = (a: UserAchievement) =>
    a.records_added + a.records_added_dashboard + a.records_completed + a.records_updated;

  const totalItems = achievements.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAchievements = achievements.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center">
          <Trophy className="w-6 h-6 text-amber-500 ml-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">الانجازات</h2>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">من تاريخ (فلتر)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">إلى تاريخ (فلتر)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={loadAchievements}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            <TrendingUp className="w-4 h-4 ml-2" />
            {loading ? 'جاري التحميل...' : 'تطبيق الفلتر'}
          </button>
        </div>

        {achievements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">#</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المستخدم</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الدور</th>
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
                      {getRoleLabel(a.role)}
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

        {achievements.length > 0 && (
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

        {achievements.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {hasSearched
                ? 'لا توجد إنجازات في الفترة المحددة'
                : 'حدّد الفترة من التاريخ إلى التاريخ ثم اضغط تطبيق الفلتر لتحميل الإنجازات'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
