from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HYDROSECURE_", env_file=".env", extra="ignore")

    database_path: str = "hydrosecure.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    leak_warning_threshold: float = 1.8
    leak_critical_threshold: float = 3.2
    leak_consecutive_samples: int = 4
    leak_hysteresis: float = 0.5

    hardware_offline_seconds: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
