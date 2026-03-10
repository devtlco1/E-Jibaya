import React, { useState } from 'react';
import { Search, User as UserIcon, MapPin, DollarSign, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { dbOperations } from '../../lib/supabase';
import { formatDateTime } from '../../utils/dateFormatter';
import { formatNumberEn } from '../../utils/numberFormatter';
import type { CollectionRecord, CollectionPayment } from '../../types';

export function FieldCollectorView() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [accountQuery, setAccountQuery] = useState('');
  const [searchedRecord, setSearchedRecord] = useState<CollectionRecord | null>(null);
  const [payments, setPayments] = useState<CollectionPayment[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noRecordFound, setNoRecordFound] = useState(false);

  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNotes, setNewPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  if (user && user.role !== 'field_agent') {
    return null;
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = accountQuery.trim();
    if (!query) {
      addNotification(
        {
          type: 'warning',
          title: 'رقم الحساب مطلوب',
          message: 'يرجى إدخال رقم الحساب أولاً'
        },
        { showAsToast: true }
      );
      return;
    }

    try {
      setSearchLoading(true);
      setSearchedRecord(null);
      setPayments([]);
      setNoRecordFound(false);

      const record = await dbOperations.getRecordByAccountNumber(query);
      if (record) {
        setSearchedRecord(record);
        const recordPayments = await dbOperations.getPaymentsForRecord(record.id);
        setPayments(recordPayments);
      } else {
        setNoRecordFound(true);
      }
    } catch (error) {
      console.error('Field collector search error:', error);
      addNotification(
        {
          type: 'error',
          title: 'خطأ في البحث',
          message: error instanceof Error ? error.message : 'حدث خطأ أثناء البحث عن السجل'
        },
        { showAsToast: true }
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedRecord || !user) return;

    const amountValue = parseFloat(newPaymentAmount.replace(',', '.'));
    if (!newPaymentAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      addNotification(
        {
          type: 'warning',
          title: 'مبلغ الدفعة غير صالح',
          message: 'يرجى إدخال مبلغ دفعة أكبر من الصفر'
        },
        { showAsToast: true }
      );
      return;
    }

    try {
      setPaymentLoading(true);
      const payment = await dbOperations.addPaymentToRecord(searchedRecord.id, {
        amount: amountValue,
        collector_id: user.id,
        notes: newPaymentNotes || undefined
      });

      if (payment) {
        setPayments(prev => [payment, ...prev]);
        // حدّث قيمة current_amount في السجل المعروض محلياً
        setSearchedRecord(prev =>
          prev
            ? {
                ...prev,
                current_amount:
                  (typeof prev.current_amount === 'number' ? prev.current_amount : 0) + amountValue
              }
            : prev
        );

        setNewPaymentAmount('');
        setNewPaymentNotes('');

        addNotification(
          {
            type: 'success',
            title: 'تم تسجيل الدفعة',
            message: `تم تسجيل دفعة بمبلغ ${formatNumberEn(amountValue)} دينار`
          },
          { showAsToast: true }
        );
      }
    } catch (error) {
      console.error('Add payment error:', error);
      addNotification(
        {
          type: 'error',
          title: 'فشل في تسجيل الدفعة',
          message: error instanceof Error ? error.message : 'حدث خطأ أثناء تسجيل الدفعة'
        },
        { showAsToast: true }
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Search className="w-4 h-4 ml-2" />
          واجهة المحصل الميداني - البحث برقم الحساب
        </h2>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="text"
            value={accountQuery}
            onChange={(e) => setAccountQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-sm"
            placeholder="أدخل رقم الحساب"
          />
          <button
            type="submit"
            disabled={searchLoading}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors min-w-[120px]"
          >
            {searchLoading ? 'جاري البحث...' : 'بحث'}
          </button>
        </form>
      </div>

      {searchedRecord && (
        <div className="space-y-6">
          {/* ملخص السجل */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <UserIcon className="w-4 h-4 ml-2" />
              ملخص السجل
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">اسم المشترك</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {searchedRecord.subscriber_name || 'غير محدد'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">رقم الحساب</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {searchedRecord.account_number || 'غير محدد'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">المنطقة / المقاطعة</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {[searchedRecord.region, searchedRecord.district].filter(Boolean).join(' - ') || 'غير محدد'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">الصنف</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {searchedRecord.category || 'غير محدد'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">نوع المقياس</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {searchedRecord.phase || 'غير محدد'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">المبالغ</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  <span className="inline-block mr-1">المطلوب:</span>
                  <span className="inline-block">
                    {searchedRecord.total_amount != null
                      ? formatNumberEn(searchedRecord.total_amount)
                      : '-'}
                  </span>
                  <span className="inline-block mx-1">/</span>
                  <span className="inline-block mr-1">المدفوع:</span>
                  <span className="inline-block">
                    {searchedRecord.current_amount != null
                      ? formatNumberEn(searchedRecord.current_amount)
                      : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* نموذج استلام دفعة جديدة */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <DollarSign className="w-4 h-4 ml-2" />
              استلام دفعة جديدة
            </h3>
            <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  مبلغ الدفعة (دينار)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPaymentAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*([.,]?\d*)?$/.test(value)) {
                      setNewPaymentAmount(value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white"
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={newPaymentNotes}
                  onChange={(e) => setNewPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-800 dark:text-white resize-none"
                  placeholder="اكتب أي ملاحظات عن الدفعة (اختياري)"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {paymentLoading ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
                </button>
              </div>
            </form>
          </div>

          {/* سجل الدفعات */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Clock className="w-4 h-4 ml-2" />
              سجل الدفعات
            </h3>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد دفعات مسجلة لهذا السجل بعد.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatNumberEn(p.amount)} دينار
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(p.collected_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.notes && (
                        <span className="text-xs text-gray-600 dark:text-gray-300 max-w-xs line-clamp-2">
                          {p.notes}
                        </span>
                      )}
                      {p.collector_id && (
                        <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          محصل
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {noRecordFound && !searchedRecord && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-100 rounded-xl p-4 sm:p-5 text-sm flex items-start gap-3">
          <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
          <div>
            <p className="font-semibold mb-1">لا يوجد سجل بهذا الرقم</p>
            <p className="text-xs sm:text-sm">
              رقم الحساب الذي أدخلته غير موجود في النظام حالياً. سيتم في خطوة لاحقة دعم إنشاء سجل جديد مباشرة من واجهة
              المحصل بهذا الرقم وتسجيل أول دفعة عليه.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

