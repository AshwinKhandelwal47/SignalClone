from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Signal Clone API"
    cors_origins: str = "http://localhost:3000"
    database_url: str = "sqlite:///./signal.db"
    media_dir: str = "./media"
    mock_otp: str = "123456"
    demo_mode: bool = True
    seed_on_startup: bool = True
    session_ttl_days: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
