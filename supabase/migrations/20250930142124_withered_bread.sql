/*
  # إضافة بيانات تجريبية للنظام

  1. البيانات المضافة
    - 50 سجل جباية بحالات مختلفة
    - بيانات متنوعة للمشتركين
    - مواقع جغرافية مختلفة
    - حالات: pending, completed, reviewed, refused
  
  2. التوزيع
    - 15 سجل قيد المراجعة
    - 15 سجل مكتمل
    - 10 سجل تمت المراجعة
    - 10 سجل امتناع
*/

-- إدراج البيانات التجريبية
INSERT INTO collection_records (
  field_agent_id,
  gps_latitude,
  gps_longitude,
  meter_photo_url,
  invoice_photo_url,
  notes,
  is_refused,
  subscriber_name,
  account_number,
  meter_number,
  address,
  last_reading,
  status,
  submitted_at,
  completed_by
) VALUES
-- سجلات قيد المراجعة (15 سجل)
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7136, 46.6753, 'https://picsum.photos/400/300?random=1', 'https://picsum.photos/400/300?random=51', 'تم قراءة المقياس بنجاح', false, 'أحمد محمد العلي', '1001', 'M001', 'حي الملز، شارع الأمير محمد بن عبدالعزيز', '1250', 'pending', NOW() - INTERVAL '1 day', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7236, 46.6853, 'https://picsum.photos/400/300?random=2', 'https://picsum.photos/400/300?random=52', 'قراءة طبيعية', false, 'فاطمة سعد الحربي', '1002', 'M002', 'حي النرجس، شارع التخصصي', '980', 'pending', NOW() - INTERVAL '2 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7336, 46.6953, 'https://picsum.photos/400/300?random=3', null, 'لم يتم العثور على فاتورة', false, 'خالد عبدالله الشمري', '1003', 'M003', 'حي العليا، طريق الملك فهد', '1450', 'pending', NOW() - INTERVAL '3 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7436, 46.7053, null, 'https://picsum.photos/400/300?random=53', 'مشكلة في تحديد الموقع', false, 'نورا أحمد القحطاني', '1004', 'M004', 'حي الروضة، شارع الستين', '750', 'pending', NOW() - INTERVAL '4 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7536, 46.7153, 'https://picsum.photos/400/300?random=4', 'https://picsum.photos/400/300?random=54', 'تم التحقق من البيانات', false, 'محمد سالم الدوسري', '1005', 'M005', 'حي الياسمين، شارع الأمير سلطان', '1100', 'pending', NOW() - INTERVAL '5 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7636, 46.7253, 'https://picsum.photos/400/300?random=5', 'https://picsum.photos/400/300?random=55', 'قراءة عادية', false, 'سارة محمد الغامدي', '1006', 'M006', 'حي الفيصلية، طريق الدائري الشرقي', '890', 'pending', NOW() - INTERVAL '6 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7736, 46.7353, 'https://picsum.photos/400/300?random=6', null, 'فاتورة غير واضحة', false, 'عبدالرحمن علي المطيري', '1007', 'M007', 'حي الصحافة، شارع الإمام سعود', '1350', 'pending', NOW() - INTERVAL '7 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7836, 46.7453, 'https://picsum.photos/400/300?random=7', 'https://picsum.photos/400/300?random=56', 'تم بنجاح', false, 'هند فهد العتيبي', '1008', 'M008', 'حي الربوة، شارع التحلية', '1200', 'pending', NOW() - INTERVAL '8 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.7936, 46.7553, null, 'https://picsum.photos/400/300?random=57', 'مشكلة تقنية في GPS', false, 'يوسف حمد الراشد', '1009', 'M009', 'حي الورود، طريق الملك عبدالله', '950', 'pending', NOW() - INTERVAL '9 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8036, 46.7653, 'https://picsum.photos/400/300?random=8', 'https://picsum.photos/400/300?random=58', 'قراءة صحيحة', false, 'أمل سعود الزهراني', '1010', 'M010', 'حي الشفا، شارع الأمير تركي', '1050', 'pending', NOW() - INTERVAL '10 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8136, 46.7753, 'https://picsum.photos/400/300?random=9', null, 'لا توجد فاتورة', false, 'طارق عبدالعزيز السديري', '1011', 'M011', 'حي الغدير، شارع الأمير محمد', '1300', 'pending', NOW() - INTERVAL '11 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8236, 46.7853, 'https://picsum.photos/400/300?random=10', 'https://picsum.photos/400/300?random=59', 'تم التحقق', false, 'ريم خالد الأحمد', '1012', 'M012', 'حي النخيل، طريق الدائري الغربي', '800', 'pending', NOW() - INTERVAL '12 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8336, 46.7953, 'https://picsum.photos/400/300?random=11', 'https://picsum.photos/400/300?random=60', 'قراءة طبيعية', false, 'عمر فيصل البقمي', '1013', 'M013', 'حي الأندلس، شارع الملك فيصل', '1150', 'pending', NOW() - INTERVAL '13 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8436, 46.8053, null, 'https://picsum.photos/400/300?random=61', 'خطأ في الموقع', false, 'لينا محمد الحكمي', '1014', 'M014', 'حي الحمراء، شارع العروبة', '920', 'pending', NOW() - INTERVAL '14 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8536, 46.8153, 'https://picsum.photos/400/300?random=12', 'https://picsum.photos/400/300?random=62', 'تم بنجاح', false, 'بدر سليمان الشهري', '1015', 'M015', 'حي الواحة، طريق الملك خالد', '1400', 'pending', NOW() - INTERVAL '15 days', null),

-- سجلات مكتملة (15 سجل)
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8636, 46.8253, 'https://picsum.photos/400/300?random=13', 'https://picsum.photos/400/300?random=63', 'تم الانتهاء من الجباية', false, 'منى عبدالله الفيصل', '2001', 'M016', 'حي السلام، شارع الأمير نايف', '1250', 'completed', NOW() - INTERVAL '16 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8736, 46.8353, 'https://picsum.photos/400/300?random=14', 'https://picsum.photos/400/300?random=64', 'جباية ناجحة', false, 'سلطان راشد العنزي', '2002', 'M017', 'حي الخزامى، شارع التخصصي', '980', 'completed', NOW() - INTERVAL '17 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8836, 46.8453, 'https://picsum.photos/400/300?random=15', null, 'مكتمل بدون فاتورة', false, 'رانيا أحمد الخالد', '2003', 'M018', 'حي الفلاح، طريق الدائري الشمالي', '1450', 'completed', NOW() - INTERVAL '18 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.8936, 46.8553, null, 'https://picsum.photos/400/300?random=65', 'مكتمل بدون موقع', false, 'حسام فهد الدوسري', '2004', 'M019', 'حي الرمال، شارع الأمير سعود', '750', 'completed', NOW() - INTERVAL '19 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9036, 46.8653, 'https://picsum.photos/400/300?random=16', 'https://picsum.photos/400/300?random=66', 'تم بالكامل', false, 'جواهر سعد المالكي', '2005', 'M020', 'حي الإزدهار، شارع الملك عبدالله', '1100', 'completed', NOW() - INTERVAL '20 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9136, 46.8753, 'https://picsum.photos/400/300?random=17', 'https://picsum.photos/400/300?random=67', 'جباية مكتملة', false, 'وليد محمد الحارثي', '2006', 'M021', 'حي الصفا، طريق الملك فهد', '890', 'completed', NOW() - INTERVAL '21 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9236, 46.8853, 'https://picsum.photos/400/300?random=18', null, 'انتهى بنجاح', false, 'نادية علي القرني', '2007', 'M022', 'حي المروج، شارع الأمير محمد', '1350', 'completed', NOW() - INTERVAL '22 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9336, 46.8953, 'https://picsum.photos/400/300?random=19', 'https://picsum.photos/400/300?random=68', 'تم الإنجاز', false, 'فهد عبدالرحمن الشمري', '2008', 'M023', 'حي النهضة، شارع التحلية', '1200', 'completed', NOW() - INTERVAL '23 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9436, 46.9053, null, 'https://picsum.photos/400/300?random=69', 'مكتمل جزئياً', false, 'دانا خالد الغامدي', '2009', 'M024', 'حي الريان، طريق الدائري الشرقي', '950', 'completed', NOW() - INTERVAL '24 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9536, 46.9153, 'https://picsum.photos/400/300?random=20', 'https://picsum.photos/400/300?random=70', 'جباية تامة', false, 'ماجد سليمان العتيبي', '2010', 'M025', 'حي الوادي، شارع الأمير تركي', '1050', 'completed', NOW() - INTERVAL '25 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9636, 46.9253, 'https://picsum.photos/400/300?random=21', null, 'مكتمل بدون صورة فاتورة', false, 'شيماء فيصل الراشد', '2011', 'M026', 'حي الأمل، شارع الملك فيصل', '1300', 'completed', NOW() - INTERVAL '26 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9736, 46.9353, 'https://picsum.photos/400/300?random=22', 'https://picsum.photos/400/300?random=71', 'انتهى بالكامل', false, 'عادل حمد البقمي', '2012', 'M027', 'حي الجنادرية، طريق الملك خالد', '800', 'completed', NOW() - INTERVAL '27 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9836, 46.9453, 'https://picsum.photos/400/300?random=23', 'https://picsum.photos/400/300?random=72', 'تم بنجاح كامل', false, 'هيفاء محمد الحكمي', '2013', 'M028', 'حي الفيحاء، شارع العروبة', '1150', 'completed', NOW() - INTERVAL '28 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 24.9936, 46.9553, null, 'https://picsum.photos/400/300?random=73', 'مكتمل بدون GPS', false, 'تركي عبدالعزيز الشهري', '2014', 'M029', 'حي الخليج، طريق الدائري الغربي', '920', 'completed', NOW() - INTERVAL '29 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0036, 46.9653, 'https://picsum.photos/400/300?random=24', 'https://picsum.photos/400/300?random=74', 'جباية مثالية', false, 'لطيفة سعود الفيصل', '2015', 'M030', 'حي الندى، شارع الأمير نايف', '1400', 'completed', NOW() - INTERVAL '30 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),

-- سجلات تمت المراجعة (10 سجل)
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0136, 46.9753, 'https://picsum.photos/400/300?random=25', 'https://picsum.photos/400/300?random=75', 'تمت المراجعة والموافقة', false, 'راكان علي العنزي', '3001', 'M031', 'حي الحزم، شارع التخصصي', '1250', 'reviewed', NOW() - INTERVAL '31 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0236, 46.9853, 'https://picsum.photos/400/300?random=26', 'https://picsum.photos/400/300?random=76', 'مراجعة مكتملة', false, 'غادة فهد الخالد', '3002', 'M032', 'حي الشرق، طريق الدائري الشمالي', '980', 'reviewed', NOW() - INTERVAL '32 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0336, 46.9953, 'https://picsum.photos/400/300?random=27', null, 'تمت المراجعة بدون فاتورة', false, 'بندر راشد الدوسري', '3003', 'M033', 'حي الغروب، شارع الأمير سعود', '1450', 'reviewed', NOW() - INTERVAL '33 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0436, 47.0053, null, 'https://picsum.photos/400/300?random=77', 'مراجعة بدون موقع', false, 'أسماء حمد المالكي', '3004', 'M034', 'حي الفجر، شارع الملك عبدالله', '750', 'reviewed', NOW() - INTERVAL '34 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0536, 47.0153, 'https://picsum.photos/400/300?random=28', 'https://picsum.photos/400/300?random=78', 'مراجعة شاملة', false, 'زياد سليمان الحارثي', '3005', 'M035', 'حي النور، طريق الملك فهد', '1100', 'reviewed', NOW() - INTERVAL '35 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0636, 47.0253, 'https://picsum.photos/400/300?random=29', 'https://picsum.photos/400/300?random=79', 'تمت المراجعة بنجاح', false, 'إيمان عبدالله القرني', '3006', 'M036', 'حي السعادة، شارع الأمير محمد', '890', 'reviewed', NOW() - INTERVAL '36 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0736, 47.0353, 'https://picsum.photos/400/300?random=30', null, 'مراجعة نهائية', false, 'حاتم فيصل الشمري', '3007', 'M037', 'حي الأمان، شارع التحلية', '1350', 'reviewed', NOW() - INTERVAL '37 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0836, 47.0453, 'https://picsum.photos/400/300?random=31', 'https://picsum.photos/400/300?random=80', 'مراجعة معتمدة', false, 'نوال خالد الغامدي', '3008', 'M038', 'حي الرخاء، طريق الدائري الشرقي', '1200', 'reviewed', NOW() - INTERVAL '38 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.0936, 47.0553, null, 'https://picsum.photos/400/300?random=81', 'مراجعة جزئية', false, 'صالح عبدالرحمن العتيبي', '3009', 'M039', 'حي الكرامة، شارع الأمير تركي', '950', 'reviewed', NOW() - INTERVAL '39 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), 25.1036, 47.0653, 'https://picsum.photos/400/300?random=32', 'https://picsum.photos/400/300?random=82', 'مراجعة تامة', false, 'فاتن سعد الراشد', '3010', 'M040', 'حي العزيزية، شارع الملك فيصل', '1050', 'reviewed', NOW() - INTERVAL '40 days', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),

-- سجلات امتناع (10 سجل)
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'العميل امتنع عن الدفع - رفض التعاون', true, 'عبدالمجيد حمد البقمي', '4001', 'M041', 'حي الصناعية، طريق الملك خالد', null, 'pending', NOW() - INTERVAL '41 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'امتناع كامل - لم يفتح الباب', true, 'سلمى فهد الحكمي', '4002', 'M042', 'حي التعاون، شارع العروبة', null, 'pending', NOW() - INTERVAL '42 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'رفض دفع الفاتورة', true, 'مشعل عبدالعزيز الشهري', '4003', 'M043', 'حي الدار البيضاء، طريق الدائري الغربي', null, 'pending', NOW() - INTERVAL '43 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'امتناع بسبب خلاف على المبلغ', true, 'وفاء سليمان الفيصل', '4004', 'M044', 'حي المنصورة، شارع الأمير نايف', null, 'pending', NOW() - INTERVAL '44 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'العميل غير موجود - امتناع', true, 'طلال راشد العنزي', '4005', 'M045', 'حي الخالدية، شارع التخصصي', null, 'pending', NOW() - INTERVAL '45 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'رفض استقبال المحصل', true, 'هيا محمد الخالد', '4006', 'M046', 'حي البديعة، طريق الدائري الشمالي', null, 'pending', NOW() - INTERVAL '46 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'امتناع لأسباب شخصية', true, 'نواف علي الدوسري', '4007', 'M047', 'حي الشميسي، شارع الأمير سعود', null, 'pending', NOW() - INTERVAL '47 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'رفض التعامل مع الشركة', true, 'ريما فيصل المالكي', '4008', 'M048', 'حي الدريهمية، شارع الملك عبدالله', null, 'pending', NOW() - INTERVAL '48 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'امتناع بسبب عدم وجود نقود', true, 'عثمان حمد الحارثي', '4009', 'M049', 'حي الجزيرة، طريق الملك فهد', null, 'pending', NOW() - INTERVAL '49 days', null),
((SELECT id FROM users WHERE role = 'field_agent' LIMIT 1), null, null, null, null, 'رفض قاطع للدفع', true, 'جميلة سعود القرني', '4010', 'M050', 'حي الملقا، شارع الأمير محمد', null, 'pending', NOW() - INTERVAL '50 days', null);