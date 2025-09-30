# 🚂 Railway Deployment Guide

## Quick Deploy Your Tournament App to Railway

Railway is perfect for your volleyball tournament app! Here's how to deploy it in minutes.

## 🚀 Step-by-Step Deployment

### 1. Prepare Your Repository

```bash
# Make sure your code is committed to Git
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### 2. Deploy to Railway

#### Option A: Deploy from GitHub (Recommended)
1. Visit [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your `sandy-scorekeeper` repository
6. Railway will automatically detect it's a Vite app and deploy!

#### Option B: Deploy with Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize and deploy
railway deploy
```

### 3. Configure Environment Variables

In your Railway dashboard:

1. Go to your project → **Variables**
2. Add these environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration (if payments enabled)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret

# Node Environment
NODE_ENV=production
```

### 4. Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as shown
4. SSL automatically handled by Railway!

## 🔧 Railway Configuration Files

Railway uses these files (already created for you):

### `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### `nixpacks.toml`
```toml
[phases.setup]
nixPkgs = ['nodejs-18_x', 'npm-9_x']

[phases.build]
cmds = [
  'npm ci',
  'npm run build'
]

[phases.start]
cmd = 'npm run preview -- --host 0.0.0.0 --port $PORT'
```

## 🎯 What Railway Provides

### ✅ Automatic Features:
- **Zero Config Deployment**: Detects Vite automatically
- **HTTPS/SSL**: Automatic SSL certificates
- **Custom Domains**: Free subdomain + custom domain support
- **CI/CD**: Auto-deploy on git push
- **Monitoring**: Built-in metrics and logs
- **Scaling**: Auto-scaling based on traffic

### 💰 Pricing:
- **Starter Plan**: $5/month per service
- **Includes**: 
  - 500GB bandwidth
  - Always-on deployment
  - Custom domains
  - Auto-scaling

## 🌐 For Payment API (If Enabled)

If you enable payments later, deploy the API separately:

### 1. Create API Service
```bash
# In Railway dashboard
# New Project → Add Service → Empty Service
```

### 2. Deploy Payment Endpoint
```javascript
// netlify/functions/create-payment-intent.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Payment intent creation logic
};
```

### 3. Update Frontend URL
```javascript
// Update in PaymentForm.tsx
const response = await fetch('https://your-api.railway.app/api/create-payment-intent', {
  method: 'POST',
  // ... rest of code
});
```

## 🔗 Useful Railway Commands

```bash
# View logs
railway logs

# Open project in browser
railway open

# Connect to database (if using Railway PostgreSQL)
railway connect

# Environment variables
railway variables

# Deploy specific branch
railway deploy --branch staging
```

## 🛠️ Advanced Railway Features

### Database Integration
```bash
# Add PostgreSQL database
railway add postgresql

# Get connection string
railway variables
```

### Multiple Environments
```bash
# Create staging environment
railway environment create staging

# Deploy to specific environment
railway deploy --environment staging
```

### Monitoring & Logs
```bash
# Real-time logs
railway logs --follow

# Service metrics
railway status
```

## 🚨 Important Notes

### For Production:
1. **Environment Variables**: Never commit secrets to git
2. **Custom Domain**: Set up proper domain for professional look
3. **Monitoring**: Monitor your app performance
4. **Backups**: Regular Supabase backups

### For Development:
1. **Preview Deployments**: Each PR can have preview URL
2. **Branch Deployments**: Deploy different branches
3. **Local Development**: Use Railway CLI for local testing

## 🔧 Troubleshooting

### Build Fails?
```bash
# Check build logs
railway logs --deployment <deployment-id>

# Local build test
npm run build
```

### Environment Variables Not Working?
```bash
# List all variables
railway variables

# Check variable names match exactly
```

### App Not Starting?
```bash
# Check start command in nixpacks.toml
# Verify port binding: --host 0.0.0.0 --port $PORT
```

## 📱 Your App URLs

After deployment, you'll get:
- **Production**: `https://your-app-name.railway.app`
- **Custom Domain**: `https://yourdomain.com` (if configured)
- **Admin Dashboard**: Railway dashboard for management

## 🎉 Success!

Your volleyball tournament app is now live on Railway! 

**Benefits:**
- ✅ Professional hosting
- ✅ Automatic SSL/HTTPS
- ✅ Fast global CDN
- ✅ Auto-deploy on git push
- ✅ Easy scaling
- ✅ Built-in monitoring

**Next Steps:**
1. Share the URL with tournament participants
2. Test registration flow in production
3. Monitor app performance
4. Enable payments when ready

Railway is perfect for your tournament app - reliable, fast, and developer-friendly! 🚂✨