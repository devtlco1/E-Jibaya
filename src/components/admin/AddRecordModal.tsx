import React, { useState } from 'react';
import { X, FileText, Camera, Shield } from 'lucide-react';
import { CreateRecordFromDashboardData } from '../../types';
import { dbOperations } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface AddRecordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const initialForm = {
  subscriber_name: '',
  account_number: '',
  meter_number: '',
  region: '',
  district: '',
  last_reading: '',
  new_zone: '',
  new_block: '',
  new_home: '',
  category: null as 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | null,
  phase: null as 'احادي' | 'ثلاثي' | 'سي تي' | 'المحولة الخاصة' | 'مقياس الكتروني' | null,
  multiplier: '',
  total_amount: '',
  current_amount: '',
  land_status: null as 'متروك' | 'مهدوم' | 'لم اعثر عليه' | 'ممتنع' | 'تجاوز' | 'قيد الانشاء' | 'مبدل' | 'مغلق' | 'لايوجد مقياس' | 'فحص مقياس' | 'فارغ' | 'خطاء في القراءة' | 'إيقاف قراءة' | 'عاطل' | null,
  status: 'pending' as 'pending' | 'completed' | 'refused'
};

export function AddRecordModal({ onClose, onSuccess }: AddRecordModalProps) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.account_number?.trim()) {
      addNotification({ type: 'error', title: 'خطأ', message: 'رقم الحساب مطلوب' });
      return;
    }
    if (!form.subscriber_name?.trim()) {
      addNotification({ type: 'error', title: 'خطأ', message: 'اسم المشترك مطلوب' });
      return;
    }
    if (!form.meter_number?.trim()) {
      addNotification({ type: 'error', title: 'خطأ', message: 'رقم المقياس مطلوب' });
      return;
    }
    if (!form.category) {
      addNotification({ type: 'error', title: 'خطأ', message: 'الصنف مطلوب' });
      return;
    }
    if (!form.phase) {
      addNotification({ type: 'error', title: 'خطأ', message: 'نوع المقياس مطلوب' });
      return;
    }
    if (!/^\d+$/.test(form.account_number.trim()) || form.account_number.length > 12) {
      addNotification({ type: 'error', title: 'خطأ', message: 'رقم الحساب يجب أن يكون أرقام فقط وحتى 12 رقم' });
      return;
    }

    setSubmitting(true);
    try {
      const data: CreateRecordFromDashboardData = {
        subscriber_name: form.subscriber_name.trim(),
        account_number: form.account_number.trim(),
        meter_number: form.meter_number.trim(),
        region: form.region.trim() || '',
        district: form.district.trim() || '',
        last_reading: form.last_reading.trim() || '',
        new_zone: form.new_zone.trim() || null,
        new_block: form.new_block.trim() || null,
        new_home: form.new_home.trim() || null,
        category: form.category,
        phase: form.phase,
        multiplier: form.multiplier.trim() || null,
        total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
        current_amount: form.current_amount ? parseFloat(form.current_amount) : null,
        land_status: form.land_status,
        status: form.status
      };

      const record = await dbOperations.createRecordFromDashboard(data);

      if (record && user) {
        try {
          await dbOperations.createActivityLog({
            user_id: user.id,
            action: 'create_record',
            target_type: 'record',
            target_id: record.id,
            target_name: record.subscriber_name || record.account_number || 'سجل جديد',
            details: { from_dashboard: true }
          });
        } catch (logError) {
          console.warn('Failed to log activity:', logError);
        }
      }

      addNotification({ type: 'success', title: 'تم بنجاح', message: 'تم إضافة السجل. المحصل الميداني سيكمل الصور والموقع لاحقاً.' });
      onSuccess();
      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'خطأ',
        message: error instanceof Error ? error.message : 'فشل في إضافة السجل'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">إضافة سجل جديد</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            أضف بيانات السجل الأساسية. المحصل الميداني سيرفع الصور والموقع عند الزيارة.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-4">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center">
              <FileText className="w-4 h-4 ml-2" /> البيانات الأساسية
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المشترك *</label>
                <input
                  type="text"
                  value={form.subscriber_name}
                  onChange={(e) => setForm({ ...form, subscriber_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الحساب *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.account_number}
                  onChange={(e) => /^\d*$/.test(e.target.value) && e.target.value.length <= 12 && setForm({ ...form, account_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  maxLength={12}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم المقياس *</label>
                <input
                  type="text"
                  value={form.meter_number}
                  onChange={(e) => setForm({ ...form, meter_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">آخر قراءة</label>
                <input
                  type="text"
                  value={form.last_reading}
                  onChange={(e) => setForm({ ...form, last_reading: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المنطقة</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المقاطعة</label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              <FileText className="w-4 h-4 ml-2" /> الصنف *
            </h4>
            <div className="flex flex-wrap gap-2">
              {(['منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    form.category === cat ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              <Camera className="w-4 h-4 ml-2" /> نوع المقياس *
            </h4>
            <div className="flex flex-wrap gap-2">
              {(['احادي', 'ثلاثي', 'سي تي', 'المحولة الخاصة', 'مقياس الكتروني'] as const).map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setForm({ ...form, phase: ph })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    form.phase === ph ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {ph}
                </button>
              ))}
            </div>
            {form.phase === 'سي تي' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">معامل الضرب</label>
                <input
                  type="text"
                  value={form.multiplier}
                  onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="مثال: 100"
                />
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">الترميز الجديد</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الزون</label>
                <input
                  type="text"
                  value={form.new_zone}
                  onChange={(e) => setForm({ ...form, new_zone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">البلوك</label>
                <input
                  type="text"
                  value={form.new_block}
                  onChange={(e) => setForm({ ...form, new_block: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المنزل</label>
                <input
                  type="text"
                  value={form.new_home}
                  onChange={(e) => setForm({ ...form, new_home: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">المبالغ</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المجموع المطلوب</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.total_amount}
                  onChange={(e) => (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) && setForm({ ...form, total_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ المستلم</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.current_amount}
                  onChange={(e) => (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) && setForm({ ...form, current_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              <Shield className="w-4 h-4 ml-2" /> حالة الارض
            </h4>
            <div className="flex flex-wrap gap-2">
              {(['متروك', 'مهدوم', 'لم اعثر عليه', 'ممتنع', 'تجاوز', 'قيد الانشاء', 'مبدل', 'مغلق', 'لايوجد مقياس', 'فحص مقياس', 'فارغ', 'خطاء في القراءة', 'إيقاف قراءة', 'عاطل'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm({ ...form, land_status: form.land_status === opt ? null : opt })}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${
                    form.land_status === opt ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              <Shield className="w-4 h-4 ml-2" /> حالة السجل
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, status: 'pending' })}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${form.status === 'pending' ? 'bg-yellow-500 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300'}`}
              >
                قيد المراجعة
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, status: 'completed' })}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${form.status === 'completed' ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300'}`}
              >
                مكتمل
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, status: 'refused' })}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${form.status === 'refused' ? 'bg-red-500 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300'}`}
              >
                امتنع
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'جاري الإضافة...' : 'إضافة السجل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
