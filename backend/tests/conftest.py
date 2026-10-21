import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.service import HydroSecureService
import app.main as main_module


@pytest.fixture()
def client(tmp_path):
    test_svc = HydroSecureService(db_path=str(tmp_path / "test.db"))
    main_module.service = test_svc
    with TestClient(app) as test_client:
        yield test_client, test_svc
    test_svc.close()
