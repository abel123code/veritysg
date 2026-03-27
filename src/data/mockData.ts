// Mock Singapore property transaction data — ready to swap with URA/HDB API responses

export interface Transaction {
  project: string;
  address: string;
  unitType: string;
  areaSqft: number;
  floor: string;
  price: number;
  pricePsf: number;
  date: string;
  propertyType: "HDB" | "Private";
}

export interface UraTransaction {
  project: string;
  street: string;
  propertyType: string;
  areaSqft: number;
  floorRange: string;
  price: number;
  pricePsf: number;
  typeOfSale: string;
  contractDate: string;
  tenure: string;
  district: string;
  noOfUnits: string;
  source?: "HDB" | "Private";
}

export interface RentalListing {
  project: string;
  address: string;
  unitType: string;
  areaSqft: number;
  rent: number;
  rentPsf: number;
  date: string;
  propertyType: "HDB" | "Private";
}

export interface SavedSearch {
  id: string;
  title: string;
  subtitle: string;
  newCount: number;
}

export const mockTransactions: Transaction[] = [
  { project: "The Pinnacle @ Duxton", address: "1G Cantonment Rd", unitType: "4-Room", areaSqft: 1076, floor: "26-30", price: 1080000, pricePsf: 1004, date: "2025-12", propertyType: "HDB" },
  { project: "The Pinnacle @ Duxton", address: "1G Cantonment Rd", unitType: "5-Room", areaSqft: 1292, floor: "41-45", price: 1418000, pricePsf: 1098, date: "2025-11", propertyType: "HDB" },
  { project: "SkyVille @ Dawson", address: "86 Dawson Rd", unitType: "4-Room", areaSqft: 990, floor: "31-35", price: 880000, pricePsf: 889, date: "2025-12", propertyType: "HDB" },
  { project: "SkyVille @ Dawson", address: "86 Dawson Rd", unitType: "3-Room", areaSqft: 732, floor: "16-20", price: 620000, pricePsf: 847, date: "2025-10", propertyType: "HDB" },
  { project: "Dawson Vista", address: "82 Dawson Rd", unitType: "4-Room", areaSqft: 969, floor: "21-25", price: 790000, pricePsf: 815, date: "2025-09", propertyType: "HDB" },
  { project: "Rivière", address: "1 Jiak Kim St", unitType: "2-BR", areaSqft: 764, floor: "18", price: 2150000, pricePsf: 2814, date: "2025-12", propertyType: "Private" },
  { project: "Rivière", address: "1 Jiak Kim St", unitType: "3-BR", areaSqft: 1184, floor: "25", price: 3680000, pricePsf: 3108, date: "2025-11", propertyType: "Private" },
  { project: "One Pearl Bank", address: "1 Pearl Bank", unitType: "2-BR", areaSqft: 700, floor: "32", price: 1780000, pricePsf: 2543, date: "2025-10", propertyType: "Private" },
  { project: "The Landmark", address: "173 Chin Swee Rd", unitType: "1-BR", areaSqft: 495, floor: "15", price: 1320000, pricePsf: 2667, date: "2025-12", propertyType: "Private" },
  { project: "Avenue South Residence", address: "1 Silat Ave", unitType: "2-BR", areaSqft: 657, floor: "22", price: 1560000, pricePsf: 2374, date: "2025-11", propertyType: "Private" },
];

export const mockNearbyProjects = [
  { project: "SkyVille @ Dawson", avgPsf: 889, transactions: 12, distance: "0.3 km" },
  { project: "Dawson Vista", avgPsf: 815, transactions: 8, distance: "0.5 km" },
  { project: "SkyTerrace @ Dawson", avgPsf: 842, transactions: 15, distance: "0.6 km" },
  { project: "One Pearl Bank", avgPsf: 2543, transactions: 6, distance: "0.8 km" },
  { project: "Avenue South Residence", avgPsf: 2374, transactions: 9, distance: "1.1 km" },
];

export const mockRentals: RentalListing[] = [
  { project: "The Pinnacle @ Duxton", address: "1G Cantonment Rd", unitType: "4-Room", areaSqft: 1076, rent: 3800, rentPsf: 3.53, date: "2025-12", propertyType: "HDB" },
  { project: "SkyVille @ Dawson", address: "86 Dawson Rd", unitType: "4-Room", areaSqft: 990, rent: 3200, rentPsf: 3.23, date: "2025-11", propertyType: "HDB" },
  { project: "Dawson Vista", address: "82 Dawson Rd", unitType: "3-Room", areaSqft: 732, rent: 2600, rentPsf: 3.55, date: "2025-12", propertyType: "HDB" },
  { project: "Rivière", address: "1 Jiak Kim St", unitType: "2-BR", areaSqft: 764, rent: 5800, rentPsf: 7.59, date: "2025-12", propertyType: "Private" },
  { project: "One Pearl Bank", address: "1 Pearl Bank", unitType: "2-BR", areaSqft: 700, rent: 4900, rentPsf: 7.00, date: "2025-11", propertyType: "Private" },
  { project: "The Landmark", address: "173 Chin Swee Rd", unitType: "1-BR", areaSqft: 495, rent: 3600, rentPsf: 7.27, date: "2025-10", propertyType: "Private" },
];

export const mockNearbyRentals = [
  { project: "SkyVille @ Dawson", avgRent: 3200, listings: 5, distance: "0.3 km" },
  { project: "Dawson Vista", avgRent: 2800, listings: 3, distance: "0.5 km" },
  { project: "Rivière", avgRent: 5800, listings: 4, distance: "0.8 km" },
  { project: "One Pearl Bank", avgRent: 4900, listings: 6, distance: "1.0 km" },
];

export const mockSavedBuySearches: SavedSearch[] = [
  { id: "1", title: "Pinnacle @ Duxton", subtitle: "4-Room · Bukit Merah", newCount: 3 },
  { id: "2", title: "One Pearl Bank", subtitle: "2-BR · Outram", newCount: 1 },
];

export const mockSavedRentSearches: SavedSearch[] = [
  { id: "1", title: "Rivière", subtitle: "2-BR · Robertson Quay", newCount: 2 },
  { id: "2", title: "SkyVille @ Dawson", subtitle: "4-Room · Queenstown", newCount: 0 },
];
