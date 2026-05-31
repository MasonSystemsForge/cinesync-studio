import { ProjectEditorClient } from "./ProjectEditorClient";

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <ProjectEditorClient projectId={id} />;
}
