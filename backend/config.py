"""Billing configuration. Edit this file to change plans/prices."""
from typing import Dict, List

# Plans are *displayed* on the pricing page. `stripe_price_id` may be None for free.
PLANS: List[Dict] = [
    {
        "id": "free",
        "name": "Starter",
        "price": 0.0,
        "interval": "forever",
        "credits_per_day": 5,
        "max_file_size_mb": 25,
        "features": [
            "5 conversions per day",
            "Files up to 25 MB",
            "Basic image + PDF tools",
            "Conversion history (7 days)",
        ],
        "cta": "Current Plan",
        "highlight": False,
    },
    {
        "id": "pro",
        "name": "Professional",
        "price": 9.99,
        "interval": "month",
        "credits_per_day": 100,
        "max_file_size_mb": 100,
        "features": [
            "100 conversions per day",
            "Files up to 100 MB",
            "Advanced editor (crop, filters, PDF merge)",
            "Priority queue",
            "Conversion history (90 days)",
        ],
        "cta": "Upgrade",
        "highlight": True,
    },
    {
        "id": "business",
        "name": "Business",
        "price": 29.99,
        "interval": "month",
        "credits_per_day": 9999,
        "max_file_size_mb": 500,
        "features": [
            "Unlimited conversions",
            "Files up to 500 MB",
            "Bulk operations",
            "Full conversion history",
            "Email support",
        ],
        "cta": "Go Business",
        "highlight": False,
    },
]

# One-time credit packs (pay-per-conversion model).
CREDIT_PACKS: List[Dict] = [
    {"id": "pack_50", "name": "Starter Pack", "credits": 50, "price": 4.99},
    {"id": "pack_200", "name": "Value Pack", "credits": 200, "price": 14.99},
    {"id": "pack_1000", "name": "Power Pack", "credits": 1000, "price": 49.99},
]


def get_plan(plan_id: str) -> Dict:
    return next((p for p in PLANS if p["id"] == plan_id), PLANS[0])


def get_pack(pack_id: str) -> Dict:
    return next((p for p in CREDIT_PACKS if p["id"] == pack_id), None)
