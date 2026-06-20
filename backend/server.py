from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from bson import ObjectId

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    get_current_user,
)
import conversions as conv
from config import PLANS, CREDIT_PACKS, get_plan, get_pack

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)

# --------------- setup ---------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
app.state.db = db

api = APIRouter(prefix="/api")
log = logging.getLogger("filemorph")
logging.basicConfig(level=logging.INFO)


# --------------- pydantic schemas ---------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ConvertRequest(BaseModel):
    file_id: str
    target_format: str


class EditImageRequest(BaseModel):
    file_id: str
    rotate: int = 0
    flip_h: bool = False
    flip_v: bool = False
    crop: Optional[List[int]] = None  # [left, top, right, bottom]
    grayscale: bool = False
    invert: bool = False
    brightness: float = 1.0
    contrast: float = 1.0
    saturation: float = 1.0
    blur: float = 0.0
    sharpen: bool = False
    out_format: str = "png"


class MergePdfRequest(BaseModel):
    file_ids: List[str]


class SplitPdfRequest(BaseModel):
    file_id: str
    ranges: List[List[int]]  # [[1,3],[4,6]]


class CheckoutIn(BaseModel):
    item_id: str  # plan id or pack id
    item_type: str  # "plan" or "pack"
    origin_url: str


# --------------- helpers ---------------
def _user_credits_default():
    return {"used_today": 0, "last_reset": datetime.now(timezone.utc).isoformat(), "credit_balance": 0}


async def _consume_credit(user_id: str, plan_id: str) -> bool:
    plan = get_plan(plan_id)
    daily_limit = plan["credits_per_day"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    usage = user.get("usage", _user_credits_default())
    last_reset = datetime.fromisoformat(usage["last_reset"])
    if last_reset.date() != datetime.now(timezone.utc).date():
        usage = {"used_today": 0, "last_reset": datetime.now(timezone.utc).isoformat(),
                 "credit_balance": usage.get("credit_balance", 0)}
    if usage["used_today"] < daily_limit:
        usage["used_today"] += 1
    elif usage.get("credit_balance", 0) > 0:
        usage["credit_balance"] -= 1
    else:
        return False
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"usage": usage}})
    return True


def _stream_bytes(data: bytes, filename: str, media_type: str = "application/octet-stream"):
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(io.BytesIO(data), media_type=media_type, headers=headers)


# --------------- public ---------------
@api.get("/")
async def root():
    return {"name": "FileMorph", "status": "ok"}


@api.get("/formats")
async def supported_formats():
    return {
        "image": conv.IMAGE_FORMATS,
        "document": conv.DOC_FORMATS,
        "sheet": conv.SHEET_FORMATS,
        "matrix": conv.CONVERSION_MATRIX,
    }


# --------------- auth ---------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "name": body.name or email.split("@")[0],
        "password_hash": hash_password(body.password),
        "plan_id": "free",
        "role": "user",
        "usage": _user_credits_default(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": doc["name"], "plan_id": "free", "usage": doc["usage"]}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {
        "id": uid, "email": email, "name": user.get("name", ""),
        "plan_id": user.get("plan_id", "free"), "usage": user.get("usage", _user_credits_default()),
        "role": user.get("role", "user"),
    }


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# --------------- file upload ---------------
@api.post("/files/upload")
async def upload(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    plan = get_plan(user.get("plan_id", "free"))
    max_size = plan["max_file_size_mb"] * 1024 * 1024
    if len(data) > max_size:
        raise HTTPException(status_code=413, detail=f"File exceeds {plan['max_file_size_mb']}MB plan limit")
    ext = conv.normalize_ext(file.filename)
    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "file_id": file_id,
        "user_id": user["id"],
        "filename": file.filename,
        "ext": ext,
        "size": len(data),
        "data_b64": base64.b64encode(data).decode("ascii"),
        "kind": "upload",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    })
    return {
        "file_id": file_id,
        "filename": file.filename,
        "ext": ext,
        "size": len(data),
        "available_targets": conv.get_targets_for(ext),
        "is_image": ext in conv.IMAGE_FORMATS,
        "is_pdf": ext == "pdf",
    }


async def _get_file(file_id: str, user_id: str) -> dict:
    doc = await db.files.find_one({"file_id": file_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    return doc


@api.get("/files/download/{file_id}")
async def download_file(file_id: str, user=Depends(get_current_user)):
    doc = await _get_file(file_id, user["id"])
    data = base64.b64decode(doc["data_b64"])
    return _stream_bytes(data, doc["filename"])


# --------------- conversion ---------------
@api.post("/convert")
async def do_convert(body: ConvertRequest, user=Depends(get_current_user)):
    doc = await _get_file(body.file_id, user["id"])
    if not await _consume_credit(user["id"], user.get("plan_id", "free")):
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade or buy a credit pack.")
    data = base64.b64decode(doc["data_b64"])
    source_ext = doc["ext"]
    target = body.target_format.lower().lstrip(".")

    try:
        if target == "xlsx" and source_ext not in conv.SHEET_FORMATS:
            out = conv.any_to_xlsx(data, source_ext)
        else:
            out = conv.run_conversion(data, source_ext, target)
    except Exception as e:
        log.exception("Conversion failed")
        raise HTTPException(status_code=400, detail=f"Conversion failed: {e}")

    new_id = str(uuid.uuid4())
    base = doc["filename"].rsplit(".", 1)[0]
    new_name = f"{base}.{target}"
    await db.files.insert_one({
        "file_id": new_id,
        "user_id": user["id"],
        "filename": new_name,
        "ext": target,
        "size": len(out),
        "data_b64": base64.b64encode(out).decode("ascii"),
        "kind": "converted",
        "source_file_id": body.file_id,
        "source_filename": doc["filename"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    })
    return {"file_id": new_id, "filename": new_name, "size": len(out)}


# --------------- editor ---------------
@api.post("/edit/image")
async def edit_image_endpoint(body: EditImageRequest, user=Depends(get_current_user)):
    doc = await _get_file(body.file_id, user["id"])
    if doc["ext"] not in conv.IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail="Not an image file")
    if not await _consume_credit(user["id"], user.get("plan_id", "free")):
        raise HTTPException(status_code=402, detail="Daily limit reached")
    data = base64.b64decode(doc["data_b64"])
    crop = tuple(body.crop) if body.crop and len(body.crop) == 4 else None
    out = conv.edit_image(
        data,
        rotate=body.rotate, flip_h=body.flip_h, flip_v=body.flip_v,
        crop=crop, grayscale=body.grayscale, invert=body.invert,
        brightness=body.brightness, contrast=body.contrast, saturation=body.saturation,
        blur=body.blur, sharpen=body.sharpen, out_format=body.out_format,
    )
    new_id = str(uuid.uuid4())
    base = doc["filename"].rsplit(".", 1)[0]
    new_name = f"{base}-edited.{body.out_format}"
    await db.files.insert_one({
        "file_id": new_id,
        "user_id": user["id"],
        "filename": new_name,
        "ext": body.out_format,
        "size": len(out),
        "data_b64": base64.b64encode(out).decode("ascii"),
        "kind": "edited",
        "source_file_id": body.file_id,
        "source_filename": doc["filename"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    })
    return {"file_id": new_id, "filename": new_name, "size": len(out)}


@api.post("/edit/pdf/merge")
async def merge_pdfs(body: MergePdfRequest, user=Depends(get_current_user)):
    parts = []
    first_name = "merged"
    for fid in body.file_ids:
        doc = await _get_file(fid, user["id"])
        if doc["ext"] != "pdf":
            raise HTTPException(status_code=400, detail=f"File {doc['filename']} is not a PDF")
        parts.append(base64.b64decode(doc["data_b64"]))
    if not await _consume_credit(user["id"], user.get("plan_id", "free")):
        raise HTTPException(status_code=402, detail="Daily limit reached")
    out = conv.merge_pdfs(parts)
    new_id = str(uuid.uuid4())
    new_name = f"{first_name}.pdf"
    await db.files.insert_one({
        "file_id": new_id, "user_id": user["id"], "filename": new_name, "ext": "pdf",
        "size": len(out), "data_b64": base64.b64encode(out).decode("ascii"),
        "kind": "edited", "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    })
    return {"file_id": new_id, "filename": new_name, "size": len(out)}


@api.post("/edit/pdf/split")
async def split_pdfs(body: SplitPdfRequest, user=Depends(get_current_user)):
    doc = await _get_file(body.file_id, user["id"])
    if doc["ext"] != "pdf":
        raise HTTPException(status_code=400, detail="Not a PDF")
    if not await _consume_credit(user["id"], user.get("plan_id", "free")):
        raise HTTPException(status_code=402, detail="Daily limit reached")
    data = base64.b64decode(doc["data_b64"])
    parts = conv.split_pdf(data, [(r[0], r[1]) for r in body.ranges])
    out_ids = []
    base = doc["filename"].rsplit(".", 1)[0]
    for idx, p in enumerate(parts):
        new_id = str(uuid.uuid4())
        new_name = f"{base}-part{idx+1}.pdf"
        await db.files.insert_one({
            "file_id": new_id, "user_id": user["id"], "filename": new_name, "ext": "pdf",
            "size": len(p), "data_b64": base64.b64encode(p).decode("ascii"),
            "kind": "edited", "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        })
        out_ids.append({"file_id": new_id, "filename": new_name, "size": len(p)})
    return {"files": out_ids}


@api.get("/files/preview/{file_id}")
async def preview(file_id: str, user=Depends(get_current_user)):
    doc = await _get_file(file_id, user["id"])
    if doc["ext"] not in conv.IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail="Preview only available for images")
    data = base64.b64decode(doc["data_b64"])
    media_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
                 "gif": "image/gif", "bmp": "image/bmp", "tiff": "image/tiff", "ico": "image/x-icon"}
    return StreamingResponse(io.BytesIO(data), media_type=media_map.get(doc["ext"], "application/octet-stream"))


@api.get("/files/history")
async def history(user=Depends(get_current_user)):
    cursor = db.files.find(
        {"user_id": user["id"], "kind": {"$in": ["converted", "edited"]}},
        {"data_b64": 0},
    ).sort("created_at", -1).limit(50)
    items = []
    async for d in cursor:
        d["_id"] = str(d["_id"])
        items.append(d)
    return {"items": items}


# --------------- billing ---------------
@api.get("/billing/config")
async def billing_config():
    return {"plans": PLANS, "credit_packs": CREDIT_PACKS}


@api.post("/billing/checkout")
async def create_checkout(body: CheckoutIn, request: Request, user=Depends(get_current_user)):
    if body.item_type == "plan":
        plan = get_plan(body.item_id)
        if not plan or plan["price"] <= 0:
            raise HTTPException(status_code=400, detail="Invalid plan")
        amount = float(plan["price"])
        name = plan["name"]
        metadata = {"user_id": user["id"], "item_type": "plan", "item_id": body.item_id}
    elif body.item_type == "pack":
        pack = get_pack(body.item_id)
        if not pack:
            raise HTTPException(status_code=400, detail="Invalid pack")
        amount = float(pack["price"])
        name = pack["name"]
        metadata = {"user_id": user["id"], "item_type": "pack", "item_id": body.item_id, "credits": str(pack["credits"])}
    else:
        raise HTTPException(status_code=400, detail="Invalid item_type")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    api_key = os.environ["STRIPE_API_KEY"]
    sc = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/payment/return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    req = CheckoutSessionRequest(
        amount=amount, currency="usd", success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session = await sc.create_checkout_session(req)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["id"],
        "amount": amount,
        "currency": "usd",
        "metadata": metadata,
        "payment_status": "initiated",
        "item_type": body.item_type,
        "item_id": body.item_id,
        "item_name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.get("/billing/status/{session_id}")
async def billing_status(session_id: str, request: Request, user=Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["payment_status"] == "paid":
        return {"payment_status": "paid", "status": "complete", "item_name": tx.get("item_name")}

    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{host_url}/api/webhook/stripe")
    status = await sc.get_checkout_status(session_id)

    if status.payment_status == "paid" and tx["payment_status"] != "paid":
        # idempotent fulfillment
        await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "paid", "status": status.status}},
        )
        meta = tx["metadata"]
        if meta.get("item_type") == "plan":
            await db.users.update_one(
                {"_id": ObjectId(tx["user_id"])},
                {"$set": {"plan_id": meta["item_id"]}},
            )
        elif meta.get("item_type") == "pack":
            credits = int(meta.get("credits", 0))
            await db.users.update_one(
                {"_id": ObjectId(tx["user_id"])},
                {"$inc": {"usage.credit_balance": credits}},
            )
    else:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status}},
        )

    return {"payment_status": status.payment_status, "status": status.status,
            "item_name": tx.get("item_name")}


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{host_url}/api/webhook/stripe")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        log.warning("Webhook err: %s", e)
        return {"ok": False}
    if evt.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": evt.session_id})
        if tx and tx["payment_status"] != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"payment_status": "paid"}},
            )
            meta = tx["metadata"]
            if meta.get("item_type") == "plan":
                await db.users.update_one({"_id": ObjectId(tx["user_id"])}, {"$set": {"plan_id": meta["item_id"]}})
            elif meta.get("item_type") == "pack":
                credits = int(meta.get("credits", 0))
                await db.users.update_one(
                    {"_id": ObjectId(tx["user_id"])},
                    {"$inc": {"usage.credit_balance": credits}},
                )
    return {"ok": True}


# --------------- include + middleware ---------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.files.create_index("file_id", unique=True)
    await db.files.create_index("user_id")
    await db.payment_transactions.create_index("session_id", unique=True)

    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email, "name": "Admin", "role": "admin",
            "password_hash": hash_password(admin_password), "plan_id": "business",
            "usage": _user_credits_default(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
