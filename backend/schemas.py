from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import List, Optional

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    
    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (with _ or - allowed)')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class PollOptionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)

class PollOptionResponse(BaseModel):
    id: int
    text: str
    position: int
    vote_count: int = 0
    
    class Config:
        from_attributes = True

class PollCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    options: List[PollOptionCreate] = Field(..., min_items=2, max_items=10)
    
    @validator('options')
    def validate_unique_options(cls, v):
        texts = [opt.text.lower().strip() for opt in v]
        if len(texts) != len(set(texts)):
            raise ValueError('Poll options must be unique')
        return v

class PollUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None

class PollResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    creator_id: int
    creator_username: str
    created_at: datetime
    is_active: bool
    options: List[PollOptionResponse]
    total_votes: int = 0
    total_likes: int = 0
    user_voted: bool = False
    user_liked: bool = False
    user_vote_option_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class VoteCreate(BaseModel):
    option_id: int

class VoteResponse(BaseModel):
    id: int
    user_id: int
    poll_id: int
    option_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class LikeResponse(BaseModel):
    id: int
    user_id: int
    poll_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PollListResponse(BaseModel):
    polls: List[PollResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class WebSocketMessage(BaseModel):
    type: str  # 'vote', 'like', 'poll_created', 'poll_updated'
    poll_id: int
    data: dict