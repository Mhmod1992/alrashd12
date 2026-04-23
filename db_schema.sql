-- ===============================================================
-- Database Schema for Supabase (PostgreSQL)
-- ===============================================================
-- This file contains the complete SQL commands to recreate the 
-- database structure, including tables, relationships, triggers, 
-- and Row Level Security (RLS) policies.
-- ===============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Helper Functions
-- Trigger function to update 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- دالة إنشاء طلب فحص متكاملة (Single Shot)
-- تقوم بالتعامل مع العميل والسيارة والطلب في عملية واحدة آمنة وسريعة
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
        -- تحديث الاسم إذا تغير لضمان دقة البيانات
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
        -- تحديث بيانات السيارة لضمان مطابقتها للطلب الحالي
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

    -- 4. تحديث حالة الحجز إذا كان الطلب محولاً من حجز
    IF p_reservation_id IS NOT NULL THEN
        UPDATE reservations 
        SET status = 'converted',
            notes = COALESCE(notes, '') || ' (تم التحويل لطلب رقم: ' || (SELECT request_number::text FROM inspection_requests WHERE id = v_request_id) || ')'
        WHERE id = p_reservation_id;
    END IF;

    -- 5. جلب بيانات الطلب كاملة لإعادتها للتطبيق فوراً
    SELECT row_to_json(r) INTO v_result FROM (
        SELECT * FROM inspection_requests WHERE id = v_request_id
    ) r;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automate creating an employee profile on signup
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

-- 2. Tables

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_vip BOOLEAN DEFAULT false,
    is_system_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Car Makes Table
CREATE TABLE IF NOT EXISTS car_makes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Car Models Table
CREATE TABLE IF NOT EXISTS car_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make_id UUID REFERENCES car_makes(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Cars Table
CREATE TABLE IF NOT EXISTS cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make_id UUID REFERENCES car_makes(id),
    model_id UUID REFERENCES car_models(id),
    year INTEGER,
    plate_number TEXT,
    plate_number_en TEXT,
    vin TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inspection Types Table
CREATE TABLE IF NOT EXISTS inspection_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC DEFAULT 0,
    finding_category_ids TEXT[], -- Array of UUIDs as strings
    fill_tab_order_ids TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Brokers Table
CREATE TABLE IF NOT EXISTS brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    default_commission NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Technicians Table
CREATE TABLE IF NOT EXISTS technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT,
    is_active BOOLEAN DEFAULT true,
    salary NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number SERIAL,
    source_text TEXT,
    client_name TEXT,
    client_phone TEXT,
    car_details TEXT,
    plate_text TEXT,
    service_type TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new',
    car_make_id UUID REFERENCES car_makes(id),
    car_model_id UUID REFERENCES car_models(id),
    car_year INTEGER,
    price NUMERIC DEFAULT 0,
    payment_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom Finding Categories Table
CREATE TABLE IF NOT EXISTS custom_finding_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Predefined Findings Table
CREATE TABLE IF NOT EXISTS predefined_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES custom_finding_categories(id) ON DELETE CASCADE,
    options TEXT[],
    reference_image TEXT,
    "group" TEXT,
    groups TEXT[],
    reference_image_position TEXT,
    "orderIndex" INTEGER,
    report_position TEXT,
    is_bundle BOOLEAN DEFAULT false,
    linked_finding_ids TEXT[],
    bundle_default_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT[],
    is_active BOOLEAN DEFAULT true,
    password TEXT,
    preferences JSONB,
    salary NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inspection Requests Table
CREATE TABLE IF NOT EXISTS inspection_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number SERIAL,
    client_id UUID REFERENCES clients(id),
    car_id UUID REFERENCES cars(id),
    car_snapshot JSONB,
    inspection_type_id UUID REFERENCES inspection_types(id),
    payment_type TEXT,
    split_payment_details JSONB,
    price NUMERIC DEFAULT 0,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    employee_id UUID REFERENCES employees(id),
    broker JSONB,
    payment_note TEXT,
    inspection_data JSONB,
    general_notes JSONB,
    category_notes JSONB,
    voice_memos JSONB,
    structured_findings JSONB,
    activity_log JSONB,
    attached_files JSONB,
    technician_assignments JSONB,
    report_stamps TEXT[],
    report_url TEXT,
    report_generated_at TIMESTAMPTZ,
    ai_analysis TEXT,
    reservation_id UUID REFERENCES reservations(id)
);

-- Payroll Drafts Table
CREATE TABLE IF NOT EXISTS payroll_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    items JSONB,
    last_updated TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'draft'
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT now(),
    "employeeId" UUID REFERENCES employees(id),
    "employeeName" TEXT,
    action TEXT,
    details TEXT,
    image_url TEXT,
    link_id TEXT,
    link_page TEXT
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    "employeeId" UUID REFERENCES employees(id),
    "employeeName" TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Revenues Table
CREATE TABLE IF NOT EXISTS other_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    payment_method TEXT,
    employee_id UUID REFERENCES employees(id),
    employee_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    link_id TEXT,
    type TEXT,
    user_id UUID REFERENCES employees(id),
    created_by_name TEXT
);

-- Internal Messages Table
CREATE TABLE IF NOT EXISTS internal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES employees(id),
    receiver_id UUID NOT NULL REFERENCES employees(id),
    sender_name TEXT,
    receiver_name TEXT,
    subject TEXT,
    content TEXT,
    is_read BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp Messages Table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  whatsapp_id TEXT UNIQUE,
  phone TEXT NOT NULL,
  name TEXT,
  message TEXT NOT NULL,
  direction TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- App Settings Table (Single row)
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    settings_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Triggers
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

-- 4. Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_finding_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create "Allow All" policies for authenticated users (Simplified for initial setup)
-- Note: In production, these should be more restrictive based on roles.
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('CREATE POLICY "Allow all for authenticated users" ON %I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;

-- Specific Policies for Notifications Table
-- 1. تفعيل نظام حماية الأسطر (RLS) لجدول التنبيهات
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. حذف أي سياسات سابقة لتجنب التكرار أو التعارض
DROP POLICY IF EXISTS "Allow all for authenticated users" ON notifications;
DROP POLICY IF EXISTS "Users can view their own or general notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Employees can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- 3. سياسة القراءة (SELECT):
-- تسمح للمستخدم برؤية التنبيهات الخاصة به فقط (حسب ID الخاص به) 
-- أو التنبيهات العامة التي يرسلها النظام للجميع (التي يكون فيها user_id فارغاً)
CREATE POLICY "Users can view their own or general notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- 4. سياسة التحديث (UPDATE):
-- تسمح للمستخدم بتغيير حالة التنبيه الخاص به فقط (مثل تحويله إلى "تمت القراءة")
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- 5. سياسة الإضافة (INSERT):
-- تسمح للنظام والموظفين بإضافة تنبيهات جديدة
CREATE POLICY "Employees can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- 6. سياسة الحذف (DELETE):
-- تسمح للمستخدم بحذف تنبيهاته الخاصة فقط من قائمته
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- 5. Initial Data
INSERT INTO app_settings (id, settings_data) 
VALUES (1, '{"appName": "Car Inspection App", "setupCompleted": false}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ===============================================================
-- Admin User Bootstrapping (Manual Step)
-- ===============================================================
-- After creating a user in Supabase Auth, copy their UUID and 
-- replace 'YOUR_USER_UUID_HERE' below. Then run this command.
-- ===============================================================

-- INSERT INTO employees (id, email, name, role, permissions, is_active)
-- VALUES (
--     'YOUR_USER_UUID_HERE', 
--     'admin@example.com', 
--     'المدير العام', 
--     'general_manager', 
--     ARRAY[
--         'view_dashboard', 'view_login_notifications', 'send_internal_messages', 
--         'create_requests', 'view_completed_requests', 'view_waiting_requests', 
--         'update_requests_data', 'change_request_status', 'mark_request_complete', 
--         'delete_requests', 'print_request', 'export_data', 'fill_requests', 
--         'view_request_info', 'view_car_history_on_create', 'view_archive', 
--         'manage_paper_archive', 'manage_notes', 'manage_findings', 
--         'view_activity_log', 'view_financials', 'manage_expenses', 
--         'manage_revenues', 'delete_expenses', 'edit_request_price', 
--         'process_payment', 'manage_clients', 'manage_employees', 
--         'manage_brokers', 'manage_technicians', 'manage_settings_general', 
--         'manage_settings_technical', 'manage_appearance', 'manage_api_keys', 
--         'manage_reservations', 'delete_whatsapp_messages', 'view_requests_list', 'view_settings'
--     ], 
--     true
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 6. Storage Buckets and Policies
-- This section automates the creation of storage buckets and their RLS policies.

-- Create Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('logos', 'logos', true), 
    ('reports', 'reports', true),
    ('attached_files', 'attached_files', true),
    ('note_images', 'note_images', true),
    ('finding_images', 'finding_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'logos' (Public Read, Auth Write)
CREATE POLICY "Public Access for Logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Admin Access for Logos" ON storage.objects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Storage Policies for 'reports' (Public Read, Auth Write)
CREATE POLICY "Public Access for Reports" ON storage.objects FOR SELECT USING (bucket_id = 'reports');
CREATE POLICY "Admin Access for Reports" ON storage.objects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Storage Policies for 'attached_files' (Public Read, Auth Write)
CREATE POLICY "Public Access for Attached Files" ON storage.objects FOR SELECT USING (bucket_id = 'attached_files');
CREATE POLICY "Admin Access for Attached Files" ON storage.objects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Storage Policies for 'note_images' (Public Read, Auth Write)
CREATE POLICY "Public Access for Note Images" ON storage.objects FOR SELECT USING (bucket_id = 'note_images');
CREATE POLICY "Admin Access for Note Images" ON storage.objects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Storage Policies for 'finding_images' (Public Read, Auth Write)
CREATE POLICY "Public Access for Finding Images" ON storage.objects FOR SELECT USING (bucket_id = 'finding_images');
CREATE POLICY "Admin Access for Finding Images" ON storage.objects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ===============================================================
-- 7. Realtime Setup
-- ===============================================================
-- The following tables require Supabase Realtime to be enabled.
-- This allows the client application to listen to changes instantly.

BEGIN;
  -- Remove the supabase_realtime publication if it exists (for safe recreation if needed)
  -- DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create the publication (Supabase usually creates this by default, but ensuring it exists)
  -- CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE inspection_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;

-- ===============================================================
-- End of Schema
-- ===============================================================
