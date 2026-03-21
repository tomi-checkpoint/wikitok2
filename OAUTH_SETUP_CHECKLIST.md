# OAuth Provider Setup Checklist

Complete these steps when ready to enable social login. For each provider, you'll need to create a developer app and get client ID + secret.

Your Supabase callback URL (fill in after Railway deploy):
```
https://YOUR_KONG_DOMAIN/auth/v1/callback
```

---

## 1. Apple Sign-In (Required for iOS App Store)

- [ ] Go to https://developer.apple.com/account/resources/identifiers/list/serviceId
- [ ] Create a new Service ID with "Sign In with Apple" enabled
- [ ] Configure the domain and return URL (Supabase callback URL above)
- [ ] Generate a private key for Sign In with Apple
- [ ] Set in Railway (GoTrue Auth service):
  - `GOTRUE_EXTERNAL_APPLE_ENABLED=true`
  - `GOTRUE_EXTERNAL_APPLE_CLIENT_ID=<your-service-id>`
  - `GOTRUE_EXTERNAL_APPLE_SECRET=<your-private-key>`

## 2. Google Sign-In

- [ ] Go to https://console.cloud.google.com/apis/credentials
- [ ] Create OAuth 2.0 Client ID (Web application type)
- [ ] Add authorized redirect URI: `https://YOUR_KONG_DOMAIN/auth/v1/callback`
- [ ] Set in Railway (GoTrue Auth service):
  - `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`
  - `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<your-client-id>`
  - `GOTRUE_EXTERNAL_GOOGLE_SECRET=<your-client-secret>`
  - `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://YOUR_KONG_DOMAIN/auth/v1/callback`

## 3. GitHub Sign-In

- [ ] Go to https://github.com/settings/applications/new
- [ ] Set Authorization callback URL: `https://YOUR_KONG_DOMAIN/auth/v1/callback`
- [ ] Set in Railway (GoTrue Auth service):
  - `GOTRUE_EXTERNAL_GITHUB_ENABLED=true`
  - `GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=<your-client-id>`
  - `GOTRUE_EXTERNAL_GITHUB_SECRET=<your-client-secret>`
  - `GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=https://YOUR_KONG_DOMAIN/auth/v1/callback`

## 4. X / Twitter Sign-In

- [ ] Go to https://developer.twitter.com/en/portal/projects-and-apps
- [ ] Create a new app or use existing
- [ ] Enable OAuth 2.0 with PKCE
- [ ] Add callback URL: `https://YOUR_KONG_DOMAIN/auth/v1/callback`
- [ ] Set in Railway (GoTrue Auth service):
  - `GOTRUE_EXTERNAL_TWITTER_ENABLED=true`
  - `GOTRUE_EXTERNAL_TWITTER_CLIENT_ID=<your-client-id>`
  - `GOTRUE_EXTERNAL_TWITTER_SECRET=<your-client-secret>`

## 5. Facebook / Meta Sign-In

- [ ] Go to https://developers.facebook.com/apps/
- [ ] Create a new app (Consumer type)
- [ ] Add Facebook Login product
- [ ] Add valid OAuth redirect URI: `https://YOUR_KONG_DOMAIN/auth/v1/callback`
- [ ] Set in Railway (GoTrue Auth service):
  - `GOTRUE_EXTERNAL_FACEBOOK_ENABLED=true`
  - `GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID=<your-app-id>`
  - `GOTRUE_EXTERNAL_FACEBOOK_SECRET=<your-app-secret>`

---

## Deep Link Configuration (iOS + Android)

### iOS Universal Links
- [ ] Add associated domain in Xcode: `applinks:YOUR_KONG_DOMAIN`
- [ ] Host `apple-app-site-association` file at `https://YOUR_KONG_DOMAIN/.well-known/apple-app-site-association`

### Android App Links
- [ ] Add intent filter in `app.json` android config
- [ ] Host `assetlinks.json` at `https://YOUR_KONG_DOMAIN/.well-known/assetlinks.json`

---

## Environment Variables Summary

Set all of these on the **GoTrue Auth** service in Railway:

| Variable | Provider |
|----------|----------|
| `GOTRUE_EXTERNAL_APPLE_ENABLED` | Apple |
| `GOTRUE_EXTERNAL_APPLE_CLIENT_ID` | Apple |
| `GOTRUE_EXTERNAL_APPLE_SECRET` | Apple |
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | Google |
| `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` | Google |
| `GOTRUE_EXTERNAL_GOOGLE_SECRET` | Google |
| `GOTRUE_EXTERNAL_GITHUB_ENABLED` | GitHub |
| `GOTRUE_EXTERNAL_GITHUB_CLIENT_ID` | GitHub |
| `GOTRUE_EXTERNAL_GITHUB_SECRET` | GitHub |
| `GOTRUE_EXTERNAL_TWITTER_ENABLED` | X/Twitter |
| `GOTRUE_EXTERNAL_TWITTER_CLIENT_ID` | X/Twitter |
| `GOTRUE_EXTERNAL_TWITTER_SECRET` | X/Twitter |
| `GOTRUE_EXTERNAL_FACEBOOK_ENABLED` | Facebook |
| `GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID` | Facebook |
| `GOTRUE_EXTERNAL_FACEBOOK_SECRET` | Facebook |
