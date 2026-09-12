-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "CaseRecord" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "service" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "refs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "sessionId" TEXT NOT NULL,
    "location" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecord" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caseRef" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseRef" TEXT NOT NULL,
    "institutionKey" TEXT NOT NULL,
    "institutionName" TEXT,
    "status" TEXT NOT NULL,
    "externalReference" TEXT,
    "requestPayload" TEXT NOT NULL,
    "resultPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseRecord_sessionId_createdAt_idx" ON "CaseRecord"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseRecord_userId_idx" ON "CaseRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRecord_sessionId_ref_key" ON "CaseRecord"("sessionId", "ref");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRecord_evidenceId_key" ON "EvidenceRecord"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_sessionId_idx" ON "EvidenceRecord"("sessionId");

-- CreateIndex
CREATE INDEX "BriefingRecord_sessionId_createdAt_idx" ON "BriefingRecord"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecord_notificationId_key" ON "NotificationRecord"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationRecord_sessionId_createdAt_idx" ON "NotificationRecord"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SubmissionRecord_userId_createdAt_idx" ON "SubmissionRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionRecord" ADD CONSTRAINT "SubmissionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

