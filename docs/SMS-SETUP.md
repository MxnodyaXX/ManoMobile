# SMS setup — Text.lk gateway

The system sends customer SMS through [Text.lk](https://text.lk) using the
Sender ID **Mano Mobile**.

## 1. Get your API token

1. Sign in at <https://app.text.lk>.
2. Open **Developers → API Tokens** and create a token (or copy the existing one).
3. Confirm the Sender ID **Mano Mobile** is approved and active on the account.
   Text.lk allows a maximum of 11 characters — "Mano Mobile" is exactly 11.

## 2. Configure the app

Add both values to `frontend/.env.local` (never to `.env.local.example`, which is
committed):

```
TEXTLK_API_TOKEN=your-token-here
TEXTLK_SENDER_ID=Mano Mobile
```

**Neither has a `NEXT_PUBLIC_` prefix, and that is deliberate.** The token can
spend money. Any variable with that prefix is inlined into the JavaScript sent to
every visitor, so a `NEXT_PUBLIC_TEXTLK_API_TOKEN` would let anyone who opens
DevTools drain your SMS balance.

Restart the dev server afterwards — environment values are read at startup.

## 3. Run the migration

`supabase/migrations/20260816000004_sms_log.sql` creates `sms_messages`, the log
of everything sent. Push it, or paste it into the Dashboard SQL editor.

## How it works

```
Browser  ──POST /api/sms/send──►  Route handler (server)  ──►  app.text.lk
   │                                    │
   │                                    └─► sms_messages (log)
   └─ never sees the token
```

- **`src/lib/sms/textlk.ts`** — server-only gateway call. It imports
  `server-only`, so importing it from a client component fails the build rather
  than leaking the token.
- **`src/app/api/sms/send/route.ts`** — requires a signed-in staff session,
  validates the number and message, sends, then logs the outcome.
- **`src/lib/sms/client.ts`** — `sendSms({ to, message, jobId, purpose })` for
  use in components.

### Phone numbers

Text.lk expects `94XXXXXXXXX`. Numbers typed at the counter arrive in several
shapes, so they are normalised before sending:

| Typed | Sent as |
|---|---|
| `0771234567` | `94771234567` |
| `+94 77 123 4567` | `94771234567` |
| `771234567` | `94771234567` |

Anything else is **rejected rather than guessed** — sending to a mangled number
costs money and tells a stranger about someone else's repair.

### Cost and the log

Text.lk bills per 160-character part (70 if the message contains any non-GSM
character, e.g. Sinhala or an emoji). The Send button shows the part count when
a message will be split. Every attempt — success or failure — is written to
`sms_messages` with the gateway's message id, cost, part count and any error, so
a billing query can be answered from the database.

## Where it is used today

The technician's **Message customer** action on a job now has a **Send SMS**
button alongside Copy and WhatsApp. Templates cover ready-for-pickup, additional
issue found, in progress, and awaiting parts.

To send from elsewhere:

```ts
import { sendSms } from "@/lib/sms/client";

const result = await sendSms({
  to: job.phone,
  message: `Hello ${job.customerName}, your ${job.brand} ${job.model} is ready.`,
  jobId: job.id,
  purpose: "ready-for-collection",
});
if (!result.ok) console.error(result.error);
```

## Testing

Text.lk accounts start in a sandbox that accepts requests without delivering to
handsets; live delivery needs a paid/upgraded account. A send that succeeds in
the app but never arrives on the phone usually means the account is still in that
state, or the Sender ID has not been approved.
