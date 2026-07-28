FROM python:3.11-slim

# mediapipe hard-declares a dependency on opencv-contrib-python (not the
# headless variant), and mediapipe's own C bindings eagerly dlopen GPU/GLES
# libraries even when only running CPU inference. None of this is GUI use,
# it's just satisfying dlopen at import time, so mesa's software
# implementations are enough without any real GPU present.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libegl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
