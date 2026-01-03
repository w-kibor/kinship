# Development Guide

## Testing SMS Webhooks Locally with ngrok

### Setup

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Install and run ngrok** (in a separate terminal):
   ```bash
   ngrok http 3000
   ```

3. **Copy the ngrok URL** (looks like `https://abc123.ngrok.io`)

4. **Configure Africa's Talking webhook:**
   - Go to your Africa's Talking dashboard
   - Navigate to SMS → Callback URLs
   - Set callback URL to: `https://your-ngrok-url.ngrok.io/api/webhooks/sms`

### Testing SMS Commands

Once configured, send an SMS to your Africa's Talking number with:
- `SAFE 123456` (where 123456 is your PIN from `/api/sms/pin`)
- `HELP 123456`
- `SAFE 123456 -1.2921,36.8219` (with coordinates)

### Important Notes

- ngrok URLs change each time you restart ngrok (free tier)
- You'll need to update the webhook URL in Africa's Talking dashboard each time
- For persistent URLs, use ngrok paid plan or deploy to a hosting service

## Deploying to Vercel (Production)

### Quick Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts to:
# - Link to your Vercel account
# - Set up environment variables
# - Deploy

# Add environment variables
vercel env add AFRICASTALKING_API_KEY
vercel env add AFRICASTALKING_USERNAME
vercel env add KINSHIP_SMS_NUMBER
# ... add all other env vars from .env.local
```

### Configure Webhook on Vercel

After deployment, your webhook URL will be:
`https://your-project.vercel.app/api/webhooks/sms`

Update this in your Africa's Talking dashboard.

## Environment Variables Needed

Make sure to set these in your hosting platform:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
KINSHIP_SMS_NUMBER=
KINSHIP_SMS_PIN=
```
