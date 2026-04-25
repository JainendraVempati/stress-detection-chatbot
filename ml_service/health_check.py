"""
Health Check Script for Stress Detection System
Tests all services and endpoints
"""

import requests
import json
import sys
from colorama import init, Fore, Style

# Initialize colorama for Windows
init(autoreset=True)

BASE_URL = "http://localhost:4000"
ML_URL = "http://localhost:5000"

def print_header(text):
    print(f"\n{'='*60}")
    print(f" {text}")
    print(f"{'='*60}\n")

def print_success(text):
    print(f"{Fore.GREEN}✓ {text}{Style.RESET_ALL}")

def print_error(text):
    print(f"{Fore.RED}✗ {text}{Style.RESET_ALL}")

def print_info(text):
    print(f"{Fore.CYAN}ℹ {text}{Style.RESET_ALL}")

def test_endpoint(method, url, expected_status=200, data=None, headers=None):
    """Test an endpoint and return result"""
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=5)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=5)
        
        if response.status_code == expected_status:
            print_success(f"{method} {url} - {response.status_code}")
            return True, response.json() if response.content else None
        else:
            print_error(f"{method} {url} - Expected {expected_status}, got {response.status_code}")
            return False, None
    except requests.exceptions.ConnectionError:
        print_error(f"{method} {url} - Connection refused (service not running)")
        return False, None
    except Exception as e:
        print_error(f"{method} {url} - {str(e)}")
        return False, None

def main():
    print_header("STRESS DETECTION SYSTEM - HEALTH CHECK")
    
    all_passed = True
    
    # Test 1: Backend Health
    print_header("1. Testing Backend Service")
    success, data = test_endpoint("GET", f"{BASE_URL}/health")
    if success and data:
        print_info(f"Version: {data.get('version', 'N/A')}")
        print_info(f"ML Integrated: {data.get('ml_integrated', False)}")
    all_passed &= success
    
    # Test 2: ML Service Health
    print_header("2. Testing ML Microservice")
    success, data = test_endpoint("GET", f"{ML_URL}/health")
    if success and data:
        print_info(f"Models Loaded: {data.get('models_loaded', False)}")
    all_passed &= success
    
    # Test 3: ML Prediction
    print_header("3. Testing ML Prediction")
    test_text = "I am feeling very stressed and overwhelmed with work"
    success, data = test_endpoint(
        "POST", 
        f"{ML_URL}/predict",
        data={"text": test_text}
    )
    if success and data:
        stress_data = data.get('data', {})
        print_info(f"Stress Level: {stress_data.get('stress_level', 'N/A')}/10")
        print_info(f"Stress Percentage: {stress_data.get('stress_percentage', 'N/A')}%")
        print_info(f"LSTM Score: {stress_data.get('lstm_score', 'N/A')}")
        print_info(f"VADER Score: {stress_data.get('vader_score', 'N/A')}")
    all_passed &= success
    
    # Test 4: ML Chat with LLM
    print_header("4. Testing ML Chat (with LLM Response)")
    success, data = test_endpoint(
        "POST",
        f"{ML_URL}/chat",
        data={"text": "I'm feeling anxious about my deadlines"}
    )
    if success and data:
        print_info(f"Stress Level: {data.get('stress_level', 'N/A')}/10")
        print_info(f"Bot Response: {data.get('bot_response', 'N/A')[:100]}...")
    all_passed &= success
    
    # Test 5: Backend Auth (Signup)
    print_header("5. Testing Backend Authentication")
    import time
    test_email = f"test_{int(time.time())}@example.com"
    success, data = test_endpoint(
        "POST",
        f"{BASE_URL}/auth/signup",
        data={
            "name": "Test User",
            "email": test_email,
            "password": "testpassword123",
            "confirmPassword": "testpassword123"
        }
    )
    if success and data:
        print_info(f"Message: {data.get('message', 'N/A')}")
        if data.get('debug') and data.get('otp'):
            print_info(f"OTP (Debug Mode): {data.get('otp')}")
    all_passed &= success
    
    # Test 6: Batch Prediction
    print_header("6. Testing Batch Prediction")
    success, data = test_endpoint(
        "POST",
        f"{ML_URL}/batch-predict",
        data={
            "texts": [
                "I'm feeling great today!",
                "Work is so stressful",
                "I'm overwhelmed with anxiety"
            ]
        }
    )
    if success and data:
        print_info(f"Predictions: {data.get('count', 0)}")
        for i, pred in enumerate(data.get('predictions', [])):
            print_info(f"  Text {i+1}: Stress Level {pred.get('stress_level', 'N/A')}/10")
    all_passed &= success
    
    # Summary
    print_header("HEALTH CHECK SUMMARY")
    if all_passed:
        print_success("All tests passed! System is operational.")
    else:
        print_error("Some tests failed. Check the output above for details.")
        print_info("Make sure all services are running:")
        print_info("  - MongoDB: mongod")
        print_info("  - ML Service: python ml_service.py")
        print_info("  - Backend: cd backend && npm start")
        print_info("  - LM Studio: Running on port 1234")
    
    print()
    return 0 if all_passed else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nHealth check interrupted.")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)
