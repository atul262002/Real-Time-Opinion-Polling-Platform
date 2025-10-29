from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional, Tuple
from database import User, Poll, PollOption, Vote, Like
from schemas import PollCreate, PollUpdate, VoteCreate
from auth import get_password_hash
import math

# User CRUD
async def create_user(db: AsyncSession, username: str, email: str, password: str) -> User:
    hashed_password = get_password_hash(password)
    user = User(username=username, email=email, hashed_password=hashed_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.username == username))
    return result.scalar_one_or_none()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalar_one_or_none()

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).filter(User.id == user_id))
    return result.scalar_one_or_none()

# Poll CRUD
async def create_poll(db: AsyncSession, poll_data: PollCreate, creator_id: int) -> Poll:
    poll = Poll(
        title=poll_data.title,
        description=poll_data.description,
        creator_id=creator_id
    )
    db.add(poll)
    await db.flush()
    
    for idx, option in enumerate(poll_data.options):
        poll_option = PollOption(
            poll_id=poll.id,
            text=option.text,
            position=idx
        )
        db.add(poll_option)
    
    await db.commit()
    await db.refresh(poll)
    result = await db.execute(
    select(Poll).options(selectinload(Poll.options)).filter(Poll.id == poll.id)
    )
    poll = result.scalar_one()
    return poll

async def get_poll_by_id(db: AsyncSession, poll_id: int) -> Optional[Poll]:
    result = await db.execute(
        select(Poll)
        .options(selectinload(Poll.options), selectinload(Poll.creator))
        .filter(Poll.id == poll_id)
    )
    return result.scalar_one_or_none()

async def get_polls(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 20,
    creator_id: Optional[int] = None,
    is_active: Optional[bool] = None
) -> Tuple[List[Poll], int]:
    query = select(Poll).options(
        selectinload(Poll.options),
        selectinload(Poll.creator)
    )
    
    filters = []
    if creator_id is not None:
        filters.append(Poll.creator_id == creator_id)
    if is_active is not None:
        filters.append(Poll.is_active == is_active)
    
    if filters:
        query = query.filter(and_(*filters))
    
    count_query = select(func.count()).select_from(Poll)
    if filters:
        count_query = count_query.filter(and_(*filters))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.order_by(Poll.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    polls = result.scalars().all()
    
    return list(polls), total

async def update_poll(db: AsyncSession, poll_id: int, poll_update: PollUpdate) -> Optional[Poll]:
    poll = await get_poll_by_id(db, poll_id)
    if not poll:
        return None
    
    if poll_update.title is not None:
        poll.title = poll_update.title
    if poll_update.description is not None:
        poll.description = poll_update.description
    if poll_update.is_active is not None:
        poll.is_active = poll_update.is_active
    
    await db.commit()
    await db.refresh(poll)
    result = await db.execute(
    select(Poll).options(selectinload(Poll.options)).filter(Poll.id == poll.id)
    )
    poll = result.scalar_one()
    return poll

async def delete_poll(db: AsyncSession, poll_id: int) -> bool:
    poll = await get_poll_by_id(db, poll_id)
    if not poll:
        return False
    
    await db.delete(poll)
    await db.commit()
    return True

# Vote CRUD
async def create_vote(db: AsyncSession, poll_id: int, option_id: int, user_id: int) -> Optional[Vote]:
    # Check if poll exists and is active
    poll = await get_poll_by_id(db, poll_id)
    if not poll or not poll.is_active:
        return None
    
    # Check if option belongs to poll
    option_result = await db.execute(
        select(PollOption).filter(
            and_(PollOption.id == option_id, PollOption.poll_id == poll_id)
        )
    )
    option = option_result.scalar_one_or_none()
    if not option:
        return None
    
    # Check if user already voted
    existing_vote = await db.execute(
        select(Vote).filter(
            and_(Vote.poll_id == poll_id, Vote.user_id == user_id)
        )
    )
    existing = existing_vote.scalar_one_or_none()
    
    if existing:
        # Update existing vote
        existing.option_id = option_id
        await db.commit()
        await db.refresh(existing)
        return existing
    
    # Create new vote
    vote = Vote(user_id=user_id, poll_id=poll_id, option_id=option_id)
    db.add(vote)
    await db.commit()
    await db.refresh(vote)
    return vote

async def get_user_vote(db: AsyncSession, poll_id: int, user_id: int) -> Optional[Vote]:
    result = await db.execute(
        select(Vote).filter(
            and_(Vote.poll_id == poll_id, Vote.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()

async def get_vote_counts(db: AsyncSession, poll_id: int) -> dict:
    result = await db.execute(
        select(Vote.option_id, func.count(Vote.id).label('count'))
        .filter(Vote.poll_id == poll_id)
        .group_by(Vote.option_id)
    )
    return {option_id: count for option_id, count in result.all()}

# Like CRUD
async def toggle_like(db: AsyncSession, poll_id: int, user_id: int) -> Tuple[bool, int]:
    """Returns (is_liked, total_likes)"""
    # Check if poll exists
    poll = await get_poll_by_id(db, poll_id)
    if not poll:
        return False, 0
    
    # Check if like exists
    existing_like = await db.execute(
        select(Like).filter(
            and_(Like.poll_id == poll_id, Like.user_id == user_id)
        )
    )
    like = existing_like.scalar_one_or_none()
    
    if like:
        # Unlike
        await db.delete(like)
        await db.commit()
        is_liked = False
    else:
        # Like
        new_like = Like(user_id=user_id, poll_id=poll_id)
        db.add(new_like)
        await db.commit()
        is_liked = True
    
    # Get total likes
    total_result = await db.execute(
        select(func.count(Like.id)).filter(Like.poll_id == poll_id)
    )
    total_likes = total_result.scalar()
    
    return is_liked, total_likes

async def get_like_count(db: AsyncSession, poll_id: int) -> int:
    result = await db.execute(
        select(func.count(Like.id)).filter(Like.poll_id == poll_id)
    )
    return result.scalar()

async def is_poll_liked_by_user(db: AsyncSession, poll_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(Like).filter(
            and_(Like.poll_id == poll_id, Like.user_id == user_id)
        )
    )
    return result.scalar_one_or_none() is not None