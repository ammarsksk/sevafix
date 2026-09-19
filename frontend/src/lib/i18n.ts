// Minimal translation-key layer. English strings live here; additional locales
// can be added as sibling dictionaries and swapped in `t()` without touching components.

export const en = {
  appName: "SevaFix",
  nav: {
    dashboard: "Dashboard",
    schemes: "Schemes",
    settings: "Settings",
    reviewSourceChanges: "Source changes",
    reviewPolicies: "Policies",
    signOut: "Sign out",
  },
  auth: {
    login: "Log in",
    signup: "Create account",
    confirmEmail: "Confirm your email",
    forgotPassword: "Forgot password",
  },
  common: {
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    back: "Back",
    retry: "Retry",
    lastSaved: "Last saved",
    unsavedChanges: "Unsaved changes",
  },
  disclaimer:
    "SevaFix helps you prepare and check your application. It does not submit to the government portal or guarantee eligibility or approval.",
} as const;

export function t(): typeof en {
  return en;
}
