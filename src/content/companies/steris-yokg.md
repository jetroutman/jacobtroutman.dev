---
company: STERIS
role: "For the Senior Software Engineer role on your Digital Workflow Solutions team."
date: Nov 2026
draft: false
summary: |
  I'm Jacob: reader, Monday-night bowler, and a guy slowly working toward a planche.

  I keep coming back to Kahneman's Noise. Smart people doing the same job make different calls, especially at the end of a long shift. I'd love to write the software that catches the miss before it ever reaches an operating room.
greeting: "Hey STERIS."
requirements:
  - { need: "C#/.NET Microsoft full stack, desktop to services", cases: ["DR-01", "DR-02"] }
  - { need: "Design patterns; refine the design as requirements change", cases: ["DR-01", "DR-02"] }
  - { need: "Translate product requirements into software design", cases: ["DR-01"] }
  - { need: "Identify bottlenecks and bugs, and devise solutions", cases: ["DR-02"] }
evidence:
  - { case: "DR-01", relevance: "a workflow like SPM raises alerts with very different stakes. This is how I decided which ones stop a user and wait for an answer, and the team made it the standard." }
  - { case: "DR-02", relevance: "this is how I handle a step that fails after the work has moved on, with hardware in the loop and a clean way back." }
plan:
  - { days: "Days 1–30", title: "Learn", items: ["Walk one instrument set through SPM end to end, the way a technician would.", "Ship a small defect fix through your review and verification process.", "Read the design and interface specs for the area I'll own."] }
  - { days: "Days 31–60", title: "Contribute", items: ["Take one feature from requirements to design review to release, with the estimate written up front.", "Write its design and verification documentation to your standards."] }
  - { days: "Days 61–90", title: "Own", items: ["Own defect and change requests for that feature area.", "Pair with a junior engineer on their next feature.", "Propose one improvement, with the trade-offs written down."] }
bonus:
  label: "Day-one question"
  title: "Where a failed print meets a failed load"
  body: "The hard moment in money orders was a print that failed after the customer had paid. The fix was a saga: the failure triggers its own refund, so nothing is quietly edited and every step stays on the record. I'd expect sterile processing to have the same shape, a load that fails after its sets have moved on and has to be pulled back. My first question would be how SPM models that reversal: as edits to the original records, or as its own recall step with its own trail. If it's the first, that's where I'd want to start."
questions:
  - "How much of SPM still runs on the MFC desktop code, and where is it headed next?"
  - "What does verification and documentation look like for one change, given where SPM runs?"
  - "Which hardware does SPM talk to, and where do those integrations tend to break?"
  - "Where has the team started using AI-assisted tools, and where has it decided not to?"
---
