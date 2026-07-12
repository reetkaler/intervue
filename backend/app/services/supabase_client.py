from supabase import Client, create_client

from app.config import settings

admin_client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
