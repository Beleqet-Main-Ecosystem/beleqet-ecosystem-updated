-- CBE transfers that have paid for a Jobs plan or a Promotion bot deposit: each one pays once.
CREATE TABLE "bank_references" (
    "reference" TEXT NOT NULL,
    "usedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_references_pkey" PRIMARY KEY ("reference")
);
