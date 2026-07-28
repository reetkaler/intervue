FROM python:3.11-slim

# mediapipe hard-declares a dependency on opencv-contrib-python (not the
# headless variant), which needs libGL at import time even though nothing
# here uses GUI features. Installing it directly is simpler than fighting
# pip's dependency resolution to force a headless swap.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
