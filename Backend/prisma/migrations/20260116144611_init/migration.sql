-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "backendname" TEXT NOT NULL,
    "DBurl" TEXT NOT NULL,
    "bucketurl" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
