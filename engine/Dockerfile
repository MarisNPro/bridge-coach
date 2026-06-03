# Python 3.12 to match the project's chosen runtime.
FROM python:3.12-slim

# endplay compiles a native DDS extension on install; give it the toolchain.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY system ./system

# Railway provides $PORT; default to 8000 for local runs.
ENV PORT=8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
