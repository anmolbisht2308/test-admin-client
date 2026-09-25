import { PageHeader } from "@/components/page-header";
import { QuestionEditor } from "@/components/question-editor";

export default function NewQuestionPage() {
  return (
    <>
      <PageHeader title="New question" />
      <QuestionEditor />
    </>
  );
}
