FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8080

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && scrapling install && chmod -R a+rX /ms-playwright
COPY app.py ./

USER 65532:65532
EXPOSE 8080
CMD ["python", "app.py"]
