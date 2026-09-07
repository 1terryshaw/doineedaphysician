const verticalConfig = {
  inquiryNoEmailPolicy: "hide", // TDL #455 (empire default)
  // === BRANDING ===
  name: "DoINeedAPhysician.com",
  shortName: "DoINeedAPhysician",
  tagline: "Find a physician near you",
  description: "A public directory of licensed physicians compiled from state medical board records and NPPES. Search by specialty and location. Not a medical referral service — see our disclaimer.",
  entity: "Physician",
  entityPlural: "Physicians",
  slug: "doineedaphysician",
  domain: "doineedaphysician.com",
  displayDomain: "doineedaphysician.com",
  supportEmail: "hello@doineedaphysician.com",
  primaryColor: "#6B8F71",
  ctaColor: "#E17055",
  instagramHandle: "",

  // === ENTITY NOUNS ===
  listingNoun: "physician",
  listingNounPlural: "physicians",

  // === COLORS ===
  heroGradientFrom: "#6B8F71",
  heroGradientVia: "#5A7D60",
  heroGradientTo: "#4A6B50",
  creamBg: "#FFF8F0",
  defaultCountry: "US",

  // === COUNTRY SUPPORT (TDL #271) ===
  supportedCountries: ["US", "CA"] as const,

  // === DATABASE ===
  tablePrefix: "physician_",

  // === BILLING ===
  siteforgeEnabled: true,

  // === TRIAGE ===
  // Disabled for the physician vertical: a symptom/diagnosis quiz would constitute
  // medical advice (see app/disclaimer/page.tsx — "Not Medical Advice"). Directory only.
  triageEnabled: false,
  triageType: "quiz",
  triageQuestions: [],
  triageResults: {
    low: { heading: "", body: "", ctaStyle: "secondary" },
    moderate: { heading: "", body: "", ctaStyle: "primary" },
    high: { heading: "", body: "", ctaStyle: "primary" },
  },
  crisisResources: {
    enabled: true,
    resources: [
      { label: "Medical emergency? Call 911 or go to your nearest ER", type: "emergency" },
      { label: "Poison Control: 1-800-222-1222", type: "crisis", url: "tel:18002221222" },
      { label: "Mental health crisis: call or text 988", type: "crisis", url: "tel:988" },
    ],
  },
  triageDisclaimer: "This directory provides listing information only and is not medical advice, diagnosis, or treatment. If you are experiencing a medical emergency, call 911.",

  // === SECTION A: PHYSICIAN SPECIALTY TILES (Phase 2d) ===
  // The 8 internal specialty tiles. Each maps to a derived_taxonomy NUCC-prefix
  // group (see therapist-reclassify/.../07-tile-prefix-map.md and the
  // physician_specialty_* RPCs). Order is the approved Section-A order; cardiology
  // breaks out of internal medicine (Option A). Psychiatry (2084P*, excluded from
  // the move) and Dermatology (own directory — Section B) are intentionally NOT
  // tiles here. Homepage links these to /specialty/<slug>, not /directory.
  // Slugs use practitioner form (Part 1.5) to match tile labels + search intent
  // ("cardiologist near me" >> "cardiology near me"). family-medicine and
  // internal-medicine keep specialty form (Option B — natural search terms).
  showSpecialtyFilter: false, // TDL #980 — listing_type data gap; dropdown hidden until enrichment
  categoryLabels: [
    { slug: "family-medicine", label: "Family Medicine", emoji: "🩺", description: "Primary care for patients of all ages" },
    { slug: "internal-medicine", label: "Internal Medicine", emoji: "🫀", description: "Adult primary and complex chronic care" },
    { slug: "pediatrician", label: "Pediatrician", emoji: "🧒", description: "Medical care for infants, children, and adolescents" },
    { slug: "obgyn", label: "OB/GYN", emoji: "🤰", description: "Obstetrics, gynecology, and women's health" },
    { slug: "cardiologist", label: "Cardiologist", emoji: "❤️", description: "Heart and cardiovascular conditions" },
    { slug: "orthopedic-surgeon", label: "Orthopedic Surgeon", emoji: "🦴", description: "Bones, joints, and musculoskeletal care" },
    { slug: "general-surgeon", label: "Surgeon", emoji: "🏥", description: "General surgical evaluation and procedures" },
    { slug: "neurologist", label: "Neurologist", emoji: "⚡", description: "Brain, spine, and nervous system conditions" },
  ],

  // === SECTION B: RELATED SPECIALISTS (external cross-links, Phase 2d) ===
  // Specialties that have their OWN empire directories. Rendered as external
  // cards (target=_blank rel=noopener) on the homepage under "Related specialists".
  relatedSpecialists: [
    { label: "Therapist", description: "Mental health, counseling, and talk therapy", url: "https://doineedatherapist.org" },
    { label: "Dermatologist", description: "Skin, hair, and nail conditions", url: "https://doineedadermatologist.com" },
    { label: "Chiropractor", description: "Spinal alignment and musculoskeletal therapy", url: "https://doineedachiropractor.com" },
    { label: "Optometrist", description: "Eye exams and vision care", url: "https://doineedanoptometrist.com" },
  ],

  // === NATIONAL REGIONS ===
  // REGION HUBS — empty-city-hubs-fan-v1 (F2, 2026-09-07). See K200.
  //
  // The 60 Canadian CITY hubs the donor template shipped (toronto, montreal,
  // vancouver, …) were REMOVED. physician_listings is 115,456 rows, 100% US — ZERO CA — so every one of
  // them rendered an indexable empty 200 and was advertised in the sitemap. No backfill
  // would have filled them: this is a market mismatch, not a grain one, and the fix is
  // curation.
  //
  // The 13 Canadian PROVINCE hubs (ab, bc, on, …) are DELIBERATELY KEPT. Terry's ruling
  // 2026-09-07: gate state/province hubs, never remove them — they 404 while empty and
  // self-revive the day CA rows land. Only city hubs are curated away.
  regions: [
    // Ontario
    // British Columbia
    // Alberta
    // Quebec
    // Manitoba
    // Saskatchewan
    // Nova Scotia
    // New Brunswick
    // Newfoundland
    // PEI
    { slug: "ab", label: "Alberta", province: "AB" },
    { slug: "bc", label: "British Columbia", province: "BC" },
    { slug: "mb", label: "Manitoba", province: "MB" },
    { slug: "nb", label: "New Brunswick", province: "NB" },
    { slug: "nl", label: "Newfoundland and Labrador", province: "NL" },
    { slug: "ns", label: "Nova Scotia", province: "NS" },
    { slug: "nt", label: "Northwest Territories", province: "NT" },
    { slug: "nu", label: "Nunavut", province: "NU" },
    { slug: "on", label: "Ontario", province: "ON" },
    { slug: "pe", label: "Prince Edward Island", province: "PE" },
    { slug: "qc", label: "Quebec", province: "QC" },
    { slug: "sk", label: "Saskatchewan", province: "SK" },
    { slug: "yt", label: "Yukon", province: "YT" },
    { slug: "al", label: "Alabama", province: "AL" },
    { slug: "ak", label: "Alaska", province: "AK" },
    { slug: "az", label: "Arizona", province: "AZ" },
    { slug: "ar", label: "Arkansas", province: "AR" },
    { slug: "ca", label: "California", province: "CA" },
    { slug: "co", label: "Colorado", province: "CO" },
    { slug: "ct", label: "Connecticut", province: "CT" },
    { slug: "de", label: "Delaware", province: "DE" },
    { slug: "fl", label: "Florida", province: "FL" },
    { slug: "ga", label: "Georgia", province: "GA" },
    { slug: "hi", label: "Hawaii", province: "HI" },
    { slug: "id", label: "Idaho", province: "ID" },
    { slug: "il", label: "Illinois", province: "IL" },
    { slug: "in", label: "Indiana", province: "IN" },
    { slug: "ia", label: "Iowa", province: "IA" },
    { slug: "ks", label: "Kansas", province: "KS" },
    { slug: "ky", label: "Kentucky", province: "KY" },
    { slug: "la", label: "Louisiana", province: "LA" },
    { slug: "me", label: "Maine", province: "ME" },
    { slug: "md", label: "Maryland", province: "MD" },
    { slug: "ma", label: "Massachusetts", province: "MA" },
    { slug: "mi", label: "Michigan", province: "MI" },
    { slug: "mn", label: "Minnesota", province: "MN" },
    { slug: "ms", label: "Mississippi", province: "MS" },
    { slug: "mo", label: "Missouri", province: "MO" },
    { slug: "mt", label: "Montana", province: "MT" },
    { slug: "ne", label: "Nebraska", province: "NE" },
    { slug: "nv", label: "Nevada", province: "NV" },
    { slug: "nh", label: "New Hampshire", province: "NH" },
    { slug: "nj", label: "New Jersey", province: "NJ" },
    { slug: "nm", label: "New Mexico", province: "NM" },
    { slug: "ny", label: "New York", province: "NY" },
    { slug: "nc", label: "North Carolina", province: "NC" },
    { slug: "nd", label: "North Dakota", province: "ND" },
    { slug: "oh", label: "Ohio", province: "OH" },
    { slug: "ok", label: "Oklahoma", province: "OK" },
    { slug: "or", label: "Oregon", province: "OR" },
    { slug: "pa", label: "Pennsylvania", province: "PA" },
    { slug: "ri", label: "Rhode Island", province: "RI" },
    { slug: "sc", label: "South Carolina", province: "SC" },
    { slug: "sd", label: "South Dakota", province: "SD" },
    { slug: "tn", label: "Tennessee", province: "TN" },
    { slug: "tx", label: "Texas", province: "TX" },
    { slug: "ut", label: "Utah", province: "UT" },
    { slug: "vt", label: "Vermont", province: "VT" },
    { slug: "va", label: "Virginia", province: "VA" },
    { slug: "wa", label: "Washington", province: "WA" },
    { slug: "wv", label: "West Virginia", province: "WV" },
    { slug: "wi", label: "Wisconsin", province: "WI" },
    { slug: "wy", label: "Wyoming", province: "WY" },
    { slug: "dc", label: "District of Columbia", province: "DC" },
  ],

  // === PROVINCE LABELS ===
  provinceLabels: {
    ON: "Ontario",
    BC: "British Columbia",
    AB: "Alberta",
    QC: "Quebec",
    MB: "Manitoba",
    SK: "Saskatchewan",
    NS: "Nova Scotia",
    NB: "New Brunswick",
    NL: "Newfoundland & Labrador",
    PE: "Prince Edward Island",
  } as Record<string, string>,

  // === CROSS-REFERRAL (v7) ===
  cluster: "B",
  crossReferrals: [
    { name: 'Not Sure Which Pro?', url: 'https://doineedapro.com', description: 'Free AI triage — tell us your problem, we\'ll tell you which type of pro to call' },
    { name: "Find a Therapist", url: "https://doineedatherapist.org", pathPattern: "/{city}" },
    { name: "Find a Physiotherapist", url: "https://doineedaphysiotherapist.com", pathPattern: "/{city}" },
    { name: "Find a Naturopath", url: "https://doineedanaturopath.com", pathPattern: "/{city}" },
  ],

  // === FAQs ===
  faqs: [
    {
      question: "Is this a medical referral service?",
      answer: "No. DoINeedAPhysician.com is a public directory compiled from state medical board records and NPPES. Inclusion is not an endorsement or referral, and we do not vet or rank practitioners. Always verify a physician's current license and credentials directly with the relevant state medical board."
    },
    {
      question: "Where does the listing information come from?",
      answer: "Listings are sourced from public, government-maintained records: the Medical Board of California / California Department of Consumer Affairs and the National Plan and Provider Enumeration System (NPPES) from the Centers for Medicare & Medicaid Services. No patient information is collected or displayed."
    },
    {
      question: "Do the specialties shown mean a physician is board certified?",
      answer: "Not necessarily. Specialty designations reflect taxonomy codes in licensee records and do not represent board certification unless explicitly stated. Verify board certification with the American Board of Medical Specialties (abms.org) or the relevant specialty board."
    },
    {
      question: "How current is the license and contact information?",
      answer: "Records may be incomplete or outdated. License status, location, and contact details can change after our last data refresh. Always confirm current details with the physician's office and the state medical board before relying on them."
    },
    {
      question: "I'm a physician — how do I claim, correct, or remove my listing?",
      answer: "Click 'Claim Your Listing' on your listing page and verify ownership with your professional email, or contact us via the contact page. Claiming and corrections are free, and we respond to verified removal requests within 7 business days."
    },
    {
      question: "What should I do in a medical emergency?",
      answer: "Do not use this directory in an emergency. If you are experiencing a medical emergency, call 911 immediately or go to your nearest emergency room."
    },
  ],

  // Design personality
  design: {
    primaryColor: '#6B8F71',
    accentColor: '#3B82F6',
    personalityWord: 'trusted',
    personalityIcon: 'Stethoscope',
    heroPattern: 'dots' as const,
    loadingMessages: [
      'Checking the directory...',
      'Looking up physicians...',
      'Gathering listings...',
      'Almost there...',
      'Loading results...',
    ],
    notFoundMessage: 'That page could not be found.',
  },
};

export default verticalConfig;
