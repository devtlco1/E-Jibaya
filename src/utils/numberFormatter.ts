/**
 * تنسيق الأرقام بأرقام إنجليزية (0-9) في كل أنحاء النظام
 */

const enFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true
});

const enIntegerFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true
});

/**
 * تنسيق رقم بأرقام إنجليزية (0-9) مع فواصل الآلاف
 */
export function formatNumberEn(
  value: number | null | undefined,
  options?: { decimals?: number; integersOnly?: boolean }
): string {
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
    return '0';
  }
  const n = Number(value);
  if (isNaN(n)) return '0';
  if (options?.integersOnly) return enIntegerFormatter.format(n);
  if (options?.decimals !== undefined) {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
      useGrouping: true
    });
    return formatter.format(n);
  }
  return enFormatter.format(n);
}

/**
 * تنسيق مبلغ (عملة) بأرقام إنجليزية
 */
export function formatCurrencyEn(
  amount: number | null | undefined,
  options?: { decimals?: number; suffix?: string }
): string {
  const decimals = options?.decimals ?? 2;
  const suffix = options?.suffix ?? 'د.ع';
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `- ${suffix}`;
  }
  const n = Number(amount);
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  });
  const formatted = formatter.format(Math.abs(n));
  return `${formatted} ${suffix}`;
}
