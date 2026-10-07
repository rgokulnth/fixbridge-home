# FixBridge Home

Build FixBridge AI - Home Service Marketplace with Escrow.

CONTEXT: Hops.ai has built backend logic with 16 tables. Now build public-facing app. Source of truth is SUPABASE, not Hops.

1. AUTH & ROLES:

- 3 roles: Customer, Expert, Admin.

- Phone OTP login for Customer/Expert (India). Email for Admin.

- Expert must complete KYC: Aadhaar/PAN upload, skills [plumbing, electrical, water-pump etc], service radius KM, base lat/long.

2. DATABASE - Create Supabase tables:

Customers[id, phone, name, lat, long, created_at]

Experts[id, phone, name, skills array, lat, long, radius_km, kyc_status: Not_started/Submitted/Verified/Failed, payout_status, rating]

Problems[id, customer_id, title, description, category=water-pump, lat, long, media_urls array, urgency: Low/Med/High, budget_min, budget_max, status: Open > AI_Analysed > Expert_Matched > Quote_Sent > Payment_Held > Job_Started > Solved > Payment_Done, created_at]

AI_Analyses[problem_id, root_cause, required_skill, difficulty, estimated_cost]

Expert_Matches[problem_id, expert_id, score, status]

Quotes[problem_id, expert_id, amount, description, status]

Jobs[problem_id, expert_id, customer_id, status, started_at, solved_at]

Payments[id, job_id, customer_id, expert_id, amount, commission, status: Pending > Paid_captured > Held_in_escrow > Released_to_expert > Refunded, stripe/razorpay_id]

Conversations[id, job_id], Messages[conversation_id, sender_id, text, created_at] with contact masking - block phone numbers.

Notifications[id, user_id, type, message, status: Queued/Sent]

3. ESCROW PAYMENT FLOW - CRITICAL:

Customer accepts Quote -> Go to Razorpay/Stripe Checkout -> Money goes to HOLD/escrow [Payment status = Held_in_escrow] -> Job status = Job_Started -> Expert marks Solved + Customer confirms -> Admin approves -> Release payout to Expert [Released_to_expert] after 20% commission cut. If dispute, Refunded.

4. CUSTOMER APP SCREENS:

- Home, Post Problem [photo/video upload, auto lat/long, budget], My Problems list, Quote view & Pay, Chat with Expert [masked], Job tracking, Rate expert.

5. EXPERT APP SCREENS:

- Dashboard with nearby Open problems, Request Inbox, Send Quote, My Jobs, Chat [masked], KYC status, Earnings with payout status.

6. ADMIN PANEL:

- Problems pipeline view, Expert verification queue, Disputes, Revenue board.

7. INTEGRATIONS - FAKE pannakoodathu:

- Supabase Auth + RLS rules per role.

- Supabase Storage for media.

- Razorpay for India + Stripe Connect for US (escrow). Create webhook handlers.

- Push notification via OneSignal, Email via Resend, SMS via Twilio - mark as Queued then Sent.

- AI Analysis - call OpenAI API with playbook from Hops.

Design clean like Urban Company. Mobile first.

Generate Supabase SQL + RLS + Storage policies.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ac57d8d-4171-5d81-88a9-4e49185de31f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
