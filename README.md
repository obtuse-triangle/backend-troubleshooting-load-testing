# Baseplate: 코드 레벨의 숨은 병목 찾아내기

라이브 코딩 발표를 위한 FastAPI 기반 블로그 API 프로젝트입니다.

## 🎯 프로젝트 목표

이 프로젝트는 **의도적으로 성능 병목을 포함**하고 있습니다:

- ✅ **pytest는 통과**: 기능 테스트는 모두 성공
- ❌ **k6 부하 테스트는 실패**: 성능 병목으로 인해 부하 테스트 실패
- 🔍 **목표**: 코드 레벨에서 병목을 찾아내고 해결하는 과정을 학습

## 🐌 의도적인 병목

`/api/posts/v1/slow` 엔드포인트는 각 Post마다 `time.sleep(0.02)`를 호출합니다:

- 100개의 Post × 0.02초 = **약 2초의 고정 지연**
- N+1 쿼리 문제나 외부 API 호출을 시뮬레이션
- 데이터가 많아질수록 선형적으로 느려짐

## 📁 프로젝트 구조

```
/
├── .github/
│   └── workflows/
│       └── main.yml        # CI: pytest만 실행
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI 앱 (엔드포인트)
│   ├── models.py           # SQLAlchemy 모델 (Post)
│   ├── schemas.py          # Pydantic 스키마
│   ├── crud.py             # 🔥 병목 로직 포함
│   └── database.py         # SQLite 설정
├── tests/
│   └── test_api.py         # 기능 테스트 (성능 미검증)
├── .gitignore
├── README.md
├── requirements.txt
├── Dockerfile           # FastAPI 앱 도커파일
├── docker-compose.yml      # Prometheus 및 Grafana 설정
└── init_db.py              # DB 초기화 스크립트
```

## 🚀 로컬 환경 설정

### 1. 저장소 클론

```bash
git clone <repository-url>
cd backend-troubleshooting-load-testing
```

### 2. Python 가상환경 생성 및 활성화

```bash
python -m venv .venv

# Linux/Mac
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### 3. 의존성 설치

```bash
pip install -r requirements.txt
```

### 4. k6 설치

부하 테스트를 위해 k6를 설치합니다:

- **공식 설치 가이드**: https://k6.io/docs/getting-started/installation/

#### macOS (Homebrew)

```bash
brew install k6
```

#### Linux (Debian/Ubuntu)

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

#### Windows (Chocolatey)

```powershell
choco install k6
```

### 5. Docker Compose 구동 (FastAPI, Prometheus, Grafana 모두 실행)

FastAPI 앱, Prometheus, Grafana를 한 번에 실행합니다:

```bash
docker compose pull
docker compose up --build -d
```

- `http://localhost:8000` 에서 FastAPI API에 접속할 수 있습니다
- `http://localhost:9090` 에서 Prometheus에 접속할 수 있습니다
- `http://localhost:3000` 에서 Grafana에 접속할 수 있습니다 (기본 로그인: admin/admin)

#### FastAPI 서비스 Dockerfile

루트 디렉토리에 아래와 같이 Dockerfile이 포함되어 있습니다:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
COPY init_db.py ./
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

docker-compose.yml에 fastapi 서비스가 추가되어 있습니다:

```yaml
fastapi:
  build: .
  container_name: fastapi-app
  ports:
    - "8000:8000"
  volumes:
    - ./app:/app/app
    - ./init_db.py:/app/init_db.py
    - ./requirements.txt:/app/requirements.txt
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000
  depends_on:
    - prometheus
```

## 📋 실행 방법

### 1. 데이터베이스 초기화

```bash
python init_db.py
```

100개의 더미 Post 데이터가 생성됩니다.

### 2. 서버 실행

FastAPI 서버도 docker compose로 실행됩니다:

```bash
docker compose up --build -d
```

서버가 http://localhost:8000 에서 실행됩니다.

### 3. 엔드포인트 확인

브라우저 또는 curl로 확인:

```bash

# 루트 엔드포인트
curl http://localhost:8000/

# 병목이 있는 엔드포인트 (느림 🐌)
curl http://localhost:8000/api/posts/v1/slow

# 최적화된 엔드포인트 (빠름 ⚡)
curl http://localhost:8000/api/posts/v2/fast
```

### 4. 기능 테스트 실행

```bash
pytest -v
```

모든 테스트가 **통과**합니다 (성능을 검증하지 않기 때문).

### 5. 부하 테스트 실행 (k6)

#### 기본 부하 테스트 스크립트 생성

`k6-test.js` 파일을 생성합니다:

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // 10초 동안 10명의 가상 사용자로 증가
    { duration: "20s", target: 10 }, // 20초 동안 10명 유지
    { duration: "10s", target: 0 }, // 10초 동안 0명으로 감소
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95%의 요청이 500ms 이내여야 함
  },
};

export default function () {
  const res = http.get("http://127.0.0.1:8000/api/posts/v1/slow");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

#### k6 실행

```bash
k6 run k6-test.js --out experimental-prometheus-rw=http://localhost:9090/api/v1/write
```

**예상 결과**: `/v1/slow` 엔드포인트는 응답 시간이 2초 이상 걸리므로 **실패**합니다.

#### 최적화된 엔드포인트 테스트

`k6-test-fast.js`:

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const res = http.get("http://127.0.0.1:8000/api/posts/v2/fast");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

```bash
k6 run k6-test-fast.js --out experimental-prometheus-rw=http://localhost:9090/api/v1/write
```

**예상 결과**: `/v2/fast` 엔드포인트는 `time.sleep()`이 없으므로 **통과**합니다.

### 6. Grafana에서 메트릭 시각화

- Grafana 대시보드에 접속: `http://localhost:3000`
- 기본 로그인: `admin` / `admin`
- 아래 대시보드를 추가합니다.

- https://grafana.com/grafana/dashboards/21542-k6-prome-load-test/
- https://grafana.com/grafana/dashboards/18030-k6-prometheus-native-histograms/

해당 대시보드를 임포트하여 k6 메트릭을 시각화할 수 있습니다.

## 📊 CI/CD

현재 GitHub Actions를 통해 `pytest`만 자동으로 실행됩니다:

- `.github/workflows/main.yml` 에 k6 부하 테스트를 추가해 보겠습니다.
- 아래 코드를 추가합니다.

```yaml
load-test:
  runs-on: ubuntu-latest

  steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: "3.10"

    - name: Install Python dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt

    - name: Initialize database
      run: |
        python init_db.py

    - name: Install k6
      run: |
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6

    - name: Start FastAPI server
      run: |
        uvicorn app.main:app --host 0.0.0.0 --port 8000 &
        sleep 5  # 서버가 시작될 때까지 대기

    - name: Run k6 load test on slow endpoint
      run: |
        k6 run k6-test.js -e BASE_URL=http://127.0.0.1:8000
```

## 🛠️ 기술 스택

- **FastAPI**: 웹 프레임워크
- **SQLAlchemy**: ORM
- **SQLite**: 데이터베이스
- **Pytest**: 단위 테스트
- **k6**: 부하 테스트
- **Prometheus**: 메트릭 수집
- **Grafana**: 메트릭 시각화

## 📝 학습 목표

1. ✅ **기능 테스트와 성능 테스트의 차이** 이해
2. 🔍 **코드 레벨 병목** 찾아내기 (프로파일링)
3. ⚡ **성능 최적화** 방법 학습
4. 📊 **k6를 활용한 부하 테스트** 실습
5. 🚀 **CI/CD에 성능 테스트 통합**
6. 📈 **Prometheus와 Grafana**로 메트릭 시각화

## 📚 참고 자료

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [k6 공식 문서](https://k6.io/docs/)
- [SQLAlchemy 공식 문서](https://docs.sqlalchemy.org/)
- [Prometheus 공식 문서](https://prometheus.io/docs/introduction/overview/)
- [Grafana 공식 문서](https://grafana.com/docs/grafana/latest/)

## 🤝 기여

라이브 코딩 발표 후 개선 사항이나 추가 예제가 있다면 PR을 환영합니다!

## 📄 라이선스

MIT License
