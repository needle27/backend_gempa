FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Ensure matplotlib and temp caches are writable in container
ENV PYTHONUNBUFFERED=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    PORT=7860

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

# Run lightweight HTTP server on port 7860 for Hugging Face healthcheck,
# and run the Celery solo worker in the foreground.
CMD ["sh", "-c", "python -m http.server 7860 & exec celery -A celery_worker.celery worker --loglevel=info --pool=solo"]
