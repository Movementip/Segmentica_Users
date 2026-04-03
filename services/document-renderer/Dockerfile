FROM python:3.11-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice \
        libreoffice-calc \
        fonts-dejavu \
        fonts-liberation \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY services/document-renderer/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/document-renderer/app.py ./app.py
COPY templates ./templates

ENV PYTHONUNBUFFERED=1
ENV TEMPLATES_DIR=/app/templates/forms
ENV LIBREOFFICE_BIN=/usr/bin/soffice
ENV PORT=3000

EXPOSE 3000

CMD ["python", "app.py"]
