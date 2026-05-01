FROM python:3.11-slim

WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết (nếu cần)
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "app.py"]
