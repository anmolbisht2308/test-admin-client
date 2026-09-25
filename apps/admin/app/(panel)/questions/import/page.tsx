"use client";

import { ApiError, errorMessage, useAuth } from "@mockprep/api-client";
import { importReportSchema, type ImportReport } from "@mockprep/types";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import { Download, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function ImportPage() {
  const { api } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function downloadTemplate() {
    setError(null);
    try {
      const res = await api.fetchRaw("/api/admin/questions/import/template");
      if (!res.ok) throw await ApiError.fromResponse(res);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "mockprep-questions-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function send(dryRun: boolean) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      const params = new URLSearchParams({
        filename: file.name,
        ...(dryRun ? { dryRun: "1" } : {}),
      });
      setReport(
        await api.request(`/api/admin/questions/import?${params.toString()}`, {
          method: "POST",
          rawBody: file,
          contentType: isCsv ? "text/csv" : XLSX,
          schema: importReportSchema,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  const choose = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setReport(null);
  };
  const valid = report ? report.total - report.rejected.length : 0;

  return (
    <>
      <PageHeader
        title="Import questions"
        description="Upload an Excel (.xlsx) or CSV file. Valid rows go into the bank as approved questions."
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Start from the template: it has every column, examples (maths, Hindi, numeric) and
              instructions.
            </p>
            <Button variant="outline" onClick={() => void downloadTemplate()}>
              <Download /> Download template
            </Button>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-sm transition-colors ${dragging ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
        >
          <FileSpreadsheet className="size-8 text-muted-foreground" />
          {file ? (
            <span className="font-medium">{file.name}</span>
          ) : (
            <span>Drop a file here or click to choose</span>
          )}
          <span className="text-xs text-muted-foreground">.xlsx or .csv, up to 2,000 rows</span>
        </button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />

        {file && !report?.dryRun && !report && (
          <div className="flex justify-end">
            <Button onClick={() => void send(true)} disabled={busy}>
              {busy ? "Checking…" : "Check file"}
            </Button>
          </div>
        )}
        {error && <Alert>{error}</Alert>}

        {report && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {report.dryRun ? "Check result" : "Imported"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm">
                {report.dryRun ? (
                  <>
                    {valid} of {report.total} rows are ready to import.
                  </>
                ) : (
                  <>{report.imported} questions imported as approved.</>
                )}
                {report.rejected.length > 0 && (
                  <>
                    {" "}
                    {report.rejected.length} row(s) {report.dryRun ? "will be" : "were"} skipped.
                  </>
                )}
                {report.duplicates > 0 && (
                  <>
                    {" "}
                    {report.duplicates} already exist in the bank (imported and flagged
                    “duplicate”).
                  </>
                )}
              </p>
              {report.rejected.length > 0 && (
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-16">Row</TH>
                      <TH>Problems</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {report.rejected.map((r) => (
                      <TR key={r.row}>
                        <TD className="tabular-nums">{r.row}</TD>
                        <TD>
                          <ul className="list-disc pl-4">
                            {r.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
              <div className="flex justify-end gap-2">
                {report.dryRun ? (
                  <Button onClick={() => void send(false)} disabled={busy || valid === 0}>
                    {busy ? "Importing…" : `Import ${valid} question${valid === 1 ? "" : "s"}`}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/questions">Open the bank</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
