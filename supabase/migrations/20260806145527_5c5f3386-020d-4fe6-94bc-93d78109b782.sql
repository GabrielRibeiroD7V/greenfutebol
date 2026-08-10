ALTER TABLE public.ticket_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_audit_logs FROM anon;
REVOKE ALL ON public.ticket_audit_logs FROM authenticated;
GRANT SELECT, INSERT ON public.ticket_audit_logs TO service_role;