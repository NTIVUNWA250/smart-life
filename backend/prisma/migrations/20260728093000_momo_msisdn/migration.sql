-- AlterTable: the user's MTN MoMo MSISDN, AES-GCM encrypted at rest (NFR7).
-- Nullable: a user without a linked wallet is never asked about at MTN.
ALTER TABLE "User" ADD COLUMN "momoMsisdnEnc" TEXT;
