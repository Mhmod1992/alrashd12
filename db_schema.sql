-- ================================================================
-- قاعدة بيانات Supabase - النسخة الكاملة والدقيقة
-- تم استخراجه من كود التطبيق مباشرة (types.ts + AppContext + scopes)
-- تاريخ الاستخراج: 2026-10-11
-- ================================================================

-- ================================================================
-- 0. الإضافات (Extensions)
-- ================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ================================================================
-- 1. الدوال المساعدة (Helper Functions)
-- ================================================================

-- دالة تحديث عمود updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';


-- ================================================================
-- دالة إنشاء طلب فحص متكاملة (Single Shot RPC)
-- تتعامل مع العميل، السيارة، والطلب في معاملة واحدة
-- ================================================================
CREATE OR REPLACE FUNCTION create_inspection_request_v3(
    p_client_name TEXT,
    p_client_phone TEXT,
    p_car_make_id UUID,
    p_car_model_id UUID,
    p_car_year INTEGER,
    p_plate_number TEXT,
    p_plate_number_en TEXT,
    p_vin TEXT,
    p_car_snapshot JSONB,
    p_inspection_type_id UUID,
    p_payment_type TEXT,
    p_payment_note TEXT,
    p_split_payment_details JSONB,
    p_price NUMERIC,
    p_status TEXT,
    p_employee_id UUID,
    p_broker JSONB,
    p_created_at TIMESTAMPTZ,
    p_reservation_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_client_id UUID;
    v_car_id UUID;
    v_request_id UUID;
    v_result JSONB;
BEGIN
    -- 1. التعامل مع العميل (بحث أو إنشاء)
    SELECT id INTO v_client_id FROM clients WHERE phone = p_client_phone LIMIT 1;

    IF v_client_id IS NULL THEN
        INSERT INTO clients (name, phone)
        VALUES (p_client_name, p_client_phone)
        RETURNING id INTO v_client_id;
    ELSE
        UPDATE clients SET name = p_client_name WHERE id = v_client_id AND name != p_client_name;
    END IF;

    -- 2. التعامل مع السيارة (بحث أو إنشاء)
    IF p_vin IS NOT NULL AND p_vin != '' THEN
        SELECT id INTO v_car_id FROM cars WHERE vin = p_vin LIMIT 1;
    ELSIF p_plate_number IS NOT NULL AND p_plate_number != '' THEN
        SELECT id INTO v_car_id FROM cars WHERE plate_number = p_plate_number LIMIT 1;
    END IF;

    IF v_car_id IS NULL THEN
        INSERT INTO cars (make_id, model_id, year, plate_number, plate_number_en, vin)
        VALUES (p_car_make_id, p_car_model_id, p_car_year, p_plate_number, p_plate_number_en, p_vin)
        RETURNING id INTO v_car_id;
    ELSE
        UPDATE cars
        SET make_id = p_car_make_id,
            model_id = p_car_model_id,
            year = p_car_year,
            plate_number = p_plate_number,
            plate_number_en = p_plate_number_en,
            vin = p_vin
        WHERE id = v_car_id;
    END IF;

    -- 3. إنشاء طلب الفحص
    INSERT INTO inspection_requests (
        client_id, car_id, car_snapshot, inspection_type_id,
        payment_type, payment_note, split_payment_details,
        price, status, employee_id, broker, created_at, reservation_id,
        inspection_data, general_notes, category_notes, structured_findings, activity_log, attached_files
    )
    VALUES (
        v_client_id, v_car_id, p_car_snapshot, p_inspection_type_id,
        p_payment_type, p_payment_note, p_split_payment_details,
        p_price, p_status, p_employee_id, p_broker, p_created_at, p_reservation_id,
        '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
    )
    RETURNING id INTO v_request_id;

    -- 4. تحديث حالة الحجز إذا تم التحويل من حجز
    IF p_reservation_id IS NOT NULL THEN
        UPDATE reservations
        SET status = 'converted',
            notes = COALESCE(notes, '') || ' (تم التحويل لطلب رقم: ' || (SELECT request_number::text FROM inspection_requests WHERE id = v_request_id) || ')'
        WHERE id = p_reservation_id;
    END IF;

    -- 5. جلب بيانات الطلب كاملة لإعادتها للتطبيق
    SELECT row_to_json(r) INTO v_result FROM (
        SELECT * FROM inspection_requests WHERE id = v_request_id
    ) r;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================================
-- دالة إنشاء ملف الموظف تلقائياً عند التسجيل
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    perms_array TEXT[];
BEGIN
    IF NEW.raw_user_meta_data->'permissions' IS NOT NULL THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'permissions')) INTO perms_array;
    ELSE
        perms_array := ARRAY[]::TEXT[];
    END IF;

    INSERT INTO public.employees (id, email, name, role, permissions, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', 'مدير النظام'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'general_manager'),
        perms_array,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================================
-- 2. الجداول (Tables)
-- ================================================================

-- ----------------------------------------------------------------
-- جدول العملاء
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    phone             TEXT NOT NULL,
    is_vip            BOOLEAN DEFAULT false,
    is_system_default BOOLEAN DEFAULT false,
    loyalty_points    NUMERIC DEFAULT 0,
    total_spent       NUMERIC DEFAULT 0,
    email             TEXT,
    address           TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول شركات السيارات
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_makes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar     TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    logo_url    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول موديلات السيارات
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_models (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make_id     UUID REFERENCES car_makes(id) ON DELETE CASCADE,
    name_ar     TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول السيارات
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cars (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make_id         UUID REFERENCES car_makes(id),
    model_id        UUID REFERENCES car_models(id),
    year            INTEGER,
    plate_number    TEXT,
    plate_number_en TEXT,
    vin             TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول أنواع الفحص
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_types (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    price                NUMERIC DEFAULT 0,
    color                TEXT,
    finding_category_ids TEXT[],
    fill_tab_order_ids   TEXT[],
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول السماسرة (الوسطاء)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brokers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT NOT NULL,
    phone              TEXT,
    default_commission NUMERIC DEFAULT 0,
    is_active          BOOLEAN DEFAULT true,
    created_by         UUID,
    created_by_name    TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول الفنيين (غير المستخدمين في النظام)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technicians (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    title       TEXT,
    phone       TEXT,
    is_active   BOOLEAN DEFAULT true,
    salary      NUMERIC DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول الموظفين (المستخدمون في النظام)
-- يتصل بـ auth.users عبر نفس الـ UUID
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL,
    title       TEXT,
    phone       TEXT,
    permissions TEXT[],
    is_active   BOOLEAN DEFAULT true,
    password    TEXT,
    preferences JSONB,
    salary      NUMERIC DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول الحجوزات
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number SERIAL,
    source_text        TEXT,
    client_name        TEXT,
    client_phone       TEXT,
    car_details        TEXT,
    plate_text         TEXT,
    service_type       TEXT,
    notes              TEXT,
    status             TEXT DEFAULT 'new',
    car_make_id        UUID REFERENCES car_makes(id),
    car_model_id       UUID REFERENCES car_models(id),
    car_year           INTEGER,
    price              NUMERIC DEFAULT 0,
    payment_type       TEXT,
    created_by_name    TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول طلبات الانتظار (قبل الدفع) - MISSING from original!
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_requests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_number     SERIAL,
    client_name        TEXT NOT NULL,
    client_phone       TEXT NOT NULL,
    car_make_id        UUID,
    car_model_id       UUID,
    car_year           INTEGER,
    plate_number       TEXT,
    plate_number_en    TEXT,
    vin                TEXT,
    car_snapshot       JSONB,
    inspection_type_id UUID,
    price              NUMERIC DEFAULT 0,
    payment_note       TEXT,
    employee_id        UUID,
    broker             JSONB,
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول فئات بنود الفحص المخصصة
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_finding_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول بنود الفحص المحددة مسبقاً
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predefined_findings (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT NOT NULL,
    category_id              UUID REFERENCES custom_finding_categories(id) ON DELETE CASCADE,
    options                  TEXT[],
    reference_image          TEXT,
    "group"                  TEXT,
    groups                   TEXT[],
    reference_image_position TEXT,
    "orderIndex"             INTEGER,
    report_position          TEXT,
    is_bundle                BOOLEAN DEFAULT false,
    linked_finding_ids       TEXT[],
    bundle_default_value     TEXT,
    created_at               TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول طلبات الفحص
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_requests (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number         SERIAL,
    client_id              UUID REFERENCES clients(id),
    car_id                 UUID REFERENCES cars(id),
    car_snapshot           JSONB,
    inspection_type_id     UUID REFERENCES inspection_types(id),
    payment_type           TEXT,
    payment_note           TEXT,
    split_payment_details  JSONB,
    price                  NUMERIC DEFAULT 0,
    status                 TEXT NOT NULL,
    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now(),
    employee_id            UUID REFERENCES employees(id),
    broker                 JSONB,
    inspection_data        JSONB,
    general_notes          JSONB,
    category_notes         JSONB,
    voice_memos            JSONB,
    structured_findings    JSONB,
    activity_log           JSONB,
    attached_files         JSONB,
    technician_assignments JSONB,
    report_stamps          TEXT[],
    report_url             TEXT,
    report_generated_at    TIMESTAMPTZ,
    ai_analysis            TEXT,
    reservation_id         UUID REFERENCES reservations(id)
);

-- ----------------------------------------------------------------
-- جدول مسودات الرواتب
-- العمود الصحيح هو draft_data (وليس items مباشرة)
-- يتم الوصول: data.draft_data.items
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_drafts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month        INTEGER NOT NULL,
    year         INTEGER NOT NULL,
    draft_data   JSONB,
    last_updated TIMESTAMPTZ DEFAULT now(),
    status       TEXT DEFAULT 'draft',
    UNIQUE (month, year)
);

-- ----------------------------------------------------------------
-- جدول سجل النشاط العام
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp      TIMESTAMPTZ DEFAULT now(),
    "employeeId"   UUID REFERENCES employees(id),
    "employeeName" TEXT,
    action         TEXT,
    details        TEXT,
    image_url      TEXT,
    link_id        TEXT,
    link_page      TEXT
);

-- ----------------------------------------------------------------
-- جدول شاشة العرض التلفزيوني (Customer Display Queue)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_display_queue (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id     UUID REFERENCES inspection_requests(id) ON DELETE CASCADE,
    request_number INTEGER,
    car_name_ar    TEXT,
    car_name_en    TEXT,
    plate_ar       TEXT,
    plate_en       TEXT,
    car_logo       TEXT,
    status         TEXT,
    ready_at       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (request_id)
);

-- ----------------------------------------------------------------
-- جدول المصروفات
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date           TIMESTAMPTZ NOT NULL,
    category       TEXT NOT NULL,
    description    TEXT,
    amount         NUMERIC NOT NULL,
    "employeeId"   UUID REFERENCES employees(id),
    "employeeName" TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول الإيرادات الأخرى
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS other_revenues (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date           TIMESTAMPTZ NOT NULL,
    category       TEXT NOT NULL,
    description    TEXT,
    amount         NUMERIC NOT NULL,
    payment_method TEXT,
    employee_id    UUID REFERENCES employees(id),
    employee_name  TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول التنبيهات
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT false,
    link            TEXT,
    link_id         TEXT,
    type            TEXT,
    user_id         UUID REFERENCES employees(id),
    created_by_name TEXT
);

-- ----------------------------------------------------------------
-- جدول الرسائل الداخلية
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id     UUID NOT NULL REFERENCES employees(id),
    receiver_id   UUID NOT NULL REFERENCES employees(id),
    sender_name   TEXT,
    receiver_name TEXT,
    subject       TEXT,
    content       TEXT,
    is_read       BOOLEAN DEFAULT false,
    priority      TEXT DEFAULT 'normal',
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- جدول رسائل واتساب
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    whatsapp_id TEXT UNIQUE,
    phone       TEXT NOT NULL,
    name        TEXT,
    message     TEXT NOT NULL,
    direction   TEXT,
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ----------------------------------------------------------------
-- جدول إعدادات التطبيق (صف واحد فقط id=1)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    id            INTEGER PRIMARY KEY DEFAULT 1,
    settings_data JSONB,
    updated_at    TIMESTAMPTZ DEFAULT now()
);


-- ================================================================
-- 3. المشغّلات (Triggers)
-- ================================================================

CREATE TRIGGER update_inspection_requests_updated_at
BEFORE UPDATE ON inspection_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- 4. سياسات الأمان على مستوى الصفوف (RLS)
-- ================================================================

ALTER TABLE clients                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_makes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_models                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians               ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_finding_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_findings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_drafts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_display_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_revenues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings              ENABLE ROW LEVEL SECURITY;

-- سياسات عامة: السماح لجميع المستخدمين المصادق عليهم
CREATE POLICY "Allow all for authenticated users" ON clients
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON car_makes
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON car_models
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON cars
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON inspection_types
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON brokers
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON technicians
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON employees
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON reservations
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON pending_requests
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON custom_finding_categories
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON predefined_findings
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON inspection_requests
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON payroll_drafts
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON activity_logs
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON expenses
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON other_revenues
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON internal_messages
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON whatsapp_messages
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON app_settings
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- شاشة التلفزيون: قراءة عامة بدون مصادقة
CREATE POLICY "Allow all for authenticated users" ON customer_display_queue
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Public Read Access for Customer Display" ON customer_display_queue
    FOR SELECT USING (true);

-- التنبيهات: سياسات مخصصة حسب المستخدم
DROP POLICY IF EXISTS "Allow all for authenticated users"                    ON notifications;
DROP POLICY IF EXISTS "Users can view their own or general notifications"    ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications"             ON notifications;
DROP POLICY IF EXISTS "Employees can insert notifications"                   ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications"             ON notifications;

CREATE POLICY "Users can view their own or general notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Employees can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);


-- ================================================================
-- 5. البيانات الأولية
-- ================================================================
INSERT INTO app_settings (id, settings_data)
VALUES (1, '{"appName": "نظام فحص السيارات", "setupCompleted": false}'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- 6. دلاء التخزين (Storage Buckets)
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('logos',          'logos',          true),
    ('reports',        'reports',        true),
    ('attached_files', 'attached_files', true),
    ('note_images',    'note_images',    true),
    ('finding_images', 'finding_images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access for Logos"          ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Auth Access for Logos"            ON storage.objects FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'logos');
CREATE POLICY "Public Access for Reports"        ON storage.objects FOR SELECT USING (bucket_id = 'reports');
CREATE POLICY "Auth Access for Reports"          ON storage.objects FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'reports');
CREATE POLICY "Public Access for Attached Files" ON storage.objects FOR SELECT USING (bucket_id = 'attached_files');
CREATE POLICY "Auth Access for Attached Files"   ON storage.objects FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'attached_files');
CREATE POLICY "Public Access for Note Images"    ON storage.objects FOR SELECT USING (bucket_id = 'note_images');
CREATE POLICY "Auth Access for Note Images"      ON storage.objects FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'note_images');
CREATE POLICY "Public Access for Finding Images" ON storage.objects FOR SELECT USING (bucket_id = 'finding_images');
CREATE POLICY "Auth Access for Finding Images"   ON storage.objects FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'finding_images');


-- ================================================================
-- 7. الوقت الفعلي (Realtime Publications)
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE inspection_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE cars;
ALTER PUBLICATION supabase_realtime ADD TABLE inspection_types;


-- ================================================================
-- 8. إنشاء المدير العام (خطوة يدوية)
-- ================================================================
-- بعد إنشاء المستخدم في Supabase Auth Dashboard،
-- شغّل الأمر أدناه باستبدال YOUR_USER_UUID_HERE
--
-- INSERT INTO employees (id, email, name, role, permissions, is_active)
-- VALUES (
--     'YOUR_USER_UUID_HERE',
--     'admin@example.com',
--     'المدير العام',
--     'general_manager',
--     ARRAY[
--         'view_dashboard', 'view_login_notifications', 'send_internal_messages',
--         'create_requests', 'create_custom_date_request', 'view_completed_requests',
--         'view_waiting_requests', 'update_requests_data', 'change_request_status',
--         'mark_request_complete', 'delete_requests', 'print_request', 'export_data',
--         'fill_requests', 'view_request_info', 'view_car_history_on_create',
--         'view_archive', 'manage_paper_archive', 'manage_notes', 'manage_findings',
--         'view_activity_log', 'delete_activity_log', 'view_financials', 'manage_expenses',
--         'manage_revenues', 'delete_expenses', 'edit_request_price', 'process_payment',
--         'manage_clients', 'manage_employees', 'view_hr_page', 'view_hr_global_directory',
--         'view_hr_salaries_payrolls', 'view_hr_performance_record',
--         'manage_brokers', 'manage_technicians', 'manage_settings_general',
--         'manage_settings_technical', 'manage_appearance', 'manage_api_keys',
--         'manage_reservations', 'delete_whatsapp_messages', 'pay_broker_commission',
--         'add_broker_commission', 'view_requests_list', 'view_requests_payment_filters',
--         'view_requests_date_filters', 'view_requests_price_column',
--         'view_requests_stats_cards', 'view_request_price_in_fill',
--         'resend_whatsapp_report', 'view_settings'
--     ],
--     true
-- )
-- ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- ملخص الفروقات عن الملف الأصلي
-- ================================================================
--
-- [1] ADDED TABLE: pending_requests
--     كان مفقوداً تماماً من الملف الأصلي وهو جدول أساسي لميزة
--     "انتظار الدفع" (WaitingForPaymentRequests page)
--
-- [2] FIXED TABLE: payroll_drafts
--     - العمود الصحيح: draft_data JSONB (وليس items JSONB)
--     - أُضيف: UNIQUE(month, year) لدعم upsert صحيح
--       (الكود: upsert(payload, { onConflict: 'month,year' }))
--
-- [3] ADDED COLUMN: clients.notes
--     موجود في Client interface في types.ts
--
-- [4] ADDED COLUMN: reservations.created_by_name
--     مستخدم في الكود:
--     supabase.from('reservations').insert({ ...payload, created_by_name })
--
-- [5] FIXED CONSTRAINT: customer_display_queue
--     أُضيف: UNIQUE(request_id) لدعم upsert صحيح
--     (الكود: upsert(tvData, { onConflict: 'request_id' }))
--
-- [6] ADDED REALTIME TABLES: pending_requests, reservations,
--     clients, cars, inspection_types
--     (مراقبة postgres_changes في AppContext.tsx)
--
-- [7] UPDATED PERMISSIONS LIST: أُضيفت الصلاحيات الجديدة:
--     create_custom_date_request, delete_activity_log,
--     view_hr_page, view_hr_global_directory,
--     view_hr_salaries_payrolls, view_hr_performance_record,
--     pay_broker_commission, add_broker_commission,
--     view_requests_payment_filters, view_requests_date_filters,
--     view_requests_price_column, view_requests_stats_cards,
--     view_request_price_in_fill, resend_whatsapp_report
--
-- ================================================================
