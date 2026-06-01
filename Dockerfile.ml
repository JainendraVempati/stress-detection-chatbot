FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (layer caching)
COPY ml_service/ml_requirements.txt .

# Install Python dependencies
# Note: torch can be large (~800 MB); CPU-only build keeps it manageable
RUN pip install --no-cache-dir -r ml_requirements.txt

# ─────────────────────────────────────────────────────────────
# Copy ML model files
# stress_model.pt  — DistilBERT fine-tuned weights (254 MB)
# tokenizer.pkl    — DistilBERT tokenizer (saved with pickle)
#
# These files are excluded from Git (see .gitignore).
# Before building this image, ensure they exist in ml_service/:
#   ml_service/stress_model.pt
#   ml_service/tokenizer.pkl
# ─────────────────────────────────────────────────────────────
COPY ml_service/stress_model.pt .
COPY ml_service/tokenizer.pkl .

# Copy application code
COPY ml_service/ml_service.py .

# Pre-download NLTK VADER lexicon so container works offline
RUN python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

# Pre-cache DistilBERT base model from HuggingFace
# (needed by DistilBertModel.from_pretrained('distilbert-base-uncased'))
# This prevents the container from downloading it at runtime.
RUN python -c "from transformers import DistilBertModel, DistilBertTokenizer; \
    DistilBertModel.from_pretrained('distilbert-base-uncased'); \
    print('[Docker] DistilBERT base model cached.')"

# Expose Flask port
EXPOSE 5000

# Health check — waits up to 5 min for model load on first start
HEALTHCHECK --interval=15s --timeout=10s --start-period=300s --retries=10 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run ML service
CMD ["python", "ml_service.py"]
