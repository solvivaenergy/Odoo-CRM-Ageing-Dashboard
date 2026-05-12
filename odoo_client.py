"""
Odoo XML-RPC client for CRM lead management.
"""
import os
import xmlrpc.client
from typing import List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

ODOO_URL = os.getenv("ODOO_URL")
ODOO_DB = os.getenv("ODOO_DB")
ODOO_USER = os.getenv("ODOO_USER")
ODOO_API_KEY = os.getenv("ODOO_API_KEY")


def authenticate() -> Dict[str, Any]:
    """
    Authenticate with Odoo via XML-RPC.
    
    Returns:
        dict: Authentication credentials (uid, models, common)
        
    Raises:
        Exception: If authentication fails
    """
    try:
        # Create XML-RPC client connection
        common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
        
        # Authenticate
        uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_API_KEY, {})
        
        if not uid:
            raise Exception("Authentication failed: Invalid credentials")
        
        # Get models client
        models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
        
        return {
            "uid": uid,
            "models": models,
            "common": common
        }
    except Exception as e:
        raise Exception(f"Odoo authentication error: {str(e)}")


def get_stage_mapping(models, db: str, uid: int, password: str) -> Dict[int, str]:
    """
    Fetch all stages from crm.stage model and return mapping of stage_id to stage_name.
    
    Args:
        models: XML-RPC models client
        db: Odoo database name
        uid: User ID
        password: API key/password
        
    Returns:
        dict: Mapping of {stage_id: stage_name}
        
    Raises:
        Exception: If query fails
    """
    try:
        # Search all stages
        stage_ids = models.execute_kw(
            db, uid, password,
            "crm.stage",
            "search",
            [[]]  # Empty domain to get all stages
        )
        
        if not stage_ids:
            return {}
        
        # Read stage records
        stages = models.execute_kw(
            db, uid, password,
            "crm.stage",
            "read",
            [stage_ids],
            {"fields": ["id", "name"]}
        )
        
        # Create mapping dictionary
        stage_mapping = {stage["id"]: stage["name"] for stage in stages}
        
        return stage_mapping
        
    except Exception as e:
        raise Exception(f"Error retrieving stage mapping: {str(e)}")


def get_target_leads() -> List[Dict[str, Any]]:
    """
    Query crm.lead records where stage_id is in [30, 37, 38].
    Returns: id, name, create_date, and unpacked stage_id info.
    
    Returns:
        list: List of lead dictionaries with id, name, create_date, 
              current_stage_id, and current_stage_name
        
    Raises:
        Exception: If query fails
    """
    try:
        auth = authenticate()
        uid = auth["uid"]
        models = auth["models"]
        
        # Search for leads with target stages within the Sales team
        # Stage IDs: 30, 37, 38
        domain = [
            ("stage_id", "in", [30, 37, 38]),
            ("team_id", "=", 6)
        ]
        
        # Search for matching records (no limit - fetch all)
        lead_ids = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_API_KEY,
            "crm.lead",
            "search",
            [domain]
        )
        
        if not lead_ids:
            return []
        
        # Read the lead records
        leads = models.execute_kw(
            ODOO_DB,
            uid,
            ODOO_API_KEY,
            "crm.lead",
            "read",
            [lead_ids],
            {"fields": ["id", "name", "create_date", "stage_id", "user_id"]}
        )
        
        # Unpack stage_id and user_id tuples/lists into separate fields
        for lead in leads:
            stage_entry = lead.get("stage_id")
            if stage_entry and isinstance(stage_entry, (list, tuple)) and len(stage_entry) >= 2:
                stage_id, stage_name = stage_entry[0], stage_entry[1]
                lead["current_stage_id"] = stage_id
                lead["current_stage_name"] = stage_name
            else:
                lead["current_stage_id"] = None
                lead["current_stage_name"] = "Unknown"

            if "stage_id" in lead:
                del lead["stage_id"]

            user_entry = lead.get("user_id")
            if user_entry and isinstance(user_entry, (list, tuple)) and len(user_entry) >= 2:
                user_id, user_name = user_entry[0], user_entry[1]
                lead["salesperson_id"] = user_id
                lead["salesperson_name"] = user_name
            else:
                lead["salesperson_id"] = None
                lead["salesperson_name"] = "Unassigned"

            lead["id"] = lead.get("id")

            if "user_id" in lead:
                del lead["user_id"]
        
        return leads
        
    except Exception as e:
        raise Exception(f"Error querying Odoo leads: {str(e)}")


def get_lead_stage_history(models, db: str, uid: int, password: str, lead_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    """
    Mine the stage history for leads from mail.message and mail.tracking.value.
    
    Args:
        models: XML-RPC models client
        db: Odoo database name
        uid: User ID
        password: API key/password
        lead_ids: List of lead IDs to get history for
        
    Returns:
        dict: Mapping of lead_id to chronological list of stage changes
        
    Raises:
        Exception: If history retrieval fails
    """
    try:
        # Step 1: Get the field ID for 'stage_id' on crm.lead
        field_domain = [
            ("model", "=", "crm.lead"),
            ("name", "=", "stage_id")
        ]
        
        field_ids = models.execute_kw(
            db, uid, password,
            "ir.model.fields",
            "search",
            [field_domain]
        )
        
        if not field_ids:
            # No stage field found, return empty history
            return {lead_id: [] for lead_id in lead_ids}
        
        stage_field_id = field_ids[0]
        
        # Step 2: Get mail.message records for these leads
        message_domain = [
            ("model", "=", "crm.lead"),
            ("res_id", "in", lead_ids)
        ]
        
        message_ids = models.execute_kw(
            db, uid, password,
            "mail.message",
            "search",
            [message_domain]
        )
        
        if not message_ids:
            # No messages found, return empty history for all leads
            return {lead_id: [] for lead_id in lead_ids}
        
        # Step 3: Get the dates and res_id of the messages
        message_map = {}  # Maps message_id to {date, res_id}
        messages = models.execute_kw(
            db, uid, password,
            "mail.message",
            "read",
            [message_ids],
            {"fields": ["id", "date", "res_id"]}
        )
        for msg in messages:
            message_map[msg["id"]] = {
                "date": msg.get("date", ""),
                "res_id": msg.get("res_id")
            }
        
        # Step 4: Get mail.tracking.value records for stage changes using the field ID
        tracking_domain = [
            ("mail_message_id", "in", message_ids),
            ("field_id", "=", stage_field_id)
        ]
        
        tracking_ids = models.execute_kw(
            db, uid, password,
            "mail.tracking.value",
            "search",
            [tracking_domain]
        )
        
        if not tracking_ids:
            # No tracking values found, return empty history
            return {lead_id: [] for lead_id in lead_ids}
        
        tracking_values = models.execute_kw(
            db, uid, password,
            "mail.tracking.value",
            "read",
            [tracking_ids],
            {"fields": ["mail_message_id", "old_value_integer", "new_value_integer"]}
        )
        
        # Step 5: Organize tracking values by lead_id
        history_by_lead = {lead_id: [] for lead_id in lead_ids}
        
        for tracking in tracking_values:
            msg_id = tracking.get("mail_message_id")
            if isinstance(msg_id, (list, tuple)):
                msg_id = msg_id[0]  # Unpack if tuple
            
            msg_info = message_map.get(msg_id, {})
            msg_date = msg_info.get("date", "")
            lead_id = msg_info.get("res_id")
            new_stage_id = tracking.get("new_value_integer")
            
            if lead_id in history_by_lead:
                history_by_lead[lead_id].append({
                    "stage_id": new_stage_id,
                    "entered_at": msg_date
                })
        
        # Step 6: Sort history chronologically for each lead
        for lead_id in history_by_lead:
            history_by_lead[lead_id].sort(key=lambda x: x.get("entered_at", ""))
        
        return history_by_lead
        
    except Exception as e:
        raise Exception(f"Error retrieving lead stage history: {str(e)}")
