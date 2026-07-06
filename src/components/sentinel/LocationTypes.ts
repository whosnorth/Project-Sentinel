export type CountryWeight = { code: string; weight: number; name: string };

export type LocationSelection =
  | { type: "global" }
  | { type: "country"; code: string; name: string }
  | { type: "region"; name: string; countries: CountryWeight[] };
export const REGIONS: { name: string; countries: CountryWeight[] }[] = [
  {
    name: "West Africa",
    countries: [
      { code: "NG", name: "Nigeria", weight: 0.7 },
      { code: "GH", name: "Ghana", weight: 0.15 },
      { code: "CI", name: "Côte d'Ivoire", weight: 0.1 },
      { code: "SN", name: "Senegal", weight: 0.05 },
    ],
  },
  {
    name: "East Africa",
    countries: [
      { code: "KE", name: "Kenya", weight: 0.4 },
      { code: "ET", name: "Ethiopia", weight: 0.3 },
      { code: "TZ", name: "Tanzania", weight: 0.2 },
      { code: "UG", name: "Uganda", weight: 0.1 },
    ],
  },
  {
    name: "Middle East",
    countries: [
      { code: "SA", name: "Saudi Arabia", weight: 0.3 },
      { code: "AE", name: "UAE", weight: 0.3 },
      { code: "IL", name: "Israel", weight: 0.2 },
      { code: "IR", name: "Iran", weight: 0.2 },
    ],
  },
  {
    name: "Southeast Asia",
    countries: [
      { code: "ID", name: "Indonesia", weight: 0.3 },
      { code: "VN", name: "Vietnam", weight: 0.2 },
      { code: "TH", name: "Thailand", weight: 0.2 },
      { code: "MY", name: "Malaysia", weight: 0.2 },
      { code: "SG", name: "Singapore", weight: 0.1 },
    ],
  },
  {
    name: "Eastern Europe",
    countries: [
      { code: "UA", name: "Ukraine", weight: 0.5 },
      { code: "PL", name: "Poland", weight: 0.3 },
      { code: "RO", name: "Romania", weight: 0.2 },
    ],
  },
  {
    name: "South America",
    countries: [
      { code: "BR", name: "Brazil", weight: 0.4 },
      { code: "AR", name: "Argentina", weight: 0.3 },
      { code: "CO", name: "Colombia", weight: 0.2 },
      { code: "CL", name: "Chile", weight: 0.1 },
    ],
  },
  {
    name: "Central America",
    countries: [
      { code: "MX", name: "Mexico", weight: 0.5 },
      { code: "GT", name: "Guatemala", weight: 0.2 },
      { code: "HN", name: "Honduras", weight: 0.15 },
      { code: "SV", name: "El Salvador", weight: 0.15 },
    ],
  },
  {
    name: "East Asia",
    countries: [
      { code: "CN", name: "China", weight: 0.5 },
      { code: "JP", name: "Japan", weight: 0.25 },
      { code: "KR", name: "South Korea", weight: 0.15 },
      { code: "TW", name: "Taiwan", weight: 0.1 },
    ],
  },
  {
    name: "South Asia",
    countries: [
      { code: "IN", name: "India", weight: 0.6 },
      { code: "PK", name: "Pakistan", weight: 0.2 },
      { code: "BD", name: "Bangladesh", weight: 0.15 },
      { code: "LK", name: "Sri Lanka", weight: 0.05 },
    ],
  },
  {
    name: "North Africa",
    countries: [
      { code: "EG", name: "Egypt", weight: 0.4 },
      { code: "MA", name: "Morocco", weight: 0.3 },
      { code: "DZ", name: "Algeria", weight: 0.2 },
      { code: "TN", name: "Tunisia", weight: 0.1 },
    ],
  },
  {
    name: "Central Asia",
    countries: [
      { code: "KZ", name: "Kazakhstan", weight: 0.4 },
      { code: "UZ", name: "Uzbekistan", weight: 0.3 },
      { code: "TM", name: "Turkmenistan", weight: 0.15 },
      { code: "KG", name: "Kyrgyzstan", weight: 0.15 },
    ],
  },
  {
    name: "Southern Africa",
    countries: [
      { code: "ZA", name: "South Africa", weight: 0.6 },
      { code: "AO", name: "Angola", weight: 0.2 },
      { code: "MZ", name: "Mozambique", weight: 0.1 },
      { code: "ZW", name: "Zimbabwe", weight: 0.1 },
    ],
  }
];
