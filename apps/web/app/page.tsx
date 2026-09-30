import { UploadForm } from "@/components/upload-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Family Budgeter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your bank statement PDFs to update the shared budget sheet.
        </p>
      </div>
      <UploadForm />
    </main>
  );
}
