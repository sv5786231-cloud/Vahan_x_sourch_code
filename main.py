import asyncio
import random
import httpx  # Async version of requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
]

# Using an Async Client to manage cookies and connection pooling
client = httpx.AsyncClient(timeout=15.0, follow_redirects=True)

async def init_session():
    """Initializes cookies by visiting the home page"""
    try:
        headers = {"User-Agent": USER_AGENTS[0]}
        await client.get("https://vahanx.in/", headers=headers)
    except Exception as e:
        print(f"Session Init Error: {e}")

async def get_vehicle_details(v_no: str, attempt: int = 1):
    reg = v_no.upper().strip()
    url = f"https://vahanx.in/rc-search/{reg}"

    try:
        # Check if we have cookies, if not, init session
        if not client.cookies:
            await init_session()

        # Random delay for retries (Anti-bot measure)
        if attempt > 1:
            await asyncio.sleep(random.uniform(2, 4))

        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Referer": "https://vahanx.in/",
            "Connection": "keep-alive"
        }

        response = await client.get(url, headers=headers)
        html = response.text

        # Detect block page or invalid response
        if not html or len(html) < 5000 or "Just a moment" in html:
            if attempt <= 3:
                await init_session()
                return await get_vehicle_details(v_no, attempt + 1)
            return {"success": False, "message": "Target site blocking or busy. Try later."}

        soup = BeautifulSoup(html, 'html.parser')

        def extract(label):
            """Finds the label in a span and gets the text from the sibling <p> tag"""
            for span in soup.find_all("span"):
                if span.get_text().strip().lower() == label.lower():
                    # Look for the <p> tag within the same parent container
                    p_tag = span.find_parent().find("p")
                    return p_tag.get_text().strip() if p_tag else "Not Found"
            return "Not Found"

        data = {
            "Vehicle No": extract("Registration Number"),
            "Model Name": extract("Model Name"),
            "Maker Model": extract("Maker Model"),
            "Owner Name": extract("Owner Name"),
            "Father Name": extract("Father's Name"),
            "RTO": extract("Registered RTO"),
            "Vehicle Type": extract("Vehicle Class"),
            "Fuel Type": extract("Fuel Type"),
            "Chassis": extract("Chassis Number"),
            "Engine": extract("Engine Number"),
            "Reg Date": extract("Registration Date"),
            "Reg Upto": extract("Registration Upto"),
            "Insurance": extract("Insurance Company"),
            "Insurance Upto": extract("Insurance Upto"),
            "Vehicle Age": extract("Vehicle Age"),
            "Finance": extract("Finance"),
            "Financer": extract("Financier Name")
        }

        # Verification: If core data is missing, retry
        if data["Vehicle No"] == "Not Found" and attempt <= 3:
            return await get_vehicle_details(v_no, attempt + 1)

        return {"success": True, "data": data}

    except Exception as e:
        if attempt <= 3:
            await init_session()
            return await get_vehicle_details(v_no, attempt + 1)
        return {"success": False, "message": str(e)}

# --- ENDPOINTS ---

@app.get("/")
async def root():
    return {"message": "Vehicle API (Python FastAPI) is running"}

@app.get("/api/vehicle/{vno}")
async def vehicle_api(vno: str):
    return await get_vehicle_details(vno)

# --- BACKGROUND KEEP-ALIVE (For Render/Heroku) ---
async def keep_alive_task():
    while True:
        await asyncio.sleep(600)  # 10 Minutes
        try:
            # Replace with your actual deployment URL
            await client.get("http://localhost:8000/")
        except:
            pass

@app.on_event("startup")
async def startup_event():
    # Start the keep-alive background loop
    asyncio.create_task(keep_alive_task())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
