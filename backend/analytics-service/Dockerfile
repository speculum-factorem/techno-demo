FROM python:3.11-slim-bookworm

WORKDIR /app

# rasterio: на части платформ ставится из исходников — нужен GDAL; на amd64 обычно приезжает wheel
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev g++ \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

ENV GDAL_CONFIG=/usr/bin/gdal-config

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
