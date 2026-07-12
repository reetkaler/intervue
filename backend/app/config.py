from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
