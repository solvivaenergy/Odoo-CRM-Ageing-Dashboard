"""
Test script to validate Odoo XML-RPC connection and lead retrieval.
Run this script to test connectivity before starting the FastAPI server.
"""
import sys
from odoo_client import authenticate, get_target_leads


def test_authentication():
    """Test Odoo authentication."""
    print("🔐 Testing Odoo authentication...")
    try:
        auth = authenticate()
        print(f"✅ Authentication successful!")
        print(f"   User ID: {auth['uid']}")
        return True
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return False


def test_lead_retrieval():
    """Test lead retrieval from Odoo."""
    print("\n📊 Testing lead retrieval...")
    try:
        leads = get_target_leads()
        print(f"✅ Lead retrieval successful!")
        print(f"   Found {len(leads)} leads in target stages (30, 37, 38)")
        
        if leads:
            print("\n   Sample leads:")
            for lead in leads[:3]:
                print(f"   - ID: {lead.get('id')}, Name: {lead.get('name')}, Created: {lead.get('create_date')}")
        return True
    except Exception as e:
        print(f"❌ Lead retrieval failed: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Odoo Connection Test Suite")
    print("=" * 60)
    
    auth_success = test_authentication()
    if not auth_success:
        print("\n❌ Tests failed - authentication error")
        sys.exit(1)
    
    retrieval_success = test_lead_retrieval()
    if not retrieval_success:
        print("\n❌ Tests failed - retrieval error")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ All tests passed! FastAPI server is ready to start.")
    print("   Run: python main.py")
    print("=" * 60)
    sys.exit(0)


if __name__ == "__main__":
    main()
