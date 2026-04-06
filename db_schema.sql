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
    car_make_id UUID,
    car_model_id UUID,
    price NUMERIC DEFAULT 0,
    payment_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
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
    employee_id UUID,
    employee_name TEXT,
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
    employee_id UUID REFERENCES employees(id),
    employee_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Revenues Table
CREATE TABLE IF NOT EXISTS revenues (
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
    user_id UUID,
    created_by_name TEXT
);

-- Internal Messages Table
CREATE TABLE IF NOT EXISTS internal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    sender_name TEXT,
    receiver_name TEXT,
    subject TEXT,
    content TEXT,
    is_read BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT now()
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
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
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
--         'manage_reservations', 'view_requests_list', 'view_settings'
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

-- ===============================================================
-- End of Schema
-- ===============================================================
