

## Add URA Private Rental Contract Data to Fair Rents

### Summary
Add a new edge function to fetch private residential rental contracts from URA's `PMI_Resi_Rental` API. The Fair Rents page will call both the existing HDB search and this new URA rental search in parallel, then display results in two separate tables (or clearly labeled sections).

### How the URA Rental Contract API Works
- **Endpoint**: `GET https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=PMI_Resi_Rental&refPeriod=25q1`
- **Auth**: Same as existing `ura-transactions` — `AccessKey` + daily `Token` headers (using existing `URA_ACCESS_KEY` secret)
- **Data**: Returns projects with arrays of rental contracts containing `rent`, `areaSqft`, `areaSqm`, `propertyType`, `noOfBedRoom`, `leaseDate`, `district`
- **Batching**: Data is queried by quarter (`refPeriod=YYqN`). To get the past 12 months, we fetch the last 4-5 quarters
- **Coordinates**: SVY21 format (same as existing ura-transactions function — reuse the conversion logic)

### Changes

**1. New edge function: `supabase/functions/ura-rentals/index.ts`**
- Reuse the token auth logic and SVY21 conversion from `ura-transactions`
- Accept `{ location, lat, lng }` (same contract as search-rentals)
- Compute the last 4 quarters (e.g. `24q2`, `24q3`, `24q4`, `25q1`)
- Fetch all 4 quarters in parallel from `PMI_Resi_Rental`
- Filter by text match (project/street name) and/or proximity (SVY21 distance within 800m)
- Filter by lease date within last 12 months
- Map to a result shape: `{ project, street, propertyType, rent, areaSqft, noOfBedRoom, leaseDate, district }`
- Sort by leaseDate descending

**2. Update `src/pages/FairRents.tsx`**
- On search, fire both `search-rentals` (HDB) and `ura-rentals` (private) in parallel
- Display two result sections: "HDB Rentals" and "Private Rentals"
- The private rentals table shows: Project, Street, Type, Bedrooms, Area, Rent/mth, Lease Date
- Each section has its own loading state and attribution text
- HDB attribution: "Data from HDB rental transactions. Source: data.gov.sg"
- Private attribution: "Data from URA rental contracts. Source: URA"

**3. No new secrets needed** — the existing `URA_ACCESS_KEY` is already configured and used by `ura-transactions`

### Files Changed
1. `supabase/functions/ura-rentals/index.ts` — new edge function
2. `src/pages/FairRents.tsx` — parallel search, dual result tables

