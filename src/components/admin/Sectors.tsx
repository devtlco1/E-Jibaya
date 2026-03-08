import React, { useState, useEffect } from 'react';
import { PieChart, Users, TrendingUp, Activity } from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { SECTORS } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { User, UserAchievement } from '../../types';

interface SectorStats {
  sector: string;
  employeeCount: number;
  recordsAdded: number;
  recordsCompleted: number;
  recordsRefused: number;
  recordsUpdated: number;
  totalActions: number;
  percentageOfTotal: number;
}

type SortOrder = 'asc' | 'desc';

export function Sectors() {
  const [stats, setStats] = useState<SectorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const [usersData, achievementsData] = await Promise.all([
        dbOperations.getUsers(),
        dbOperations.getUsersAchievements('2000-01-01', endDate)
      ]);
      setUsers(usersData);
      setAchievements(achievementsData);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'خطأ',
        message: error instanceof Error ? error.message : 'فشل في تحميل بيانات القطاعات'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!users.length && !achievements.length) return;

    const totalActionsAll = achievements.reduce(
      (sum, a) => sum + a.records_added + a.records_added_dashboard + a.records_completed + a.records_updated,
      0
    );

    const sectorStatsList: SectorStats[] = SECTORS.map(sector => {
      const sectorUserIds = users
        .filter(u => u.is_active && !u.username.includes('(محذوف)') && (u.sector || '') === sector)
        .map(u => u.id);

      const sectorAchievements = achievements.filter(a => sectorUserIds.includes(a.user_id));

      const recordsAdded = sectorAchievements.reduce((s, a) => s + a.records_added, 0);
      const recordsAddedDashboard = sectorAchievements.reduce((s, a) => s + a.records_added_dashboard, 0);
      const recordsCompleted = sectorAchievements.reduce((s, a) => s + a.records_completed, 0);
      const recordsRefused = sectorAchievements.reduce((s, a) => s + a.records_refused, 0);
      const recordsUpdated = sectorAchievements.reduce((s, a) => s + a.records_updated, 0);
      const totalActions = recordsAdded + recordsAddedDashboard + recordsCompleted + recordsUpdated;

      const percentageOfTotal = totalActionsAll > 0 ? (totalActions / totalActionsAll) * 100 : 0;

      return {
        sector,
        employeeCount: sectorUserIds.length,
        recordsAdded: recordsAdded + recordsAddedDashboard,
        recordsCompleted,
        recordsRefused,
        recordsUpdated,
        totalActions,
        percentageOfTotal
      };
    });

    setStats(sectorStatsList);
  }, [users, achievements]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center">
          <PieChart className="w-6 h-6 text-indigo-500 ml-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">القطاعات</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ترتيب نسبة الإنجاز:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="desc">من الأعلى إلى الأقل</option>
            <option value="asc">من الأقل إلى الأعلى</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        ملخص إنجازات كل قطاع — عدد الموظفين، العمل المنجز، ونسبة الإنجاز من الإجمالي
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...stats]
          .sort((a, b) =>
            sortOrder === 'desc'
              ? b.percentageOfTotal - a.percentageOfTotal
              : a.percentageOfTotal - b.percentageOfTotal
          )
          .map((s, i) => (
          <div
            key={s.sector}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-5 bg-gradient-to-l from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.sector}</h3>
              <div className="mt-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {s.employeeCount} موظف
                </span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">سجلات مضافة</span>
                <span className="font-medium text-gray-900 dark:text-white">{s.recordsAdded}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">سجلات مكتملة</span>
                <span className="font-medium text-gray-900 dark:text-white">{s.recordsCompleted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">سجلات امتناع</span>
                <span className="font-medium text-gray-900 dark:text-white">{s.recordsRefused}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">تحديثات</span>
                <span className="font-medium text-gray-900 dark:text-white">{s.recordsUpdated}</span>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">نسبة الإنجاز</span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {s.percentageOfTotal.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${Math.min(s.percentageOfTotal, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
