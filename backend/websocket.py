from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Map of poll_id to set of WebSocket connections
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Map of WebSocket to set of poll_ids it's subscribed to
        self.subscriptions: Dict[WebSocket, Set[int]] = {}
        # Set of all connected WebSockets (for global broadcasts)
        self.all_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.subscriptions[websocket] = set()
        self.all_connections.add(websocket)
        logger.info(f"WebSocket connected: {websocket.client}")
    
    def disconnect(self, websocket: WebSocket):
        # Remove from all poll subscriptions
        if websocket in self.subscriptions:
            poll_ids = self.subscriptions[websocket].copy()
            for poll_id in poll_ids:
                self.unsubscribe(websocket, poll_id)
            del self.subscriptions[websocket]
        
        # Remove from all connections
        self.all_connections.discard(websocket)
        logger.info(f"WebSocket disconnected: {websocket.client}")
    
    def subscribe(self, websocket: WebSocket, poll_id: int):
        if poll_id not in self.active_connections:
            self.active_connections[poll_id] = set()
        self.active_connections[poll_id].add(websocket)
        
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(poll_id)
        logger.info(f"WebSocket subscribed to poll {poll_id}")
    
    def unsubscribe(self, websocket: WebSocket, poll_id: int):
        if poll_id in self.active_connections:
            self.active_connections[poll_id].discard(websocket)
            if not self.active_connections[poll_id]:
                del self.active_connections[poll_id]
        
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(poll_id)
        logger.info(f"WebSocket unsubscribed from poll {poll_id}")
    
    async def broadcast_to_poll(self, poll_id: int, message: dict):
        """Broadcast message to all connections subscribed to a specific poll"""
        if poll_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[poll_id].copy():
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to websocket: {e}")
                    disconnected.add(connection)
            
            # Clean up disconnected websockets
            for connection in disconnected:
                self.disconnect(connection)
    
    async def broadcast_to_all(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.all_connections.copy():
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected websockets
        for connection in disconnected:
            self.disconnect(connection)
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

manager = ConnectionManager()

async def handle_websocket_message(websocket: WebSocket, data: dict):
    """Handle incoming WebSocket messages"""
    message_type = data.get("type")
    
    if message_type == "subscribe":
        poll_id = data.get("poll_id")
        if poll_id:
            manager.subscribe(websocket, poll_id)
            await manager.send_personal_message({
                "type": "subscribed",
                "poll_id": poll_id
            }, websocket)
    
    elif message_type == "unsubscribe":
        poll_id = data.get("poll_id")
        if poll_id:
            manager.unsubscribe(websocket, poll_id)
            await manager.send_personal_message({
                "type": "unsubscribed",
                "poll_id": poll_id
            }, websocket)
    
    elif message_type == "ping":
        await manager.send_personal_message({
            "type": "pong"
        }, websocket)

async def broadcast_vote_update(poll_id: int, vote_data: dict):
    """Broadcast vote update to all subscribers of a poll"""
    await manager.broadcast_to_poll(poll_id, {
        "type": "vote_update",
        "poll_id": poll_id,
        "data": vote_data
    })

async def broadcast_like_update(poll_id: int, like_data: dict):
    """Broadcast like update to all subscribers of a poll"""
    await manager.broadcast_to_poll(poll_id, {
        "type": "like_update",
        "poll_id": poll_id,
        "data": like_data
    })

async def broadcast_poll_created(poll_data: dict):
    """Broadcast new poll creation to all connected clients"""
    logger.info(f"Broadcasting new poll creation: {poll_data.get('id')}")
    await manager.broadcast_to_all({
        "type": "poll_created",
        "data": poll_data
    })

async def broadcast_poll_updated(poll_id: int, poll_data: dict):
    """Broadcast poll update to all connected clients (not just subscribers)"""
    logger.info(f"Broadcasting poll update: {poll_id}, is_active: {poll_data.get('is_active')}")
    await manager.broadcast_to_all({
        "type": "poll_update",
        "poll_id": poll_id,
        "data": poll_data
    })

async def broadcast_poll_deleted(poll_id: int):
    """Broadcast poll deletion to all connected clients"""
    logger.info(f"Broadcasting poll deletion: {poll_id}")
    await manager.broadcast_to_all({
        "type": "poll_deleted",
        "poll_id": poll_id
    })