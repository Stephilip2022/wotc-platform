/**
 * State Portal Configuration Seeds
 * Initial data for state WOTC portal configurations
 */

export const statePortalSeeds = [
  {
    stateCode: "CA",
    stateName: "California",
    portalUrl: "https://eddservices.edd.ca.gov/wotc/",
    submissionUrl: "https://eddservices.edd.ca.gov/wotc/upload",
    authType: "credentials",
    loginFieldSelectors: {
      username: "#username",
      password: "#password",
      submitButton: "#loginButton",
      successIndicator: ".dashboard-container"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code",
      "Disability Status"
    ],
    optionalColumns: [
      "Phone",
      "Email",
      "Veteran Status",
      "SNAP Benefits"
    ],
    dateFormat: "MM/DD/YYYY",
    maxBatchSize: 250,
    submissionFrequency: "weekly",
    automationEnabled: true,
    expectedProcessingDays: 45,
    supportEmail: "wotc@edd.ca.gov",
    supportPhone: "(916) 464-3300",
    status: "active",
    notes: "California requires additional disability documentation. Use Form EDD 9198."
  },
  {
    stateCode: "NY",
    stateName: "New York",
    portalUrl: "https://labor.ny.gov/wotc/portal",
    submissionUrl: "https://labor.ny.gov/wotc/portal/upload",
    authType: "credentials",
    loginFieldSelectors: {
      username: "input[name='username']",
      password: "input[name='password']",
      submitButton: "button[type='submit']",
      successIndicator: "#wotc-dashboard"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code",
      "Veteran Documentation"
    ],
    optionalColumns: [
      "Address",
      "City",
      "ZIP",
      "Email"
    ],
    dateFormat: "YYYY-MM-DD",
    maxBatchSize: 200,
    submissionFrequency: "daily",
    automationEnabled: true,
    expectedProcessingDays: 30,
    supportEmail: "wotc.program@labor.ny.gov",
    supportPhone: "(518) 457-9000",
    status: "active",
    notes: "NY requires DD-214 for all veteran claims. Accepts CSV or XML format."
  },
  {
    stateCode: "TX",
    stateName: "Texas",
    portalUrl: "https://www.twc.texas.gov/wotc",
    submissionUrl: "https://www.twc.texas.gov/wotc/submit",
    authType: "credentials",
    loginFieldSelectors: {
      username: "#UserName",
      password: "#Password",
      submitButton: "#LoginBtn",
      successIndicator: ".welcome-message"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "Date of Birth",
      "Address",
      "Phone"
    ],
    dateFormat: "MM-DD-YYYY",
    maxBatchSize: 500,
    submissionFrequency: "daily",
    automationEnabled: true,
    expectedProcessingDays: 21,
    supportEmail: "wotc@twc.texas.gov",
    supportPhone: "(512) 463-2222",
    status: "active",
    notes: "Texas has simplified requirements. Fastest processing time in the country."
  },
  {
    stateCode: "FL",
    stateName: "Florida",
    portalUrl: "https://floridajobs.org/wotc",
    submissionUrl: "https://floridajobs.org/wotc/upload",
    authType: "credentials",
    loginFieldSelectors: {
      username: "#email",
      password: "#pwd",
      submitButton: ".btn-login",
      successIndicator: "#employer-dashboard"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code",
      "County"
    ],
    optionalColumns: [
      "Email",
      "Phone",
      "Veteran Status"
    ],
    dateFormat: "MM/DD/YYYY",
    maxBatchSize: 300,
    submissionFrequency: "weekly",
    automationEnabled: true,
    expectedProcessingDays: 35,
    supportEmail: "wotc@deo.myflorida.com",
    supportPhone: "(850) 245-7105",
    status: "active",
    notes: "Florida requires county information for designated community residents."
  },
  {
    stateCode: "IL",
    stateName: "Illinois",
    portalUrl: "https://www.illinoisworknet.com/wotc",
    submissionUrl: "https://www.illinoisworknet.com/wotc/submit",
    authType: "credentials",
    loginFieldSelectors: {
      username: "input#username",
      password: "input#password",
      submitButton: "button.submit-btn",
      successIndicator: ".dashboard-header"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "Address",
      "Phone",
      "Email",
      "SNAP Status"
    ],
    dateFormat: "YYYY-MM-DD",
    maxBatchSize: 250,
    submissionFrequency: "weekly",
    automationEnabled: false,
    expectedProcessingDays: 40,
    supportEmail: "IDES.WOTC@Illinois.gov",
    supportPhone: "(312) 793-5280",
    status: "active",
    notes: "Illinois portal undergoes maintenance every Sunday 2-6 AM CST."
  },
  {
    stateCode: "PA",
    stateName: "Pennsylvania",
    portalUrl: "https://www.dli.pa.gov/wotc",
    submissionUrl: "https://www.dli.pa.gov/wotc/upload",
    authType: "credentials",
    loginFieldSelectors: {
      username: "input[name='user']",
      password: "input[name='pass']",
      submitButton: "#login-submit",
      successIndicator: "#main-dashboard"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "Veteran Documentation",
      "TANF Benefits",
      "Email"
    ],
    dateFormat: "MM/DD/YYYY",
    maxBatchSize: 200,
    submissionFrequency: "weekly",
    automationEnabled: false,
    expectedProcessingDays: 42,
    supportEmail: "ra-li-wotc@pa.gov",
    supportPhone: "(717) 787-5279",
    status: "maintenance",
    notes: "Portal currently under renovation. Expected back online Q1 2026."
  },
  {
    stateCode: "OH",
    stateName: "Ohio",
    portalUrl: "https://jfs.ohio.gov/wotc/portal",
    submissionUrl: "https://jfs.ohio.gov/wotc/portal/submit",
    authType: "credentials",
    loginFieldSelectors: {
      username: "#userId",
      password: "#userPassword",
      submitButton: ".login-button",
      successIndicator: ".employer-home"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "Email",
      "Phone",
      "Address",
      "City",
      "ZIP"
    ],
    dateFormat: "YYYY-MM-DD",
    maxBatchSize: 300,
    submissionFrequency: "daily",
    automationEnabled: true,
    expectedProcessingDays: 28,
    supportEmail: "wotc@jfs.ohio.gov",
    supportPhone: "(614) 466-2319",
    status: "active",
    notes: "Ohio accepts bulk submissions. Fastest turnaround times."
  },
  {
    stateCode: "GA",
    stateName: "Georgia",
    portalUrl: "https://dol.georgia.gov/wotc",
    submissionUrl: "https://dol.georgia.gov/wotc/upload",
    authType: "credentials",
    loginFieldSelectors: {
      username: "#login-email",
      password: "#login-password",
      submitButton: "button.btn-primary",
      successIndicator: ".user-dashboard"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "SNAP Benefits",
      "Veteran Status",
      "Phone"
    ],
    dateFormat: "MM-DD-YYYY",
    maxBatchSize: 400,
    submissionFrequency: "weekly",
    automationEnabled: true,
    expectedProcessingDays: 33,
    supportEmail: "wotc@gdol.ga.gov",
    supportPhone: "(404) 232-3500",
    status: "active",
    notes: "Georgia prefers weekly batch submissions. No size limit."
  },
  {
    stateCode: "NC",
    stateName: "North Carolina",
    portalUrl: "https://des.nc.gov/wotc",
    submissionUrl: "https://des.nc.gov/wotc/submit",
    authType: "credentials",
    loginFieldSelectors: {
      username: "input#username",
      password: "input#password",
      submitButton: "#btn-login",
      successIndicator: "#dashboard"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "Address",
      "Phone",
      "Email"
    ],
    dateFormat: "YYYY-MM-DD",
    maxBatchSize: 250,
    submissionFrequency: "weekly",
    automationEnabled: false,
    expectedProcessingDays: 38,
    supportEmail: "wotc@nccommerce.com",
    supportPhone: "(919) 707-1500",
    status: "active",
    notes: "NC requires manual review for veteran claims over $9,000."
  },
  {
    stateCode: "MI",
    stateName: "Michigan",
    portalUrl: "https://www.michigan.gov/leo/wotc",
    submissionUrl: "https://www.michigan.gov/leo/wotc/upload",
    authType: "credentials",
    loginFieldSelectors: {
      username: "input[type='email']",
      password: "input[type='password']",
      submitButton: "button[type='submit']",
      successIndicator: ".welcome-banner"
    },
    requiredColumns: [
      "Employee Last Name",
      "Employee First Name",
      "SSN",
      "Date of Birth",
      "Hire Date",
      "Target Group Code"
    ],
    optionalColumns: [
      "Unemployment Insurance",
      "SNAP Benefits",
      "Veteran Status"
    ],
    dateFormat: "MM/DD/YYYY",
    maxBatchSize: 300,
    submissionFrequency: "weekly",
    automationEnabled: true,
    expectedProcessingDays: 35,
    supportEmail: "LEO-WOTC@michigan.gov",
    supportPhone: "(517) 335-5858",
    status: "active",
    notes: "Michigan portal is optimized for large batch uploads."
  }
];

export const getAllStates = () => [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP"
];
