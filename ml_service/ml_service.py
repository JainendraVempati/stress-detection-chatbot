"""
ML Microservice for Stress Detection
Hybrid: DistilBERT (75%) + VADER Sentiment (25%)
Replaces LSTM model with DistilBERT fine-tuned classifier
"""

import re
import json
import pickle
import requests
import nltk
import torch
import torch.nn as nn
from transformers import DistilBertModel, DistilBertTokenizer
from flask import Flask, request, jsonify
from flask_cors import CORS
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import os
from pathlib import Path
from datetime import datetime

# ============================================================
# Initialize Flask App
# ============================================================
app = Flask(__name__)
CORS(app)

MODEL_DIR = Path(__file__).parent

# ============================================================
# Load NLTK VADER
# ============================================================
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon', quiet=True)

sia = SentimentIntensityAnalyzer()

# ============================================================
# DistilBERT Classifier Architecture
# Verified from actual saved state_dict (stress_model.pt):
#   bert.embeddings.word_embeddings.weight → [30522, 768]
#   6 transformer layers (layer.0 … layer.5)
#   fc1.weight → [256, 768]   ← 768→256 (NOT 64!)
#   fc2.weight → [1, 256]     ← 256→1
# ============================================================
class DistilBertStressClassifier(nn.Module):
    def __init__(self, hidden_size=768, intermediate_size=256, dropout_rate=0.3):
        super(DistilBertStressClassifier, self).__init__()
        self.bert = DistilBertModel.from_pretrained(
            'distilbert-base-uncased',
            local_files_only=False  # downloads if not cached
        )
        self.dropout = nn.Dropout(dropout_rate)
        self.fc1 = nn.Linear(hidden_size, intermediate_size)  # 768 → 256
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(intermediate_size, 1)             # 256 → 1

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        # CLS token pooling (index 0)
        cls_output = outputs.last_hidden_state[:, 0, :]
        x = self.dropout(cls_output)
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        return x

# ============================================================
# Global Variables
# ============================================================
tokenizer = None
model = None
models_loaded = False
device = torch.device('cpu')  # CPU inference (no GPU needed for serving)

nvidia_api_key = os.environ.get("NVIDIA_API_KEY", "")
nvidia_model = os.environ.get("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")

def setup_nvidia():
    if nvidia_api_key:
        print(f"[NVIDIA NIM] API key configured (model: {nvidia_model})")
    else:
        print("[NVIDIA NIM] WARNING: NVIDIA_API_KEY not set. LLM responses will use fallback.")


# ============================================================
# Download model from URL if not present locally
# (Used on Render — stress_model.pt is too large for GitHub)
# ============================================================
def download_model_if_needed():
    model_pt = MODEL_DIR / "stress_model.pt"
    if model_pt.exists() and model_pt.stat().st_size > 1_000_000:
        print(f"[ML Service] stress_model.pt already present ({model_pt.stat().st_size // 1_000_000}MB), skipping download.")
        return True

    model_url = os.environ.get("MODEL_DOWNLOAD_URL", "")
    if not model_url:
        print("[ERROR] stress_model.pt not found and MODEL_DOWNLOAD_URL env var is not set.")
        print("        Set MODEL_DOWNLOAD_URL to a direct download link for stress_model.pt")
        return False

    print(f"[ML Service] Downloading stress_model.pt from MODEL_DOWNLOAD_URL ...")
    print(f"             This may take several minutes (file is ~254MB)...")
    try:
        with requests.get(model_url, stream=True, timeout=600) as r:
            r.raise_for_status()
            total = int(r.headers.get('content-length', 0))
            downloaded = 0
            with open(model_pt, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded / total * 100
                        print(f"             ... {pct:.0f}% ({downloaded // 1_000_000}MB / {total // 1_000_000}MB)", flush=True)
        size_mb = model_pt.stat().st_size // 1_000_000
        print(f"[ML Service] ✅ Downloaded stress_model.pt ({size_mb}MB)")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to download stress_model.pt: {e}")
        if model_pt.exists():
            model_pt.unlink()
        return False

# ============================================================
# Load DistilBERT Model + Tokenizer
# ============================================================
def load_models():
    global tokenizer, model, models_loaded

    try:
        # --- Download stress_model.pt if needed (Render deployment) ---
        if not download_model_if_needed():
            print("[ERROR] Failed to start service - models not loaded")
            print("        Set MODEL_DOWNLOAD_URL env var to a direct download link for stress_model.pt")
            return False

        # --- Load DistilBERT Tokenizer ---
        print("[ML Service] Loading DistilBERT tokenizer...")
        tokenizer_path = MODEL_DIR / "tokenizer.pkl"
        if not tokenizer_path.exists():
            print(f"[ERROR] tokenizer.pkl not found at {tokenizer_path}")
            return False
        with open(tokenizer_path, 'rb') as f:
            tokenizer = pickle.load(f)
        print(f"[ML Service] Tokenizer loaded: {type(tokenizer).__name__} "
              f"(vocab_size={tokenizer.vocab_size})")

        # --- Load DistilBERT Model Weights ---
        print("[ML Service] Loading DistilBERT stress classifier...")

        # stress_model.pt — single portable file (state_dict)
        # Converted from PyTorch folder format (stress_model/) in Linux sandbox.
        # Architecture verified: fc1=[256,768], fc2=[1,256]
        model_pt = MODEL_DIR / "stress_model.pt"

        if not model_pt.exists():
            print(f"[ERROR] stress_model.pt not found at {model_pt} (download may have failed)")
            return False

        # Build architecture matching the saved weights exactly
        model = DistilBertStressClassifier(
            hidden_size=768,
            intermediate_size=256,
            dropout_rate=0.3
        )

        # Load state dict — works on ALL platforms (Windows/Mac/Linux)
        state_dict = torch.load(
            str(model_pt),
            map_location=device,
            weights_only=False
        )

        # strict=False: ignores MLM head keys (vocab_layer_norm, vocab_transform,
        # vocab_projector) that are in the DistilBERT base but not in our classifier
        missing, unexpected = model.load_state_dict(state_dict, strict=False)

        if missing:
            print(f"[ML Service] WARNING - Missing keys ({len(missing)}): {missing[:3]}")
        if unexpected:
            print(f"[ML Service] INFO - Unexpected keys ignored ({len(unexpected)}): {unexpected[:3]}")

        model.to(device)
        model.eval()

        models_loaded = True
        print("[ML Service] ✓ DistilBERT model loaded successfully!")
        print(f"[ML Service] Architecture: DistilBERT-base-uncased + fc1(768→256) + fc2(256→1)")
        print(f"[ML Service] Device: {device}")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to load models: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================
# Text Cleaning
# ============================================================
def clean_text(text):
    text = str(text).lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# ============================================================
# Stress Keywords (for tracking only — not gating prediction)
# ============================================================
STRESS_KEYWORDS = [
    'stress', 'stressed', 'anxious', 'anxiety', 'depressed', 'depression',
    'angry', 'anger', 'frustrated', 'frustration', 'worried', 'worry',
    'sad', 'unhappy', 'miserable', 'hopeless', 'overwhelmed', 'exhausted',
    'tired', 'fatigue', 'burnout', 'panic', 'fear', 'scared', 'afraid',
    'nervous', 'tense', 'pressure', 'overwhelming', 'difficult', 'hard',
    'terrible', 'awful', 'horrible', 'bad', 'worst', 'hate', 'annoyed',
    'irritated', 'agitated', 'distressed', 'helpless', 'lonely', 'isolated',
    'cry', 'crying', 'hurt', 'pain', 'suffering', 'struggling', 'breaking',
    "can't take", 'cant take', 'giving up', 'no way out', 'piling',
    'mentally exhausted', 'emotionally drained', 'can\'t sleep', 'no sleep'
]

POSITIVE_WORDS = [
    'good', 'great', 'happy', 'excellent', 'wonderful', 'amazing', 'fantastic',
    'awesome', 'fine', 'okay', 'ok', 'calm', 'relaxed', 'peaceful', 'joyful',
    'cheerful', 'content', 'satisfied', 'pleased', 'thrilled', 'excited',
    'positive', 'blessed', 'grateful', 'thankful', 'love', 'enjoy', 'better',
    'best', 'perfect', 'beautiful', 'nice', 'lovely', 'brilliant', 'superb'
]

def contains_stress_indicators(text):
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in STRESS_KEYWORDS)

def contains_positive_indicators(text):
    text_lower = text.lower()
    return any(word in text_lower for word in POSITIVE_WORDS)

# ============================================================
# Stress Prediction — DistilBERT (75%) + VADER (25%) Hybrid
# ============================================================
def predict_stress(text):
    """
    Predict stress using hybrid:
      - 75% DistilBERT fine-tuned classifier (CLS token → fc1 → relu → fc2)
      - 25% VADER sentiment analysis

    Returns dict with stress_level (1-10), stress_percentage (0-100), components
    """
    if not models_loaded or model is None or tokenizer is None:
        return None

    try:
        cleaned = clean_text(text)

        has_stress = contains_stress_indicators(cleaned)
        has_positive = contains_positive_indicators(cleaned)

        # --- DistilBERT Inference ---
        # Tokenize: max 128 tokens (DistilBERT standard)
        encoding = tokenizer(
            cleaned,
            max_length=128,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        input_ids = encoding['input_ids'].to(device)
        attention_mask = encoding['attention_mask'].to(device)

        with torch.no_grad():
            logits = model(input_ids=input_ids, attention_mask=attention_mask)

        # Sigmoid to get probability (binary classifier: stressed vs not)
        bert_prob = torch.sigmoid(logits).item()

        # --- VADER Sentiment (corrected formula) ---
        # VADER compound: -1.0 (very negative) to +1.0 (very positive)
        # Old formula: (1 - compound) / 2  → gives 0.50 for neutral (WRONG)
        # New formula: only negative sentiment maps to stress.
        # Neutral (compound=0) → 0% stress. Negative (compound=-1) → 100% stress.
        # Positive (compound=+1) → 0% stress.
        scores = sia.polarity_scores(cleaned)
        neg = scores['neg']      # 0.0-1.0: fraction of text that is negative
        compound = scores['compound']
        # Map: compound  -1 → 1.0,  0 → 0.0,  +1 → 0.0
        # Only negative end contributes. Clamp so positive sentiment → 0 stress.
        vader_stress = max(0.0, -compound)   # range [0, 1]; 0 for neutral/positive

        # --- Hybrid Score: 75% BERT + 25% VADER ---
        stress_score = (0.75 * bert_prob) + (0.25 * vader_stress)

        # Convert to 1-10 scale
        stress_level = round(1 + stress_score * 9, 2)
        stress_level = max(1.0, min(10.0, stress_level))

        # stress_percentage from BERT probability alone (primary signal)
        stress_percentage = round(bert_prob * 100, 2)

        return {
            "stress_level": stress_level,
            "stress_percentage": stress_percentage,
            "bert_score": round(bert_prob, 3),
            "vader_score": round(vader_stress, 3),
            "combined_score": round(stress_score, 3),
            "has_stress_keywords": has_stress,
            "has_positive_keywords": has_positive
        }

    except Exception as e:
        print(f"[ERROR] DistilBERT prediction failed: {e}")
        import traceback
        traceback.print_exc()
        return None

# ============================================================
# NVIDIA NIM — LLM Response Generation
# ============================================================
# Use the same module-level variables defined at top of file (nvidia_api_key, nvidia_model)

def get_llm_response(user_text, stress_level):
    """
    Get contextual response from NVIDIA NIM (Llama 3.1) based on stress level.
    Tone adapts to stress severity.
    """
    if not nvidia_api_key:
        print("[NVIDIA NIM] ERROR: NVIDIA_API_KEY not set in environment")
        return "AI service unavailable. Please check NVIDIA_API_KEY in backend/.env"

    if stress_level < 3:
        severity = "very low"
        tone = "light, positive, and encouraging"
        urgency = "casual conversation"
        context = "The user is calm and content. Keep the conversation light and positive."
        focus = "Maintain their good mood and encourage positive habits"
    elif stress_level < 5:
        severity = "low to moderate"
        tone = "supportive and friendly"
        urgency = "mild attention needed"
        context = "The user shows minor stress or concern. Offer gentle support."
        focus = "Provide light coping strategies and check if they want to talk more"
    elif stress_level < 7:
        severity = "moderate to high"
        tone = "empathetic, serious, and supportive"
        urgency = "active support required"
        context = "The user is experiencing significant stress. Take their concerns seriously."
        focus = "Offer practical coping strategies, validate their feelings, and suggest actionable steps"
    else:
        severity = "very high"
        tone = "very serious, compassionate, and urgent"
        urgency = "immediate attention and care needed"
        context = "CRITICAL: The user is experiencing severe stress or distress. Respond with maximum empathy and urgency."
        focus = "Validate their pain, suggest immediate calming techniques, encourage professional help, and show genuine concern"

    prompt = f"""You are a compassionate and experienced stress counselor and mental health support AI.

User's message: "{user_text}"

STRESS ANALYSIS:
- Stress Level: {stress_level}/10 ({severity})
- Urgency: {urgency}
- Context: {context}

YOUR RESPONSE STRATEGY:
- Tone: {tone}
- Focus: {focus}

RESPONSE GUIDELINES:
1. First, ACKNOWLEDGE and VALIDATE their feelings based on their stress level
2. Show appropriate level of concern (match the severity)
3. Reply in the SAME LANGUAGE the user used (e.g., if they wrote in Telugu, reply in Telugu)
4. Provide practical, actionable advice suitable for their stress level
5. If stress is HIGH (7+), suggest immediate calming techniques (deep breathing, grounding)
6. If stress is VERY HIGH (8+), GENTLY suggest professional support without being alarmist
7. Keep the response natural, warm, and genuine (3-5 sentences)
8. End with an open question to encourage them to share more if they want

Remember: Higher stress levels require more serious, empathetic, and actionable responses."""

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {nvidia_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": nvidia_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7 if stress_level >= 7 else 0.5,
        "max_tokens": 300,
    }

    print(f"[NVIDIA NIM] Requesting response for stress level {stress_level}/10 (model: {nvidia_model})")

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        data = response.json()

        if "choices" in data and data["choices"]:
            response_text = data["choices"][0]["message"]["content"]
            print(f"[NVIDIA NIM] Response generated successfully ({len(response_text)} chars)")
            return response_text

        print(f"[NVIDIA NIM] No choices in response: {json.dumps(data)[:200]}")
        return "Unable to generate response"

    except requests.exceptions.ConnectionError:
        print("[NVIDIA NIM] ConnectionError - Could not reach NVIDIA API")
        return "AI service unavailable. Please check internet connection."
    except requests.exceptions.Timeout:
        print("[NVIDIA NIM] Timeout - Request took longer than 60 seconds")
        return "AI request timed out. Please try again."
    except Exception as e:
        print(f"[NVIDIA NIM] Unexpected error: {str(e)}")
        return f"Error generating response: {str(e)}"

# ============================================================
# API Endpoints
# ============================================================

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "models_loaded": models_loaded,
        "model_type": "DistilBERT + VADER hybrid",
        "device": str(device),
        "timestamp": str(datetime.now())
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict stress from user text
    Request:  {"text": "user message"}
    Response: {"success": true, "data": {...}}
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"success": False, "error": "Missing 'text' field"}), 400

        if not models_loaded:
            return jsonify({"success": False, "error": "Models not loaded"}), 503

        result = predict_stress(data['text'])
        if result is None:
            return jsonify({"success": False, "error": "Prediction failed"}), 500

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """
    Full chat: stress prediction + NVIDIA NIM LLM response
    Request:  {"text": "user message"}
    Response: {"success": true, "stress_level": X, "bot_response": "..."}

    NOTE: Node.js backend (chat_integrated.js) handles its own NVIDIA call.
          This endpoint's bot_response is used only if Node falls back to ML service.
          The stress prediction (DistilBERT + VADER) is always the primary output.
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"success": False, "error": "Missing 'text' field"}), 400

        user_text = data['text']

        stress_data = predict_stress(user_text)
        if stress_data is None:
            return jsonify({"success": False, "error": "Prediction failed"}), 500

        llm_response = get_llm_response(user_text, stress_data['stress_level'])

        return jsonify({
            "success": True,
            "stress_level": stress_data['stress_level'],
            "stress_percentage": stress_data['stress_percentage'],
            "components": {
                "bert": stress_data['bert_score'],     # DistilBERT score
                "vader": stress_data['vader_score'],
                "combined": stress_data['combined_score'],
                "has_stress_keywords": stress_data.get('has_stress_keywords', False),
                "has_positive_keywords": stress_data.get('has_positive_keywords', False)
            },
            "bot_response": llm_response
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """
    Batch prediction for multiple texts
    Request:  {"texts": ["text1", "text2", ...]}
    Response: {"success": true, "predictions": [{...}, ...]}
    """
    try:
        data = request.get_json()
        if not data or 'texts' not in data:
            return jsonify({"success": False, "error": "Missing 'texts' field"}), 400

        texts = data['texts']
        if not isinstance(texts, list):
            return jsonify({"success": False, "error": "'texts' must be a list"}), 400

        predictions = []
        for text in texts:
            result = predict_stress(text)
            if result:
                predictions.append(result)

        return jsonify({
            "success": True,
            "count": len(predictions),
            "predictions": predictions
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ============================================================
# Error Handlers
# ============================================================
@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"success": False, "error": "Internal server error"}), 500

# ============================================================
# Main Entry Point
# ============================================================
if __name__ == '__main__':
    print("\n" + "="*70)
    print("STRESS DETECTION ML MICROSERVICE")
    print("Model: DistilBERT (fine-tuned) + VADER Hybrid")
    print("="*70)

    # Load env from backend .env
    env_path = Path(__file__).parent.parent / "Stress Detection" / "backend" / ".env"
    if env_path.exists():
        from dotenv import load_dotenv
        load_dotenv(env_path)
        print(f"[ML Service] Loaded environment from {env_path}")

    if load_models():
        setup_nvidia()

        print("\n[ML Service] Starting Flask server on http://localhost:5000")
        print("[ML Service] Endpoints:")
        print("  - GET  /health        - Health check")
        print("  - POST /predict       - Stress prediction only")
        print("  - POST /chat          - Stress prediction + LLM response")
        print("  - POST /batch-predict - Batch predictions")
        print(f"\n[ML Service] LLM: NVIDIA NIM ({nvidia_model})")
        print(f"[ML Service] Classifier: DistilBERT 6-layer + VADER (75/25 hybrid)")
        print("\n" + "="*70 + "\n")

        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        print("[ERROR] Failed to start service - models not loaded")
        print(f"Please ensure these files exist in: {MODEL_DIR}")
        print("  - stress_model.pt   (DistilBERT weights — single .pt file)")
        print("  - tokenizer.pkl     (DistilBERT tokenizer)")
