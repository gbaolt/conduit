-- AlterTable
ALTER TABLE "File" ADD COLUMN     "sourceFileId" TEXT;

-- AlterTable
ALTER TABLE "AskAttachment" ADD COLUMN     "fileId" TEXT,
ALTER COLUMN "key" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "File_sourceFileId_idx" ON "File"("sourceFileId");

-- An Ask attachment holds its own object or points at a sent file, never both and never neither.
ALTER TABLE "AskAttachment" ADD CONSTRAINT "AskAttachment_key_or_file" CHECK (("key" IS NULL) <> ("fileId" IS NULL));
