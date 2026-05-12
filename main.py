"""
FastAPI application for Odoo CRM opportunity ageing dashboard.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from datetime import datetime
from dotenv import load_dotenv
from cachetools import TTLCache, cached
from odoo_client import get_target_leads, get_lead_stage_history, get_stage_mapping, authenticate

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Odoo Ageing Dashboard API",
    description="API for tracking Odoo 18 CRM opportunity ageing",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cache = TTLCache(maxsize=100, ttl=300)

@cached(cache)
def fetch_leads_from_odoo():
    print("Fetching fresh data from Odoo XML-RPC...")
    leads = get_target_leads()
    
    if not leads:
        return {
            "status": "success",
            "message": "No leads found in target stages",
            "leads": []
        }
    
    lead_ids = [lead["id"] for lead in leads]
    auth = authenticate()
    models = auth["models"]
    uid = auth["uid"]
    password = os.getenv("ODOO_API_KEY")
    db = os.getenv("ODOO_DB")
    
    stage_mapping = get_stage_mapping(models, db, uid, password)
    stage_history = get_lead_stage_history(models, db, uid, password, lead_ids)
    
    for lead in leads:
        lead_id = lead["id"]
        create_date = lead.get("create_date", "")
        history = stage_history.get(lead_id, [])
        
        try:
            if isinstance(create_date, str):
                create_dt = datetime.fromisoformat(create_date.replace("Z", "+00:00"))
            else:
                create_dt = create_date
        except:
            create_dt = None
        
        enriched_history = []
        
        if create_dt:
            enriched_history.append({
                "stage_id": None,
                "stage_name": "Created / 01 New Deals",
                "entered_at": create_date,
                "time_in_stage_seconds": None
            })
        
        for entry in history:
            stage_id = entry.get("stage_id")
            entered_at = entry.get("entered_at")
            stage_name = stage_mapping.get(stage_id, "Unknown Stage")
            
            enriched_history.append({
                "stage_id": stage_id,
                "stage_name": stage_name,
                "entered_at": entered_at,
                "time_in_stage_seconds": None
            })
        
        now = datetime.utcnow()
        
        for idx in range(len(enriched_history) - 1):
            current_entry = enriched_history[idx]
            next_entry = enriched_history[idx + 1]
            
            try:
                current_time_str = current_entry.get("entered_at", "")
                next_time_str = next_entry.get("entered_at", "")
                
                if current_time_str:
                    current_time = datetime.fromisoformat(current_time_str.replace("Z", "+00:00"))
                    if next_time_str:
                        next_time = datetime.fromisoformat(next_time_str.replace("Z", "+00:00"))
                        duration = (next_time - current_time).total_seconds()
                        current_entry["time_in_stage_seconds"] = max(0, int(duration))
            except:
                pass
        
        if enriched_history:
            last_entry = enriched_history[-1]
            try:
                last_time_str = last_entry.get("entered_at", "")
                if last_time_str:
                    last_time = datetime.fromisoformat(last_time_str.replace("Z", "+00:00"))
                    if last_time.tzinfo is None:
                        duration = (now - last_time).total_seconds()
                    else:
                        duration = (now - last_time.replace(tzinfo=None)).total_seconds()
                    last_entry["time_in_stage_seconds"] = max(0, int(duration))
            except:
                pass
        
        lead["stage_history"] = enriched_history
    
    return {
        "status": "success",
        "message": f"Retrieved {len(leads)} leads with enriched stage history",
        "leads": leads
    }


@app.get("/api/leads")
def get_leads():
    try:
        return fetch_leads_from_odoo()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch leads: {str(e)}"
        )


@app.get("/api/test-odoo")
def test_odoo_connection():
    return get_leads()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
