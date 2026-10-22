"""
Seed sample ThinkSpace assignments for local testing.
Creates 3 representative published assignments and 1 draft assignment.
"""
from datetime import datetime, timezone, timedelta
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.assignment import Assignment, Rubric, RubricCriterion, AssignmentStatus

def seed():
    session = SessionLocal()
    try:
        # Find or use first admin / evaluator
        admin = session.query(User).filter(User.username == "thinkadmin").first()
        if not admin:
            admin = session.query(User).first()
        if not admin:
            print("No users found to author sample assignments.")
            return

        now = datetime.now(timezone.utc)

        sample_tasks = [
            {
                "title": "Think & Read: 'Why Nations Fail' — Institutsional Iqtisodiyot Tahlili",
                "slug": "think-read-why-nations-fail-review",
                "direction": "Think & Read",
                "difficulty": "intermediate",
                "description": "Daron Acemoglu va James Robinsonning 'Why Nations Fail' asarining 1-3 boblarini o'qib, inkluziv va ekstraktiv institutlar bo'yicha 3 ta tanqidiy kuzatuv tayyorlang.",
                "instructions": (
                    "Ushbu topshiriq doirasida sizdan quyidagilar talab qilinadi:\n\n"
                    "1. 'Why Nations Fail' kitobining dastlabki 3 bobini diqqat bilan mutolaa qilish.\n"
                    "2. Mualliflarning iqtisodiy institutlar va farovonlik o'rtasidagi bog'liqlik haqidagi asosiy tezisini aniqlash.\n"
                    "3. Zamonaviy Markaziy Osiyo yoki xalqaro iqtisodiy munosabatlar kontekstida 3 ta mustaqil tanqidiy mulohaza (critical observation) shakllantirish.\n"
                    "4. Xulosa va tavsiyalar qismini yozish.\n\n"
                    "Hajmi: 600-800 so'z. Ilmiy uslub va asoslangan argumentlar talab etiladi."
                ),
                "attachment_url": "https://economics.mit.edu/people/faculty/daron-acemoglu",
                "status": "published",
                "publish_at": now - timedelta(days=1),
                "deadline_at": now + timedelta(days=6),
                "max_score": 100,
                "criteria": [
                    {"title": "Nazariy tushunchalarni o'zlashtirish", "max_points": 40},
                    {"title": "Tanqidiy tahlil va dalillar sifati", "max_points": 35},
                    {"title": "Akademik tuzilma va til uslubi", "max_points": 25},
                ]
            },
            {
                "title": "Think & Analyze: Markaziy Osiyo Logistika va Savdo Integratsiyasi Keysi",
                "slug": "think-analyze-central-asia-trade-case",
                "direction": "Think & Analyze",
                "difficulty": "advanced",
                "description": "Markaziy Osiyo mintaqaviy savdo integratsiyasi va transport yo'laklari bo'yicha keysni tahlil qilib, asosiy to'siqlar va ularni bartaraf etish choralarini ishlab chiqing.",
                "instructions": (
                    "Keys tahlili bo'yicha vazifalar:\n\n"
                    "1. Mintaqadagi bojxona, tarif va notarif to'siqlarni baholash.\n"
                    "2. O'zbekistonning transport-tranzit salohiyatini oshirish bo'yicha SWOT tahlil o'tkazish.\n"
                    "3. 3 ta ustuvor siyosiy yoki iqtisodiy tavsiya taklif etish.\n\n"
                    "Hajmi: 700-1000 so'z. Tahliliy jadvallar va statistik raqamlar keltirilishi rag'batlantiriladi."
                ),
                "status": "published",
                "publish_at": now - timedelta(hours=12),
                "deadline_at": now + timedelta(days=9),
                "max_score": 100,
                "criteria": [
                    {"title": "Muammoni aniqlash va metodologik tahlil", "max_points": 40},
                    {"title": "Amaliy yechimlar va tavsiyalar asosliligi", "max_points": 40},
                    {"title": "Taqdimot va strukturaviy mantiq", "max_points": 20},
                ]
            },
            {
                "title": "Think & Discuss: Ko'p tomonlama vs Ikki tomonlama Savdo Bitimlari Debati",
                "slug": "think-discuss-trade-agreements-debate",
                "direction": "Think & Discuss",
                "difficulty": "intermediate",
                "description": "WTO doirasidagi ko'p tomonlama muzokaralar hamda mintaqaviy erkin savdo zonalari (FTA) samaradorligi bo'yicha bo'lajak jonli debat uchun dalillar to'plami tayyorlang.",
                "instructions": (
                    "Debatga tayyorgarlik bo'yicha ko'rsatma:\n\n"
                    "1. 'Ko'p tomonlama erkin savdo kelishuvi' pozitsiyasi bo'yicha 2 ta kuchli argument keltiring.\n"
                    "2. 'Ikki tomonlama maxsus savdo shartnomalari' pozitsiyasining 2 ta asosiy ustunligini ko'rsating.\n"
                    "3. Qarama-qarshi tomon berishi mumkin bo'lgan e'tirozlarga raddiya (rebuttal) loyihasini tuzing.\n\n"
                    "Format: Tezislar ko'rinishida 400-600 so'z."
                ),
                "status": "published",
                "publish_at": now - timedelta(hours=6),
                "deadline_at": now + timedelta(days=4),
                "max_score": 100,
                "criteria": [
                    {"title": "Ritorik kuch va dalillar salmog'i", "max_points": 50},
                    {"title": "Raddiyalar va diplomatik yondashuv", "max_points": 50},
                ]
            },
            {
                "title": "Think & Lead: Global Iqlim Moliyasi va Yashil Iqtisodiyot (Qoralama)",
                "slug": "think-lead-green-economy-draft",
                "direction": "Think & Lead",
                "difficulty": "advanced",
                "description": "Yashil energetika transformatsiyasi loyihasi bo'yicha ichki qoralama topshiriq (Adminlar ko'rishi uchun).",
                "instructions": "Ushbu topshiriq qoralama holatida. Talabalar uchun hali e'lon qilinmagan.",
                "status": "draft",
                "deadline_at": now + timedelta(days=14),
                "max_score": 100,
                "criteria": [
                    {"title": "Liderlik va strategik qarash", "max_points": 100}
                ]
            }
        ]

        for item in sample_tasks:
            existing = session.query(Assignment).filter(Assignment.slug == item["slug"]).first()
            if existing:
                continue
            
            criteria_data = item.pop("criteria")
            assign = Assignment(
                **item,
                reference_links=[],
                allowed_formats=["text", "pdf", "link"],
                min_evaluators=1,
                requires_moderation=False,
                discrepancy_threshold=15.0,
                created_by_id=admin.id
            )
            session.add(assign)
            session.flush()

            rubric = Rubric(assignment_id=assign.id, version=1, is_active=True)
            session.add(rubric)
            session.flush()

            for idx, c in enumerate(criteria_data):
                crit = RubricCriterion(
                    rubric_id=rubric.id,
                    title=c["title"],
                    max_points=c["max_points"],
                    weight=1.0,
                    order_index=idx
                )
                session.add(crit)

        session.commit()
        print("Sample ThinkSpace assignments seeded successfully.")
    except Exception as e:
        session.rollback()
        print("Error seeding assignments:", e)
    finally:
        session.close()

if __name__ == "__main__":
    seed()
