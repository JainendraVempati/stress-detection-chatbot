FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY ml_service/ml_requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r ml_requirements.txt

# Copy application from ml_service directory
COPY ml_service/ml_service.py .
COPY ml_service/tokenizer.pkl .
COPY ml_service/sequence_config.pkl .
COPY ml_service/model.pkl .

# Download NLTK data
RUN python -c "import nltk; nltk.download('vader_lexicon')"

# Expose port
EXPOSE 5000

# Run application
CMD ["python", "ml_service.py"]
