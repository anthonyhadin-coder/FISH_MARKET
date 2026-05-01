// loginTranslations.ts — Google OAuth bilingual string map
// Used exclusively by the login page and Google auth components.

export interface LoginTranslation {
  // App identity
  appName: string;
  tagline: string;
  betaBadge: string;

  // Google OAuth
  googleSignIn: string;
  googleVerifying: string;
  googleError: string;
  googlePopupBlocked: string;
  allowPopups: string;
  dividerOr: string;
  securedBy: string;

  // Role selection modal
  welcomeModal: string;
  selectRole: string;
  roleAgent: string;
  roleOwner: string;
  roleViewer: string;
  roleAgentDesc: string;
  roleOwnerDesc: string;
  roleViewerDesc: string;

  // Welcome flash
  welcomeUser: string; // use .replace('[Name]', name)

  // Phone/password form
  phoneLabel: string;
  phonePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  loginBtn: string;
  loginLoading: string;

  // Errors
  wrongCreds: string;
  networkError: string;
  rateLimited: string; // use .replace('[s]', seconds)
  accountLocked: string; // use .replace('[s]', time)
  offlineBanner: string;

  // Success
  authenticated: string;
  redirecting: string;

  // Lang toggle
  langToggle: string;

  // Footer links
  privacy: string;
  terms: string;
  help: string;

  // Signup
  noAccount: string;
  createAccount: string;
  alreadyHaveAccount: string;
  registerBtn: string;
  fullName: string;
  fullNamePlaceholder: string;

  // Login page specific
  loginTitle: string;
  dontHaveAccount: string;
  errorLocked: string;
  errorInvalid: string;
  // OTP Flow
  useOtp: string;
  usePassword: string;
  sendOtp: string;
  verifyingOtp: string;
  enterOtp: string;
  otpSent: string;
  resendOtp: string;
  resendIn: string;
  invalidOtp: string;
}

export const loginT: Record<'en' | 'ta', LoginTranslation> = {
  en: {
    appName: 'Fish Market',
    tagline: 'Smart Digital Accounts for Fishing Agents',
    betaBadge: 'BETA v0.9',

    googleSignIn: 'Sign in with Google',
    googleVerifying: 'Verifying with Google…',
    googleError: 'Google login failed — try again',
    googlePopupBlocked: 'Allow popups to continue with Google',
    allowPopups: 'Allow popups for Google login',
    dividerOr: 'OR',
    securedBy: 'Secured • 256-bit SSL',
    accountLocked: 'Account locked. Try again in [s].',

    welcomeModal: 'Welcome to Fish Market! 🐟',
    selectRole: 'Select your role to get started',
    roleAgent: 'Boat Agent',
    roleOwner: 'Market Owner',
    roleViewer: 'Viewer',
    roleAgentDesc: 'Record daily fish sales & manage buyer credits',
    roleOwnerDesc: 'Monitor boats, expenses & profits',
    roleViewerDesc: 'Read-only access to reports',

    welcomeUser: 'Welcome, [Name]! 👋',

    phoneLabel: 'Phone Number',
    phonePlaceholder: 'Enter phone number',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    forgotPassword: 'Forgot?',
    loginBtn: 'Sign In',
    loginLoading: 'Signing in…',

    wrongCreds: 'Invalid phone number or password.',
    networkError: 'Network error — check your connection.',
    rateLimited: 'Too many attempts. Try again in [s]s.',
    offlineBanner: "You're offline — Google login unavailable",

    authenticated: 'Authenticated',
    redirecting: 'Securely redirecting to your dashboard…',

    langToggle: 'தமிழ்',

    privacy: 'Privacy',
    terms: 'Terms',
    help: 'Help',

    noAccount: "Don't have an account?",
    createAccount: 'Create New Account',
    alreadyHaveAccount: 'Already have an account?',
    registerBtn: 'Create Account',
    fullName: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',

    loginTitle: 'Fish Market',
    dontHaveAccount: "Don't have an account?",
    errorLocked: 'Too many attempts. Please wait before retrying.',
    errorInvalid: 'Invalid phone number or password.',
    useOtp: 'Sign in with OTP',
    usePassword: 'Sign in with Password',
    sendOtp: 'Send OTP',
    verifyingOtp: 'Verifying OTP…',
    enterOtp: 'Enter 6-digit OTP',
    otpSent: 'OTP sent to your phone',
    resendOtp: 'Resend OTP',
    resendIn: 'Resend in [s]s',
    invalidOtp: 'Invalid or expired OTP',
  },
  ta: {
    appName: 'மீன் சந்தை',
    tagline: 'மீன் முகவர்களுக்கான டிஜிட்டல் கணக்கு',
    betaBadge: 'பீட்டா v0.9',

    googleSignIn: 'Google மூலம் உள்நுழை',
    googleVerifying: 'சரிபார்க்கிறது…',
    googleError: 'Google உள்நுழைவு தோல்வி — மீண்டும் முயற்சிக்கவும்',
    googlePopupBlocked: 'தொடர அனுமதிக்கவும் (popup)',
    allowPopups: 'Google உள்நுழைவுக்கு popup அனுமதிக்கவும்',
    dividerOr: 'அல்லது',
    securedBy: 'பாதுகாப்பானது • 256-bit SSL',
    accountLocked: 'கணக்கு பூட்டப்பட்டது. [s] பிறகு முயற்சிக்கவும்.',

    welcomeModal: 'மீன் சந்தைக்கு வரவேற்கிறோம்! 🐟',
    selectRole: 'உங்கள் பங்கை தேர்ந்தெடுக்கவும்',
    roleAgent: 'முகவர்',
    roleOwner: 'படகு உரிமையாளர்',
    roleViewer: 'பார்வையாளர்',
    roleAgentDesc: 'தினசரி மீன் விற்பனையை பதிவு செய்யவும்',
    roleOwnerDesc: 'படகு, செலவு & லாபம் கண்காணிக்கவும்',
    roleViewerDesc: 'அறிக்கைகளை மட்டும் பார்க்கவும்',

    welcomeUser: 'வணக்கம், [Name]! 👋',

    phoneLabel: 'கைபேசி எண்',
    phonePlaceholder: 'கைபேசி எண்ணை உள்ளிடவும்',
    passwordLabel: 'கடவுச்சொல்',
    passwordPlaceholder: '••••••••',
    forgotPassword: 'மறந்துவிட்டதா?',
    loginBtn: 'உள்நுழைக',
    loginLoading: 'உள்நுழைகிறது…',

    wrongCreds: 'தவறான கைபேசி எண் அல்லது கடவுச்சொல்.',
    networkError: 'நெட்வொர்க் பிழை — இணைப்பை சரிபார்க்கவும்.',
    rateLimited: 'அதிக முயற்சி. [s] வினாடி பிறகு முயற்சிக்கவும்.',
    offlineBanner: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள் — Google உள்நுழைவு இல்லை',

    authenticated: 'அங்கீகரிக்கப்பட்டது',
    redirecting: 'உங்கள் டேஷ்போர்டிற்கு பாதுகாப்பாக திருப்பி விடப்படுகிறது…',

    langToggle: 'English',

    privacy: 'தனியுரிமை',
    terms: 'விதிமுறைகள்',
    help: 'உதவி',

    noAccount: 'கணக்கு இல்லையா?',
    createAccount: 'புதிய கணக்கை உருவாக்கவும்',
    alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
    registerBtn: 'கணக்கை உருவாக்கு',
    fullName: 'முழு பெயர்',
    fullNamePlaceholder: 'உங்கள் முழு பெயரை உள்ளிடவும்',

    loginTitle: 'மீன் சந்தை',
    dontHaveAccount: 'கணக்கு இல்லையா?',
    errorLocked: 'அதிக முயற்சிகள். சிறிது நேரம் காத்திருங்கள்.',
    errorInvalid: 'தவறான கைபேசி எண் அல்லது கடவுச்சொல்.',
    useOtp: 'OTP மூலம் உள்நுழைக',
    usePassword: 'கடவுச்சொல் மூலம் உள்நுழைக',
    sendOtp: 'OTP அனுப்புக',
    verifyingOtp: 'OTP சரிபார்க்கிறது…',
    enterOtp: '6-இலக்க OTP-ஐ உள்ளிடவும்',
    otpSent: 'உங்கள் கைபேசிக்கு OTP அனுப்பப்பட்டது',
    resendOtp: 'மீண்டும் அனுப்புக',
    resendIn: '[s] வினாடியில் மீண்டும் அனுப்புக',
    invalidOtp: 'தவறான அல்லது காலாவதியான OTP',
  },
};
