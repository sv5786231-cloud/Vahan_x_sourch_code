import os
import requests
import random
import time
from flask import Flask, jsonify
from bs4 import BeautifulSoup

app = Flask(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
]

def fetch_data(veh_no):
    url = f"https://vahanx.in/rc-search/{veh_no}"
    session = requests.Session()
    
    for attempt in range(2):
        try:
            headers = {
                "User-Agent": random.choice(USER_AGENTS),
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/"
            }
            response = session.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Search logic for Father's Name
                target = soup.find(lambda tag: tag.name == "span" and "father" in tag.text.lower())
                if target and target.parent:
                    val = target.parent.find('p')
                    if val and val.text.strip():
                        return val.text.strip()
            time.sleep(2)
        except:
            continue
    return "_ _"

@app.route('/api/vehicle/<veh_no>', methods=['GET'])
def get_vehicle_info(veh_no):
    clean_no = veh_no.replace(" ", "").upper()
    father_name = fetch_data(clean_no)
    return jsonify({
        "status": "success",
        "vehicle_no": clean_no,
        "father_name": father_name
    })

if __name__ == "__main__":
    # Render binding fix
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
