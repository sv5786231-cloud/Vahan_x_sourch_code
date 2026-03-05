import os
import requests
import random
import time
from flask import Flask, jsonify
from bs4 import BeautifulSoup

app = Flask(__name__)

# --- CONFIGURATION ---
API_KEY = "KEY_THREE_5544"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
]

# --- SCRAPING LOGIC ---
def fetch_father_name(veh_no):
    url = f"https://vahanx.in/rc-search/{veh_no}"
    session = requests.Session()
    
    # 2 baar try karega agar pehli baar fail hua
    for _ in range(2):
        try:
            headers = {
                "User-Agent": random.choice(USER_AGENTS),
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/"
            }
            response = session.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Father/Husband's Name search logic (Adaptive Search)
                target = soup.find(lambda tag: tag.name == "span" and ("father" in tag.text.lower() or "husband" in tag.text.lower()))
                
                if target:
                    # Target ke agle paragraph 'p' mein value hoti hai
                    val = target.find_next('p') or target.parent.find('p')
                    if val and val.text.strip():
                        return val.text.strip().upper()
            
            time.sleep(1) # Chhota delay block hone se bachne ke liye
        except Exception:
            continue
            
    return "_ _" # Agar data nahi mila

# --- ROUTES ---

# 1. Home Route (UptimeRobot ke liye taaki app 24/7 chale)
@app.route('/')
def home():
    return "Vehicle API is Active and Running 24/7", 200

# 2. Main API Endpoint: /api/KEY_THREE_5544/WB18X1739
@app.route('/api/<key>/<veh_no>', methods=['GET'])
def get_vehicle_data(key, veh_no):
    # API Key Security Check
    if key != API_KEY:
        return jsonify({
            "status": "error",
            "message": "Unauthorized: Invalid API Key"
        }), 403

    # Vehicle number clean karein (Space hatao aur Uppercase karo)
    clean_no = veh_no.replace(" ", "").upper()
    
    # Data fetch karein
    father_name = fetch_father_name(clean_no)
    
    # Final Response Format
    return jsonify({
        "status": "success",
        "vehicle_no": clean_no,
        "father_name": father_name
    })

# --- RUN APP ---
if __name__ == "__main__":
    # Render binding logic
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
