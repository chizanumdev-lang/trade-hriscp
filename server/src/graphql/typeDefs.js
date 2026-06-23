export const typeDefs = `#graphql
  scalar JSON

  type User {
    id: ID!
    email: String!
    role: String!
    organizationId: String!
    employeeId: String
    employee: Employee
    isOrgOwner: Boolean
    lastLogin: String
    avatarUrl: String
    mustCompleteProfile: Boolean
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type PromotionRequest {
    id: ID!
    employeeId: String!
    employee: Employee!
    requestedById: String!
    requestedBy: User!
    newJobTitle: String
    newDepartmentId: String
    newEmployeeClass: String
    newEmployeeGrade: String
    isHeadOfDepartment: Boolean!
    status: String!
    isExecuted: Boolean!
    effectiveDate: String!
    createdAt: String!
    updatedAt: String!
    approvals: [ApprovalRecord!]
  }

  type PromotionBenefitsPreview {
    oldSalary: Float
    newSalary: Float
    oldLeaveDays: Float
    newLeaveDays: Float
    oldHmoPlan: String
    newHmoPlan: String
  }

  type PromotionHistory {
    id: ID!
    employeeId: String!
    previousTitle: String
    newTitle: String
    previousGrade: String
    newGrade: String
    effectiveDate: String!
    approvedBy: String
    createdAt: String!
  }

  type EmployeeStatusHistory {
    id: ID!
    employeeId: String!
    previousStatus: String!
    newStatus: String!
    changedBy: String
    reason: String
    createdAt: String!
  }

  type CompensationBand {
    id: ID!
    organizationId: String!
    grade: String!
    minSalary: Float!
    maxSalary: Float!
    hmoPlan: String!
    annualLeaveDays: Float!
  }

  type Organization {
    id: ID!
    name: String!
    country: String
    subscriptionPlan: String
    subscriptionStatus: String
    featuresEnabled: JSON
    paymentSplit: JSON
    statutoryConfig: JSON
  }

  type Employee {
    id: ID!
    employeeCode: String!
    fullName: String!
    email: String!
    privateEmail: String
    phone: String
    dateOfBirth: String
    gender: String
    maritalStatus: String
    nationality: String
    nationalId: String
    passportNumber: String
    jobTitle: String!
    departmentId: String
    bankName: String
    bankAccountNumber: String
    pensionId: String
    employeeClass: String
    employeeGrade: String
    department: Department
    employmentStatus: String!
    employmentType: String
    hireDate: String!
    probationStartDate: String
    probationEndDate: String
    basicSalary: Float
    hmoPlan: String
    hmoProvider: String
    pensionAdministrator: String
    allowances: String
    onboardingStatus: String
    onboardingProgress: Int
    managerId: String
    manager: Employee
    promotionHistory: [PromotionHistory]
    statusHistory: [EmployeeStatusHistory]
    suspensions: [Suspension!]
    paymentSplit: JSON
  }

  type Department {
    id: ID!
    name: String!
    code: String
    status: String!
    headEmployeeId: String
    employees: [Employee]
    loans: [Loan]
    paymentSplit: JSON
  }

  type Shift {
    id: ID!
    name: String!
    startTime: String!
    endTime: String!
    breakMinutes: Int!
    isActive: Boolean!
  }

  type Suspension {
    id: ID!
    employeeId: String!
    employee: Employee!
    startDate: String!
    endDate: String!
    reason: String!
    approvedBy: String
    status: String!
    createdAt: String!
    updatedAt: String!
    approvals: [ApprovalRecord!]
  }

  type ApprovalWorkflowStep {
    order: Int!
    role: String!
  }

  type ApprovalWorkflow {
    id: ID!
    name: String!
    entityType: String!
    steps: String! # Will return JSON string
    isActive: Boolean!
  }

  type LeaveType {
    id: ID!
    name: String!
    daysPerYear: Int!
    isPaid: Boolean!
    requiresApproval: Boolean!
    eligibleAfterDays: Int
    applicableTo: JSON
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type LeaveBalance {
    id: ID!
    employeeId: String!
    leaveTypeId: String!
    year: Int!
    totalEntitled: Float!
    used: Float!
    pending: Float!
    available: Float!
    carriedForward: Float!
    expired: Float!
    accrualRunAt: String
    leaveType: LeaveType
  }

  type PublicHoliday {
    id: ID!
    organizationId: String!
    name: String!
    date: String!
    isRecurring: Boolean!
  }

  input PublicHolidayInput {
    name: String!
    date: String!
    isRecurring: Boolean
  }

  type LeaveRequest {
    id: ID!
    employeeId: String!
    leaveTypeId: String!
    startDate: String!
    endDate: String!
    selectedDates: [String!]
    totalDays: Float!
    isHalfDay: Boolean!
    status: String!
    reason: String
    attachmentUrl: String
    createdAt: String!
    employee: Employee
    leaveType: LeaveType
  }

  type LeavePlan {
    id: ID!
    employeeId: String!
    employee: Employee
    year: Int!
    plannedDates: [String!]!
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  type Attendance {
    id: ID!
    employeeId: String!
    date: String!
    clockIn: String
    clockOut: String
    status: String!
  }

  type Document {
    id: ID!
    employeeId: String!
    name: String!
    category: String!
    fileUrl: String!
    fileType: String!
    fileSize: Int
    currentVersion: Int!
    visibilityLevel: String!
    status: String!
    uploadedBy: String!
    createdAt: String!
    updatedAt: String!
  }

  type DocumentVersion {
    id: ID!
    documentId: String!
    version: Int!
    fileUrl: String!
    fileType: String!
    fileSize: Int
    uploadedBy: String!
    createdAt: String!
  }

  type Notification {
    id: ID!
    userId: String!
    title: String!
    message: String!
    category: String!
    channel: String!
    deepLink: String
    isRead: Boolean!
    createdAt: String!
  }

  type AuditLog {
    id: ID!
    actorId: String!
    actor: User
    entityType: String!
    entityId: String!
    action: String!
    previousValue: JSON
    newValue: JSON
    details: JSON
    ipAddress: String
    location: String
    createdAt: String!
  }

  type PayrollRun {
    id: ID!
    month: String!
    periodStart: String!
    periodEnd: String!
    status: String!
    totalGross: Float!
    totalNet: Float!
    createdAt: String!
  }

  type PayrollRecord {
    id: ID!
    employeeId: String!
    employee: Employee
    basicSalary: Float
    allowances: JSON
    grossPay: Float!
    deductions: JSON
    totalDeductions: Float!
    netPay: Float!
    payslipUrl: String
    paymentBatches: JSON
  }

  type CompensationStructure {
    id: ID!
    organizationId: String!
    name: String!
    departmentId: String
    gradeLevel: String
    effectiveDate: String!
    components: JSON!
    status: String!
    createdAt: String!
  }

  type EmployeeCompensation {
    id: ID!
    employeeId: String!
    compensationStructureId: String!
    compensationStructure: CompensationStructure
    salaryAmount: Float!
    overrides: JSON
    effectiveDate: String!
  }

  type CompensationHistory {
    id: ID!
    employeeId: String!
    previousSalary: Float!
    newSalary: Float!
    effectiveDate: String!
    initiatorId: String!
    approverId: String
    createdAt: String!
  }

  type PayrollAdjustment {
    id: ID!
    employeeId: String!
    payrollRunId: String
    type: String!
    amount: Float!
    reason: String!
    status: String!
    createdAt: String!
  }

  type Payslip {
    id: ID!
    employeeId: String!
    payrollRunId: String!
    pdfUrl: String
    issuedAt: String!
    downloadCount: Int!
  }

  type PaymentBatch {
    id: ID!
    payrollRunId: String!
    batchLabel: String!
    percentage: Float!
    records: JSON!
  }

  type SalaryHistory {
    id: ID!
    employeeId: String!
    basicSalary: Float
    employeeClass: String
    employeeGrade: String
    hmoPlan: String
    hmoProvider: String
    pensionAdministrator: String!
    allowances: String
    effectiveDate: String!
    reason: String
    attachmentUrl: String!
    status: String!
    approvedBy: String
    createdAt: String!
  }

  type Policy {
    id: ID!
    title: String!
    category: String!
    content: String
    status: String!
    requiresAck: Boolean!
    createdAt: String!
  }

  type Announcement {
    id: ID!
    title: String!
    content: String!
    priority: String!
    createdAt: String!
  }

  type Goal {
    id: ID!
    title: String!
    description: String
    weight: Float!
    status: String!
    period: String!
    selfRating: Float
    managerRating: Float
  }
  
  type CheckIn {
    id: ID!
    employeeId: ID!
    managerId: ID!
    period: String!
    scheduledDate: String
    completedDate: String
    selfAppraisal: String
    managerNotes: String
    overallRating: Float
    status: String!
  }

  type OnboardingTask {
    id: ID!
    employeeId: ID!
    title: String!
    description: String
    category: String!
    assignedTo: String
    isCompleted: Boolean!
    dueDate: String
    completedAt: String
    status: String!
  }

  type Offboarding {
    id: ID!
    employeeId: ID!
    exitType: String!
    exitDate: String!
    reason: String
    attachmentUrl: String
    assetReturned: Boolean!
    accessRevoked: Boolean!
    handoverComplete: Boolean!
    finalPayrollProcessed: Boolean!
  }

  type Celebration {
    employeeId: ID!
    fullName: String!
    type: String! # "BIRTHDAY" or "WORK_ANNIVERSARY"
    date: String!
    years: Int # for work anniversaries
  }
  type CloudinarySignature {
    signature: String!
    timestamp: Int!
    apiKey: String!
    cloudName: String!
  }

  
  type Loan {
    id: ID!
    employeeId: String!
    amount: Float!
    monthlyRepayment: Float!
    totalRepaid: Float!
    remainingBalance: Float!
    status: String!
    startDate: String!
    createdAt: String!
    updatedAt: String!
    employee: Employee
    
    # frontend mapped fields
    employee_id: String
    employee_name: String
    loan_type: String
    loan_amount: Float
    loan_reason: String
    duration_months: Int
    paid_from: String
    monthly_installment: Float
    start_month: String
  }

  input LoanInput {
    employee_id: String!
    loan_type: String!
    loan_amount: Float!
    loan_reason: String
    duration_months: Int!
    paid_from: String
  }

  type PaginatedEmployees {
    employees: [Employee!]!
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type PaginatedLeaveRequests {
    leaveRequests: [LeaveRequest!]!
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type PaginatedLoans {
    loans: [Loan!]!
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type Query {
    loans: [Loan!]!
    paginatedLoans(page: Int, limit: Int, employeeId: ID): PaginatedLoans!
    me: User
    organization(id: ID!): Organization
    organizations: [Organization!]!
    compensationBands: [CompensationBand!]!
    promotionRequests(employeeId: ID): [PromotionRequest!]!
    previewPromotionBenefits(employeeId: ID!, newGrade: String!): PromotionBenefitsPreview!
    employees: [Employee]
    paginatedEmployees(page: Int, limit: Int, search: String, status: String, employmentStatus: String): PaginatedEmployees!
    employee(id: ID!): Employee
    departments: [Department]
    department(id: ID!): Department
    shifts: [Shift]
    approvalWorkflows: [ApprovalWorkflow]
    
    # Phase 2 Queries
    leaveTypes: [LeaveType]
    leaveRequests(employeeId: ID): [LeaveRequest]
    paginatedLeaveRequests(page: Int, limit: Int, employeeId: ID): PaginatedLeaveRequests!
    leaveBalances(employeeId: ID!): [LeaveBalance!]!
    leaveCalendar(year: Int!, departmentId: ID): [LeaveRequest!]!
    publicHolidays(year: Int!): [PublicHoliday!]!
    myLeavePlans(year: Int!): [LeavePlan!]!
    teamLeavePlans(year: Int!, departmentId: ID): [LeavePlan!]!
    attendanceRecords(employeeId: ID, date: String): [Attendance]
    documents(employeeId: ID, category: String): [Document]
    documentHistory(documentId: ID!): [DocumentVersion]
    getCloudinarySignature: CloudinarySignature!
    notifications: [Notification]

    # Phase 3 Queries
    payrollRuns: [PayrollRun!]!
    payrollRecords(payrollRunId: ID!): [PayrollRecord!]!
    myPayrollRecords: [PayrollRecord!]!
    payrollAdjustments(employeeId: ID): [PayrollAdjustment!]!
    salaryHistory(employeeId: ID!): [SalaryHistory]
    compensationStructures: [CompensationStructure!]!

    # Phase 4 Queries
    policies: [Policy]
    announcements: [Announcement]
    goals(employeeId: ID!): [Goal]
    
    # Phase 5 & 6 Queries
    checkIns(employeeId: ID!): [CheckIn]
    onboardingTasks(employeeId: ID): [OnboardingTask]
    offboardingDetails(employeeId: ID!): Offboarding
    allOffboardings: [Offboarding]
    upcomingCelebrations(month: Int!): [Celebration]
    profileUpdateRequests: [ProfileUpdateRequest]
    auditLogs(entityType: String, action: String, limit: Int): [AuditLog]
  }

  type ApprovalRecord {
    id: ID!
    entityType: String!
    entityId: String!
    approverUserId: String!
    action: String!
    comments: String
    previousStatus: String
    createdAt: String!
  }

  type ProfileUpdateRequest {
    id: ID!
    employeeId: String!
    fieldName: String!
    currentValue: String
    requestedValue: String!
    status: String!
    reviewedBy: String
    createdAt: String!
    employee: Employee!
  }

  input RegisterInput {
    email: String!
    password: String!
    orgName: String!
  }

  input EmployeeInput {
    fullName: String!
    email: String!
    phone: String
    jobTitle: String!
    departmentId: String
    employmentType: String
    hireDate: String!
    basicSalary: Float
    employeeClass: String
    employeeGrade: String
    hmoPlan: String
    hmoProvider: String
    pensionAdministrator: String
    templateId: String
  }

  
  input SuspendEmployeeInput {
    startDate: String!
    endDate: String!
    reason: String
    attachmentUrl: String
  }

  input OffboardEmployeeInput {
    exitType: String!
    exitDate: String!
    reason: String
    attachmentUrl: String
  }

  input CompensationBandInput {
    grade: String!
    minSalary: Float!
    maxSalary: Float!
    hmoPlan: String!
    annualLeaveDays: Float!
  }

  input RequestPromotionInput {
    employeeId: String!
    newJobTitle: String
    newDepartmentId: String
    newEmployeeClass: String
    newEmployeeGrade: String
    isHeadOfDepartment: Boolean
    effectiveDate: String!
  }

  input UpdateEmployeeInput {
    privateEmail: String
    phone: String
    dateOfBirth: String
    gender: String
    maritalStatus: String
    nationality: String
    nationalId: String
    passportNumber: String
    jobTitle: String
    departmentId: String
    managerId: String
    employmentType: String
    employmentStatus: String
    hireDate: String
    probationStartDate: String
    probationEndDate: String
    bankName: String
    bankAccountNumber: String
    pensionId: String
    employeeClass: String
    employeeGrade: String
    hmoPlan: String
    hmoProvider: String
    pensionAdministrator: String
    isHeadOfDepartment: Boolean
  }

  input LeaveRequestInput {
    leaveTypeId: String!
    startDate: String!
    endDate: String!
    selectedDates: [String!]
    totalDays: Float!
    isHalfDay: Boolean
    reason: String
    attachmentUrl: String
  }

  input CompensationStructureInput {
    name: String!
    departmentId: String
    gradeLevel: String
    effectiveDate: String!
    components: JSON!
  }

  input PayrollAdjustmentInput {
    employeeId: String!
    type: String!
    amount: Float!
    reason: String!
  }

  type Mutation {
    createLoan(input: LoanInput!): Loan!
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
    clearProfileGate: User!
    uploadProfilePicture(file: String!): User!
    
    createEmployee(input: EmployeeInput!): Employee!
    
    updateOrganizationFeatures(strictLeaveNotice: Boolean!): Organization!
    updateStatutoryConfig(config: JSON!): Organization!
    updateEmployee(id: ID!, input: UpdateEmployeeInput!, auditAction: String, auditContext: String): Employee!
    suspendEmployee(id: ID!, input: SuspendEmployeeInput!): Employee!
    offboardEmployee(id: ID!, input: OffboardEmployeeInput!): Employee!

    updateEmployeeSelf(input: UpdateEmployeeInput!): Employee!
    submitProfileForReview(employeeId: ID!): Employee!
    deleteEmployee(id: ID!): Boolean
    startOnboarding(employeeId: ID!): Employee
    approveEmployeeData(employeeId: ID!): Employee!
    rejectEmployeeData(employeeId: ID!, reason: String): Employee!
    
    createDepartment(name: String!, code: String, headEmployeeId: String): Department!
    updateDepartment(id: ID!, name: String, code: String, headEmployeeId: String): Department!
    approveDepartment(id: ID!): Department!
    deleteDepartment(id: ID!): Boolean

    createShift(name: String!, startTime: String!, endTime: String!, breakMinutes: Int): Shift!
    updateShift(id: ID!, name: String, startTime: String, endTime: String, breakMinutes: Int, isActive: Boolean): Shift!
    deleteShift(id: ID!): Boolean

    createApprovalWorkflow(name: String!, entityType: String!, steps: String!): ApprovalWorkflow!
    updateApprovalWorkflow(id: ID!, name: String, entityType: String, steps: String, isActive: Boolean): ApprovalWorkflow!
    deleteApprovalWorkflow(id: ID!): Boolean

    processApproval(entityType: String!, entityId: ID!, action: String!, comments: String): ApprovalRecord!

    # Phase 2 Mutations
    createLeaveType(name: String!, daysPerYear: Int!, isPaid: Boolean, requiresApproval: Boolean, eligibleAfterDays: Int, applicableTo: JSON): LeaveType!
    submitLeaveRequest(input: LeaveRequestInput!): LeaveRequest!
    approveLeaveRequest(id: ID!): LeaveRequest!
    rejectLeaveRequest(id: ID!, reason: String): LeaveRequest!
    cancelLeaveRequest(id: ID!, reason: String): LeaveRequest!
    createPublicHoliday(input: PublicHolidayInput!): PublicHoliday!
    deletePublicHoliday(id: ID!): Boolean!
    
    submitLeavePlan(year: Int!, plannedDates: [String!]!): LeavePlan!
    approveLeavePlan(planId: ID!): LeavePlan!
    rejectLeavePlan(planId: ID!): LeavePlan!

    approveSuspension(id: ID!, comments: String): Suspension!
    rejectSuspension(id: ID!, comments: String): Suspension!

    clockIn: Attendance!
    clockOut: Attendance!
    
    uploadDocument(employeeId: ID!, name: String!, category: String!, fileUrl: String!, fileType: String!, fileSize: Int, visibilityLevel: String!): Document!
    replaceDocumentVersion(id: ID!, fileUrl: String!, fileType: String!, fileSize: Int): Document!
    archiveDocument(id: ID!): Document!
    deleteDocument(id: ID!): Document!
    approveDocument(id: ID!): Document!
    rejectDocument(id: ID!, reason: String, attachmentUrl: String): Document!
    approveProfileUpdateRequest(id: ID!): ProfileUpdateRequest!
    rejectProfileUpdateRequest(id: ID!, reason: String, attachmentUrl: String): ProfileUpdateRequest!
    
    markNotificationRead(id: ID!): Notification!

    # Phase 3 Mutations
    createPayrollRun(month: String!, periodStart: String!, periodEnd: String!): PayrollRun!
    submitPayrollRun(id: ID!): PayrollRun!
    approvePayrollRun(id: ID!): PayrollRun!
    rejectPayrollRun(id: ID!, reason: String
    attachmentUrl: String!): PayrollRun!
    lockPayrollRun(id: ID!): PayrollRun!
    generatePaymentInstructions(payrollRunId: ID!): [PaymentBatch!]!
    generatePayslip(recordId: ID!): String!
    createCompensationStructure(input: CompensationStructureInput!): CompensationStructure!
    updateCompensationStructure(id: ID!, input: CompensationStructureInput!): CompensationStructure!
    assignEmployeeCompensation(employeeId: ID!, compensationStructureId: ID!, salaryAmount: Float!, overrides: JSON, effectiveDate: String!): EmployeeCompensation!
    requestCompensationUpdate(employeeId: ID!, basicSalary: Float
    hmoPlan: String
    hmoProvider: String
    pensionAdministrator: String!, allowances: String, reason: String
    attachmentUrl: String!): SalaryHistory!

    createPayrollAdjustment(input: PayrollAdjustmentInput!): PayrollAdjustment!
    approvePayrollAdjustment(id: ID!): PayrollAdjustment!
    rejectPayrollAdjustment(id: ID!, reason: String): PayrollAdjustment!

    # Phase 4 Mutations
    createPolicy(title: String!, category: String!, content: String, requiresAck: Boolean): Policy
    submitPolicy(id: ID!): Policy!
    approvePolicy(id: ID!): Policy!
    rejectPolicy(id: ID!, reason: String
    attachmentUrl: String!): Policy!
    acknowledgePolicy(policyId: ID!): Boolean
    createAnnouncement(title: String!, content: String!, priority: String!): Announcement
    createGoal(employeeId: ID!, title: String!, weight: Float!, period: String!): Goal
    
    # Phase 5 & 6 Mutations
    createCheckIn(employeeId: ID!, period: String!, scheduledDate: String): CheckIn
    updateCheckIn(id: ID!, selfAppraisal: String, managerNotes: String, overallRating: Float, status: String): CheckIn
    createOnboardingTask(employeeId: ID!, title: String!, description: String, category: String!, assignedTo: String, dueDate: String): OnboardingTask
    updateOnboardingTask(id: ID!, status: String, isCompleted: Boolean): OnboardingTask
    initiateOffboarding(employeeId: ID!, exitType: String!, exitDate: String!, reason: String
    attachmentUrl: String): Offboarding
    updateOffboarding(id: ID!, assetReturned: Boolean, accessRevoked: Boolean, handoverComplete: Boolean): Offboarding!
    
    upsertCompensationBand(input: CompensationBandInput!): CompensationBand!
    
    requestPromotion(input: RequestPromotionInput!): PromotionRequest!
    approvePromotion(id: ID!, status: String!, comments: String): PromotionRequest!
  }
`;
