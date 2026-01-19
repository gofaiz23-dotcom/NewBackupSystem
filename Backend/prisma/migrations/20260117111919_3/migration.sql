-- CreateTable
CREATE TABLE "backup_statuses" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "backendName" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "result" JSONB,
    "error" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_statuses" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "backendName" TEXT NOT NULL,
    "tableName" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backup_statuses_jobId_key" ON "backup_statuses"("jobId");

-- CreateIndex
CREATE INDEX "backup_statuses_jobId_idx" ON "backup_statuses"("jobId");

-- CreateIndex
CREATE INDEX "backup_statuses_status_idx" ON "backup_statuses"("status");

-- CreateIndex
CREATE INDEX "backup_statuses_createdAt_idx" ON "backup_statuses"("createdAt");

-- CreateIndex
CREATE INDEX "backup_statuses_isAutomatic_idx" ON "backup_statuses"("isAutomatic");

-- CreateIndex
CREATE UNIQUE INDEX "upload_statuses_jobId_key" ON "upload_statuses"("jobId");

-- CreateIndex
CREATE INDEX "upload_statuses_jobId_idx" ON "upload_statuses"("jobId");

-- CreateIndex
CREATE INDEX "upload_statuses_status_idx" ON "upload_statuses"("status");

-- CreateIndex
CREATE INDEX "upload_statuses_backendName_idx" ON "upload_statuses"("backendName");

-- CreateIndex
CREATE INDEX "upload_statuses_createdAt_idx" ON "upload_statuses"("createdAt");

-- CreateIndex
CREATE INDEX "upload_statuses_type_idx" ON "upload_statuses"("type");
