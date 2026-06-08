export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    role: String!
    organizationId: String!
    employeeId: String
    isOrgOwner: Boolean
    lastLogin: String
    avatarUrl: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Organization {
    id: ID!
    name: String!
    country: String
    subscriptionPlan: String
    ownerEmail: String!
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
    department: Department
    employmentStatus: String!
    employmentType: String
    hireDate: String!
    basicSalary: Float
    allowances: String
    onboardingStatus: String
    onboardingProgress: Int
  }

  type Department {
    id: ID!
    name: String!
    code: String
    headEmployeeId: String
    employees: [Employee]
  }

  type LeaveType {
    id: ID!
    name: String!
    daysPerYear: Int!
    isPaid: Boolean!
    requiresApproval: Boolean!
  }

  type LeaveRequest {
    id: ID!
    employeeId: String!
    leaveTypeId: String!
    startDate: String!
    endDate: String!
    totalDays: Float!
    status: String!
    reason: String
    createdAt: String!
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
    isRead: Boolean!
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
    basicSalary: Float!
    grossPay: Float!
    totalDeductions: Float!
    netPay: Float!
    payslipUrl: String
  }

  type SalaryHistory {
    id: ID!
    employeeId: String!
    basicSalary: Float!
    allowances: String
    effectiveDate: String!
    reason: String!
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

  type Query {
    me: User
    organization(id: ID!): Organization
    employees: [Employee]
    employee(id: ID!): Employee
    departments: [Department]
    
    # Phase 2 Queries
    leaveTypes: [LeaveType]
    leaveRequests(employeeId: ID): [LeaveRequest]
    attendanceRecords(employeeId: ID, date: String): [Attendance]
    documents(employeeId: ID, category: String): [Document]
    documentHistory(documentId: ID!): [DocumentVersion]
    getCloudinarySignature: CloudinarySignature!
    notifications: [Notification]

    # Phase 3 Queries
    payrollRuns: [PayrollRun]
    payrollRecords(payrollRunId: ID!): [PayrollRecord]
    myPayrollRecords: [PayrollRecord]
    salaryHistory(employeeId: ID!): [SalaryHistory]

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
    jobTitle: String!
    departmentId: String
    hireDate: String!
    basicSalary: Float
    templateId: String
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
    employmentType: String
    employmentStatus: String
    hireDate: String
    bankName: String
    bankAccountNumber: String
    pensionId: String
  }

  input LeaveRequestInput {
    leaveTypeId: String!
    startDate: String!
    endDate: String!
    totalDays: Float!
    reason: String
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    
    createEmployee(input: EmployeeInput!): Employee!
    updateEmployee(id: ID!, input: UpdateEmployeeInput!): Employee!
    deleteEmployee(id: ID!): Boolean
    startOnboarding(employeeId: ID!): Employee
    
    createDepartment(name: String!, code: String, headEmployeeId: String): Department!
    updateDepartment(id: ID!, name: String, code: String, headEmployeeId: String): Department!
    approveDepartment(id: ID!): Department!
    deleteDepartment(id: ID!): Boolean

    processApproval(entityType: String!, entityId: ID!, action: String!, comments: String): ApprovalRecord!

    # Phase 2 Mutations
    createLeaveType(name: String!, daysPerYear: Int!, isPaid: Boolean, requiresApproval: Boolean): LeaveType!
    submitLeaveRequest(input: LeaveRequestInput!): LeaveRequest!
    approveLeaveRequest(id: ID!): LeaveRequest!
    rejectLeaveRequest(id: ID!): LeaveRequest!
    
    clockIn: Attendance!
    clockOut: Attendance!
    
    uploadDocument(employeeId: ID!, name: String!, category: String!, fileUrl: String!, fileType: String!, fileSize: Int, visibilityLevel: String!): Document!
    replaceDocumentVersion(id: ID!, fileUrl: String!, fileType: String!, fileSize: Int): Document!
    archiveDocument(id: ID!): Document!
    deleteDocument(id: ID!): Document!
    
    markNotificationRead(id: ID!): Notification!

    # Phase 3 Mutations
    createPayrollRun(month: String!, periodStart: String!, periodEnd: String!): PayrollRun!
    approvePayrollRun(id: ID!): PayrollRun!
    generatePayslip(recordId: ID!): String!
    requestCompensationUpdate(employeeId: ID!, basicSalary: Float!, allowances: String, reason: String!): SalaryHistory!

    # Phase 4 Mutations
    createPolicy(title: String!, category: String!, content: String, requiresAck: Boolean): Policy
    acknowledgePolicy(policyId: ID!): Boolean
    createAnnouncement(title: String!, content: String!, priority: String!): Announcement
    createGoal(employeeId: ID!, title: String!, weight: Float!, period: String!): Goal
    
    # Phase 5 & 6 Mutations
    createCheckIn(employeeId: ID!, period: String!, scheduledDate: String): CheckIn
    updateCheckIn(id: ID!, selfAppraisal: String, managerNotes: String, overallRating: Float, status: String): CheckIn
    createOnboardingTask(employeeId: ID!, title: String!, description: String, category: String!, assignedTo: String, dueDate: String): OnboardingTask
    updateOnboardingTask(id: ID!, status: String, isCompleted: Boolean): OnboardingTask
    initiateOffboarding(employeeId: ID!, exitType: String!, exitDate: String!, reason: String): Offboarding
    updateOffboarding(id: ID!, assetReturned: Boolean, accessRevoked: Boolean, handoverComplete: Boolean): Offboarding!
  }
`;
