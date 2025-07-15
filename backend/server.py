from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import aiohttp
import json
from fastapi_discord import DiscordOAuthClient, User

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'discord_bot')
DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID')
DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET')
DISCORD_REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
BOT_OWNER_ID = os.environ.get('BOT_OWNER_ID', '510769103024291840')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-here')

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Discord OAuth2 client
discord = DiscordOAuthClient(
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI,
    scopes=("identify", "guilds")
)

# Create the main app
app = FastAPI(title="Discord Bot Dashboard API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Models
class UserInfo(BaseModel):
    id: str
    username: str
    discriminator: str
    avatar: Optional[str] = None
    email: Optional[str] = None

class Guild(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    owner: bool = False
    permissions: str

class ModerationAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    guild_id: str
    user_id: str
    action_type: str  # warn, ban, kick, mute
    reason: str
    moderator_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration: Optional[int] = None  # for mutes, in minutes

class BotSettings(BaseModel):
    guild_id: str
    prefix: str = "!"
    log_channel_id: Optional[str] = None
    auto_role_id: Optional[str] = None
    warning_role_id: Optional[str] = None
    jail_role_id: Optional[str] = None
    anti_spam: bool = True
    anti_swear: bool = True
    anti_link: bool = True
    ai_enabled: bool = True
    ai_channels: List[str] = []

class BotStats(BaseModel):
    guild_count: int
    user_count: int
    total_warnings: int
    total_bans: int
    total_kicks: int
    total_mutes: int
    uptime: str

# Helper functions
def create_jwt_token(user_data: dict) -> str:
    payload = {
        "user_id": user_data["id"],
        "username": user_data["username"],
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = await verify_jwt_token(token)
    user_data = await db.users.find_one({"id": payload["user_id"]})
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")
    return user_data

async def get_discord_user_guilds(access_token: str) -> List[Dict]:
    """Get user's Discord guilds using their access token"""
    headers = {"Authorization": f"Bearer {access_token}"}
    async with aiohttp.ClientSession() as session:
        async with session.get("https://discord.com/api/users/@me/guilds", headers=headers) as response:
            if response.status == 200:
                return await response.json()
            return []

async def get_bot_guilds() -> List[Dict]:
    """Get bot's guilds - would need to communicate with Discord bot"""
    # This would typically communicate with the Discord bot
    # For now, return empty list
    return []

async def is_user_admin_in_guild(guild_id: str, user_id: str) -> bool:
    """Check if user has admin permissions in guild"""
    # This would check Discord API or cached permissions
    # For now, return True for bot owner
    return user_id == BOT_OWNER_ID

# Authentication routes
@api_router.get("/auth/login")
async def discord_login():
    """Redirect to Discord OAuth2 login"""
    return {"url": discord.oauth_login_url}

@api_router.get("/auth/callback")
async def discord_callback(code: str):
    """Handle Discord OAuth2 callback"""
    try:
        token, refresh_token = await discord.get_access_token(code)
        user_data = await discord.user(token)
        
        # Save user data to database
        user_doc = {
            "id": user_data.id,
            "username": user_data.username,
            "discriminator": user_data.discriminator,
            "avatar": user_data.avatar,
            "email": user_data.email,
            "access_token": token,
            "refresh_token": refresh_token,
            "last_login": datetime.utcnow()
        }
        
        await db.users.update_one(
            {"id": user_data.id},
            {"$set": user_doc},
            upsert=True
        )
        
        # Create JWT token
        jwt_token = create_jwt_token(user_doc)
        
        # Redirect to frontend with token
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        return RedirectResponse(url=f"{frontend_url}?token={jwt_token}")
        
    except Exception as e:
        logging.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=400, detail="Authentication failed")

@api_router.get("/auth/me", response_model=UserInfo)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info"""
    return UserInfo(**current_user)

# Guild management routes
@api_router.get("/guilds")
async def get_user_guilds(current_user: dict = Depends(get_current_user)):
    """Get user's guilds where they have admin and bot is present"""
    try:
        user_guilds = await get_discord_user_guilds(current_user["access_token"])
        bot_guilds = await get_bot_guilds()
        
        # Filter guilds where user has admin and bot is present
        admin_guilds = []
        for guild in user_guilds:
            permissions = int(guild["permissions"])
            # Check if user has admin permissions (0x8) or is guild owner
            if (permissions & 0x8) or guild["owner"]:
                # Check if bot is in this guild
                bot_in_guild = any(bg["id"] == guild["id"] for bg in bot_guilds)
                if bot_in_guild or current_user["id"] == BOT_OWNER_ID:
                    admin_guilds.append({
                        "id": guild["id"],
                        "name": guild["name"],
                        "icon": guild["icon"],
                        "owner": guild["owner"],
                        "permissions": guild["permissions"]
                    })
        
        return {"guilds": admin_guilds}
        
    except Exception as e:
        logging.error(f"Error getting guilds: {e}")
        raise HTTPException(status_code=500, detail="Failed to get guilds")

@api_router.get("/guilds/{guild_id}/settings")
async def get_guild_settings(guild_id: str, current_user: dict = Depends(get_current_user)):
    """Get guild bot settings"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = await db.guild_settings.find_one({"guild_id": guild_id})
    if not settings:
        # Return default settings
        default_settings = BotSettings(guild_id=guild_id)
        return default_settings.dict()
    
    return settings

@api_router.post("/guilds/{guild_id}/settings")
async def update_guild_settings(
    guild_id: str,
    settings: BotSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update guild bot settings"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings_dict = settings.dict()
    settings_dict["updated_at"] = datetime.utcnow()
    settings_dict["updated_by"] = current_user["id"]
    
    await db.guild_settings.update_one(
        {"guild_id": guild_id},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {"message": "Settings updated successfully"}

# Moderation routes
@api_router.get("/guilds/{guild_id}/moderation/actions")
async def get_moderation_actions(
    guild_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get moderation actions for a guild"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    actions = await db.moderation_actions.find(
        {"guild_id": guild_id}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
    return {"actions": actions}

@api_router.get("/guilds/{guild_id}/moderation/users/{user_id}/warnings")
async def get_user_warnings(
    guild_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get warnings for a specific user in a guild"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    warnings = await db.moderation_actions.find({
        "guild_id": guild_id,
        "user_id": user_id,
        "action_type": "warn"
    }).sort("timestamp", -1).to_list(100)
    
    return {"warnings": warnings}

@api_router.delete("/guilds/{guild_id}/moderation/actions/{action_id}")
async def delete_moderation_action(
    guild_id: str,
    action_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a moderation action"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.moderation_actions.delete_one({
        "id": action_id,
        "guild_id": guild_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Action not found")
    
    return {"message": "Action deleted successfully"}

# Statistics routes
@api_router.get("/stats")
async def get_bot_stats(current_user: dict = Depends(get_current_user)):
    """Get bot statistics"""
    # Only bot owner can see global stats
    if current_user["id"] != BOT_OWNER_ID:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get stats from database
    total_warnings = await db.moderation_actions.count_documents({"action_type": "warn"})
    total_bans = await db.moderation_actions.count_documents({"action_type": "ban"})
    total_kicks = await db.moderation_actions.count_documents({"action_type": "kick"})
    total_mutes = await db.moderation_actions.count_documents({"action_type": "mute"})
    
    stats = BotStats(
        guild_count=0,  # Would get from Discord bot
        user_count=0,   # Would get from Discord bot
        total_warnings=total_warnings,
        total_bans=total_bans,
        total_kicks=total_kicks,
        total_mutes=total_mutes,
        uptime="0 days"  # Would get from Discord bot
    )
    
    return stats.dict()

@api_router.get("/guilds/{guild_id}/stats")
async def get_guild_stats(
    guild_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get statistics for a specific guild"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get guild-specific stats
    total_warnings = await db.moderation_actions.count_documents({
        "guild_id": guild_id,
        "action_type": "warn"
    })
    total_bans = await db.moderation_actions.count_documents({
        "guild_id": guild_id,
        "action_type": "ban"
    })
    total_kicks = await db.moderation_actions.count_documents({
        "guild_id": guild_id,
        "action_type": "kick"
    })
    total_mutes = await db.moderation_actions.count_documents({
        "guild_id": guild_id,
        "action_type": "mute"
    })
    
    return {
        "guild_id": guild_id,
        "total_warnings": total_warnings,
        "total_bans": total_bans,
        "total_kicks": total_kicks,
        "total_mutes": total_mutes
    }

# AI management routes
@api_router.post("/guilds/{guild_id}/ai/toggle")
async def toggle_ai_for_channel(
    guild_id: str,
    channel_id: str,
    enabled: bool,
    current_user: dict = Depends(get_current_user)
):
    """Toggle AI for a specific channel"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update AI settings
    await db.ai_settings.update_one(
        {"guild_id": guild_id, "channel_id": channel_id},
        {"$set": {"enabled": enabled, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    
    return {"message": f"AI {'enabled' if enabled else 'disabled'} for channel"}

@api_router.get("/guilds/{guild_id}/ai/settings")
async def get_ai_settings(
    guild_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get AI settings for a guild"""
    # Verify user has admin in guild
    if not await is_user_admin_in_guild(guild_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = await db.ai_settings.find({"guild_id": guild_id}).to_list(100)
    
    return {"ai_settings": settings}

# Health check
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Bot communication routes (for Discord bot to sync data)
@api_router.post("/bot/sync/moderation")
async def sync_moderation_action(action: ModerationAction):
    """Sync moderation action from Discord bot"""
    # This would typically have some authentication
    action_dict = action.dict()
    await db.moderation_actions.insert_one(action_dict)
    return {"message": "Action synced"}

@api_router.get("/bot/settings/{guild_id}")
async def get_bot_settings_for_guild(guild_id: str):
    """Get bot settings for Discord bot"""
    settings = await db.guild_settings.find_one({"guild_id": guild_id})
    return settings or {}

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Discord Bot Dashboard API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)