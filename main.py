import os
import requests
import random
import time
from flask import Flask, jsonify
from bs4 import BeautifulSoup

app = Flask(__name__)

# List of rotating User-Agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
]

def fetch_data(veh_no):
    url = f"https://vahanx.in/rc-search/{veh_no}"
    
    # Render IP block hone se bachne ke liye hum random delays aur sessions use karenge
    session = requests.Session()
    
    # 3 baar alag-alag tarike se try karega
    for attempt in range(3):
        try:
            headers = {
                "User-Agent": random.choice(USER_AGENTS),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/",
                "Connection": "keep-alive"
            }
            
            # Request bhej rahe hain
            response = session.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Check agar page block toh nahi hua (vahanx aksar check karne ko bolta hai)
                if "checking your browser" in response.text.lower():
                    time.sleep(2)
                    continue

                # Father's name nikalne ka sabse tagda logic
                # Hum poore page mein 'Father' text dhoond rahe hain
                target = soup.find(lambda tag: tag.name == "span" and "father" in tag.text.lower())
                if target and target.parent:
                    val = target.parent.find('p')
                    if val and val.text.strip():
                        return val.text.strip()
                
            # Har fail attempt ke baad thoda rukna zaroori hai
            time.sleep(random.uniform(2, 4))
            
        except Exception:
            time.sleep(1)
            continue
            
    return "_ _"

@app.route('/api/vehicle/<veh_no>', methods=['GET'])
def get_vehicle_info(veh_no):
    clean_no = veh_no.replace(" ", "").upper()
    
    # Result fetch karna
    father_name = fetch_data(clean_no)
    
    # Response format
    return jsonify({
        "status": "success",
        "vehicle_no": clean_no,
        "father_name": father_name
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
