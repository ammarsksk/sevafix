# Frontend reference modules

Copy these files into the frontend, adjust import paths, and install `aws-amplify` plus optionally `@aws-amplify/ui-react`.

1. Copy `.env.local.example` to `.env.local`.
2. Import and call `configureSevaFixAuth()` once in a browser/client bootstrap module.
3. Use Amplify Auth or the Amplify `Authenticator` component for sign-up/sign-in flows.
4. Use `sevaFixApi` for backend calls and `uploadDocument` for direct uploads.
5. Do not commit `.env.local`, tokens, citizen documents, or AWS credentials.

The environment identifiers in the example are public client configuration. The deployment role/profile is intentionally not included.
