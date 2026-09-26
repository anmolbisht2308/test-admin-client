"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  examListResponseSchema,
  examTemplateListResponseSchema,
  uploadConfigResponseSchema,
  uploadSchema,
  type ExamFamily,
  type UploadFileKind,
} from "@mockprep/types";
import { Alert, Badge, Button, Card, CardContent, Field, Input, Select, cn } from "@mockprep/ui";
import { FileText, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { titleFromFilename } from "@/lib/format";
import { uploadPaperFile } from "@/lib/upload";
import { useApiQuery } from "@/lib/use-api-query";

const ZONES: { kind: UploadFileKind; label: string; hint: string; accept: string }[] = [
  { kind: "paper", label: "Question paper", hint: "PDF, required", accept: "application/pdf" },
  {
    kind: "key",
    label: "Answer key",
    hint: "PDF or image, optional",
    accept: "application/pdf,image/png,image/jpeg,image/webp",
  },
  {
    kind: "solutions",
    label: "Solutions",
    hint: "PDF or image, optional",
    accept: "application/pdf,image/png,image/jpeg,image/webp",
  },
];

function DropZone({
  label,
  hint,
  accept,
  file,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files[0] ?? null);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm",
        over ? "border-primary bg-primary/5" : "border-border",
        file && "border-solid",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        aria-label={label}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <FileText className="size-6 text-primary" aria-hidden />
          <p className="max-w-full font-medium break-all">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onFile(null)}>
            <X /> Remove
          </Button>
        </>
      ) : (
        <>
          <Upload className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            Choose file
          </Button>
          <p className="text-xs text-muted-foreground">or drop it here</p>
        </>
      )}
    </div>
  );
}

export default function NewUploadPage() {
  const { api } = useAuth();
  const router = useRouter();
  const exams = useApiQuery("/api/admin/exams", examListResponseSchema);
  const templates = useApiQuery("/api/admin/templates", examTemplateListResponseSchema);
  const config = useApiQuery("/api/admin/uploads/config", uploadConfigResponseSchema);
  const [examKey, setExamKey] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [files, setFiles] = useState<Record<UploadFileKind, File | null>>({
    paper: null,
    key: null,
    solutions: null,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byFamily = useMemo(() => {
    const groups = new Map<ExamFamily, { slug: string; name: string }[]>();
    for (const e of exams.data?.exams ?? []) {
      groups.set(e.family, [...(groups.get(e.family) ?? []), e]);
    }
    return [...groups];
  }, [exams.data]);
  const exam = exams.data?.exams.find((e) => e.slug === examKey);
  const examTemplates = (templates.data?.templates ?? []).filter((t) =>
    exam?.templateKeys.includes(t.key),
  );
  const template = examTemplates.find((t) => t.key === templateKey) ?? examTemplates[0];

  const setFile = (kind: UploadFileKind, file: File | null) => {
    setFiles((f) => ({ ...f, [kind]: file }));
    if (kind === "paper" && file && !titleTouched) setTitle(titleFromFilename(file.name));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!exam || !template) return setError("Choose the exam.");
    if (!files.paper) return setError("Add the question paper PDF.");
    if (title.trim().length < 2) return setError("Enter a title.");
    try {
      setBusy("Uploading the paper…");
      const paper = await uploadPaperFile(api, files.paper, "paper");
      setBusy("Uploading the answer key…");
      const key = files.key ? await uploadPaperFile(api, files.key, "key") : null;
      setBusy("Uploading the solutions…");
      const solutions = files.solutions
        ? await uploadPaperFile(api, files.solutions, "solutions")
        : null;
      setBusy("Starting…");
      const upload = await api.request("/api/admin/uploads", {
        method: "POST",
        body: {
          title: title.trim(),
          examKey: exam.slug,
          templateKey: template.key,
          files: { paper, key, solutions },
        },
        schema: uploadSchema,
      });
      router.push(`/uploads/${upload.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Upload a paper"
        description="Upload a question paper and the system builds a draft test. You only review what it flags."
        action={
          config.data &&
          (config.data.ai ? (
            <Badge variant="success" className="gap-1">
              <Sparkles className="size-3" /> AI on · {config.data.model}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              title="Text PDFs only. Add GEMINI_API_KEY to the api and worker for scanned papers and image keys."
            >
              Text parser (no AI key)
            </Badge>
          ))
        }
      />
      <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-6">
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Exam" htmlFor="exam">
              <Select
                id="exam"
                value={examKey}
                onChange={(e) => {
                  setExamKey(e.target.value);
                  setTemplateKey("");
                }}
              >
                <option value="">Choose…</option>
                {byFamily.map(([family, list]) => (
                  <optgroup key={family} label={EXAM_FAMILY_LABELS[family]}>
                    {list.map((e) => (
                      <option key={e.slug} value={e.slug}>
                        {e.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            {examTemplates.length > 1 ? (
              <Field label="Paper" htmlFor="template">
                <Select
                  id="template"
                  value={template?.key ?? ""}
                  onChange={(e) => setTemplateKey(e.target.value)}
                >
                  {examTemplates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div />
            )}
            {template && (
              <div className="rounded-md bg-muted/50 p-3 text-sm md:col-span-2">
                <p className="font-medium">
                  {template.name} · {template.sections.reduce((a, s) => a + s.count, 0)} questions ·{" "}
                  {template.totalTimeSec / 60} min · {template.optionCount} options · +
                  {template.marking.correct}/{template.marking.wrong}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {template.sections.map((s) => `${s.name} (${s.count})`).join(" · ")}
                </p>
              </div>
            )}
            <Field label="Test title" htmlFor="title" className="md:col-span-2">
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                placeholder="Filled from the paper's file name"
              />
            </Field>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {ZONES.map((z) => (
            <DropZone
              key={z.kind}
              label={z.label}
              hint={z.hint}
              accept={z.accept}
              file={files[z.kind]}
              onFile={(f) => setFile(z.kind, f)}
            />
          ))}
        </div>

        {(error ?? exams.error) && <Alert>{error ?? exams.error}</Alert>}
        <div className="flex items-center justify-end gap-3">
          {busy && <span className="text-sm text-muted-foreground">{busy}</span>}
          <Button type="submit" size="lg" disabled={busy !== null}>
            <Upload /> Upload and build test
          </Button>
        </div>
      </form>
    </>
  );
}
