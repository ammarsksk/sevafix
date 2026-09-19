import { Amplify, type ResourcesConfig } from "aws-amplify";

const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing frontend environment variable: ${name}`);
  return value;
};

const oauthDomain = process.env.NEXT_PUBLIC_COGNITO_OAUTH_DOMAIN?.replace(/^https?:?\/\//, "").replace(/\/$/, "");
const oauthRedirect = process.env.NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT ?? "http://localhost:3000";

const authConfig: ResourcesConfig["Auth"] = {
  Cognito: {
    userPoolId: required(
      "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    ),
    userPoolClientId: required(
      "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID",
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
    ),
    loginWith: {
      email: true,
      ...(oauthDomain
        ? {
            oauth: {
              domain: oauthDomain,
              scopes: ["openid", "email", "profile"],
              redirectSignIn: [oauthRedirect],
              redirectSignOut: [oauthRedirect],
              responseType: "code" as const,
              providers: ["Google" as const],
            },
          }
        : {}),
    },
    signUpVerificationMethod: "code",
    userAttributes: { email: { required: true } },
    passwordFormat: {
      minLength: 10,
      requireLowercase: true,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialCharacters: true,
    },
  },
};

let configured = false;

export function configureSevaFixAuth(): void {
  if (configured) return;
  Amplify.configure({ Auth: authConfig });
  configured = true;
}
