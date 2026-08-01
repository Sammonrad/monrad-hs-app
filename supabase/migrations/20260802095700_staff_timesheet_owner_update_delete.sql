-- Staff timesheet self-management:
-- Restore owner DELETE (dropped in archive_delete_policy_hardening) and
-- ensure owner UPDATE remains for authenticated users who own the row.
-- Ownership column: user_id (see mapTimesheetToRow / timesheet_records schema).
-- Admin SELECT, admin UPDATE, and admin archived DELETE policies are unchanged.
-- Idempotent. No schema, grants, triggers, or other table changes.

-- ---------------------------------------------------------------------------
-- Staff UPDATE own timesheets (user_id = auth.uid())
-- ---------------------------------------------------------------------------

drop policy if exists "Users can update their own timesheet records"
on public.timesheet_records;

create policy "Users can update their own timesheet records"
on public.timesheet_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Staff DELETE own timesheets (permanent; not archive)
-- Coexists with "Admins can permanently delete archived timesheet records"
-- ---------------------------------------------------------------------------

drop policy if exists "Users can delete their own timesheet records"
on public.timesheet_records;

create policy "Users can delete their own timesheet records"
on public.timesheet_records
for delete
to authenticated
using (auth.uid() = user_id);
