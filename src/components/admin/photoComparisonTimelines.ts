import { CollectionRecord, RecordPhoto } from '../../types';

export function isRecordPhotoInvoiceBack(p: RecordPhoto): boolean {
  const n = p.notes || '';
  return (
    p.photo_type === 'invoice' &&
    (n.includes('ARCH:BACK') || n.includes('ظهر فاتورة'))
  );
}

export function isRecordPhotoInvoiceFace(p: RecordPhoto): boolean {
  return p.photo_type === 'invoice' && !isRecordPhotoInvoiceBack(p);
}

export type ViewerCategory = 'meter' | 'invoice_face' | 'invoice_back';

export interface TimelineRow {
  id: string;
  photo_url: string;
  sortDate: string;
  rowLabel: string;
  verified: boolean;
  rejected: boolean;
  source: 'main' | 'record';
  dbPhotoId?: string;
  notes?: string | null;
}

function parseTime(s: string): number {
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export const MAIN_METER_ID = '__main_meter__';
export const MAIN_INVOICE_FACE_ID = '__main_invoice_face__';
export const MAIN_INVOICE_BACK_ID = '__main_invoice_back__';

export function buildMeterTimeline(record: CollectionRecord | null, photos: RecordPhoto[]): TimelineRow[] {
  if (!record) return [];
  const extras = photos.filter(p => p.photo_type === 'meter');
  const acc: Omit<TimelineRow, 'rowLabel'>[] = [];
  const seen = new Set<string>();
  for (const p of extras) {
    const url = (p.photo_url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    acc.push({
      id: p.id,
      photo_url: url,
      sortDate: p.created_at,
      verified: !!p.verified,
      rejected: !!(p as { rejected?: boolean }).rejected,
      source: 'record',
      dbPhotoId: p.id,
      notes: p.notes ?? null,
    });
  }
  const main = (record.meter_photo_url || '').trim();
  if (main && !seen.has(main)) {
    acc.push({
      id: MAIN_METER_ID,
      photo_url: main,
      sortDate: record.updated_at || record.submitted_at,
      verified: !!record.meter_photo_verified,
      rejected: !!record.meter_photo_rejected,
      source: 'main',
    });
  }
  acc.sort((a, b) => parseTime(a.sortDate) - parseTime(b.sortDate));
  return acc.map((row, i) => ({
    ...row,
    rowLabel: i === 0 ? 'الصورة الأصلية' : `صورة إضافية #${i}`,
  }));
}

export function buildInvoiceFaceTimeline(record: CollectionRecord | null, photos: RecordPhoto[]): TimelineRow[] {
  if (!record) return [];
  const extras = photos.filter(isRecordPhotoInvoiceFace);
  const acc: Omit<TimelineRow, 'rowLabel'>[] = [];
  const seen = new Set<string>();
  for (const p of extras) {
    const url = (p.photo_url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    acc.push({
      id: p.id,
      photo_url: url,
      sortDate: p.created_at,
      verified: !!p.verified,
      rejected: !!(p as { rejected?: boolean }).rejected,
      source: 'record',
      dbPhotoId: p.id,
      notes: p.notes ?? null,
    });
  }
  const main = (record.invoice_photo_url || '').trim();
  if (main && !seen.has(main)) {
    acc.push({
      id: MAIN_INVOICE_FACE_ID,
      photo_url: main,
      sortDate: record.updated_at || record.submitted_at,
      verified: !!record.invoice_photo_verified,
      rejected: !!record.invoice_photo_rejected,
      source: 'main',
    });
  }
  acc.sort((a, b) => parseTime(a.sortDate) - parseTime(b.sortDate));
  return acc.map((row, i) => ({
    ...row,
    rowLabel: i === 0 ? 'الصورة الأصلية (وجه)' : `صورة إضافية #${i} (وجه)`,
  }));
}

export function buildInvoiceBackTimeline(record: CollectionRecord | null, photos: RecordPhoto[]): TimelineRow[] {
  if (!record) return [];
  const extras = photos.filter(isRecordPhotoInvoiceBack);
  const acc: Omit<TimelineRow, 'rowLabel'>[] = [];
  const seen = new Set<string>();
  for (const p of extras) {
    const url = (p.photo_url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    acc.push({
      id: p.id,
      photo_url: url,
      sortDate: p.created_at,
      verified: !!p.verified,
      rejected: !!(p as { rejected?: boolean }).rejected,
      source: 'record',
      dbPhotoId: p.id,
      notes: p.notes ?? null,
    });
  }
  const main = (record.invoice_photo_back_url || '').trim();
  if (main && !seen.has(main)) {
    acc.push({
      id: MAIN_INVOICE_BACK_ID,
      photo_url: main,
      sortDate: record.updated_at || record.submitted_at,
      verified: !!record.invoice_back_photo_verified,
      rejected: !!record.invoice_back_photo_rejected,
      source: 'main',
    });
  }
  acc.sort((a, b) => parseTime(a.sortDate) - parseTime(b.sortDate));
  return acc.map((row, i) => ({
    ...row,
    rowLabel: i === 0 ? 'الصورة الأصلية (ظهر)' : `صورة إضافية #${i} (ظهر)`,
  }));
}

export function pickFirstTimelineRow(record: CollectionRecord | null, photos: RecordPhoto[]): {
  category: ViewerCategory;
  row: TimelineRow;
} | null {
  const m = buildMeterTimeline(record, photos);
  if (m[0]) return { category: 'meter', row: m[0] };
  const f = buildInvoiceFaceTimeline(record, photos);
  if (f[0]) return { category: 'invoice_face', row: f[0] };
  const b = buildInvoiceBackTimeline(record, photos);
  if (b[0]) return { category: 'invoice_back', row: b[0] };
  return null;
}

export function timelineRowToRecordPhoto(
  recordId: string,
  row: TimelineRow,
  category: ViewerCategory
): RecordPhoto {
  const photo_type = category === 'meter' ? 'meter' : 'invoice';
  return {
    id: row.id,
    record_id: recordId,
    photo_type,
    photo_url: row.photo_url,
    photo_date: row.sortDate,
    created_by: null,
    created_at: row.sortDate,
    notes: row.notes ?? null,
    verified: row.verified,
    ...(row.rejected ? { rejected: true } : {}),
  } as RecordPhoto;
}

export function computeVerificationAggregates(record: CollectionRecord | null, photos: RecordPhoto[]) {
  const meter = buildMeterTimeline(record, photos);
  const face = buildInvoiceFaceTimeline(record, photos);
  const back = buildInvoiceBackTimeline(record, photos);
  const groups = [meter, face, back].filter(g => g.length > 0);
  const flat = groups.flat();
  const allVerified = groups.length > 0 && groups.every(g => g.every(r => r.verified));
  const anyRejected = flat.some(r => r.rejected);
  return { allVerified, anyRejected, meter, face, back, flat };
}
