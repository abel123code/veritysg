# Jonathan's Real Estate Project — Full Amendment Tracker

---

## 1. Fair Buys Tab

### 1.1 Design & Input Form
- [ ] Sleek, monochrome, McKinsey-style UI
- [ ] User inputs (all required before search):
  - Type of housing (HDB or Condo toggle)
  - No. of Square Feet
  - No. of Bedrooms
  - Offering price (seller/agent's asking price)
  - Location of the property
- [ ] All fields must be filled before the user can generate a search

### 1.2 Deal Meter (Speedometer)
- [ ] Circular speedometer gauge at bottom of page (Bad Deal → Fair Deal → Good Deal → Great Deal)
- [ ] Below the meter: display a message like *"$30,000 over what you should be paying!"*
- [ ] **Meter logic:**
  - Only factor in exact project + exact sqft configuration
  - If fewer than 3 matching transactions → meter does not move; display "Unable to calculate due to insufficient transactions"
  - If 3 or more matching transactions → take the **median** of those transactions
  - Assign Great / Good / Fair / Bad deal rating based on comparison to median
  - Ensure logic is not incongruous (sanity check the output)

### 1.3 Nearby Transactions — HDB (when HDB is selected)
- [ ] Call **HDB Resale Data API** only (NOT private properties API)
- [ ] Use API key/password to avoid rate limits
- [ ] Display in a neat table row:
  - Type of housing (HDB)
  - No. of sqft (convert `floor_area_sqm` → sqft)
  - No. of bedrooms (from `flat_type`)
  - Resale price
  - Remaining lease
  - Location of property
  - Date of transaction

### 1.4 Nearby Transactions — Condo (when Condo is selected)
- [ ] Call **Private Residential Property Transactions API** only (NOT HDB dataset)
- [ ] Use API key/password to avoid rate limits
- [ ] Display in a neat table row:
  - Type of housing (Condo)
  - Location (Project Name & Street Name)
  - No. of sqft (from `area`)
  - Transacted Price
  - Floor range
  - Contract Date
  - Tenure (Freehold or XX yrs lease commencing from XXXX)

### 1.5 Bugs to Fix
- [ ] **Sorting priority broken:** When a specific address is typed (e.g. "469 Segar Rd"), the exact block is not shown first — surrounding properties are prioritised instead
- [ ] **Data integrity issue:** Data displayed is skewed — e.g. a 3-room HDB showing $2.2M price (likely pulling condo data for HDB searches)
- [ ] **HDB data spewing irrelevant listings**
- [ ] **Fair meter not coded yet**

---

## 2. Fair Rents Tab

### 2.1 Design & Input Form
- [ ] Mirror the Fair Buys tab style (monochrome, McKinsey-style)
- [ ] User inputs (all required before search):
  - Type of housing (HDB or Condo toggle)
  - No. of Square Feet
  - No. of Bedrooms
  - Monthly rental offering (what the agent is quoting)
  - Location of the property
- [ ] All fields must be filled before the user can generate a search
- [ ] **CRITICAL:** Only call rental data APIs — NO resale APIs in this tab

### 2.2 Deal Meter (Speedometer)
- [ ] Same circular speedometer as Fair Buys (Bad Deal → Fair Deal → Good Deal → Great Deal)
- [ ] Below the meter: display a message like *"$500 over what you should be paying for rent!"*
- [ ] Same meter logic as Fair Buys (exact project + sqft, minimum 3 transactions, median-based)

### 2.3 Nearby Transactions — HDB (when HDB is selected)
- [ ] Call **HDB Rental Data API** only (NOT private properties rental API)
- [ ] Use API key/password to avoid rate limits
- [ ] Display in a neat table row:
  - Type of housing (HDB — hardcode this, not in API)
  - Location (Street Name) + Block number
  - No. of bedrooms (from `flat_type`)
  - Monthly rental
  - Rent Approval Date

### 2.4 Nearby Transactions — Condo (when Condo is selected)
- [ ] Call **Private Residential Properties Rentals Contract API** only (NOT HDB dataset)
- [ ] Use API key/password to avoid rate limits
- [ ] **Filter out non-condo data** (no detached house, semi-D, etc.) — use `PropertyType` field
- [ ] Display in a neat table row:
  - Type of housing (Condo)
  - Location (Project Name & Street Name)
  - Area in sqft
  - Monthly Rental Price
  - No. of Bedrooms
  - Lease Date

### 2.5 Bugs to Fix
- [ ] **Sorting priority broken:** Same issue as Fair Buys — specific block not shown first
- [ ] **Cannot fetch HDB rental data at all**

---

## 3. Fair Buys / Rents — Shared Sorting Logic

- [ ] Results must follow this priority:
  1. **Exact project / block** that was searched
  2. **Square feet within ±50 sqft** of the user's input
- [ ] Other listings in the same project should be deprioritised (show only if fewer than 5 results match conditions 1 & 2)
- [ ] Other listings for other projects should NOT appear on the first page
- [ ] Price and sqft should feel proportional — don't show a 2000 sqft listing when user searched 500 sqft

---

## 4. Just Looking Around Tab

### 4.1 Bugs to Fix
- [ ] **General vs. specific location recognition:** When a general location like "Jurong" is entered, the tool interprets it as a specific address (e.g. "17A Jurong Gateway"). Needs to distinguish between broad area searches vs. specific address searches
- [ ] **Search autocomplete blocked by map** (Renting & Button)
- [ ] **No limit on displayed transactions** — results can be excessively long
- [ ] **No property type indicator** — user can't tell if a result is HDB or Condo. Add a column on the lefthand side
- [ ] **Specific project not prioritised in results** — hypothesis is results sort by transaction date, not by relevance to the searched property. Refer to Miro for full flow/spec
- [ ] Consider the two main variables:
  - What the user searches (postal code, project, town, landmark, or broader area)
  - What the data offers (too many listings, too few listings, or no listings)

### 4.2 Map Issues
- [ ] **Pin drop shows irrelevant properties** — shows random places far from the pin
- [ ] **Pin drop doesn't show area transactions** — should show transactions within <1km radius of the dropped pin
- [ ] **Need AI-assisted location understanding** — so the map search understands which property/area is being targeted and limits results to a determined radius

---

## 5. Homepage

### 5.1 Hero Section
- [x] **Text not centralised** — opening lines shift around when a new word animates in *(FIXED: Updated GooeyText component to use fixed-width centered container with `whitespace-nowrap`)*
- [x] **Photo not inserted** for the hello/intro page *(FIXED: Added background image support to HeroGreeting with CMS integration)*
- [x] **Text bugs out** when the language changes *(FIXED: Removed `w-max` from text spans, added proper centering)*
- [x] Add ability to insert a **looping video** (properties) via CMS *(FIXED: Added video background support in HeroGreeting + Hero Settings section in Admin CMS)*

### 5.2 Hotspots
- [x] **Hotspots shift position** when screen size changes — not responsive *(FIXED: Updated RoomExperience with resize listener and proper container-relative positioning)*
- [x] Create a **mobile experience CMS** (separate from web CMS) so hotspots display correctly on different screen sizes *(ALREADY EXISTS: Admin.tsx has Desktop/Mobile toggle with separate coordinates)*
- [x] Dev: Duplicate CMS for mobile, allowing portrait uploads *(ALREADY EXISTS: `mobile_image_url` and `mobile_x_percent`/`mobile_y_percent` fields)*
- [ ] Jon: Create mobile assets (portrait uploads) *(User task)*

### 5.3 Design Language
- [ ] **Standardise colour scheme/design** across all features (homepage, guide, tool)
- [ ] **Standardise navigation bar design** across all pages
- [ ] Overall feel is **not very immersive** — UI design needs improvement

---

## 6. Guide Section

- [ ] Data & questions not settled yet

---

## 7. CMS

- [ ] **Tool CMS not present yet** — needs to be built

---

## 8. Data Unification

### 8.1 HDB Data Fields (from data.gov.sg)
| Field | Column Name | Type |
|---|---|---|
| Month | `month` | YYYY-MM |
| Town | `town` | Text |
| Flat Type | `flat_type` | Text |
| Block | `block` | Text |
| Street Name | `street_name` | Text |
| Storey Range | `storey_range` | Text |
| Floor Area Sqm | `floor_area_sqm` | Text |
| Flat Model | `flat_model` | Text |
| Lease Commence Date | `lease_commence_date` | Text |
| Remaining Lease | `remaining_lease` | Text |

### 8.2 Private Property Data Fields (URA)
| Field | Example |
|---|---|
| Project Name | PADDY GREEN |
| Transacted Price ($) | 1,358,000 |
| Area (SQFT) | 1,420.85 |
| Unit Price ($ PSF) | 956 |
| Sale Date | May-22 |
| Street Name | LORONG 12 GEYLANG |
| Type of Sale | Resale |

### 8.3 Goal
- [ ] Create a **unified table** that combines both HDB and private property data
- [ ] Determine which fields can be presented from BOTH datasets
- [ ] Build a suitable prompt/logic to merge them in the display layer

---

## 9. Other Features & Misc

- [ ] **Differentiate HDB vs Condo vs Landed** in the results table
- [ ] **User authentication** — allow users to save searches
- [ ] Continue finding and logging more bugs
- [ ] Fix redundant surrounding-property data appearing before the specifically searched property

---

## API Confirmation Checklist

| Tab | API Required | Confirm Correct? |
|---|---|---|
| Fair Buys — HDB | HDB Resale Data API | [ ] |
| Fair Buys — Condo | Private Properties Resale Data API | [ ] |
| Fair Rents — HDB | HDB Rental Data API | [ ] |
| Fair Rents — Condo | Private Non-Landed Residential Properties Rentals Contract API | [ ] |
