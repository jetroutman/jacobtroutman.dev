---
company: SeatGeek
role: "For the Senior Software Engineer role on your R&D team."
date: Nov 2026
draft: false
phone: "708-705-8858"
summary: |
  I'm Jacob. I read a lot, I bowl in a Monday league, and I main Azucena in Tekken 8.

  One of my favorite books ever is Jerry Weintraub's memoir, When I Stop Talking, You'll Know I'm Dead. He's the guy who took Elvis on tour. Somebody has to get the fans into the building, and I'd like to write that code.
greeting: "Hey SeatGeek."
requirements:
  - { need: "Business-critical software in a fast-paced environment", cases: ["DR-01", "DR-02"] }
  - { need: "Complex technical challenges with custom solutions", cases: ["DR-02"] }
  - { need: "Well-considered opinions about how software should work", cases: ["DR-01"] }
  - { need: "A product mindset: user experience and business impact", cases: ["DR-01", "DR-02"] }
evidence:
  - { case: "DR-02", relevance: "a fan pays for a ticket before it's issued. This is how I handled a step that fails after the customer has already paid." }
  - { case: "DR-01", relevance: "fans, venues and box offices all get messages with very different stakes. This is how I decided which ones get to interrupt someone." }
plan:
  - { days: "Days 1–30", title: "Learn", items: ["Ship a small change to production in my first two weeks. You ship many times a day, so I want to learn that path early.", "Get productive in the parts of your stack that are new to me, starting with whichever language my team owns.", "Read the write-ups from your biggest onsales."] }
  - { days: "Days 31–60", title: "Contribute", items: ["Take one feature from design review to release.", "Write a short decision record for it that the team can review."] }
  - { days: "Days 61–90", title: "Own", items: ["Own a flow end to end, including its dashboards and alerts.", "Propose one improvement, with the trade-offs written down."] }
bonus:
  label: "Onsale idea"
  title: "An onsale has the same shape as a money order"
  body: "A money order takes the customer's money for something that hasn't been printed yet, and the printer can fail. A ticket in a high-traffic onsale works the same way: the seat is held, the card is charged, then the ticket is issued, and any step can fail. What I learned at the register carries over. Make each step recover on its own, so a failure releases the hold or refunds the charge without anyone stepping in. And decide up front what the person waiting sees while that happens. I haven't built ticketing, so on day one I'd want to know where your compensating steps live today, and what a fan sees when one runs."
questions:
  - "What's the hardest part of a big onsale today: the queue, holding inventory, or what happens after payment?"
  - "Which team would this role join, and which languages does it work in day to day?"
  - "Your posting says no token limits on AI tools. What has the team learned about where they help and where they don't?"
  - "Six months in, what would tell you this hire worked?"
---
