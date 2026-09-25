import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mockprep/ui";
import Link from "next/link";

// TODO(phase 2): admin sign-in, sidebar layout, exams + templates.
export default function AdminHome() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Admin panel</CardTitle>
        <CardDescription>
          Exams, question bank, PDF uploads and tests will show up here as each phase is built.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/status">Check system status</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
