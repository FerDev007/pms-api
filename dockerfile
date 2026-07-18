FROM node:22-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build


FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite:////var/data/pms.db \
    FRONTEND_DIST=/app/frontend/dist

RUN apt-get update && apt-get install -y --no-install-recommends snmp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini VERSION seed.sql ./
COPY migrations ./migrations
COPY app ./app
COPY --from=frontend-build /frontend/dist ./frontend/dist

RUN mkdir -p /var/data /app/apks \
    && groupadd --system app \
    && useradd --system --gid app app \
    && chown -R app:app /app /var/data

USER app
EXPOSE 10000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
