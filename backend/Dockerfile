FROM python:3.12-slim

LABEL description="Network Monitor API - FastAPI backend"

RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping \
    net-tools \
    dnsutils \
    curl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Karachi
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY app/config.yml /app/config.yml

RUN mkdir -p /app/logs /app/reports /app/data

EXPOSE 8000

ENV CONFIG_PATH=/app/config.yml
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
