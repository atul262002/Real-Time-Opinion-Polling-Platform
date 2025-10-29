from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import math
from contextlib import asynccontextmanager

from database import get_db, init_db, User
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    PollCreate, PollResponse, PollUpdate, PollListResponse,
    VoteCreate, VoteResponse, PollOptionResponse
)
from auth import (
    verify_password, create_access_token, 
    get_current_user, get_current_user_optional
)
import crud
from websocket import (
    manager, handle_websocket_message,
    broadcast_vote_update, broadcast_like_update,
    broadcast_poll_created, broadcast_poll_updated, broadcast_poll_deleted
)
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    pass

app = FastAPI(title="QuickPoll API", version="1.0.0", lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth endpoints
@app.post("/api/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    existing_user = await crud.get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    existing_email = await crud.get_user_by_email(db, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = await crud.create_user(db, user_data.username, user_data.email, user_data.password)
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_username(db, user_data.username)
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

# Poll endpoints
@app.post("/api/polls", response_model=PollResponse, status_code=status.HTTP_201_CREATED)
async def create_poll(
    poll_data: PollCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    poll = await crud.create_poll(db, poll_data, current_user.id)
    
    # Get vote counts and prepare response
    vote_counts = await crud.get_vote_counts(db, poll.id)
    total_votes = sum(vote_counts.values())
    total_likes = await crud.get_like_count(db, poll.id)
    
    options_response = [
        PollOptionResponse(
            id=opt.id,
            text=opt.text,
            position=opt.position,
            vote_count=vote_counts.get(opt.id, 0)
        )
        for opt in sorted(poll.options, key=lambda x: x.position)
    ]
    
    poll_response = PollResponse(
        id=poll.id,
        title=poll.title,
        description=poll.description,
        creator_id=poll.creator_id,
        creator_username=poll.creator.username,
        created_at=poll.created_at,
        is_active=poll.is_active,
        options=options_response,
        total_votes=total_votes,
        total_likes=total_likes,
        user_voted=False,
        user_liked=False
    )
    
    # Broadcast poll creation
    await broadcast_poll_created(poll_response.model_dump(mode='json'))
    
    return poll_response

@app.get("/api/polls", response_model=PollListResponse)
async def get_polls(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    creator_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    skip = (page - 1) * page_size
    
    # Default to showing only active polls unless filtering by creator
    if is_active is None and creator_id is None:
        is_active = True
    
    polls, total = await crud.get_polls(db, skip, page_size, creator_id, is_active)
    
    poll_responses = []
    for poll in polls:
        vote_counts = await crud.get_vote_counts(db, poll.id)
        total_votes = sum(vote_counts.values())
        total_likes = await crud.get_like_count(db, poll.id)
        
        user_voted = False
        user_vote_option_id = None
        user_liked = False
        
        if current_user:
            user_vote = await crud.get_user_vote(db, poll.id, current_user.id)
            if user_vote:
                user_voted = True
                user_vote_option_id = user_vote.option_id
            user_liked = await crud.is_poll_liked_by_user(db, poll.id, current_user.id)
        
        options_response = [
            PollOptionResponse(
                id=opt.id,
                text=opt.text,
                position=opt.position,
                vote_count=vote_counts.get(opt.id, 0)
            )
            for opt in sorted(poll.options, key=lambda x: x.position)
        ]
        
        poll_responses.append(PollResponse(
            id=poll.id,
            title=poll.title,
            description=poll.description,
            creator_id=poll.creator_id,
            creator_username=poll.creator.username,
            created_at=poll.created_at,
            is_active=poll.is_active,
            options=options_response,
            total_votes=total_votes,
            total_likes=total_likes,
            user_voted=user_voted,
            user_liked=user_liked,
            user_vote_option_id=user_vote_option_id
        ))
    
    total_pages = math.ceil(total / page_size)
    
    return PollListResponse(
        polls=poll_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@app.get("/api/polls/{poll_id}", response_model=PollResponse)
async def get_poll(
    poll_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    poll = await crud.get_poll_by_id(db, poll_id)
    
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )
    
    vote_counts = await crud.get_vote_counts(db, poll.id)
    total_votes = sum(vote_counts.values())
    total_likes = await crud.get_like_count(db, poll.id)
    
    user_voted = False
    user_vote_option_id = None
    user_liked = False
    
    if current_user:
        user_vote = await crud.get_user_vote(db, poll.id, current_user.id)
        if user_vote:
            user_voted = True
            user_vote_option_id = user_vote.option_id
        user_liked = await crud.is_poll_liked_by_user(db, poll.id, current_user.id)
    
    options_response = [
        PollOptionResponse(
            id=opt.id,
            text=opt.text,
            position=opt.position,
            vote_count=vote_counts.get(opt.id, 0)
        )
        for opt in sorted(poll.options, key=lambda x: x.position)
    ]
    
    return PollResponse(
        id=poll.id,
        title=poll.title,
        description=poll.description,
        creator_id=poll.creator_id,
        creator_username=poll.creator.username,
        created_at=poll.created_at,
        is_active=poll.is_active,
        options=options_response,
        total_votes=total_votes,
        total_likes=total_likes,
        user_voted=user_voted,
        user_liked=user_liked,
        user_vote_option_id=user_vote_option_id
    )

@app.put("/api/polls/{poll_id}", response_model=PollResponse)
async def update_poll(
    poll_id: int,
    poll_update: PollUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    poll = await crud.get_poll_by_id(db, poll_id)
    
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )
    
    if poll.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this poll"
        )
    
    updated_poll = await crud.update_poll(db, poll_id, poll_update)
    
    vote_counts = await crud.get_vote_counts(db, updated_poll.id)
    total_votes = sum(vote_counts.values())
    total_likes = await crud.get_like_count(db, updated_poll.id)
    
    user_vote = await crud.get_user_vote(db, updated_poll.id, current_user.id)
    user_voted = user_vote is not None
    user_vote_option_id = user_vote.option_id if user_vote else None
    user_liked = await crud.is_poll_liked_by_user(db, updated_poll.id, current_user.id)
    
    options_response = [
        PollOptionResponse(
            id=opt.id,
            text=opt.text,
            position=opt.position,
            vote_count=vote_counts.get(opt.id, 0)
        )
        for opt in sorted(updated_poll.options, key=lambda x: x.position)
    ]
    
    poll_response = PollResponse(
        id=updated_poll.id,
        title=updated_poll.title,
        description=updated_poll.description,
        creator_id=updated_poll.creator_id,
        creator_username=updated_poll.creator.username,
        created_at=updated_poll.created_at,
        is_active=updated_poll.is_active,
        options=options_response,
        total_votes=total_votes,
        total_likes=total_likes,
        user_voted=user_voted,
        user_liked=user_liked,
        user_vote_option_id=user_vote_option_id
    )
    
    # Broadcast poll update to ALL users
    await broadcast_poll_updated(poll_id, poll_response.model_dump(mode='json'))
    
    return poll_response

@app.delete("/api/polls/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poll(
    poll_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    poll = await crud.get_poll_by_id(db, poll_id)
    
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )
    
    if poll.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this poll"
        )
    
    # Broadcast BEFORE deleting
    await broadcast_poll_deleted(poll_id)
    
    await crud.delete_poll(db, poll_id)

# Vote endpoints
@app.post("/api/polls/{poll_id}/vote", response_model=VoteResponse)
async def vote_on_poll(
    poll_id: int,
    vote_data: VoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vote = await crud.create_vote(db, poll_id, vote_data.option_id, current_user.id)
    
    if not vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid poll or option, or poll is inactive"
        )
    
    # Get updated vote counts
    vote_counts = await crud.get_vote_counts(db, poll_id)
    total_votes = sum(vote_counts.values())
    
    # Get poll options for the response
    poll = await crud.get_poll_by_id(db, poll_id)
    options_data = [
        {
            "id": opt.id,
            "text": opt.text,
            "position": opt.position,
            "vote_count": vote_counts.get(opt.id, 0)
        }
        for opt in sorted(poll.options, key=lambda x: x.position)
    ]
    
    # Broadcast vote update
    await broadcast_vote_update(poll_id, {
        "total_votes": total_votes,
        "options": options_data,
        "user_id": current_user.id,
        "user_vote_option_id": vote_data.option_id
    })
    
    return VoteResponse.model_validate(vote)

# Like endpoints
@app.post("/api/polls/{poll_id}/like")
async def toggle_poll_like(
    poll_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    is_liked, total_likes = await crud.toggle_like(db, poll_id, current_user.id)
    
    if total_likes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )
    
    # Broadcast like update
    await broadcast_like_update(poll_id, {
        "total_likes": total_likes,
        "is_liked": is_liked,
        "user_id": current_user.id
    })
    
    return {
        "is_liked": is_liked,
        "total_likes": total_likes
    }

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await handle_websocket_message(websocket, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/")
async def root():
    return {"message": "QuickPoll API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)