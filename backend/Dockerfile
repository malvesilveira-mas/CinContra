FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL="sqlite:////app/data/squads.db" \
    CSV_PATH="/app/squad_rpg_60.csv"

WORKDIR /app

RUN mkdir -p /app/data

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY squad_rpg_60.csv /app/squad_rpg_60.csv
COPY app /app/app
COPY tests /app/tests

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
