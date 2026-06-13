"""POST /bot — a non-cheating play bot. Given only the hands the bot may see
(its own + dummy once revealed) and the cards played, it samples consistent
layouts of the concealed cards, double-dummy-solves each, and returns the card
with the best average outcome for its side. The concealed hands are never sent,
so the bot cannot cheat."""
from fastapi import APIRouter, HTTPException

from app import bot
from app.log import logger
from app.schemas import BotRequest, BotResponse

router = APIRouter()


@router.post("/bot", response_model=BotResponse)
def bot_play(req: BotRequest):
    try:
        res = bot.suggest_card(req.known_hands, req.played, req.strain,
                               req.declarer, samples=req.samples, seed=req.seed,
                               constraints=req.constraints)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    logger.info("bot %s plays %s (%d samples)", res["to_act"], res["card"], res["samples"])
    return BotResponse(**res)
