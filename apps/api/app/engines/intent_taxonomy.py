"""Intent taxonomy (10 parents, 25 sub-intents) and a deterministic training corpus.

The corpus is generated from phrase templates with slot filling, so the
classifier can be trained at seed time with no external data or paid API.
"""

from __future__ import annotations

import random

from pydantic import BaseModel


class IntentDef(BaseModel):
    code: str
    label: str
    keywords: list[str]


PARENTS: dict[str, str] = {
    "refund": "Refund",
    "cancellation": "Cancellation",
    "amendment": "Amendment",
    "voucher": "Voucher and confirmation",
    "payment": "Payment and credit",
    "rates": "Rates and inventory sync",
    "supplier": "Supplier confirmation",
    "special_request": "Special request",
    "visa": "Visa and documents",
    "platform": "Platform or access issue",
}

SUB_INTENTS: list[IntentDef] = [
    IntentDef(
        code="refund.status",
        label="Refund > Status",
        keywords=["refund status", "where is refund", "refund update"],
    ),
    IntentDef(
        code="refund.delay",
        label="Refund > Delay",
        keywords=["refund delayed", "still no refund", "refund pending"],
    ),
    IntentDef(
        code="refund.amount_mismatch",
        label="Refund > Amount mismatch",
        keywords=["short refund", "wrong refund amount", "partial refund"],
    ),
    IntentDef(
        code="cancellation.request",
        label="Cancellation > Request",
        keywords=["cancel booking", "please cancel"],
    ),
    IntentDef(
        code="cancellation.charges",
        label="Cancellation > Charges",
        keywords=["cancellation charges", "cancellation fee", "penalty"],
    ),
    IntentDef(
        code="amendment.dates",
        label="Amendment > Dates",
        keywords=["change dates", "extend stay", "modify check-in"],
    ),
    IntentDef(
        code="amendment.guest_name",
        label="Amendment > Guest name",
        keywords=["name change", "guest name correction"],
    ),
    IntentDef(
        code="amendment.room_type",
        label="Amendment > Room type",
        keywords=["upgrade room", "change room type"],
    ),
    IntentDef(
        code="voucher.not_received",
        label="Voucher > Not received",
        keywords=["voucher not received", "send voucher"],
    ),
    IntentDef(
        code="voucher.confirmation_number",
        label="Voucher > Confirmation number",
        keywords=["hotel confirmation number", "HCN missing"],
    ),
    IntentDef(
        code="payment.failed",
        label="Payment > Failed",
        keywords=["payment failed", "transaction declined"],
    ),
    IntentDef(
        code="payment.credit_limit",
        label="Payment > Credit limit",
        keywords=["credit limit", "increase limit"],
    ),
    IntentDef(
        code="payment.double_charge",
        label="Payment > Double charge",
        keywords=["charged twice", "duplicate debit"],
    ),
    IntentDef(
        code="rates.mismatch",
        label="Rates > Mismatch",
        keywords=["rate mismatch", "price different", "rate discrepancy"],
    ),
    IntentDef(
        code="rates.inventory_sync",
        label="Rates > Inventory sync",
        keywords=["inventory not updated", "sold out but showing", "allotment"],
    ),
    IntentDef(
        code="supplier.confirmation_pending",
        label="Supplier > Confirmation pending",
        keywords=["not confirmed", "awaiting supplier"],
    ),
    IntentDef(
        code="supplier.overbooking",
        label="Supplier > Overbooking",
        keywords=["overbooked", "walked guest", "no room at arrival"],
    ),
    IntentDef(
        code="special_request.early_checkin",
        label="Special request > Early check-in",
        keywords=["early check-in", "late checkout"],
    ),
    IntentDef(
        code="special_request.accessibility",
        label="Special request > Accessibility",
        keywords=["wheelchair", "accessible room"],
    ),
    IntentDef(
        code="special_request.meal",
        label="Special request > Meal plan",
        keywords=["vegetarian", "meal plan", "halal"],
    ),
    IntentDef(code="visa.status", label="Visa > Status", keywords=["visa status", "visa approval"]),
    IntentDef(
        code="visa.documents",
        label="Visa > Documents",
        keywords=["passport copy", "documents required"],
    ),
    IntentDef(
        code="platform.login",
        label="Platform > Login",
        keywords=["cannot login", "password reset", "account locked"],
    ),
    IntentDef(
        code="platform.api_error",
        label="Platform > API error",
        keywords=["api error", "timeout", "500 error"],
    ),
    IntentDef(
        code="platform.search",
        label="Platform > Search results",
        keywords=["search not showing", "no results"],
    ),
]

_HOTELS = [
    "Marina Pearl",
    "Palm Crescent",
    "Juhu Shores",
    "Raffles Quay Suites",
    "Thames View",
    "Old Town Inn",
    "Burj Vista",
    "Sentosa Bay",
    "Bandra Heights",
    "Kensington Lodge",
]
_CITIES = ["Dubai", "Mumbai", "London", "Singapore", "Goa", "Bali", "Abu Dhabi", "Phuket"]
_SUPPLIERS = ["Atlas Bedbank", "Crescent Rooms", "Meridian Wholesale", "Oriel Hotels", "the hotel", "the supplier"]
_DAYS = ["2", "3", "5", "7", "10", "14", "21"]

_TEMPLATES: dict[str, list[str]] = {
    "refund.status": [
        "What is the status of the refund for {tboh}?",
        "Can you share an update on our refund for the {hotel} booking",
        "Please confirm whether refund has been processed for {tboh}",
        "Need refund status for cancelled booking at {hotel} {city}",
        "Agency asking when the refund will be credited for {tboh}",
        "Has the refund been initiated from {supplier} side?",
    ],
    "refund.delay": [
        "Refund for {tboh} still not received after {days} days",
        "Still no refund for the cancelled {hotel} booking, this is delayed",
        "We have been waiting {days} days for refund, customer is angry",
        "Refund delayed again for {tboh}, please escalate",
        "Third time asking: refund pending since {days} days for {tboh}",
        "Why is the refund taking so long? Cancelled {days} days ago",
    ],
    "refund.amount_mismatch": [
        "Refund amount received is less than expected for {tboh}",
        "We got a partial refund, {amount} short, for {hotel}",
        "Wrong refund amount credited for booking {tboh}",
        "Refund does not match the cancellation policy, short by {amount}",
    ],
    "cancellation.request": [
        "Please cancel booking {tboh} at {hotel}",
        "Guest wants to cancel the {city} stay, kindly cancel {tboh}",
        "Request cancellation of reservation at {hotel} {city}",
        "Cancel the booking, guest trip is called off",
    ],
    "cancellation.charges": [
        "Why are cancellation charges applied on {tboh}? It was within free cancellation",
        "Cancellation fee charged incorrectly for {hotel}",
        "Please waive the cancellation penalty for {tboh}",
        "Cancellation charges look wrong, LCD has not passed",
    ],
    "amendment.dates": [
        "Please change check-in date for {tboh} to next week",
        "Guest wants to extend stay by {days} nights at {hotel}",
        "Modify dates on booking {tboh}, new check-in {days} days later",
        "Amend travel dates for the {city} booking",
    ],
    "amendment.guest_name": [
        "Guest name spelled wrong on {tboh}, please correct",
        "Name change required for lead guest on {hotel} booking",
        "Please update the guest name on voucher {tboh}",
    ],
    "amendment.room_type": [
        "Upgrade room type to deluxe for {tboh}",
        "Change room from twin to double at {hotel}",
        "Guest wants a sea view room instead, please amend {tboh}",
    ],
    "voucher.not_received": [
        "Voucher not received for {tboh}, please send",
        "We did not get the hotel voucher for {hotel} booking",
        "Kindly resend voucher, guest travelling to {city} tomorrow",
        "Voucher missing from the portal for {tboh}",
    ],
    "voucher.confirmation_number": [
        "Hotel confirmation number missing on {tboh}",
        "Need HCN for {hotel}, guest checking in soon",
        "Hotel says no reservation found, please share confirmation number for {tboh}",
    ],
    "payment.failed": [
        "Payment failed while booking {hotel}, amount debited",
        "Transaction declined but money deducted for {tboh}",
        "Card payment failed on the portal, please check",
    ],
    "payment.credit_limit": [
        "Please increase our credit limit, bookings are blocked",
        "Credit limit exhausted, need temporary top up",
        "Agency credit limit not updated after payment of {amount}",
    ],
    "payment.double_charge": [
        "We were charged twice for {tboh}",
        "Duplicate debit of {amount} for the {hotel} booking",
        "Double charge on our account, please reverse one",
    ],
    "rates.mismatch": [
        "Rate shown at booking differs from invoice for {tboh}",
        "Price mismatch between search and checkout for {hotel}",
        "Hotel charging guest a different rate than we booked",
        "Rate discrepancy of {amount} on {tboh}",
    ],
    "rates.inventory_sync": [
        "{hotel} shows available on portal but hotel says sold out",
        "Inventory not updated, rooms showing that are not available",
        "Allotment sync issue for {city} hotels, bookings failing",
        "Stop sell not reflected for {hotel}",
    ],
    "supplier.confirmation_pending": [
        "Booking {tboh} still not confirmed by supplier",
        "Awaiting confirmation from {supplier} for {hotel}, check-in in {days} days",
        "Reservation on request for too long, please chase supplier",
        "Supplier has not confirmed {tboh} yet",
    ],
    "supplier.overbooking": [
        "{hotel} is overbooked, guest walked to another hotel",
        "Guest arrived at {hotel} and there is no room, hotel overbooked",
        "Hotel says overbooking, guest stranded in {city}",
        "Overbooked property refused check-in for {tboh}",
    ],
    "special_request.early_checkin": [
        "Request early check-in for {tboh}, flight lands at 6am",
        "Can you arrange late checkout at {hotel}?",
        "Guest needs early check-in, please request with hotel",
    ],
    "special_request.accessibility": [
        "Guest needs wheelchair accessible room at {hotel}",
        "Please ensure accessible room for elderly guest on {tboh}",
        "Request ground floor room for guest with mobility issues",
    ],
    "special_request.meal": [
        "Guest requires vegetarian meals, please inform {hotel}",
        "Add halal meal plan to {tboh}",
        "Change meal plan to half board for {city} stay",
    ],
    "visa.status": [
        "What is the status of visa application for our guest?",
        "Visa approval pending for {city} trip, travel in {days} days",
        "Please update on visa for {tboh}",
    ],
    "visa.documents": [
        "Which documents are required for the {city} visa?",
        "Uploading passport copy for visa, please confirm received",
        "Visa documents rejected, need list of what is missing",
    ],
    "platform.login": [
        "Cannot login to the portal, account locked",
        "Password reset link not working",
        "Our agent's account is blocked, please unlock",
    ],
    "platform.api_error": [
        "API returning 500 error on booking endpoint",
        "Getting timeout errors from the API since morning",
        "Booking API failing intermittently for {city} searches",
    ],
    "platform.search": [
        "Search not showing any hotels for {city}",
        "No results on portal for {city} dates next month",
        "Hotel search results are empty for {hotel}",
    ],
}

_PREFIXES = ["", "", "", "Hi team, ", "Urgent: ", "Dear support, ", "Hello, ", "Please help. "]
_SUFFIXES = ["", "", "", " Thanks.", " Regards.", " Please treat as urgent.", " Guest is waiting."]


def generate_corpus(per_intent: int = 64, seed: int = 7) -> list[tuple[str, str]]:
    """Return ``(text, intent_code)`` pairs; 25 intents x 64 = 1,600 samples by default."""
    rng = random.Random(seed)
    rows: list[tuple[str, str]] = []
    for code, templates in _TEMPLATES.items():
        for _ in range(per_intent):
            text = rng.choice(templates).format(
                tboh=f"TBOH-{rng.randint(10000, 99999)}",
                hotel=rng.choice(_HOTELS),
                city=rng.choice(_CITIES),
                supplier=rng.choice(_SUPPLIERS),
                days=rng.choice(_DAYS),
                amount=f"{rng.choice(['AED', 'INR', 'USD', 'GBP'])} {rng.randint(40, 900)}",
            )
            rows.append((f"{rng.choice(_PREFIXES)}{text}{rng.choice(_SUFFIXES)}", code))
    rng.shuffle(rows)
    return rows


def parent_of(code: str) -> str:
    return code.split(".")[0]


def label_of(code: str) -> str:
    for item in SUB_INTENTS:
        if item.code == code:
            return item.label
    return PARENTS.get(code, code)


def render_example(
    code: str,
    rng: random.Random,
    tboh: str | None = None,
    hotel: str | None = None,
    city: str | None = None,
) -> str:
    """Render one realistic ticket text for ``code`` (used by the seed script)."""
    template = rng.choice(_TEMPLATES[code])
    return template.format(
        tboh=tboh or "our booking",
        hotel=hotel or rng.choice(_HOTELS),
        city=city or rng.choice(_CITIES),
        supplier=rng.choice(_SUPPLIERS),
        days=rng.choice(_DAYS),
        amount=f"{rng.choice(['AED', 'INR', 'USD', 'GBP'])} {rng.randint(40, 900)}",
    )


INTENT_CODES: list[str] = [i.code for i in SUB_INTENTS]
