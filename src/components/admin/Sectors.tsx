import React, { useState, useEffect } from 'react';
import { PieChart, Users, FileText, Download } from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { formatNumberEn } from '../../utils/numberFormatter';
import { SECTOR_RECORD_PREFIXES } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { User, UserAchievement } from '../../types';

/** ترتيب القطاعات للعرض (حسب مرجع أرقام السجلات) */
const SECTOR_ORDER = Object.keys(SECTOR_RECORD_PREFIXES);

interface SectorStats {
  sector: string;
  sectorRecordCount: number;
  employeeCount: number;
  recordsAdded: number;
  recordsAddedField: number;
  recordsAddedDashboard: number;
  recordsCompleted: number;
  recordsRefused: number;
  recordsUpdated: number;
  recordsVerified: number;
  totalActions: number;
  /** نسبة الإنجاز من سجلات القطاع (مرجع رقم السجل) وليس من إجمالي السجلات */
  percentageFromSectorRecords: number;
}

function escapeCsvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type SortOrder = 'asc' | 'desc';

export function Sectors() {
  const [stats, setStats] = useState<SectorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [sectorRecordCounts, setSectorRecordCounts] = useState<Record<string, number>>({});
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const [usersData, achievementsData, recordCounts] = await Promise.all([
        dbOperations.getUsers(),
        dbOperations.getUsersAchievements('2000-01-01', endDate),
        dbOperations.getSectorRecordCounts()
      ]);
      setUsers(usersData);
      setAchievements(achievementsData);
      setSectorRecordCounts(recordCounts);
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
    const sectorStatsList: SectorStats[] = SECTOR_ORDER.map(sector => {
      const sectorUserIds = users
        .filter(u => u.is_active && !u.username.includes('(محذوف)') && (u.sector || '') === sector)
        .map(u => u.id);

      const sectorAchievements = achievements.filter(a => sectorUserIds.includes(a.user_id));

      const recordsAddedField = sectorAchievements.reduce((s, a) => s + a.records_added, 0);
      const recordsAddedDashboard = sectorAchievements.reduce((s, a) => s + a.records_added_dashboard, 0);
      const recordsCompleted = sectorAchievements.reduce((s, a) => s + a.records_completed, 0);
      const recordsRefused = sectorAchievements.reduce((s, a) => s + a.records_refused, 0);
      const recordsUpdated = sectorAchievements.reduce((s, a) => s + a.records_updated, 0);
      const recordsVerified = sectorAchievements.reduce((s, a) => s + (a.records_verified || 0), 0);
      const totalActions = recordsAddedField + recordsAddedDashboard + recordsCompleted + recordsUpdated + recordsVerified;

      const sectorRecordCount = sectorRecordCounts[sector] ?? 0;
      const percentageFromSectorRecords = sectorRecordCount > 0 ? (totalActions / sectorRecordCount) * 100 : 0;

      return {
        sector,
        sectorRecordCount,
        employeeCount: sectorUserIds.length,
        recordsAdded: recordsAddedField + recordsAddedDashboard,
        recordsAddedField,
        recordsAddedDashboard,
        recordsCompleted,
        recordsRefused,
        recordsUpdated,
        recordsVerified,
        totalActions,
        percentageFromSectorRecords
      };
    });

    setStats(sectorStatsList);
  }, [users, achievements, sectorRecordCounts]);

  const exportSectorsToCsv = () => {
    const headers = ['القطاع', 'عدد سجلات القطاع (مرجع)', 'عدد الموظفين', 'سجلات ميدانية', 'سجلات من الداشبورد', 'سجلات مكتملة', 'سجلات امتناع', 'تحديثات', 'تدقيق', 'الإجمالي', 'نسبة الإنجاز من سجلات القطاع %'];
    const rows: string[][] = [headers.map(escapeCsvCell)];
    const sorted = [...stats].sort((a, b) => sortOrder === 'desc' ? b.percentageFromSectorRecords - a.percentageFromSectorRecords : a.percentageFromSectorRecords - b.percentageFromSectorRecords);
    sorted.forEach(s => {
      rows.push([
        s.sector,
        String(s.sectorRecordCount),
        String(s.employeeCount),
        String(s.recordsAddedField),
        String(s.recordsAddedDashboard),
        String(s.recordsCompleted),
        String(s.recordsRefused),
        String(s.recordsUpdated),
        String(s.recordsVerified),
        String(s.totalActions),
        s.percentageFromSectorRecords.toFixed(1)
      ].map(escapeCsvCell));
    });
    const sumRec = sorted.reduce((s, x) => s + x.sectorRecordCount, 0);
    const sumEmp = sorted.reduce((s, x) => s + x.employeeCount, 0);
    const sumField = sorted.reduce((s, x) => s + x.recordsAddedField, 0);
    const sumDash = sorted.reduce((s, x) => s + x.recordsAddedDashboard, 0);
    const sumComp = sorted.reduce((s, x) => s + x.recordsCompleted, 0);
    const sumRef = sorted.reduce((s, x) => s + x.recordsRefused, 0);
    const sumUpd = sorted.reduce((s, x) => s + x.recordsUpdated, 0);
    const sumVer = sorted.reduce((s, x) => s + x.recordsVerified, 0);
    const sumTotal = sorted.reduce((s, x) => s + x.totalActions, 0);
    rows.push(['المجموع', String(sumRec), String(sumEmp), String(sumField), String(sumDash), String(sumComp), String(sumRef), String(sumUpd), String(sumVer), String(sumTotal), ''].map(escapeCsvCell));
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_القطاعات_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification({ type: 'success', title: 'تم التصدير', message: 'تم تصدير تقرير القطاعات مع صف المجموع' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ترتيب نسبة الإنجاز (من سجلات القطاع):</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="desc">من الأعلى إلى الأقل</option>
            <option value="asc">من الأقل إلى الأعلى</option>
          </select>
          <button
            type="button"
            onClick={exportSectorsToCsv}
            disabled={stats.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير التقرير (CSV)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...stats]
          .sort((a, b) =>
            sortOrder === 'desc'
              ? b.percentageFromSectorRecords - a.percentageFromSectorRecords
              : a.percentageFromSectorRecords - b.percentageFromSectorRecords
          )
          .map((s) => (
          <div
            key={s.sector}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-5 bg-gradient-to-l from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.sector}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  <FileText className="w-4 h-4" />
                  {loading ? '...' : `${formatNumberEn(s.sectorRecordCount)} سجل تابع للقطاع`}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  {loading ? '...' : `${formatNumberEn(s.employeeCount)} موظف`}
                </span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">سجلات مضافة</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {loading ? '...' : formatNumberEn(s.recordsAdded)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">سجلات مكتملة</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {loading ? '...' : formatNumberEn(s.recordsCompleted)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">سجلات امتناع</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {loading ? '...' : formatNumberEn(s.recordsRefused)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">تحديثات</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {loading ? '...' : formatNumberEn(s.recordsUpdated)}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">نسبة الإنجاز من سجلات القطاع</span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {loading ? '...' : `${formatNumberEn(s.percentageFromSectorRecords, { decimals: 1 })}%`}
                  </span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: loading ? '0%' : `${Math.min(s.percentageFromSectorRecords, 100)}%` }}
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
