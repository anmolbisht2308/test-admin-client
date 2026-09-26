"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { adminTestResponseSchema, type Test } from "@mockprep/types";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@mockprep/ui";
import { useState } from "react";
import { canEditContent } from "@/lib/roles";

const toNum = (v: string) => (v.trim() === "" ? null : Number(v));

/** Expected cut-offs shown on students' results (editable on published tests too). */
export function CutoffsCard({ test }: { test: Test }) {
  const { api, state } = useAuth();
  const [overall, setOverall] = useState(
    test.cutoffs.overall === null ? "" : String(test.cutoffs.overall),
  );
  const [sections, setSections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      test.sections.map((s) => [
        s.name,
        test.cutoffs.sections[s.name] === undefined ? "" : String(test.cutoffs.sections[s.name]),
      ]),
    ),
  );
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const readOnly = !canEditContent(state.user?.role);

  async function save() {
    setBusy(true);
    setNotice(null);
    const sectionCutoffs = Object.fromEntries(
      Object.entries(sections).flatMap(([name, v]) => {
        const n = toNum(v);
        return n === null || Number.isNaN(n) ? [] : [[name, n]];
      }),
    );
    try {
      await api.request(`/api/admin/tests/${test.id}/cutoffs`, {
        method: "PUT",
        body: { overall: toNum(overall), sections: sectionCutoffs },
        schema: adminTestResponseSchema,
      });
      setNotice({ kind: "success", text: "Cut-offs saved. Results show them right away." });
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Expected cut-offs</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset disabled={readOnly || busy} className="grid gap-4 md:grid-cols-4">
          <Field label="Overall" htmlFor="cut-overall" hint="Leave empty for none.">
            <Input
              id="cut-overall"
              type="number"
              step="any"
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
            />
          </Field>
          {test.sections.map((s) => (
            <Field key={s.name} label={s.name} htmlFor={`cut-${s.name}`}>
              <Input
                id={`cut-${s.name}`}
                type="number"
                step="any"
                value={sections[s.name] ?? ""}
                onChange={(e) => setSections((c) => ({ ...c, [s.name]: e.target.value }))}
              />
            </Field>
          ))}
          <div className="flex items-end md:col-span-4">
            <Button variant="outline" onClick={() => void save()}>
              {busy ? "Saving…" : "Save cut-offs"}
            </Button>
          </div>
        </fieldset>
        {notice && (
          <Alert variant={notice.kind} className="mt-3">
            {notice.text}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
