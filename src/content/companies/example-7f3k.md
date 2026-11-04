---
# Template. Copy this file per application with an unguessable slug,
# e.g. acme-pay-9q2m.md -> /for/acme-pay-9q2m/. draft: true keeps it out of production.
company: Contoso
role: "For the Senior .NET Engineer role on your payments platform team."
date: Nov 2026
draft: true
summary: "You're hiring a senior .NET engineer to build payment services. That's the work I do now: C# services for point-of-sale software, designed around what happens when a step fails."
requirements:
  - { need: "C# and .NET services", cases: ["DR-01", "DR-02"] }
  - { need: "Payment flows that fail safely", cases: ["DR-02"] }
  - { need: "Shipping LLM features", cases: ["DR-03"] }
evidence:
  - { case: "DR-02", relevance: "payments fail halfway through. This is how I handle a step that fails after the customer has paid." }
  - { case: "DR-01", relevance: "your platform sends alerts with very different stakes. This is how I made sure the urgent ones get seen." }
  - { case: "DR-03", relevance: "how I ship an LLM feature to real users, and what I keep out of the model." }
plan:
  - { days: "Days 1–30", title: "Learn", items: ["Ship a small fix to production in the first two weeks.", "Read the incident history for the services I'll own."] }
  - { days: "Days 31–60", title: "Contribute", items: ["Take one feature from design review to release.", "Write a decision record for it that the team can review."] }
  - { days: "Days 61–90", title: "Own", items: ["Join the on-call rotation for my services.", "Propose one improvement, with the trade-offs written down."] }
bonus:
  label: "Day-one idea"
  title: "The first thing I'd look at in your payments flow"
  body: "Replace with one specific, true idea for this company, drawn from the posting and Jacob's own experience. It rewards the reader who finished the tour, so make it worth finding."
questions:
  - "What does a bad day look like for the services this role owns?"
  - "How does the team write down and review design decisions?"
  - "Where do you plan to use LLMs, and where have you decided not to?"
  - "Six months in, what would tell you this hire worked?"
---
