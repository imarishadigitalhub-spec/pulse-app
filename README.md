# PULSE

**Your people. Your moments. Your world.**

PULSE is a mobile-first social and messaging application built with React, TypeScript, Vite and Firebase. It is designed to bring people, conversations and social experiences together.

## Current status

PULSE is under active development and is being prepared for beta testing.

Profile viewing and the current application foundation are available. Messaging capabilities including image, video, document and audio sharing, camera capture, video calling, and chat appearance customization are still being developed. Do not treat these features as complete.

## Technology

- React and TypeScript
- Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Progressive Web App support

## Local development

Requirements: Node.js and npm.

1. Install dependencies:

   `npm install`

2. Create your local environment file:

   `cp .env.example .env.local`

3. Add your Firebase project's configuration values to `.env.local`.

4. Start the development server:

   `npm run dev`

5. Create a production build:

   `npm run build`

## Firebase environment variables

The application expects these variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Never commit `.env.local` or other files containing real credentials.

## Cloudflare Pages

Recommended build settings:

- Framework preset: React (Vite)
- Root directory: `/`
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

Configure all six Firebase environment variables in Cloudflare Pages project settings before deploying.

## Firebase security

Firestore and Storage rules are maintained in this repository. Review and test security rules before deploying them to Firebase. A Cloudflare Pages deployment does not deploy Firebase rules.

## License

See [LICENSE](LICENSE).
