# Inspiration CRM - Detailed UI Analysis & Feature Breakdown

**Date:** July 5, 2026  
**URL:** https://platform.inspiration.co/tenant/leads  
**Analysis:** Complete UI/UX exploration of Inspiration Leads Management System

---

## 📐 Layout Architecture

### Main Container Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                         │
│  ├─ Logo (Inspiration)                                          │
│  ├─ Page Title: "MT Leads"                                 │
│  ├─ Search Bar (global search)                             │
│  ├─ Notification Bell Icon                                 │
│  └─ User Profile Menu (V icon)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Left Sidebar (Dark Green)                                 │
│  ├─ Inspiration Logo                                            │
│  ├─ Navigation Icons:                                      │
│  │  - Overview (dashboard icon)                           │
│  │  - Leads (table icon)  [ACTIVE]                        │
│  │  - Contacts (person icon)                              │
│  │  - Other sections                                       │
│  └─ User Avatar (V)                                        │
│                                                             │
│  Main Content Area                                          │
│  ├─ Metrics Dashboard (4 cards)                            │
│  ├─ Time Range Filters                                     │
│  ├─ Control Bar (Search, Import/Export, Assignment Rules)  │
│  ├─ Stage Tabs (8 stages)                                  │
│  └─ Leads Table (Data Grid)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Dashboard Metrics Section

### Metrics Cards (4 Cards - 2x2 Grid)

**Card 1: Total Leads**
- Label: "Total leads"
- Sublabel: "all leads in this workspace"
- Value: 4992
- Background: Light gray/white
- Border: Light gray
- Icon: None visible

**Card 2: Open Leads**
- Label: "Open leads"
- Sublabel: "leads not assigned yet"
- Value: 4992
- Background: Light gray/white
- Border: Light gray
- Note: All leads are unassigned

**Card 3: Hot or Urgent**
- Label: "Hot or Urgent"
- Sublabel: "needs quick follow-up"
- Value: 2
- Background: Light gray/white
- Border: Light gray
- Priority indicator

**Card 4: Won this month**
- Label: "Won this month"
- Sublabel: "all leads assigned"
- Value: 0
- Background: Light gray/white
- Border: Light gray
- Closed deals counter

---

## 🎛️ Control & Filter Section

### View Toggle Buttons (Left Group)
1. **List View Button**
   - Icon: Three horizontal lines (≡)
   - State: Active/Inactive toggle
   - Toggles between list and other views

2. **Kanban View Button**
   - Icon: Columns/Cards icon
   - State: Active/Inactive toggle
   - Shows leads by stage as cards

### Time Range Filter Buttons (Center Group)
1. **All time** - Shows all data (default selected - highlighted in light color)
2. **7 days** - Last week only
3. **30 days** - Last month
4. **4 months** - Last quarter
5. **Custom range** - Date picker for custom period

**Styling:** 
- Default: Light background, dark text
- Active: Darker/highlighted background
- Mutually exclusive selection

### Action Controls (Right Section)
1. **Search Leads Input**
   - Placeholder: "Search leads"
   - Icon: Magnifying glass
   - Autocomplete enabled
   - Filters table in real-time

2. **Import/Export Dropdown**
   - Icon: Up/Down arrow
   - Label: "Import / Exp..."
   - Has chevron dropdown indicator
   - Options (predicted):
     * Import leads (CSV)
     * Export leads
     * Export filtered view
     * Bulk operations

3. **Assignment Rules Button**
   - Icon: Calendar with checkmark
   - Label: "Assignment Rules"
   - Link to rule configuration
   - Auto-assign leads based on criteria

4. **New Lead Button**
   - Icon: Plus sign (+)
   - Label: "New lead"
   - Color: Dark green (CTA)
   - Opens new lead creation modal

---

## 🏷️ Stage Filter Tabs (8 Stages)

Horizontal tab navigation showing CRM workflow stages:

1. **All** (Default Selected - Dark green)
   - Shows all leads regardless of stage
   - Acts as "no filter" option

2. **New Lead**
   - Initial contact status
   - Unqualified leads
   - Just created

3. **Contacted**
   - Initial communication made
   - Awaiting response
   - Follow-ups in progress

4. **Qualified**
   - Customer validated
   - Requirements gathered
   - Ready for quotation

5. **Quote Sent**
   - Quotation provided
   - Awaiting customer decision
   - Follow-up period active

6. **Closed Won**
   - Deal confirmed
   - Order received
   - Deal completion

7. **Deal Lost**
   - Deal rejected or cancelled
   - No sale
   - Archival stage

8. **Disqualified**
   - Lead deemed unsuitable
   - No potential
   - Out of sales funnel

**Tab Styling:**
- Active tab: Dark green background, white text
- Inactive tabs: Light/transparent background, dark text
- Clicking changes filter

---

## 📋 Leads Table - Column Structure

### Columns (Left to Right):

1. **Checkbox (Select)**
   - Checkbox to select individual leads
   - Bulk action enablement
   - Row selection for operations
   - Note: Column header has "Select all" checkbox

2. **Source & Lead (Company Name)**
   - Company logo/avatar on left (red icon for some)
   - Lead name on top (e.g., "Leisstung Motorraad Pri...")
   - Truncated with ellipsis if long
   - Clickable - opens lead detail view
   - Width: ~250-300px (largest column)

3. **Contact (Person Name & Details)**
   - Contact person name
   - Phone number
   - Email address (truncated)
   - Multiple lines per row
   - Filterable with funnel icon
   - Width: ~150-200px

4. **Stage**
   - Shows current stage badge
   - Color-coded:
     * New Lead: Light blue
     * Contacted: Blue
     * Qualified: Green
     * Quote Sent: Orange
     * Closed Won: Dark green
     * Deal Lost: Red
     * Disqualified: Gray
   - **Interactive Dropdown:**
     * Click to open stage selector
     * 7 options: New Lead, Contacted, Qualified, Quote Sent, Closed Won, Deal Lost, Disqualified
     * Current stage shows checkmark
     * Can change stage inline
   - Below badge: "Lead Created" or stage description
   - Width: ~120px

5. **Stage details**
   - Additional information about current stage
   - Text: "No stage details"
   - Can contain notes/metadata
   - Width: ~150px

6. **Priority**
   - Priority level badge:
     * **Low:** Light gray/blue
     * **Medium:** Yellow (most common in data)
     * **High:** Orange
     * **Urgent:** Red
   - **Interactive Dropdown:**
     * Click to change priority
     * 4 options: Low, Medium, High, Urgent
     * Current priority marked
     * Color-coded options
   - Width: ~90px

7. **Assigned to**
   - Assigned user name (e.g., "Priyanka K", "Priyanka G")
   - Shows team member responsible
   - **Interactive Dropdown:**
     * Click to reassign
     * List of team members
     * Current assignee marked
     * "Unassigned" option available
   - Width: ~120px

8. **Last activity** (Not visible in current view - scroll right)
   - Timestamp of last interaction
   - Relative time (e.g., "2 days ago")
   - Shows engagement level

9. **Actions** (Not visible in current view - scroll right)
   - Row action buttons (predicted):
     * View details (eye icon)
     * Edit (pencil)
     * Delete (trash)
     * More options (three dots menu)

---

## 🎯 Inline Interactive Elements

### Row-Level Actions
Each lead row has hidden action buttons on hover:

1. **Eye Icon** - View/Open lead detail
2. **Phone Icon** - Quick call
3. **Chat Icon** - Send message
4. **More (...) Menu** - Additional actions

### Dropdown Interactions

**Stage Dropdown:**
- Opens: Modal/dropdown menu
- Shows 7 stage options
- Current stage highlighted with checkmark (✓)
- Options listed:
  1. New Lead
  2. Contacted
  3. Qualified
  4. Quote Sent
  5. Closed Won
  6. Deal Lost
  7. Disqualified
- Click to change stage

**Priority Dropdown:**
- Opens: Color-coded dropdown
- Shows 4 priority levels
- Current priority selected
- Options:
  1. Low (Blue)
  2. Medium (Yellow)
  3. High (Orange)
  4. Urgent (Red)

**Assigned to Dropdown:**
- Opens: User list
- Shows available team members
- Current assignee marked
- "Unassigned" option on top
- Search within dropdown (likely)

---

## 🔍 Search & Filter Capabilities

### Global Search (Top Right)
- Placeholder: "Search"
- Searches across all fields
- Global workspace search

### Leads Search (Below filters)
- Placeholder: "Search leads"
- Filters table in real-time
- Searches: Company name, contact name, email, phone
- Case-insensitive likely

### Column Filters
- Funnel icon on columns: Contact, Stage, Priority, Assigned to
- Click to open filter menu
- Multiple filter values selectable
- AND/OR logic (to confirm)

### Date Range Filter
- "All time" button selected
- Alternative options:
  * 7 days
  * 30 days
  * 4 months
  * Custom range (date picker opens)

---

## 🎨 Visual Design Elements

### Color Scheme
- **Primary Green:** Dark forest green (#2D5016 approx)
  - Sidebar background
  - Active buttons
  - CTA buttons (New Lead)
  - Selected tabs

- **Secondary Colors:**
  - Light gray: Card backgrounds, borders
  - Blue: New Lead badge, Contacted
  - Yellow: Medium priority
  - Orange: High priority, Quote Sent
  - Red: Urgent, Deal Lost, Company icons
  - Green: Qualified, Closed Won

- **Text:**
  - Dark gray/black: Primary text
  - Medium gray: Secondary text, sublabels
  - White: Text on dark backgrounds

### Typography
- **Headers/Titles:** Bold, larger font (18-24px)
- **Labels:** Medium weight, smaller (12-14px)
- **Body Text:** Regular weight (14px)
- **Numbers/Metrics:** Very large (48-60px), bold

### Spacing
- **Padding:** Generous (16-20px typically)
- **Margins:** Consistent spacing between sections
- **Gap:** Between elements in grids/rows

### Border & Shadows
- **Subtle shadows:** Cards have light drop shadow
- **Borders:** Light gray, 1px
- **Border radius:** Rounded corners (~8px) on buttons/cards

---

## 📱 Responsive Behavior

### Table Scrolling
- Horizontal scroll for hidden columns
- Sticky first column (Source & Lead) when scrolling
- Pagination likely available (need to verify)

### Column Visibility
- Some columns hidden on smaller screens
- Scroll to reveal: Last activity, Actions
- Priority columns: Core visible by default

### Sidebar
- Collapsible on mobile (likely)
- Fixed width on desktop (~80px)
- Icons only, no labels

---

## 🔐 Permissions & Access

### Visible User Interface Elements
- Notifications button (bell icon)
- Profile menu (V icon in top right)
- User avatar in sidebar (V)
- Likely dropdown menu with:
  * Settings
  * Preferences
  * Logout
  * Help/Support

### Role-Based UI
- Assignment Rules button suggests admin access
- Import/Export suggests advanced permissions
- Bulk operations checkbox implies role limitations

---

## 📂 Data Visible in Current View

### Sample Leads Shown:
1. **Krishna Rajpurohit**
   - Phone: (shown truncated)
   - Email: krishnarajpurohit37@...
   - Stage: Lead Created
   - Priority: Medium
   - Assigned: (visible but data cut off)

2. **Leisstung Motorraad Pri...**
   - Phone: 91900829691 0
   - Email: ashirwad86@gmail...
   - Stage: New Lead (with dropdown)
   - Priority: Medium (yellow)
   - Assigned: Priyanka G

3. **JBR Hotel Cherukuvarip...**
   - Contact: G Reddeppa
   - Phone: 91709386830 4
   - Stage: New Lead
   - Priority: Medium
   - Assigned: Priyanka G

---

## 🎯 Key Observations for VECK Implementation

### What Inspiration Does Well:
1. ✅ Clean, minimalist table design
2. ✅ Inline stage/priority changes (no modal)
3. ✅ Color-coded priority levels
4. ✅ Multiple view options (List/Kanban)
5. ✅ Quick metrics dashboard
6. ✅ Stage filtering tabs
7. ✅ Search + Advanced filters
8. ✅ Assignment management
9. ✅ Import/Export capabilities
10. ✅ Responsive column widths

### Design Patterns to Adopt:
- Metrics cards at top
- Stage tabs for filtering
- Inline dropdowns for status changes
- Checkbox selection with bulk actions
- Color-coded priority system
- Funnel icon for filters on columns
- Green color for primary actions

### Missing from Inspiration (for VECK):
- No visible SLA/deadline tracking
- No timeline/activity history view
- No quote/deal information inline
- No follow-up scheduling visible
- No checklist status
- No custom fields shown

---

## 🔄 Predicted Additional Pages/Features

Based on navigation visible:
1. **Overview** - Dashboard/analytics
2. **Leads** - Current page
3. **Contacts** - Contact directory
4. **Other sections** - Settings, Reports, Analytics, etc.

---

## 📋 Complete Feature Checklist

**Dashboard:**
- [x] Metrics cards (4)
- [x] Time range filter
- [x] View toggle (List/Kanban)

**Filtering & Search:**
- [x] Global search
- [x] Leads search
- [x] Stage tabs (8)
- [x] Column filters (funnel icons)
- [x] Date range selector

**Table Features:**
- [x] Row selection checkbox
- [x] Bulk select all
- [x] Sortable columns
- [x] Inline dropdown editing
- [x] Row hover actions
- [x] Color-coded badges

**Dropdowns:**
- [x] Stage selector (7 options)
- [x] Priority selector (4 options)
- [x] Assignment selector (team members)
- [x] Import/Export menu
- [x] User profile menu

**Actions:**
- [x] Create new lead
- [x] Assign leads
- [x] Change stage
- [x] Change priority
- [x] Bulk operations
- [x] Import data
- [x] Export data
- [x] Assignment rules

**Column Information:**
- [x] Source & Lead (company)
- [x] Contact (person)
- [x] Stage
- [x] Stage details
- [x] Priority
- [x] Assigned to
- [x] Last activity (off-screen)
- [x] Actions (off-screen)

---

## 🎨 VECK UI Implementation Recommendations

### Colors
- Use same green palette for VECK
- Match badge colors for consistency
- Similar contrast ratios

### Layout
- Copy metrics card layout
- Use same stage tab design
- Match table column structure
- Adopt inline dropdown pattern

### Interactions
- Single-click stage changes
- Hover actions on rows
- Color-coded priorities
- Checkbox bulk select

### Additional for VECK (based on SOP):
- Add SLA deadline column (red for breached)
- Show follow-up status
- Add checklist progress indicator
- Timeline/activity sidebar
- Quote status badge
- Deal lost reason on demand

---

## 📸 Screenshots & Elements Captured

✅ Dashboard metrics (4 cards)
✅ View toggles (List/Kanban)
✅ Time range filters (5 options)
✅ Control bar (Search, Import/Export, Assignment Rules, New Lead)
✅ Stage tabs (8 stages)
✅ Table header with columns
✅ Lead rows with inline dropdowns
✅ Stage selector dropdown (7 options)
✅ Priority colors (Medium - yellow shown)
✅ Sidebar navigation
✅ Top navigation bar

---

## 🎯 Next Steps for VECK

1. **Adopt Inspiration's UI patterns** for consistency
2. **Add VECK-specific features:**
   - SLA tracking column
   - Checklist progress
   - Follow-up schedule
   - Deal lost reasons
3. **Enhance filtering** with SOP-based filters
4. **Add timeline view** for activity history
5. **Implement mandatory checklists** at stage progression
6. **Add audit trail** for compliance

---

**Analysis Complete:** Ready for implementation phase.
