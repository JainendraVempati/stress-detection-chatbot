"""
ML Microservice for Stress Detection
Integrates LSTM + LLM models and exposes REST API for Node.js backend
"""

import re
import json
import joblib
import pickle
import requests
import nltk
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.preprocessing.sequence import pad_sequences
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import os
from pathlib import Path
from datetime import datetime

# ============================================================
# Initialize Flask App
# ============================================================
app = Flask(__name__)
CORS(app)

# Configure model path - Updated for production structure
MODEL_DIR = Path(__file__).parent
DATA_DIR = Path(__file__).parent

# ============================================================
# Load NLTK VADER
# ============================================================
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon', quiet=True)

sia = SentimentIntensityAnalyzer()

# ============================================================
# Global Model Variables
# ============================================================
tokenizer = None
config = None
model = None
models_loaded = False
lm_studio_model = None  # Auto-detected LM Studio model name

def detect_lmstudio_model():
    """Auto-detect the first available chat model in LM Studio"""
    global lm_studio_model
    try:
        response = requests.get("http://localhost:1234/v1/models", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and len(data['data']) > 0:
                # Find the first non-embedding model
                for m in data['data']:
                    model_id = m.get('id', '')
                    if 'embedding' not in model_id.lower():
                        lm_studio_model = model_id
                        print(f"[LM Studio] Auto-detected model: {lm_studio_model}")
                        return lm_studio_model
        print("[LM Studio] Could not auto-detect model, using default")
        lm_studio_model = "phi-3-mini-4k-instruct"
        return lm_studio_model
    except Exception as e:
        print(f"[LM Studio] Auto-detection failed: {e}, using default")
        lm_studio_model = "phi-3-mini-4k-instruct"
        return lm_studio_model

def load_models():
    """Load all ML models and preprocessing artifacts"""
    global tokenizer, config, model, models_loaded
    
    try:
        print("[ML Service] Loading tokenizer...")
        tokenizer_path = DATA_DIR / "tokenizer.pkl"
        if tokenizer_path.exists():
            tokenizer = joblib.load(tokenizer_path)
        else:
            print(f"[WARNING] Tokenizer not found at {tokenizer_path}")
            return False
        
        print("[ML Service] Loading sequence config...")
        config_path = DATA_DIR / "sequence_config.pkl"
        if config_path.exists():
            config = joblib.load(config_path)
        else:
            print(f"[WARNING] Config not found at {config_path}")
            return False
        
        print("[ML Service] Loading LSTM model...")
        model_path = DATA_DIR / "model.pkl"
        if model_path.exists():
            with open(model_path, "rb") as f:
                model = pickle.load(f)
        else:
            print(f"[WARNING] Model not found at {model_path}")
            return False
        
        models_loaded = True
        print("[ML Service] ✓ All models loaded successfully!")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to load models: {e}")
        return False

# ============================================================
# Text Cleaning Function
# ============================================================
def clean_text(text):
    """Clean and normalize text"""
    text = str(text).lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# ============================================================
# Stress Keywords List
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
    'can\'t take', 'cant take', 'giving up', 'no way out'
]

# Positive words that indicate NO stress
POSITIVE_WORDS = [
    'good', 'great', 'happy', 'excellent', 'wonderful', 'amazing', 'fantastic',
    'awesome', 'fine', 'okay', 'ok', 'calm', 'relaxed', 'peaceful', 'joyful',
    'cheerful', 'content', 'satisfied', 'pleased', 'thrilled', 'excited',
    'positive', 'blessed', 'grateful', 'thankful', 'love', 'enjoy', 'better',
    'best', 'perfect', 'beautiful', 'nice', 'lovely', 'brilliant', 'superb'
]

def contains_stress_indicators(text):
    """Check if text contains any stress-related keywords"""
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in STRESS_KEYWORDS)

def contains_positive_indicators(text):
    """Check if text contains any positive keywords"""
    text_lower = text.lower()
    return any(word in text_lower for word in POSITIVE_WORDS)

# ============================================================
# Stress Prediction Function
# ============================================================
def predict_stress(text):
    """
    Predict stress level using hybrid approach:
    - 75% weight: LSTM neural network
    - 25% weight: VADER sentiment analysis
    
    ALWAYS runs ML models for accurate prediction.
    Keywords are tracked but don't gate the prediction.
    
    Returns:
        dict: stress_level (1-10), stress_percentage (0-100), components
    """
    if not models_loaded or model is None or tokenizer is None:
        return None
    
    try:
        cleaned_text = clean_text(text)
        
        # Check for indicators (for tracking, not gating)
        has_stress = contains_stress_indicators(cleaned_text)
        has_positive = contains_positive_indicators(cleaned_text)
        
        # ALWAYS run LSTM Prediction (0-1)
        sequence = tokenizer.texts_to_sequences([cleaned_text])
        padded = pad_sequences(sequence, maxlen=config["max_len"], 
                              padding="post", truncating="post")
        lstm_prob = float(model.predict(padded, verbose=0)[0][0])
        
        # ALWAYS run VADER Sentiment (convert to 0-1 stress scale)
        compound = sia.polarity_scores(cleaned_text)['compound']
        vader_stress = (1 - compound) / 2
        
        # Hybrid Score
        stress_score = (0.75 * lstm_prob) + (0.25 * vader_stress)
        
        # Convert to 1-10 scale
        stress_level = round(1 + stress_score * 9, 2)
        stress_level = max(1.0, min(10.0, stress_level))
        
        stress_percentage = round(lstm_prob * 100, 2)
        
        return {
            "stress_level": stress_level,
            "stress_percentage": stress_percentage,
            "lstm_score": round(lstm_prob, 3),
            "vader_score": round(vader_stress, 3),
            "combined_score": round(stress_score, 3),
            "has_stress_keywords": has_stress,
            "has_positive_keywords": has_positive
        }
        
    except Exception as e:
        print(f"[ERROR] Prediction failed: {e}")
        return None

# ============================================================
# LM Studio API Call
# ============================================================
def get_llm_response(user_text, stress_level):
    """
    Get contextual response from LM Studio based on stress level
    Adjusts tone and seriousness based on stress severity
    """
    url = "http://localhost:1234/v1/chat/completions"
    
    # Use auto-detected model or fallback to default
    model_to_use = lm_studio_model or "phi-3-mini-4k-instruct"
    
    # Determine severity and adjust response strategy
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
3. Provide practical, actionable advice suitable for their stress level
4. If stress is HIGH (7+), suggest immediate calming techniques (breathing, grounding)
5. If stress is VERY HIGH (8+), GENTLY suggest professional support without being alarmist
6. Keep the response natural, warm, and genuine (3-5 sentences)
7. End with an open question to encourage them to share more if they want

Remember: Higher stress levels require more serious, empathetic, and actionable responses."""
    
    payload = {
        "model": model_to_use,  # Use auto-detected model
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7 if stress_level >= 7 else 0.5,
        "max_tokens": 300
    }
    
    print(f"[LM Studio] Requesting response for stress level {stress_level}/10 (model: {model_to_use})")
    
    try:
        response = requests.post(url, json=payload, timeout=30)  # Increased timeout to 30s for LLM response
        data = response.json()
        
        if "choices" in data:
            response_text = data["choices"][0]["message"]["content"]
            print(f"[LM Studio] Response generated successfully ({len(response_text)} chars)")
            return response_text
        print(f"[LM Studio] No choices in response: {json.dumps(data)[:200]}")
        return "Unable to generate response"
        
    except requests.exceptions.ConnectionError:
        print("[LM Studio] ConnectionError - LM Studio not running on localhost:1234")
        return "LM Studio service unavailable. Please check if server is running on localhost:1234"
    except requests.exceptions.Timeout:
        print("[LM Studio] Timeout - Request took longer than 30 seconds")
        return "LM Studio request timed out. Please ensure LM Studio is running and model is fully loaded. Try again in a moment."
    except Exception as e:
        print(f"[LM Studio] Unexpected error: {str(e)}")
        return f"Error generating response: {str(e)}"

# ============================================================
# API Endpoints
# ============================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "models_loaded": models_loaded,
        "timestamp": str(datetime.now())
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict stress from user text
    
    Request: {"text": "user message"}
    Response: {"success": true, "data": {...}}
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"success": False, "error": "Missing 'text' field"}), 400
        
        user_text = data['text']
        
        if not models_loaded:
            return jsonify({"success": False, "error": "Models not loaded"}), 503
        
        result = predict_stress(user_text)
        
        if result is None:
            return jsonify({"success": False, "error": "Prediction failed"}), 500
        
        return jsonify({
            "success": True,
            "data": result
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """
    Full chat endpoint combining stress prediction + LLM response
    
    Request: {"text": "user message"}
    Response: {"success": true, "stress_level": X, "response": "..."}
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"success": False, "error": "Missing 'text' field"}), 400
        
        user_text = data['text']
        
        # Get stress prediction
        stress_data = predict_stress(user_text)
        
        if stress_data is None:
            return jsonify({"success": False, "error": "Prediction failed"}), 500
        
        # Get LLM response
        llm_response = get_llm_response(user_text, stress_data['stress_level'])
        
        return jsonify({
            "success": True,
            "stress_level": stress_data['stress_level'],
            "stress_percentage": stress_data['stress_percentage'],
            "components": {
                "lstm": stress_data['lstm_score'],
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
    
    Request: {"texts": ["text1", "text2", ...]}
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
    print("="*70)
    
    # Load models on startup
    if load_models():
        # Auto-detect LM Studio model
        detect_lmstudio_model()
        
        print("\n[ML Service] Starting Flask server on http://localhost:5000")
        print("[ML Service] Endpoints:")
        print("  - GET  /health - Health check")
        print("  - POST /predict - Single prediction")
        print("  - POST /chat - Chat with LLM integration")
        print("  - POST /batch-predict - Batch predictions")
        print(f"\n[ML Service] LM Studio Model: {lm_studio_model}")
        print("\n" + "="*70 + "\n")
        
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        print("[ERROR] Failed to start service - models not loaded")
        print(f"Please ensure model files exist in: {DATA_DIR}")
