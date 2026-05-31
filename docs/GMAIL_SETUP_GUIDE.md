# Gmail SMTP Setup Guide for OTP Emails

## Why Gmail SMTP?
- ✅ **FREE** - No need to buy a domain
- ✅ **Works with ALL email addresses** - Send OTP to any email
- ✅ **Reliable** - Uses Gmail's infrastructure
- ✅ **Easy to set up** - Takes only 5 minutes

## Step-by-Step Setup

### Step 1: Enable 2-Step Verification on Gmail
1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** in the left menu
3. Under "How you sign in to Google", click on **2-Step Verification**
4. Click **Get Started** and follow the setup process
5. You can use your phone number or Google Authenticator app

### Step 2: Generate an App Password
1. After enabling 2-Step Verification, go to: https://myaccount.google.com/apppasswords
2. Sign in to your Google account if prompted
3. Under "Select app", choose **Mail**
4. Under "Select device", choose **Other (Custom name)**
5. Type: `StressBot OTP System`
6. Click **Generate**
7. Google will show you a **16-character password** (like: `abcd efgh ijkl mnop`)
8. **IMPORTANT**: Copy this password - you won't see it again!

### Step 3: Update Your .env File
1. Open: `backend/.env`
2. Find this line:
   ```
   EMAIL_PASS=your_gmail_app_password_here
   ```
3. Replace `your_gmail_app_password_here` with your 16-character app password
4. **Remove spaces** from the app password
   - Example: If Google gave you `abcd efgh ijkl mnop`
   - Enter: `abcdefghijklmn op`

### Step 4: Restart Your Backend Server
```bash
# Stop the current server (Ctrl+C)
# Then restart it:
cd backend
node server.js
```

### Step 5: Test OTP Email
1. Open your app in the browser
2. Go to Sign Up or Login with Email OTP
3. Enter any email address
4. Check if the OTP email arrives!

## Important Notes

⚠️ **Security Tips:**
- Never share your App Password publicly
- Don't commit the `.env` file to GitHub (it's already in `.gitignore`)
- The `.env.example` file has a placeholder for safety

✅ **Testing:**
- You can send OTP to ANY email address (Gmail, Yahoo, Outlook, etc.)
- Emails should arrive within 1-2 minutes
- Check spam/junk folder if you don't see it

## Troubleshooting

### Issue: "Invalid login" error
**Solution:** Double-check your App Password is correct (no spaces)

### Issue: Emails not arriving
**Solution:** 
1. Check spam/junk folder
2. Verify 2-Step Verification is enabled
3. Make sure you're using an App Password, not your regular Gmail password

### Issue: "Connection timeout" error
**Solution:** Check your internet connection and firewall settings

## Need Help?
If you encounter any issues, check the backend console logs - they will show detailed error messages to help diagnose the problem.
