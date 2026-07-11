


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.user_profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'staff',
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_hs_general_meeting_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_hs_general_meeting_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_register_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "source_type" "text",
    "source_record_id" "text",
    "action_description" "text",
    "person_responsible" "text",
    "due_date" "date",
    "priority" "text",
    "status" "text" DEFAULT 'Open'::"text",
    "site_location" "text",
    "notes" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."action_register_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hs_general_meeting_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "meeting_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "meeting_time" time without time zone,
    "meeting_title" "text",
    "meeting_type" "text" DEFAULT 'General'::"text" NOT NULL,
    "location" "text",
    "chairperson" "text",
    "attendees_text" "text",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "next_meeting_date" "date",
    "next_meeting_time" time without time zone,
    "schedule_frequency" "text",
    "completed_at" timestamp with time zone,
    "record_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hs_general_meeting_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incident_near_miss_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "record_date" "date",
    "incident_time" "text",
    "reported_by" "text",
    "site_location" "text",
    "report_type" "text",
    "person_involved" "text",
    "what_happened" "text",
    "immediate_action_taken" "text",
    "possible_cause" "text",
    "corrective_action_required" "text",
    "person_responsible" "text",
    "follow_up_date" "date",
    "checklist_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."incident_near_miss_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_start_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "record_date" "date",
    "operator_name" "text",
    "job_name" "text",
    "site_location" "text",
    "machine_used" "text",
    "hazards_checked" boolean,
    "services_checked" boolean,
    "ppe_confirmed" boolean,
    "emergency_access_confirmed" boolean,
    "checklist_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_start_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machine_defect_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "machine_id" "uuid" NOT NULL,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "severity" "text" DEFAULT 'Minor'::"text" NOT NULL,
    "status" "text" DEFAULT 'Open'::"text" NOT NULL,
    "defect_description" "text" NOT NULL,
    "immediate_action" "text",
    "machine_isolated" boolean DEFAULT false NOT NULL,
    "safe_to_operate" boolean,
    "assigned_to" "text",
    "target_date" "date",
    "source_type" "text",
    "source_record_id" "text",
    "resolution_details" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "reported_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "machine_defect_records_severity_check" CHECK (("severity" = ANY (ARRAY['Minor'::"text", 'Major'::"text", 'Critical'::"text"]))),
    CONSTRAINT "machine_defect_records_status_check" CHECK (("status" = ANY (ARRAY['Open'::"text", 'In Progress'::"text", 'Deferred'::"text", 'Resolved'::"text"])))
);


ALTER TABLE "public"."machine_defect_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machine_document_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "machine_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_title" "text" NOT NULL,
    "reference_number" "text",
    "issuing_organisation" "text",
    "issue_date" "date",
    "expiry_date" "date",
    "document_location" "text",
    "notes" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."machine_document_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machine_equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_number" "text" NOT NULL,
    "asset_name" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "make" "text",
    "model" "text",
    "manufacture_year" integer,
    "serial_number" "text",
    "registration_number" "text",
    "ownership_status" "text" DEFAULT 'Owned'::"text" NOT NULL,
    "operational_status" "text" DEFAULT 'Available'::"text" NOT NULL,
    "assigned_operator" "text",
    "normal_location" "text",
    "current_hours" numeric(12,1),
    "current_odometer" numeric(12,1),
    "next_service_date" "date",
    "next_service_hours" numeric(12,1),
    "next_service_odometer" numeric(12,1),
    "prestart_required" boolean DEFAULT true NOT NULL,
    "road_legal" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "machine_equipment_operational_status_check" CHECK (("operational_status" = ANY (ARRAY['Available'::"text", 'In Use'::"text", 'Maintenance'::"text", 'Out of Service'::"text"]))),
    CONSTRAINT "machine_equipment_ownership_status_check" CHECK (("ownership_status" = ANY (ARRAY['Owned'::"text", 'Financed'::"text", 'Leased'::"text", 'Hired'::"text"])))
);


ALTER TABLE "public"."machine_equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machine_prestart_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "record_date" "date",
    "operator_name" "text",
    "machine_name" "text",
    "machine_type" "text",
    "site_location" "text",
    "machine_safe" boolean,
    "defects_found" boolean DEFAULT false,
    "defect_severity" "text",
    "defect_description" "text",
    "action_required" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."machine_prestart_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machine_service_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "machine_id" "uuid" NOT NULL,
    "service_date" "date" NOT NULL,
    "service_type" "text" NOT NULL,
    "hours_at_service" numeric(12,1),
    "odometer_at_service" numeric(12,1),
    "service_provider" "text",
    "work_completed" "text" NOT NULL,
    "parts_or_fluids" "text",
    "recommendations" "text",
    "next_service_date" "date",
    "next_service_hours" numeric(12,1),
    "next_service_odometer" numeric(12,1),
    "completed_by" "text",
    "reference_number" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."machine_service_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sssp_acknowledgements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sssp_id" "uuid" NOT NULL,
    "person_name" "text" NOT NULL,
    "company" "text",
    "role_or_trade" "text",
    "acknowledgement_text" "text" NOT NULL,
    "comments" "text",
    "recorded_by" "uuid" DEFAULT "auth"."uid"(),
    "acknowledged_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sssp_acknowledgements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sssp_hazards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sssp_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "hazard_reference" "text",
    "task_activity" "text" NOT NULL,
    "hazard_description" "text" NOT NULL,
    "potential_harm" "text",
    "persons_at_risk" "text",
    "is_critical_risk" boolean DEFAULT false NOT NULL,
    "existing_controls" "text",
    "control_hierarchy" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "initial_likelihood" smallint NOT NULL,
    "initial_consequence" smallint NOT NULL,
    "additional_controls" "text",
    "responsible_person" "text",
    "target_date" "date",
    "residual_likelihood" smallint NOT NULL,
    "residual_consequence" smallint NOT NULL,
    "control_verification" "text",
    "monitoring_requirements" "text",
    "review_trigger" "text",
    "status" "text" DEFAULT 'Open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sssp_hazards_initial_consequence_check" CHECK ((("initial_consequence" >= 1) AND ("initial_consequence" <= 5))),
    CONSTRAINT "sssp_hazards_initial_likelihood_check" CHECK ((("initial_likelihood" >= 1) AND ("initial_likelihood" <= 5))),
    CONSTRAINT "sssp_hazards_residual_consequence_check" CHECK ((("residual_consequence" >= 1) AND ("residual_consequence" <= 5))),
    CONSTRAINT "sssp_hazards_residual_likelihood_check" CHECK ((("residual_likelihood" >= 1) AND ("residual_likelihood" <= 5))),
    CONSTRAINT "sssp_hazards_status_check" CHECK (("status" = ANY (ARRAY['Open'::"text", 'Controlled'::"text", 'Closed'::"text"])))
);


ALTER TABLE "public"."sssp_hazards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sssp_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sssp_number" "text" NOT NULL,
    "project_name" "text" NOT NULL,
    "client_name" "text",
    "principal_contractor" "text",
    "contract_reference" "text",
    "site_name" "text" NOT NULL,
    "site_address" "text",
    "scope_of_work" "text" NOT NULL,
    "planned_start_date" "date",
    "planned_finish_date" "date",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "revision_number" integer DEFAULT 1 NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "prepared_by_name" "text",
    "reviewed_by_name" "text",
    "approved_by_name" "text",
    "approved_at" timestamp with time zone,
    "submitted_to" "text",
    "submitted_at" timestamp with time zone,
    "company_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "client_requirements" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "project_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "work_methodology" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "roles_responsibilities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "site_arrangements" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "emergency_plan" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "communication_consultation" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "traffic_public_management" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "environmental_controls" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "plant_equipment" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "training_competency" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ppe_requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "permits_notifications" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "hazardous_substances" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subcontractor_arrangements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "incident_reporting" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "monitoring_review" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attachments_manifest" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "revision_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "declaration" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sssp_records_revision_number_check" CHECK (("revision_number" > 0)),
    CONSTRAINT "sssp_records_status_check" CHECK (("status" = ANY (ARRAY['Draft'::"text", 'Ready for Review'::"text", 'Approved'::"text", 'Submitted'::"text", 'Closed'::"text"])))
);


ALTER TABLE "public"."sssp_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timesheet_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "record_date" "date",
    "employee_name" "text",
    "job_name" "text",
    "site_location" "text",
    "machine_used" "text",
    "total_hours" numeric,
    "chargeable_hours" numeric,
    "non_chargeable_hours" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."timesheet_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."toolbox_meeting_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "record_date" "date",
    "job_name" "text",
    "site_location" "text",
    "meeting_led_by" "text",
    "attendees" "text",
    "work_planned" "text",
    "hazards_discussed" "text",
    "controls_agreed" "text",
    "weather_ground_conditions" "text",
    "checklist_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."toolbox_meeting_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "phone" "text",
    "notes" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visitor_sign_in_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visitor_name" "text" NOT NULL,
    "company" "text",
    "phone" "text",
    "person_visiting" "text",
    "site_name" "text" NOT NULL,
    "purpose" "text",
    "vehicle_registration" "text",
    "arrival_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "departure_time" timestamp with time zone,
    "induction_acknowledged" boolean DEFAULT false NOT NULL,
    "critical_risks_acknowledged" boolean DEFAULT false NOT NULL,
    "emergency_procedure_acknowledged" boolean DEFAULT false NOT NULL,
    "ppe_acknowledged" boolean DEFAULT false NOT NULL,
    "hazards_reported" "text",
    "notes" "text",
    "signed_in_by" "uuid",
    "signed_out_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "visitor_departure_after_arrival" CHECK ((("departure_time" IS NULL) OR ("departure_time" >= "arrival_time")))
);


ALTER TABLE "public"."visitor_sign_in_records" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_register_records"
    ADD CONSTRAINT "action_register_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hs_general_meeting_records"
    ADD CONSTRAINT "hs_general_meeting_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incident_near_miss_records"
    ADD CONSTRAINT "incident_near_miss_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_start_records"
    ADD CONSTRAINT "job_start_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machine_defect_records"
    ADD CONSTRAINT "machine_defect_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machine_document_records"
    ADD CONSTRAINT "machine_document_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machine_equipment"
    ADD CONSTRAINT "machine_equipment_asset_number_key" UNIQUE ("asset_number");



ALTER TABLE ONLY "public"."machine_equipment"
    ADD CONSTRAINT "machine_equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machine_prestart_records"
    ADD CONSTRAINT "machine_prestart_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machine_service_records"
    ADD CONSTRAINT "machine_service_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sssp_acknowledgements"
    ADD CONSTRAINT "sssp_acknowledgements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sssp_hazards"
    ADD CONSTRAINT "sssp_hazards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sssp_records"
    ADD CONSTRAINT "sssp_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sssp_records"
    ADD CONSTRAINT "sssp_records_sssp_number_key" UNIQUE ("sssp_number");



ALTER TABLE ONLY "public"."timesheet_records"
    ADD CONSTRAINT "timesheet_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."toolbox_meeting_records"
    ADD CONSTRAINT "toolbox_meeting_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitor_sign_in_records"
    ADD CONSTRAINT "visitor_sign_in_records_pkey" PRIMARY KEY ("id");



CREATE INDEX "hs_general_meeting_chairperson_idx" ON "public"."hs_general_meeting_records" USING "btree" ("chairperson");



CREATE INDEX "hs_general_meeting_date_idx" ON "public"."hs_general_meeting_records" USING "btree" ("meeting_date" DESC);



CREATE INDEX "hs_general_meeting_location_idx" ON "public"."hs_general_meeting_records" USING "btree" ("location");



CREATE INDEX "hs_general_meeting_next_date_idx" ON "public"."hs_general_meeting_records" USING "btree" ("next_meeting_date");



CREATE INDEX "hs_general_meeting_record_data_idx" ON "public"."hs_general_meeting_records" USING "gin" ("record_data");



CREATE INDEX "hs_general_meeting_status_idx" ON "public"."hs_general_meeting_records" USING "btree" ("status");



CREATE INDEX "machine_defect_machine_idx" ON "public"."machine_defect_records" USING "btree" ("machine_id", "reported_at" DESC);



CREATE INDEX "machine_defect_status_idx" ON "public"."machine_defect_records" USING "btree" ("status", "severity");



CREATE INDEX "machine_document_machine_idx" ON "public"."machine_document_records" USING "btree" ("machine_id", "expiry_date");



CREATE INDEX "machine_equipment_name_idx" ON "public"."machine_equipment" USING "btree" ("asset_name");



CREATE INDEX "machine_equipment_status_idx" ON "public"."machine_equipment" USING "btree" ("operational_status", "archived");



CREATE INDEX "machine_service_machine_idx" ON "public"."machine_service_records" USING "btree" ("machine_id", "service_date" DESC);



CREATE INDEX "sssp_acknowledgements_sssp_idx" ON "public"."sssp_acknowledgements" USING "btree" ("sssp_id", "acknowledged_at");



CREATE INDEX "sssp_hazards_sssp_idx" ON "public"."sssp_hazards" USING "btree" ("sssp_id", "sort_order");



CREATE INDEX "sssp_records_created_idx" ON "public"."sssp_records" USING "btree" ("created_at" DESC);



CREATE INDEX "sssp_records_project_idx" ON "public"."sssp_records" USING "btree" ("project_name");



CREATE INDEX "sssp_records_status_idx" ON "public"."sssp_records" USING "btree" ("status");



CREATE INDEX "visitor_sign_in_arrival_idx" ON "public"."visitor_sign_in_records" USING "btree" ("arrival_time" DESC);



CREATE INDEX "visitor_sign_in_departure_idx" ON "public"."visitor_sign_in_records" USING "btree" ("departure_time");



CREATE INDEX "visitor_sign_in_site_idx" ON "public"."visitor_sign_in_records" USING "btree" ("site_name");



CREATE OR REPLACE TRIGGER "hs_general_meeting_updated_at" BEFORE UPDATE ON "public"."hs_general_meeting_records" FOR EACH ROW EXECUTE FUNCTION "public"."touch_hs_general_meeting_updated_at"();



CREATE OR REPLACE TRIGGER "machine_defect_updated_at" BEFORE UPDATE ON "public"."machine_defect_records" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "machine_document_updated_at" BEFORE UPDATE ON "public"."machine_document_records" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "machine_equipment_updated_at" BEFORE UPDATE ON "public"."machine_equipment" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "machine_service_updated_at" BEFORE UPDATE ON "public"."machine_service_records" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."action_register_records"
    ADD CONSTRAINT "action_register_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hs_general_meeting_records"
    ADD CONSTRAINT "hs_general_meeting_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hs_general_meeting_records"
    ADD CONSTRAINT "hs_general_meeting_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incident_near_miss_records"
    ADD CONSTRAINT "incident_near_miss_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_start_records"
    ADD CONSTRAINT "job_start_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."machine_defect_records"
    ADD CONSTRAINT "machine_defect_records_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machine_equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."machine_defect_records"
    ADD CONSTRAINT "machine_defect_records_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."machine_defect_records"
    ADD CONSTRAINT "machine_defect_records_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."machine_document_records"
    ADD CONSTRAINT "machine_document_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."machine_document_records"
    ADD CONSTRAINT "machine_document_records_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machine_equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."machine_equipment"
    ADD CONSTRAINT "machine_equipment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."machine_prestart_records"
    ADD CONSTRAINT "machine_prestart_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."machine_service_records"
    ADD CONSTRAINT "machine_service_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."machine_service_records"
    ADD CONSTRAINT "machine_service_records_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machine_equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sssp_acknowledgements"
    ADD CONSTRAINT "sssp_acknowledgements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sssp_acknowledgements"
    ADD CONSTRAINT "sssp_acknowledgements_sssp_id_fkey" FOREIGN KEY ("sssp_id") REFERENCES "public"."sssp_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sssp_hazards"
    ADD CONSTRAINT "sssp_hazards_sssp_id_fkey" FOREIGN KEY ("sssp_id") REFERENCES "public"."sssp_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sssp_records"
    ADD CONSTRAINT "sssp_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."timesheet_records"
    ADD CONSTRAINT "timesheet_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."toolbox_meeting_records"
    ADD CONSTRAINT "toolbox_meeting_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visitor_sign_in_records"
    ADD CONSTRAINT "visitor_sign_in_records_signed_in_by_fkey" FOREIGN KEY ("signed_in_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visitor_sign_in_records"
    ADD CONSTRAINT "visitor_sign_in_records_signed_out_by_fkey" FOREIGN KEY ("signed_out_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Admins can create general meetings" ON "public"."hs_general_meeting_records" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can delete general meetings" ON "public"."hs_general_meeting_records" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage SSSP acknowledgements" ON "public"."sssp_acknowledgements" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage SSSP hazards" ON "public"."sssp_hazards" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage SSSPs" ON "public"."sssp_records" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage defects" ON "public"."machine_defect_records" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage equipment" ON "public"."machine_equipment" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage equipment documents" ON "public"."machine_document_records" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage service records" ON "public"."machine_service_records" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update all user profiles" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update general meetings" ON "public"."hs_general_meeting_records" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can view all action records" ON "public"."action_register_records" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all incident records" ON "public"."incident_near_miss_records" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all job start records" ON "public"."job_start_records" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all machine prestarts" ON "public"."machine_prestart_records" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all timesheet records" ON "public"."timesheet_records" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all toolbox meetings" ON "public"."toolbox_meeting_records" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Authenticated users can acknowledge SSSPs" ON "public"."sssp_acknowledgements" FOR INSERT TO "authenticated" WITH CHECK (("recorded_by" = "auth"."uid"()));



CREATE POLICY "Authenticated users can create visitor records" ON "public"."visitor_sign_in_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can report defects" ON "public"."machine_defect_records" FOR INSERT TO "authenticated" WITH CHECK (("reported_by" = "auth"."uid"()));



CREATE POLICY "Authenticated users can update visitor records" ON "public"."visitor_sign_in_records" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view SSSP acknowledgements" ON "public"."sssp_acknowledgements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view SSSP hazards" ON "public"."sssp_hazards" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view SSSPs" ON "public"."sssp_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view defects" ON "public"."machine_defect_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view equipment" ON "public"."machine_equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view equipment documents" ON "public"."machine_document_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view general meetings" ON "public"."hs_general_meeting_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view service records" ON "public"."machine_service_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view visitor records" ON "public"."visitor_sign_in_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can delete their own action records" ON "public"."action_register_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own incident records" ON "public"."incident_near_miss_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own job start records" ON "public"."job_start_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own machine prestarts" ON "public"."machine_prestart_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own timesheet records" ON "public"."timesheet_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own toolbox meetings" ON "public"."toolbox_meeting_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own action records" ON "public"."action_register_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own incident records" ON "public"."incident_near_miss_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own job start records" ON "public"."job_start_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own machine prestarts" ON "public"."machine_prestart_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own staff profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "id") AND ("role" = 'staff'::"text")));



CREATE POLICY "Users can insert their own timesheet records" ON "public"."timesheet_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own toolbox meetings" ON "public"."toolbox_meeting_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own action records" ON "public"."action_register_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own incident records" ON "public"."incident_near_miss_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own job start records" ON "public"."job_start_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own machine prestarts" ON "public"."machine_prestart_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own staff profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "id") AND ("role" = 'staff'::"text"))) WITH CHECK ((("auth"."uid"() = "id") AND ("role" = 'staff'::"text")));



CREATE POLICY "Users can update their own timesheet records" ON "public"."timesheet_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own toolbox meetings" ON "public"."toolbox_meeting_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own action records" ON "public"."action_register_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own incident records" ON "public"."incident_near_miss_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own job start records" ON "public"."job_start_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own machine prestarts" ON "public"."machine_prestart_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "id") OR "public"."is_admin"()));



CREATE POLICY "Users can view their own timesheet records" ON "public"."timesheet_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own toolbox meetings" ON "public"."toolbox_meeting_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."action_register_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hs_general_meeting_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incident_near_miss_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_start_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machine_defect_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machine_document_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machine_equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machine_prestart_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machine_service_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sssp_acknowledgements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sssp_hazards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sssp_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timesheet_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."toolbox_meeting_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visitor_sign_in_records" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_hs_general_meeting_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_hs_general_meeting_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_hs_general_meeting_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."action_register_records" TO "anon";
GRANT ALL ON TABLE "public"."action_register_records" TO "authenticated";
GRANT ALL ON TABLE "public"."action_register_records" TO "service_role";



GRANT ALL ON TABLE "public"."hs_general_meeting_records" TO "anon";
GRANT ALL ON TABLE "public"."hs_general_meeting_records" TO "authenticated";
GRANT ALL ON TABLE "public"."hs_general_meeting_records" TO "service_role";



GRANT ALL ON TABLE "public"."incident_near_miss_records" TO "anon";
GRANT ALL ON TABLE "public"."incident_near_miss_records" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_near_miss_records" TO "service_role";



GRANT ALL ON TABLE "public"."job_start_records" TO "anon";
GRANT ALL ON TABLE "public"."job_start_records" TO "authenticated";
GRANT ALL ON TABLE "public"."job_start_records" TO "service_role";



GRANT ALL ON TABLE "public"."machine_defect_records" TO "anon";
GRANT ALL ON TABLE "public"."machine_defect_records" TO "authenticated";
GRANT ALL ON TABLE "public"."machine_defect_records" TO "service_role";



GRANT ALL ON TABLE "public"."machine_document_records" TO "anon";
GRANT ALL ON TABLE "public"."machine_document_records" TO "authenticated";
GRANT ALL ON TABLE "public"."machine_document_records" TO "service_role";



GRANT ALL ON TABLE "public"."machine_equipment" TO "anon";
GRANT ALL ON TABLE "public"."machine_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."machine_equipment" TO "service_role";



GRANT ALL ON TABLE "public"."machine_prestart_records" TO "anon";
GRANT ALL ON TABLE "public"."machine_prestart_records" TO "authenticated";
GRANT ALL ON TABLE "public"."machine_prestart_records" TO "service_role";



GRANT ALL ON TABLE "public"."machine_service_records" TO "anon";
GRANT ALL ON TABLE "public"."machine_service_records" TO "authenticated";
GRANT ALL ON TABLE "public"."machine_service_records" TO "service_role";



GRANT ALL ON TABLE "public"."sssp_acknowledgements" TO "anon";
GRANT ALL ON TABLE "public"."sssp_acknowledgements" TO "authenticated";
GRANT ALL ON TABLE "public"."sssp_acknowledgements" TO "service_role";



GRANT ALL ON TABLE "public"."sssp_hazards" TO "anon";
GRANT ALL ON TABLE "public"."sssp_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."sssp_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."sssp_records" TO "anon";
GRANT ALL ON TABLE "public"."sssp_records" TO "authenticated";
GRANT ALL ON TABLE "public"."sssp_records" TO "service_role";



GRANT ALL ON TABLE "public"."timesheet_records" TO "anon";
GRANT ALL ON TABLE "public"."timesheet_records" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheet_records" TO "service_role";



GRANT ALL ON TABLE "public"."toolbox_meeting_records" TO "anon";
GRANT ALL ON TABLE "public"."toolbox_meeting_records" TO "authenticated";
GRANT ALL ON TABLE "public"."toolbox_meeting_records" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."visitor_sign_in_records" TO "anon";
GRANT ALL ON TABLE "public"."visitor_sign_in_records" TO "authenticated";
GRANT ALL ON TABLE "public"."visitor_sign_in_records" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







