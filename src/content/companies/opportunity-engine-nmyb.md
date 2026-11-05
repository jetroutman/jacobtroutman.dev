---
company: Opportunity Engine
role: "For the Full Stack Engineer role on your client's regulatory-AI team."
date: Nov 2026
draft: false
summary: "Your client needs a full stack engineer who has been through the production grinder: shipping C# and Azure features that hold up for enterprise customers, alongside AI. That's my last eight years: production C# and .NET, point-of-sale flows designed around what fails, and an AI classification system I built and shipped myself."
requirements:
  - { need: "Production judgment: identify what may break and build durable solutions", cases: ["DR-02", "DR-01"] }
  - { need: "End-to-end features across front-end and back-end systems in C#", cases: ["DR-01", "DR-02"] }
  - { need: "Features that hold up under real customer usage", cases: ["DR-02"] }
evidence:
  - { case: "DR-02", relevance: "compliance workflows have steps that can fail halfway. This is how I make sure a failed step undoes itself instead of leaving the customer stuck." }
  - { case: "DR-01", relevance: "your platform has to tell each business what matters. This is how I made sure urgent messages interrupt and the rest don't." }
plan:
  - { days: "Days 1–30", title: "Learn", items: ["Ship a small fix to production in the first two weeks.", "Pair on the Python services and ship one small change there.", "Read the incident history and the most common customer bugs."] }
  - { days: "Days 31–60", title: "Contribute", items: ["Take one feature from design to release across the React front end and C# back end.", "Write a short decision record for it that the team can review."] }
  - { days: "Days 61–90", title: "Own", items: ["Own one workflow end to end, including the AI-powered step and its failure path.", "Propose one reliability improvement, with the trade-offs written down."] }
bonus:
  label: "Day-one idea"
  title: "Not every regulatory change should interrupt someone"
  body: "Your platform decides which new rules matter to each business. In DR-01 I let severity alone decide whether a notification interrupts or just informs, and kept category cosmetic. I'd start regulatory alerts the same way: one question, does this change require the customer to act before a deadline, decides whether it becomes a task with an owner and a date or a line in a digest. Jurisdiction and topic only shape how it looks. That keeps 'what matters' a product decision you can test, not a side effect of styling."
questions:
  - "When the model flags a regulation as relevant and it isn't, or misses one, how does the customer find out, and how does the team?"
  - "How do engineers and data scientists split the work when a model update goes to production?"
  - "Which parts of the stack are C# and which are Python, and where does this role spend most of its time?"
  - "Six months in, what would tell you this hire worked?"
---
