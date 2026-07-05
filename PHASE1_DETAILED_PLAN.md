# PHASE 1: CRM & SALES - Detailed Implementation Plan

**Timeline:** Week 3-8 (6 weeks)  
**Status:** Ready to Start  
**Repository:** https://github.com/vansh051102/veck

---

## 📋 Executive Summary

Phase 1 builds the complete lead management system with workflow enforcement, SLA tracking, and sales pipeline management. This is the core of VECK's CRM functionality.

**Deliverables:**
- Lead management dashboard
- Workflow state machine (7 stages)
- SLA engine with breach detection
- Activity management (calls, emails, notes, meetings)
- Checklist engine with stage blocking
- Quote generation and tracking
- Timeline/audit view
- 25+ API endpoints
- Complete React components
- Real-time data management

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│           LEADS MANAGEMENT SYSTEM (Phase 1)             │
├─────────────────────────────────────────────────────────┤
│
│  Frontend Layer (React Components)
│  ├─ Dashboard (metrics + filters)
│  ├─ Leads Table (TanStack, virtualization)
│  ├─ Lead Detail View
│  ├─ Activity Forms (call, email, note, meeting)
│  ├─ Quote Builder
│  ├─ Checklist UI
│  └─ Timeline View
│
│  State Management (Zustand)
│  ├─ Leads store (list, filters, pagination)
│  ├─ Lead detail store (single lead + related data)
│  ├─ Activity store
│  ├─ UI store (modals, toasts, sidebar)
│  └─ Form store (for complex forms)
│
│  API Layer (/api/v1/*)
│  ├─ Leads endpoints (CRUD, stage, assign)
│  ├─ Activities endpoints
│  ├─ Quotes endpoints
│  ├─ Checklists endpoints
│  ├─ Timeline endpoints
│  └─ Dashboard metrics
│
│  Business Logic
│  ├─ Workflow state machine
│  ├─ SLA calculation & tracking
│  ├─ Checklist blocking rules
│  ├─ Auto-stage transitions
│  └─ Validation & permissions
│
│  Database (Prisma + PostgreSQL)
│  ├─ Lead model
│  ├─ Contact model
│  ├─ Activity model
│  ├─ Checklist model
│  ├─ Timeline model
│  ├─ Quote model
│  └─ PurchaseRequest model
│
└─────────────────────────────────────────────────────────┘
```

---

## 📅 Week-by-Week Breakdown

### Week 3-4: API Foundation & Core Models

#### Week 3: Leads API & Database

**Goals:**
- Build complete Leads API
- Implement workflow validation
- Setup SLA tracking
- Create lead creation flow

**Tasks:**

1. **Create Leads API Endpoints** (`app/api/v1/leads/`)
   - `POST /api/v1/leads` - Create new lead
   - `GET /api/v1/leads` - List leads with filters
   - `GET /api/v1/leads/dashboard` - Dashboard metrics
   - `GET /api/v1/leads/:id` - Get single lead
   - `PUT /api/v1/leads/:id` - Update lead
   - `PUT /api/v1/leads/:id/stage` - Change stage (with validation)
   - `PUT /api/v1/leads/:id/assign` - Assign to user
   - `DELETE /api/v1/leads/:id` - Soft delete lead

   **File Structure:**
   ```
   app/api/v1/leads/
   ├── route.ts (GET list, POST create)
   ├── [id]/
   │   ├── route.ts (GET, PUT, DELETE)
   │   ├── stage/route.ts (PUT stage change)
   │   ├── assign/route.ts (PUT assign)
   │   └── dashboard/route.ts (GET metrics)
   └── metrics/route.ts (GET dashboard stats)
   ```

2. **Implement Workflow Engine** (`lib/workflow.ts`)
   - Define 7 stage states
   - Set allowed transitions
   - Define required checklists per stage
   - Set SLA hours per stage
   - Create transition validation logic
   - Handle stage change side effects (audit log, timeline event)

   **Code Template:**
   ```typescript
   // lib/workflow.ts
   
   const WORKFLOW_STATES: Record<string, WorkflowState> = {
     'New Lead': {
       name: 'New Lead',
       allowedTransitions: ['Contacted', 'Disqualified'],
       requiredChecklists: ['Initial Qualification'],
       slaHours: 24,
       color: 'blue',
       icon: 'Star'
     },
     'Contacted': {
       name: 'Contacted',
       allowedTransitions: ['Qualified', 'Deal Lost', 'Disqualified'],
       requiredChecklists: [],
       slaHours: 48,
       color: 'yellow',
       icon: 'Phone'
     },
     'Qualified': {
       name: 'Qualified',
       allowedTransitions: ['Quote Sent', 'Deal Lost', 'Disqualified'],
       requiredChecklists: ['Technical Assessment', 'Budget Confirmation'],
       slaHours: 72,
       color: 'orange',
       icon: 'CheckCircle'
     },
     'Quote Sent': {
       name: 'Quote Sent',
       allowedTransitions: ['Closed Won', 'Deal Lost', 'Qualified'],
       requiredChecklists: [],
       slaHours: 96,
       color: 'green',
       icon: 'FileText'
     },
     'Closed Won': {
       name: 'Closed Won',
       allowedTransitions: [],
       requiredChecklists: [],
       slaHours: 0,
       color: 'emerald',
       icon: 'Trophy'
     },
     'Deal Lost': {
       name: 'Deal Lost',
       allowedTransitions: [],
       requiredChecklists: [],
       slaHours: 0,
       color: 'red',
       icon: 'X'
     },
     'Disqualified': {
       name: 'Disqualified',
       allowedTransitions: [],
       requiredChecklists: [],
       slaHours: 0,
       color: 'gray',
       icon: 'Ban'
     }
   }
   
   export async function validateStageTransition(
     leadId: string,
     currentStage: string,
     newStage: string,
     orgId: string
   ): Promise<{
     allowed: boolean
     reason?: string
     blockedChecklists?: string[]
   }> {
     // 1. Check if transition is allowed
     const state = WORKFLOW_STATES[currentStage]
     if (!state.allowedTransitions.includes(newStage)) {
       return {
         allowed: false,
         reason: `Cannot transition from ${currentStage} to ${newStage}`
       }
     }
   
     // 2. Check if all required checklists are completed
     const newState = WORKFLOW_STATES[newStage]
     if (newState.requiredChecklists.length > 0) {
       const incompleteChecklists = await prisma.checklist.findMany({
         where: {
           leadId,
           title: { in: newState.requiredChecklists },
           completedAt: null
         }
       })
   
       if (incompleteChecklists.length > 0) {
         return {
           allowed: false,
           reason: 'Required checklists must be completed',
           blockedChecklists: incompleteChecklists.map(c => c.title)
         }
       }
     }
   
     return { allowed: true }
   }
   
   export function calculateSLADeadline(stage: string, createdAt: Date): Date {
     const state = WORKFLOW_STATES[stage]
     const deadline = new Date(createdAt)
     deadline.setHours(deadline.getHours() + state.slaHours)
     return deadline
   }
   
   export function getTimeUntilSLABreach(slaDeadline: Date): {
     hoursRemaining: number
     breached: boolean
     status: 'safe' | 'warning' | 'critical' | 'breached'
   } {
     const now = new Date()
     const diff = slaDeadline.getTime() - now.getTime()
     const hoursRemaining = Math.round(diff / (1000 * 60 * 60))
   
     if (hoursRemaining < 0) {
       return { hoursRemaining: Math.abs(hoursRemaining), breached: true, status: 'breached' }
     } else if (hoursRemaining < 4) {
       return { hoursRemaining, breached: false, status: 'critical' }
     } else if (hoursRemaining < 12) {
       return { hoursRemaining, breached: false, status: 'warning' }
     }
   
     return { hoursRemaining, breached: false, status: 'safe' }
   }
   ```

3. **Implement SLA Engine** (`lib/sla.ts`)
   - Calculate SLA deadlines on lead creation
   - Check for breaches
   - Update SLA status
   - Generate breach alerts
   - Track response times

   **Code Template:**
   ```typescript
   // lib/sla.ts
   
   export async function updateLeadSLA(leadId: string) {
     const lead = await prisma.lead.findUnique({
       where: { id: leadId }
     })
   
     if (!lead) throw new Error('Lead not found')
   
     const { WORKFLOW_STATES } = await import('./workflow')
     const state = WORKFLOW_STATES[lead.stage]
   
     const slaDeadline = new Date(lead.slaCreatedAt)
     slaDeadline.setHours(slaDeadline.getHours() + state.slaHours)
   
     const now = new Date()
     const breached = now > slaDeadline
   
     await prisma.lead.update({
       where: { id: leadId },
       data: {
         slaDeadline,
         slaBreached: breached,
         lastActivityAt: new Date()
       }
     })
   }
   
   export async function getSLAStatus(lead: Lead) {
     const { getTimeUntilSLABreach } = await import('./workflow')
     return getTimeUntilSLABreach(lead.slaDeadline)
   }
   ```

4. **Create Lead Creation Flow**
   - Validate input (Zod schema)
   - Create contact if new
   - Create lead
   - Calculate SLA deadline
   - Create initial checklist
   - Log audit event
   - Create timeline entry

   **Endpoint Implementation:**
   ```typescript
   // app/api/v1/leads/route.ts
   
   export const POST = withErrorHandler(async (req) => {
     const { orgId, userId } = extractOrgAndUserIds(req.headers) || {}
     if (!orgId || !userId) throw new UnauthorizedError()
   
     const body = await req.json()
     const validation = CreateLeadSchema.safeParse(body)
     if (!validation.success) {
       throw new ValidationError('Invalid input', validation.error.errors)
     }
   
     const { contactId, companyName, priority, notes, source, tags } = validation.data
   
     // 1. Verify contact exists
     const contact = await prisma.contact.findUnique({
       where: { id: contactId }
     })
     if (!contact) throw new NotFoundError('Contact')
   
     // 2. Create lead
     const { WORKFLOW_STATES } = await import('@/lib/workflow')
     const initialStage = 'New Lead'
     const slaDeadline = new Date()
     slaDeadline.setHours(slaDeadline.getHours() + WORKFLOW_STATES[initialStage].slaHours)
   
     const lead = await prisma.lead.create({
       data: {
         orgId,
         contactId,
         companyName,
         stage: initialStage,
         stageChangedAt: new Date(),
         priority,
         notes,
         source,
         tags,
         slaDeadline,
         createdById: userId
       },
       include: { contact: true }
     })
   
     // 3. Create timeline
     await prisma.timeline.create({
       data: {
         leadId: lead.id,
         contactId: contact.id,
         events: {
           create: {
             type: 'lead_created',
             title: 'Lead Created',
             description: `Lead for ${companyName} created`,
             createdBy: userId,
             createdAt: new Date()
           }
         }
       }
     })
   
     // 4. Create initial checklist
     const checklistTitle = WORKFLOW_STATES[initialStage].requiredChecklists[0]
     if (checklistTitle) {
       await prisma.checklist.create({
         data: {
           leadId: lead.id,
           title: checklistTitle,
           isRequired: true,
           items: {
             create: [
               { title: 'Review company details' },
               { title: 'Verify contact information' },
               { title: 'Assess lead quality' }
             ]
           }
         }
       })
     }
   
     // 5. Audit log
     await logAudit(
       orgId,
       userId,
       'created',
       'lead',
       lead.id,
       companyName,
       { new: lead },
       req.headers.get('x-forwarded-for') || ''
     )
   
     return successResponse(lead, { statusCode: 201 })
   })
   ```

#### Week 4: Activities & Timeline API

**Goals:**
- Build Activities API
- Implement Timeline tracking
- Create activity forms
- Add activity validation

**Tasks:**

1. **Activities API Endpoints** (`app/api/v1/leads/[id]/activities/`)
   - `POST /api/v1/leads/:id/activities` - Create activity
   - `GET /api/v1/leads/:id/activities` - List activities
   - `PUT /api/v1/activities/:activityId` - Update activity
   - `DELETE /api/v1/activities/:activityId` - Delete activity

   **File Structure:**
   ```
   app/api/v1/leads/[id]/activities/
   ├── route.ts (GET list, POST create)
   └── [activityId]/
       └── route.ts (PUT, DELETE)
   ```

2. **Timeline API Endpoints** (`app/api/v1/leads/[id]/timeline/`)
   - `GET /api/v1/leads/:id/timeline` - Get timeline events
   - Events auto-created on:
     - Lead created
     - Stage changed
     - Activity added
     - Checklist completed
     - Quote sent
     - Lead assigned

3. **Activity Form Handler** (`lib/activity-handler.ts`)
   - Handle 4 activity types (call, email, note, meeting)
   - Validate metadata per type
   - Create timeline event
   - Update lead lastActivityAt
   - Send notifications if needed

   **Code Template:**
   ```typescript
   // lib/activity-handler.ts
   
   export async function createActivity(
     leadId: string,
     orgId: string,
     userId: string,
     data: CreateActivityInput
   ) {
     const { type, title, description, scheduledFor, duration, metadata } = data
   
     // 1. Validate metadata based on type
     const validationRules: Record<string, any> = {
       call: { phone: 'string', duration: 'number', outcome: 'string' },
       email: { recipient: 'email', subject: 'string', body: 'string' },
       note: { content: 'string', isPrivate: 'boolean' },
       meeting: { attendees: 'array', location: 'string', notes: 'string' }
     }
   
     // 2. Create activity
     const activity = await prisma.activity.create({
       data: {
         leadId,
         orgId,
         type,
         title,
         description,
         scheduledFor,
         duration,
         metadata,
         createdBy: userId
       }
     })
   
     // 3. Update lead's lastActivityAt
     await prisma.lead.update({
       where: { id: leadId },
       data: { lastActivityAt: new Date() }
     })
   
     // 4. Create timeline event
     const lead = await prisma.lead.findUnique({
       where: { id: leadId },
       include: { contact: true }
     })
   
     if (lead) {
       await prisma.timelineEvent.create({
         data: {
           timelineId: lead.timeline?.id || '',
           type: 'activity_added',
           title: `${type.charAt(0).toUpperCase() + type.slice(1)} added`,
           description: title,
           metadata: { activityId: activity.id, activityType: type },
           createdBy: userId
         }
       })
     }
   
     // 5. Log audit
     await logAudit(
       orgId,
       userId,
       'created',
       'activity',
       activity.id,
       title,
       { new: activity }
     )
   
     return activity
   }
   ```

4. **Update Lead on Stage Change**
   - Update SLA deadline
   - Clear previous stage checklists
   - Create new stage checklists
   - Trigger timeline event
   - Log audit event

---

### Week 5: Frontend - Dashboard & Leads List

#### Dashboard Component

**File:** `app/dashboard/page.tsx`

**Features:**
1. **Metrics Cards** (top 4)
   - Total leads (all leads in workspace)
   - Open leads (not assigned)
   - Hot/Urgent leads (needs quick follow-up)
   - Won this month (closed_won status, this month)

   **Component:**
   ```typescript
   // components/leads/MetricsCard.tsx
   
   interface MetricsCardProps {
     title: string
     value: number | string
     icon: React.ReactNode
     trend?: { value: number; direction: 'up' | 'down' }
     color?: 'blue' | 'green' | 'orange' | 'red'
   }
   
   export function MetricsCard({ title, value, icon, trend, color = 'blue' }: MetricsCardProps) {
     return (
       <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-6`}>
         <div className="flex items-center justify-between">
           <div>
             <p className="text-sm font-medium text-gray-600">{title}</p>
             <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
             {trend && (
               <p className={`text-sm mt-2 text-${trend.direction === 'up' ? 'green' : 'red'}-600`}>
                 {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
               </p>
             )}
           </div>
           <div className={`text-${color}-600 text-3xl`}>{icon}</div>
         </div>
       </div>
     )
   }
   ```

2. **Stage Tabs** (horizontal)
   - All, New Lead, Contacted, Qualified, Quote Sent, Closed Won, Deal Lost, Disqualified
   - Show count per stage
   - Active tab highlighted

   **Component:**
   ```typescript
   // components/leads/StageTabs.tsx
   
   interface StageTabsProps {
     stages: Array<{ name: string; count: number; color: string }>
     activeStage: string
     onStageChange: (stage: string) => void
   }
   
   export function StageTabs({ stages, activeStage, onStageChange }: StageTabsProps) {
     return (
       <div className="border-b border-gray-200">
         <nav className="flex space-x-8 px-6">
           {stages.map((stage) => (
             <button
               key={stage.name}
               onClick={() => onStageChange(stage.name)}
               className={`py-4 px-1 border-b-2 font-medium text-sm ${
                 activeStage === stage.name
                   ? `border-${stage.color}-500 text-${stage.color}-600`
                   : 'border-transparent text-gray-500 hover:text-gray-700'
               }`}
             >
               {stage.name}
               <span className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                 {stage.count}
               </span>
             </button>
           ))}
         </nav>
       </div>
     )
   }
   ```

3. **Filter Bar** (below tabs)
   - Search by name/company/email
   - Filter by date range (All time, 7 days, 30 days, 4 months, Custom)
   - Filter by priority (All, Low, Medium, High, Urgent)
   - Filter by assignee (All, Unassigned, specific users)
   - Filter by source (All, Website, LinkedIn, Referral, Email, Other)

   **Component:**
   ```typescript
   // components/leads/FilterBar.tsx
   
   interface FilterBarProps {
     onSearchChange: (search: string) => void
     onDateRangeChange: (range: DateRange) => void
     onPriorityChange: (priority: string[]) => void
     onAssigneeChange: (assignees: string[]) => void
     onSourceChange: (sources: string[]) => void
   }
   
   export function FilterBar({ 
     onSearchChange, 
     onDateRangeChange,
     onPriorityChange,
     onAssigneeChange,
     onSourceChange
   }: FilterBarProps) {
     const [showAdvanced, setShowAdvanced] = useState(false)
   
     return (
       <div className="bg-white p-4 border-b border-gray-200 space-y-4">
         {/* Search Bar */}
         <div className="flex items-center space-x-4">
           <input
             type="text"
             placeholder="Search leads..."
             onChange={(e) => onSearchChange(e.target.value)}
             className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
           />
           
           {/* Quick filters */}
           <select onChange={(e) => onDateRangeChange(e.target.value as any)}>
             <option value="all">All time</option>
             <option value="7days">Last 7 days</option>
             <option value="30days">Last 30 days</option>
             <option value="4months">Last 4 months</option>
             <option value="custom">Custom range</option>
           </select>
           
           <button
             onClick={() => setShowAdvanced(!showAdvanced)}
             className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
           >
             {showAdvanced ? 'Hide' : 'Show'} Filters
           </button>
           
           {/* Bulk actions */}
           <button className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
             Import/Export
           </button>
         </div>
         
         {/* Advanced filters */}
         {showAdvanced && (
           <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
             <MultiSelect
               label="Priority"
               options={['Low', 'Medium', 'High', 'Urgent']}
               onChange={onPriorityChange}
             />
             <MultiSelect
               label="Assigned To"
               options={['Unassigned', 'User1', 'User2']}
               onChange={onAssigneeChange}
             />
             <MultiSelect
               label="Source"
               options={['Website', 'LinkedIn', 'Referral', 'Email']}
               onChange={onSourceChange}
             />
             <DateRangePicker onChange={onDateRangeChange} />
           </div>
         )}
       </div>
     )
   }
   ```

4. **Action Bar** (top right)
   - Search input
   - Import/Export button
   - Assignment Rules button
   - + New Lead button (primary)

#### Leads Table Component

**File:** `components/leads/LeadsTable.tsx`

**Features:**
1. **TanStack Table Implementation**
   - Sortable columns
   - Filterable columns
   - Selectable rows (checkboxes)
   - Pagination (20 per page)
   - Virtual scrolling for performance

   **Code Template:**
   ```typescript
   // components/leads/LeadsTable.tsx
   
   import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table'
   
   export function LeadsTable({ leads, onLeadClick }: LeadsTableProps) {
     const [sorting, setSorting] = useState<SortingState>([])
     const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
     const [selectedRows, setSelectedRows] = useState({})
   
     const columns = [
       {
         id: 'select',
         header: ({ table }) => (
           <input
             type="checkbox"
             checked={table.getIsAllRowsSelected()}
             onChange={table.getToggleAllRowsSelectedHandler()}
           />
         ),
         cell: ({ row }) => (
           <input
             type="checkbox"
             checked={row.getIsSelected()}
             onChange={row.getToggleSelectedHandler()}
           />
         ),
         size: 50
       },
       {
         header: 'Company',
         accessorKey: 'companyName',
         cell: (info) => (
           <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
               {info.row.original.contact.firstName[0]}
             </div>
             <div>
               <p className="font-medium">{info.getValue() as string}</p>
               <p className="text-sm text-gray-500">{info.row.original.contact.email}</p>
             </div>
           </div>
         ),
         size: 250
       },
       {
         header: 'Contact',
         accessorKey: 'contact.fullName',
         cell: (info) => `${info.row.original.contact.firstName} ${info.row.original.contact.lastName}`,
         size: 150
       },
       {
         header: 'Stage',
         accessorKey: 'stage',
         cell: (info) => {
           const stage = info.getValue() as string
           return (
             <select
               value={stage}
               onChange={(e) => handleStageChange(info.row.original.id, e.target.value)}
               className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer`}
               style={{
                 backgroundColor: getStageColor(stage),
                 color: 'white'
               }}
             >
               {LEAD_STAGES.map((s) => (
                 <option key={s} value={s}>{s}</option>
               ))}
             </select>
           )
         },
         size: 120
       },
       {
         header: 'Priority',
         accessorKey: 'priority',
         cell: (info) => {
           const priority = info.getValue() as string
           const colors = {
             'Low': 'bg-blue-100 text-blue-800',
             'Medium': 'bg-yellow-100 text-yellow-800',
             'High': 'bg-orange-100 text-orange-800',
             'Urgent': 'bg-red-100 text-red-800'
           }
           return (
             <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[priority]}`}>
               {priority}
             </span>
           )
         },
         size: 100
       },
       {
         header: 'Assigned To',
         accessorKey: 'assignedTo.fullName',
         cell: (info) => info.getValue() || 'Unassigned',
         size: 120
       },
       {
         header: 'Last Activity',
         accessorKey: 'lastActivityAt',
         cell: (info) => formatRelativeTime(info.getValue() as Date),
         size: 120
       },
       {
         header: 'SLA',
         accessorKey: 'slaDeadline',
         cell: (info) => <SLABadge deadline={info.getValue() as Date} />,
         size: 100
       },
       {
         header: 'Actions',
         cell: (info) => (
           <div className="flex items-center space-x-2">
             <button
               onClick={() => onLeadClick(info.row.original.id)}
               className="p-1 hover:bg-gray-100 rounded"
               title="View details"
             >
               <Eye size={16} />
             </button>
             <button
               onClick={() => handleCreateQuote(info.row.original.id)}
               className="p-1 hover:bg-gray-100 rounded"
               title="Create quote"
             >
               <FileText size={16} />
             </button>
             <DropdownMenu>
               <DropdownMenuTrigger>
                 <MoreVertical size={16} />
               </DropdownMenuTrigger>
               <DropdownMenuContent>
                 <DropdownMenuItem onClick={() => handleCall(info.row.original.id)}>
                   Call
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleEmail(info.row.original.id)}>
                   Email
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleDelete(info.row.original.id)}>
                   Delete
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           </div>
         ),
         size: 100
       }
     ]
   
     const table = useReactTable({
       data: leads,
       columns,
       getCoreRowModel: getCoreRowModel(),
       getSortedRowModel: getSortedRowModel(),
       getFilteredRowModel: getFilteredRowModel(),
       state: { sorting, columnFilters },
       onSortingChange: setSorting,
       onColumnFiltersChange: setColumnFilters
     })
   
     return (
       <div className="bg-white rounded-lg border border-gray-200">
         <table className="w-full">
           <thead>
             {table.getHeaderGroups().map((headerGroup) => (
               <tr key={headerGroup.id} className="border-b border-gray-200">
                 {headerGroup.headers.map((header) => (
                   <th
                     key={header.id}
                     className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                     style={{ width: header.getSize() }}
                   >
                     {header.isPlaceholder ? null : (
                       <div
                         onClick={header.column.getToggleSortingHandler()}
                         className="cursor-pointer select-none"
                       >
                         {flexRender(header.column.columnDef.header, header.getContext())}
                       </div>
                     )}
                   </th>
                 ))}
               </tr>
             ))}
           </thead>
           <tbody>
             {table.getRowModel().rows.map((row) => (
               <tr
                 key={row.id}
                 className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
               >
                 {row.getVisibleCells().map((cell) => (
                   <td key={cell.id} className="px-6 py-4">
                     {flexRender(cell.column.columnDef.cell, cell.getContext())}
                   </td>
                 ))}
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     )
   }
   ```

2. **SLA Indicator Component**
   ```typescript
   // components/leads/SLABadge.tsx
   
   export function SLABadge({ deadline }: { deadline: Date }) {
     const { hoursRemaining, status } = getTimeUntilSLABreach(deadline)
   
     const statusConfig = {
       safe: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓' },
       warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⚠' },
       critical: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '!' },
       breached: { bg: 'bg-red-100', text: 'text-red-800', icon: '✕' }
     }
   
     const config = statusConfig[status]
   
     return (
       <div className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-sm font-medium`}>
         {config.icon} {hoursRemaining}h
       </div>
     )
   }
   ```

3. **Pagination Component**
   - Page number input
   - Previous/Next buttons
   - Items per page selector
   - Total count display

---

### Week 6: Frontend - Lead Detail & Forms

#### Lead Detail View

**File:** `app/leads/[id]/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│  Lead: Company Name | Stage Selector    │
├─────────────┬───────────────────────────┤
│   Sidebar   │      Main Content         │
│  (Timeline) │  ├─ Contact Info          │
│             │  ├─ Activities Form       │
│             │  ├─ Checklists            │
│             │  ├─ Quotes List           │
│             │  ├─ Purchase Requests     │
│             │  └─ Custom Fields         │
└─────────────┴───────────────────────────┘
```

**Components:**

1. **Header** - Lead info + quick actions
   ```typescript
   // components/leads/LeadHeader.tsx
   
   interface LeadHeaderProps {
     lead: Lead & { contact: Contact }
     onAssign: (userId: string) => void
     onStageChange: (stage: string) => void
   }
   
   export function LeadHeader({ lead, onAssign, onStageChange }: LeadHeaderProps) {
     return (
       <div className="bg-white border-b border-gray-200 px-6 py-4">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-bold">{lead.companyName}</h1>
             <p className="text-gray-600">
               {lead.contact.firstName} {lead.contact.lastName} • {lead.contact.email}
             </p>
           </div>
           <div className="flex items-center space-x-4">
             <StageSelector
               currentStage={lead.stage}
               onChange={onStageChange}
             />
             <UserAssigner
               currentAssignee={lead.assignedTo}
               onChange={onAssign}
             />
             <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
               Create Quote
             </button>
           </div>
         </div>
       </div>
     )
   }
   ```

2. **Timeline Sidebar**
   - All events (lead created, stage changed, activity added, etc.)
   - Activity list grouped by date
   - Hover to see details
   - Click to expand

3. **Contact Info Section**
   ```typescript
   // components/leads/ContactInfo.tsx
   
   export function ContactInfo({ lead }: { lead: Lead & { contact: Contact } }) {
     return (
       <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
         <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
         <div className="grid grid-cols-2 gap-6">
           <div>
             <label className="text-sm text-gray-600">Name</label>
             <p className="font-medium">{lead.contact.firstName} {lead.contact.lastName}</p>
           </div>
           <div>
             <label className="text-sm text-gray-600">Company</label>
             <p className="font-medium">{lead.companyName}</p>
           </div>
           <div>
             <label className="text-sm text-gray-600">Email</label>
             <p className="font-medium">{lead.contact.email}</p>
           </div>
           <div>
             <label className="text-sm text-gray-600">Phone</label>
             <p className="font-medium">{lead.contact.phone}</p>
           </div>
           <div>
             <label className="text-sm text-gray-600">Designation</label>
             <p className="font-medium">{lead.contact.designation || '-'}</p>
           </div>
           <div>
             <label className="text-sm text-gray-600">Source</label>
             <p className="font-medium">{lead.source || '-'}</p>
           </div>
         </div>
       </div>
     )
   }
   ```

4. **Activities Section**
   - Add activity button (Call, Email, Note, Meeting)
   - List of recent activities
   - Edit/Delete options
   - Activity-specific forms

   **Activity Forms:**
   ```typescript
   // components/leads/ActivityForms.tsx
   
   // Call Form
   interface CallFormProps {
     leadId: string
     onSubmit: (data: CreateActivityInput) => void
   }
   
   export function CallForm({ leadId, onSubmit }: CallFormProps) {
     const form = useForm<CreateActivityInput>({
       resolver: zodResolver(CreateActivitySchema),
       defaultValues: {
         type: 'call',
         title: '',
         duration: 0,
         metadata: {}
       }
     })
   
     return (
       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
         <input
           {...form.register('title')}
           placeholder="Call topic"
           className="w-full px-4 py-2 border border-gray-300 rounded-lg"
         />
         <input
           {...form.register('duration', { valueAsNumber: true })}
           type="number"
           placeholder="Duration (minutes)"
           className="w-full px-4 py-2 border border-gray-300 rounded-lg"
         />
         <textarea
           {...form.register('description')}
           placeholder="Call notes"
           className="w-full px-4 py-2 border border-gray-300 rounded-lg"
         />
         <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
           Log Call
         </button>
       </form>
     )
   }
   
   // Similar forms for Email, Note, Meeting...
   ```

5. **Checklists Section**
   ```typescript
   // components/leads/ChecklistsSection.tsx
   
   export function ChecklistsSection({ lead }: { lead: Lead }) {
     const [checklists, setChecklists] = useState<Checklist[]>([])
     const [loading, setLoading] = useState(true)
   
     useEffect(() => {
       fetchChecklists()
     }, [lead.id])
   
     const fetchChecklists = async () => {
       const res = await fetch(`/api/v1/leads/${lead.id}/checklists`)
       const data = await res.json()
       setChecklists(data.data)
       setLoading(false)
     }
   
     const toggleItem = async (checklistId: string, itemId: string, completed: boolean) => {
       await fetch(`/api/v1/checklists/${checklistId}/items/${itemId}`, {
         method: 'PUT',
         body: JSON.stringify({ completed: !completed })
       })
       fetchChecklists()
     }
   
     return (
       <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
         <h2 className="text-lg font-semibold mb-4">Checklists</h2>
         {loading ? (
           <div>Loading...</div>
         ) : (
           <div className="space-y-6">
             {checklists.map((checklist) => (
               <div key={checklist.id}>
                 <h3 className="font-medium mb-3">
                   {checklist.title}
                   {checklist.isRequired && <span className="text-red-600 ml-2">*</span>}
                 </h3>
                 <div className="space-y-2">
                   {checklist.items.map((item) => (
                     <label key={item.id} className="flex items-center space-x-3">
                       <input
                         type="checkbox"
                         checked={item.completed}
                         onChange={() => toggleItem(checklist.id, item.id, item.completed)}
                         className="w-4 h-4 rounded"
                       />
                       <span className={item.completed ? 'line-through text-gray-500' : ''}>
                         {item.title}
                       </span>
                     </label>
                   ))}
                 </div>
                 {checklist.isRequired && !checklist.completedAt && (
                   <p className="text-sm text-red-600 mt-2">
                     ⚠️ This checklist must be completed before progressing
                   </p>
                 )}
               </div>
             ))}
           </div>
         )}
       </div>
     )
   }
   ```

6. **Quotes Section**
   - List of quotes with status
   - View/Edit buttons
   - Send quote button
   - Mark as accepted

7. **Purchase Requests Section**
   - List of PRs with status
   - Create new PR button

---

### Week 7: Frontend - Forms & Modals

#### Quote Builder Modal

**File:** `components/leads/QuoteBuilder.tsx`

**Features:**
1. Select products from catalog
2. Add quantity and price
3. Apply discounts
4. Calculate totals
5. Set validity date
6. Add payment terms and notes
7. Preview
8. Send or save as draft

**Code Template:**
```typescript
// components/leads/QuoteBuilder.tsx

interface QuoteBuilderProps {
  leadId: string
  onClose: () => void
  onSave: (quote: CreateQuoteInput) => void
}

export function QuoteBuilder({ leadId, onClose, onSave }: QuoteBuilderProps) {
  const [items, setItems] = useState<QuoteItem[]>([])
  const [totalDiscount, setTotalDiscount] = useState(0)
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  const [notes, setNotes] = useState('')

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  const finalAmount = subtotal - totalDiscount

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Quote</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Products Section */}
          <div>
            <h3 className="font-semibold mb-4">Products</h3>
            <ProductSelector
              onProductAdd={(product) => {
                setItems([...items, { productId: product.id, quantity: 1, price: product.basePrice }])
              }}
            />

            {/* Line Items */}
            <div className="mt-4 space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[idx].quantity = parseInt(e.target.value)
                      setItems(newItems)
                    }}
                    className="w-20 px-2 py-1 border rounded"
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[idx].price = parseFloat(e.target.value)
                      setItems(newItems)
                    }}
                    className="w-20 px-2 py-1 border rounded"
                  />
                  <div className="flex-1">
                    {(item.quantity * item.price).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: 'INR'
                    })}
                  </div>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Section */}
          <div className="bg-gray-50 p-4 rounded space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{subtotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <input
                type="number"
                value={totalDiscount}
                onChange={(e) => setTotalDiscount(parseFloat(e.target.value))}
                className="w-24 px-2 py-1 border rounded text-right"
              />
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Final Amount</span>
              <span>{finalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          </div>

          {/* Validity & Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Valid Until</label>
              <input
                type="date"
                value={validUntil.toISOString().split('T')[0]}
                onChange={(e) => setValidUntil(new Date(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Terms</label>
              <input
                type="text"
                placeholder="e.g., Net 30, 50% upfront"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional terms, conditions, etc."
              rows={4}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button onClick={onClose} className="px-4 py-2 border rounded">
              Cancel
            </button>
            <button
              onClick={() => onSave({ items, finalAmount, validUntil, notes })}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Save Draft
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded">
              Save & Send
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Week 8: Testing, Optimization & Deployment

#### Testing

**Unit Tests** (`tests/unit/`)
- Workflow state machine tests
- SLA calculation tests
- Activity handler tests
- API response formatting

**Example:**
```typescript
// tests/unit/workflow.test.ts

describe('Workflow State Machine', () => {
  it('should allow transition from New Lead to Contacted', async () => {
    const result = await validateStageTransition(
      'lead-123',
      'New Lead',
      'Contacted',
      'org-123'
    )
    expect(result.allowed).toBe(true)
  })

  it('should block invalid transitions', async () => {
    const result = await validateStageTransition(
      'lead-123',
      'New Lead',
      'Closed Won',
      'org-123'
    )
    expect(result.allowed).toBe(false)
  })

  it('should require checklists before Qualified stage', async () => {
    // Create lead and try to move to Qualified without completing checklists
    const result = await validateStageTransition(
      'lead-123',
      'Contacted',
      'Qualified',
      'org-123'
    )
    expect(result.allowed).toBe(false)
    expect(result.blockedChecklists).toContain('Technical Assessment')
  })
})
```

**Integration Tests** (`tests/integration/`)
- Complete lead creation flow
- Stage transition with checklist blocking
- Activity creation and timeline updates
- Quote generation

**E2E Tests** (`tests/e2e/`)
- Create lead from scratch
- Transition through workflow stages
- Add activities and check timeline
- Generate and send quote

#### Optimization

1. **Database Optimization**
   - Run `EXPLAIN ANALYZE` on complex queries
   - Add missing indexes
   - Optimize N+1 queries

2. **Frontend Optimization**
   - Code splitting by route
   - Image lazy loading
   - Memoization of expensive components
   - Virtual scrolling in tables

3. **Caching**
   - Redis for lead list (5-minute TTL)
   - Browser cache for static assets
   - SWR with stale-while-revalidate

#### Deployment

1. **Pre-deployment Checklist**
   - [ ] All tests passing (>90% coverage)
   - [ ] Performance benchmarks met
   - [ ] Documentation updated
   - [ ] API documented (OpenAPI/Swagger)
   - [ ] Staging environment tested
   - [ ] Database migrations tested

2. **Deploy to Vercel**
   ```bash
   # Push to main branch
   git push origin main
   
   # Vercel auto-deploys on push
   # Check deployment at https://veck.vercel.app
   ```

3. **Post-deployment**
   - Monitor error logs
   - Check performance metrics
   - Verify all APIs working
   - Test with real data

---

## 📊 API Endpoints Summary - Phase 1

### Leads Endpoints
```
POST   /api/v1/leads                    - Create lead
GET    /api/v1/leads                    - List leads (with filters, pagination)
GET    /api/v1/leads/dashboard          - Dashboard metrics
GET    /api/v1/leads/:id                - Get single lead
PUT    /api/v1/leads/:id                - Update lead
PUT    /api/v1/leads/:id/stage          - Change stage
PUT    /api/v1/leads/:id/assign         - Assign lead
DELETE /api/v1/leads/:id                - Delete lead (soft)
```

### Activities Endpoints
```
POST   /api/v1/leads/:id/activities     - Create activity
GET    /api/v1/leads/:id/activities     - List activities
PUT    /api/v1/activities/:id           - Update activity
DELETE /api/v1/activities/:id           - Delete activity
```

### Timeline Endpoints
```
GET    /api/v1/leads/:id/timeline       - Get timeline events
```

### Checklists Endpoints
```
POST   /api/v1/leads/:id/checklists     - Create checklist
GET    /api/v1/leads/:id/checklists     - Get checklists
PUT    /api/v1/checklists/:id/items/:itemId - Toggle checklist item
```

### Quotes Endpoints
```
POST   /api/v1/leads/:id/quotes         - Create quote
GET    /api/v1/leads/:id/quotes         - List quotes
PUT    /api/v1/quotes/:id               - Update quote
PUT    /api/v1/quotes/:id/send          - Send quote (email)
PUT    /api/v1/quotes/:id/accept        - Mark as accepted
```

### Purchase Requests Endpoints
```
POST   /api/v1/leads/:id/purchase-requests - Create PR
GET    /api/v1/leads/:id/purchase-requests - List PRs
PUT    /api/v1/purchase-requests/:id       - Update PR status
```

---

## 🎯 Success Criteria - Phase 1

✅ **Backend:**
- All 25+ endpoints fully functional
- Workflow validation working
- SLA tracking accurate
- Audit logging complete
- 90%+ test coverage

✅ **Frontend:**
- Dashboard renders metrics correctly
- Leads table performant (1000+ rows)
- Lead detail view functional
- All forms working
- Real-time data updates

✅ **Integration:**
- Complete lead lifecycle working
- Activities tracked in timeline
- Checklists blocking stage transitions
- Quotes integrating with leads
- Audit trail accurate

✅ **Performance:**
- Dashboard load <2s
- Leads list load <1s
- API response <200ms
- Lead detail load <1.5s

✅ **Documentation:**
- All endpoints documented
- Component storybook created
- Setup guide updated
- API examples provided

---

## 📈 Phase 1 Deliverables Checklist

- [ ] Leads API (8 endpoints)
- [ ] Activities API (4 endpoints)
- [ ] Timeline API (1 endpoint)
- [ ] Checklists API (3 endpoints)
- [ ] Quotes API (5 endpoints)
- [ ] Purchase Requests API (3 endpoints)
- [ ] Workflow state machine
- [ ] SLA engine
- [ ] Dashboard component
- [ ] Leads table component
- [ ] Lead detail view
- [ ] Activity forms (4 types)
- [ ] Checklist UI
- [ ] Quote builder
- [ ] Timeline sidebar
- [ ] Zustand stores (3-4 stores)
- [ ] React hooks (custom hooks)
- [ ] Unit tests (50+)
- [ ] Integration tests (20+)
- [ ] E2E tests (10+)
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment to production

---

## 🚀 Ready to Start?

This detailed plan covers:
- ✅ Complete architecture
- ✅ Week-by-week breakdown
- ✅ Code templates & examples
- ✅ All 25+ API endpoints
- ✅ All React components
- ✅ Testing strategy
- ✅ Deployment process

**Total Effort:** 6 weeks for 1-2 developers

**Next Step:** Start Week 3 with Leads API implementation

---

**Questions?** Check:
- `IMPLEMENTATION_PLAN.md` - 4-phase overview
- `docs/SETUP.md` - Installation & setup
- GitHub Issues - Track progress

Let's build! 🚀
