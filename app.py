import os
import requests
import random
import time
from flask import Flask, jsonify, abort
from bs4 import BeautifulSoup

app = Flask(__name__)

# Security Key
API_KEY = "KEY_THREE_5544"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
]

def fetch_father_name(veh_no):
    url = f"https://vahanx.in/rc-search/{veh_no}"
    session = requests.Session()
    
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
                
                # Father/Husband's Name find karne ka logic
                target = soup.find(lambda tag: tag.name == "span" and ("father" in tag.text.lower() or "husband" in tag.text.lower()))
                if target:
                    # Aksar span ke baad wala paragraph ya sibling mein value hoti hai
                    val = target.find_next('p') or target.parent.find('p')
                    if val and val.text.strip():
                        return val.text.strip().upper()
            time.sleep(1)
        except Exception:
            continue
    return "_ _"

@app.route('/api/<key>/<veh_no>', methods=['GET'])
def get_vehicle_info(key, veh_no):
    # API Key Validation
    if key != API_KEY:
        return jsonify({"status": "error", "message": "Invalid API Key"}), 403

    clean_no = veh_no.replace(" ", "").upper()
    father_name = fetch_father_name(clean_no)
    
    # Aapka requested response format
    return jsonify({
        "status": "success",
        "vehicle_no": clean_no,
        "father_name": father_name
    })

if __name__ == "__main__":
    # Render ya local host ke liye port binding
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
