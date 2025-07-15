#!/usr/bin/env python3
"""
Discord Bot Dashboard Backend API Test Suite
Tests all API endpoints for the Discord moderation bot web dashboard
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class DiscordBotAPITester:
    def __init__(self, base_url="https://aa77600d-79a4-425a-9b8f-2c57fad7e39b.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_guild_id = "123456789012345678"  # Mock guild ID for testing
        self.test_user_id = "510769103024291840"   # Bot owner ID
        
    def log_test(self, name: str, status: str, details: str = ""):
        """Log test results"""
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_icon} {name}: {status}")
        if details:
            print(f"   Details: {details}")
        print()

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Default headers
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log_test(name, "PASS", f"Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.log_test(name, "FAIL", f"Expected {expected_status}, got {response.status_code}")
                try:
                    error_details = response.json()
                    print(f"   Error Response: {error_details}")
                except:
                    print(f"   Error Response: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            self.log_test(name, "FAIL", "Request timeout")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_test(name, "FAIL", "Connection error")
            return False, {}
        except Exception as e:
            self.log_test(name, "FAIL", f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/health",
            200
        )
        return success

    def test_root_endpoint(self):
        """Test root endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "/",
            200
        )
        return success

    def test_auth_login_endpoint(self):
        """Test Discord OAuth login endpoint"""
        success, response = self.run_test(
            "Discord OAuth Login",
            "GET",
            "/auth/login",
            200
        )
        
        if success and isinstance(response, dict) and 'url' in response:
            print(f"   OAuth URL received: {response['url'][:50]}...")
            return True
        return success

    def test_auth_me_without_token(self):
        """Test /auth/me endpoint without token (should fail)"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Auth Me (No Token)",
            "GET",
            "/auth/me",
            403  # Should fail without token
        )
        
        # Restore token
        self.token = temp_token
        return not success  # We expect this to fail, so invert the result

    def test_guilds_without_auth(self):
        """Test guilds endpoint without authentication"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Guilds (No Auth)",
            "GET",
            "/guilds",
            403  # Should fail without auth
        )
        
        # Restore token
        self.token = temp_token
        return not success  # We expect this to fail

    def test_guild_settings_get(self):
        """Test getting guild settings"""
        success, response = self.run_test(
            "Get Guild Settings",
            "GET",
            f"/guilds/{self.test_guild_id}/settings",
            200
        )
        
        if success and isinstance(response, dict):
            expected_fields = ['guild_id', 'prefix', 'anti_spam', 'anti_swear', 'ai_enabled']
            for field in expected_fields:
                if field in response:
                    print(f"   ✓ Found expected field: {field}")
                else:
                    print(f"   ⚠️ Missing field: {field}")
        
        return success

    def test_guild_settings_post(self):
        """Test updating guild settings"""
        settings_data = {
            "guild_id": self.test_guild_id,
            "prefix": "!",
            "log_channel_id": "987654321098765432",
            "auto_role_id": "876543210987654321",
            "warning_role_id": "765432109876543210",
            "jail_role_id": "654321098765432109",
            "anti_spam": True,
            "anti_swear": True,
            "anti_link": True,
            "ai_enabled": True,
            "ai_channels": ["123456789012345678"]
        }
        
        success, response = self.run_test(
            "Update Guild Settings",
            "POST",
            f"/guilds/{self.test_guild_id}/settings",
            200,
            data=settings_data
        )
        return success

    def test_moderation_actions_get(self):
        """Test getting moderation actions"""
        success, response = self.run_test(
            "Get Moderation Actions",
            "GET",
            f"/guilds/{self.test_guild_id}/moderation/actions",
            200
        )
        
        if success and isinstance(response, dict) and 'actions' in response:
            print(f"   Found {len(response['actions'])} moderation actions")
        
        return success

    def test_user_warnings_get(self):
        """Test getting user warnings"""
        success, response = self.run_test(
            "Get User Warnings",
            "GET",
            f"/guilds/{self.test_guild_id}/moderation/users/{self.test_user_id}/warnings",
            200
        )
        
        if success and isinstance(response, dict) and 'warnings' in response:
            print(f"   Found {len(response['warnings'])} warnings for user")
        
        return success

    def test_bot_stats(self):
        """Test bot statistics endpoint (owner only)"""
        success, response = self.run_test(
            "Bot Statistics",
            "GET",
            "/stats",
            200
        )
        
        if success and isinstance(response, dict):
            expected_fields = ['total_warnings', 'total_bans', 'total_kicks', 'total_mutes']
            for field in expected_fields:
                if field in response:
                    print(f"   ✓ Stat field {field}: {response[field]}")
        
        return success

    def test_guild_stats(self):
        """Test guild-specific statistics"""
        success, response = self.run_test(
            "Guild Statistics",
            "GET",
            f"/guilds/{self.test_guild_id}/stats",
            200
        )
        
        if success and isinstance(response, dict):
            expected_fields = ['guild_id', 'total_warnings', 'total_bans', 'total_kicks', 'total_mutes']
            for field in expected_fields:
                if field in response:
                    print(f"   ✓ Guild stat {field}: {response[field]}")
        
        return success

    def test_ai_settings_get(self):
        """Test getting AI settings"""
        success, response = self.run_test(
            "Get AI Settings",
            "GET",
            f"/guilds/{self.test_guild_id}/ai/settings",
            200
        )
        
        if success and isinstance(response, dict) and 'ai_settings' in response:
            print(f"   Found {len(response['ai_settings'])} AI settings")
        
        return success

    def test_ai_toggle(self):
        """Test toggling AI for a channel"""
        success, response = self.run_test(
            "Toggle AI for Channel",
            "POST",
            f"/guilds/{self.test_guild_id}/ai/toggle?channel_id=123456789012345678&enabled=true",
            200
        )
        return success

    def test_bot_sync_moderation(self):
        """Test bot moderation sync endpoint"""
        moderation_data = {
            "id": "test-action-123",
            "guild_id": self.test_guild_id,
            "user_id": "987654321098765432",
            "action_type": "warn",
            "reason": "Test warning from API test",
            "moderator_id": self.test_user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "duration": None
        }
        
        success, response = self.run_test(
            "Bot Sync Moderation",
            "POST",
            "/bot/sync/moderation",
            200,
            data=moderation_data
        )
        return success

    def test_bot_settings_for_guild(self):
        """Test getting bot settings for Discord bot"""
        success, response = self.run_test(
            "Bot Settings for Guild",
            "GET",
            f"/bot/settings/{self.test_guild_id}",
            200
        )
        return success

    def simulate_auth_token(self):
        """Simulate having an auth token for testing protected endpoints"""
        # For testing purposes, we'll create a mock JWT token
        # In real scenario, this would come from Discord OAuth flow
        import jwt
        from datetime import datetime, timedelta
        
        payload = {
            "user_id": self.test_user_id,
            "username": "TestUser",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        # Use the same secret as in the backend
        secret = "your-jwt-secret-key-here"
        self.token = jwt.encode(payload, secret, algorithm="HS256")
        print(f"🔑 Generated mock JWT token for testing protected endpoints")
        print()

    def run_all_tests(self):
        """Run all API tests"""
        print("=" * 60)
        print("🚀 DISCORD BOT DASHBOARD API TEST SUITE")
        print("=" * 60)
        print()
        
        # Test public endpoints first
        print("📋 TESTING PUBLIC ENDPOINTS")
        print("-" * 30)
        self.test_health_check()
        self.test_root_endpoint()
        self.test_auth_login_endpoint()
        self.test_auth_me_without_token()
        self.test_guilds_without_auth()
        
        # Simulate authentication for protected endpoints
        print("🔐 SIMULATING AUTHENTICATION")
        print("-" * 30)
        self.simulate_auth_token()
        
        # Test protected endpoints
        print("🛡️ TESTING PROTECTED ENDPOINTS")
        print("-" * 30)
        self.test_guild_settings_get()
        self.test_guild_settings_post()
        self.test_moderation_actions_get()
        self.test_user_warnings_get()
        self.test_bot_stats()
        self.test_guild_stats()
        self.test_ai_settings_get()
        self.test_ai_toggle()
        
        # Test bot communication endpoints
        print("🤖 TESTING BOT COMMUNICATION ENDPOINTS")
        print("-" * 30)
        self.test_bot_sync_moderation()
        self.test_bot_settings_for_guild()
        
        # Print final results
        print("=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
            return 0
        else:
            print(f"\n⚠️ {self.tests_run - self.tests_passed} tests failed. Check the details above.")
            return 1

def main():
    """Main test runner"""
    tester = DiscordBotAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())