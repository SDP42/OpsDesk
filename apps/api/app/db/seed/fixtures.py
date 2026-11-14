"""Fictional reference data for the demo world (no real companies or people).

Demo passwords come from the DEMO_PASSWORD setting and exist only in the seed
script and the README.
"""

from __future__ import annotations

REGIONS = ["IN", "AE", "UK", "SEA"]

# code, name, city, country, region, tier
AGENCIES: list[tuple[str, str, str, str, str, int]] = [
    ("SAF", "Saffron Trails", "Mumbai", "India", "IN", 1),
    ("MON", "Monsoon Holidays", "Delhi", "India", "IN", 2),
    ("KON", "Konkan Coast Getaways", "Goa", "India", "IN", 3),
    ("DUN", "Dune & Dhow Travel", "Dubai", "UAE", "AE", 1),
    ("GHT", "Gulf Horizon Tours", "Abu Dhabi", "UAE", "AE", 2),
    ("MCT", "Marina Crest Travel", "Dubai", "UAE", "AE", 3),
    ("TGT", "Thames Gate Travel", "London", "United Kingdom", "UK", 1),
    ("PEN", "Pennine Journeys", "Manchester", "United Kingdom", "UK", 2),
    ("HRS", "Highland Rail & Sail", "Edinburgh", "United Kingdom", "UK", 3),
    ("LCV", "Lion City Voyages", "Singapore", "Singapore", "SEA", 1),
    ("ADB", "Andaman Blue Holidays", "Bangkok", "Thailand", "SEA", 2),
    ("BTK", "Batik Route Travel", "Kuala Lumpur", "Malaysia", "SEA", 3),
]

# name, email, region, kind
SUPPLIERS: list[tuple[str, str, str, str]] = [
    ("Atlas Bedbank", "desk@atlas-bedbank.supplier.demo", "AE", "bedbank"),
    ("Crescent Rooms DMC", "ops@crescent-rooms.supplier.demo", "AE", "dmc"),
    ("Meridian Stay Wholesale", "support@meridian-stay.supplier.demo", "UK", "bedbank"),
    ("Oriel Hotels Group", "reservations@oriel-hotels.supplier.demo", "UK", "hotel"),
    ("Sundara Resorts Supply", "res@sundara.supplier.demo", "SEA", "hotel"),
    ("Northline Hospitality", "help@northline.supplier.demo", "IN", "hotel"),
]

HOTELS: dict[str, list[str]] = {
    "Dubai": ["Marina Pearl Hotel", "Palm Crescent Resort", "Burj Vista Suites", "Creekside Souk Inn"],
    "Abu Dhabi": ["Corniche Sands Hotel", "Saadiyat Shore Resort"],
    "Mumbai": ["Juhu Shores Hotel", "Bandra Heights", "Colaba Causeway Inn"],
    "Goa": ["Konkan Palms Resort", "Calangute Breeze"],
    "Delhi": ["Lutyens Court Hotel", "Aerocity Transit Suites"],
    "London": ["Thames View Hotel", "Kensington Lodge", "Southbank Quarter"],
    "Edinburgh": ["Old Town Inn", "Royal Mile Residence"],
    "Singapore": ["Raffles Quay Suites", "Sentosa Bay Resort", "Orchard Lantern Hotel"],
    "Bangkok": ["Chao Phraya Riverside", "Sukhumvit Garden Hotel"],
    "Phuket": ["Andaman Cliffs Resort", "Patong Lagoon Hotel"],
    "Bali": ["Ubud Rice Terrace Villas", "Seminyak Sunset Hotel"],
}

GUESTS = ["A. Sharma", "R. Iyer", "M. Al Mansoori", "S. Patel", "J. Okafor", "L. Chen", "K. Tan",
          "N. Fernandes", "H. Rahman", "E. Walsh", "P. Kaur", "D. Moreau", "Y. Nakamura",
          "F. Haddad", "T. Wright", "V. Menon", "C. Lim", "Z. Qureshi"]

# name, email-local, region, rank, skills, callsign, slot ("on" covers now, "off", "away", "busy")
AGENTS: list[tuple[str, str, str, int, list[str], str, str]] = [
    ("Priya Nair", "priya.nair", "IN", 3, ["refund", "cancellation", "supplier", "voucher"], "IN-01", "on"),
    ("Arjun Mehta", "arjun.mehta", "IN", 2, ["payment", "rates", "amendment", "voucher"], "IN-02", "on"),
    ("Omar Haddad", "omar.haddad", "AE", 3, ["refund", "supplier", "special_request", "visa"], "AE-01", "on"),
    ("Layla Farouk", "layla.farouk", "AE", 2, ["cancellation", "voucher", "payment"], "AE-02", "busy"),
    ("James Whitlock", "james.whitlock", "UK", 3, ["refund", "rates", "platform"], "UK-01", "on"),
    ("Sophie Clarke", "sophie.clarke", "UK", 1, ["amendment", "voucher", "special_request"], "UK-02", "off"),
    ("Wei Lim", "wei.lim", "SEA", 3, ["supplier", "rates", "refund", "visa"], "SEA-01", "on"),
    ("Ananya Rao", "ananya.rao", "SEA", 2, ["payment", "platform", "cancellation"], "SEA-02", "away"),
]

TOWER_CHIEFS = [("Rahul Kapoor", "rahul.kapoor", "TC-01"), ("Fatima Al Zahra", "fatima.alzahra", "TC-02")]
LEAD = ("Meera Iyer", "meera.iyer", "DIR-01")

REQUESTER_FIRST = ["Aarav", "Diya", "Kabir", "Isha", "Yousef", "Mariam", "Oliver", "Amelia",
                   "Ethan", "Grace", "Jun", "Mei", "Rizal", "Siti", "Anand", "Noor",
                   "Harry", "Fiona", "Kiran", "Hana", "Tariq", "Lina", "Ravi", "Ploy"]

DOMAIN = "opsdesk.demo"

# The four callsign cards on /login, plus extra journey accounts.
DEMO_ACCOUNTS = {
    "requester": f"pilot.saf@{DOMAIN}",
    "agent": f"priya.nair@{DOMAIN}",
    "escalation_manager": f"rahul.kapoor@{DOMAIN}",
    "lead": f"meera.iyer@{DOMAIN}",
}
JOURNEY_ACCOUNTS = {
    "dubai_pilot": f"pilot.dun@{DOMAIN}",
    "uae_controller": f"omar.haddad@{DOMAIN}",
}

THEMES = [
    ("refund_delay", "Refund delay", "Finance > refund SLA dashboard"),
    ("inventory_sync", "Inventory sync", None),
    ("overbooking", "Overbooking", None),
    ("rate_mismatch", "Rate mismatch", None),
    ("voucher_issue", "Voucher issue", None),
    ("special_request", "Special request", None),
    ("payment_failure", "Payment failure", None),
    ("platform_outage", "Platform outage", None),
    ("supplier_silence", "Supplier silence", None),
    ("visa_docs", "Visa and documents", None),
]

QUEUES = [
    ("Triage", None, "triage"),
    ("India Ops", "IN", "region"),
    ("UAE Ops", "AE", "region"),
    ("UK Ops", "UK", "region"),
    ("SEA Ops", "SEA", "region"),
    ("Tower Chief Escalations", None, "escalation"),
]

# Relative intent frequencies for generated tickets.
INTENT_WEIGHTS = {
    "refund.status": 9, "refund.delay": 8, "refund.amount_mismatch": 4,
    "cancellation.request": 7, "cancellation.charges": 4,
    "amendment.dates": 5, "amendment.guest_name": 3, "amendment.room_type": 2,
    "voucher.not_received": 6, "voucher.confirmation_number": 5,
    "payment.failed": 3, "payment.credit_limit": 2, "payment.double_charge": 2,
    "rates.mismatch": 4, "rates.inventory_sync": 3,
    "supplier.confirmation_pending": 6, "supplier.overbooking": 2,
    "special_request.early_checkin": 3, "special_request.accessibility": 1,
    "special_request.meal": 1, "visa.status": 2, "visa.documents": 2,
    "platform.login": 2, "platform.api_error": 2, "platform.search": 1,
}
