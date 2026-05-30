import { JobProgressClient } from "./JobProgressClient";

type JobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobPage({ params }: JobPageProps) {
  const { id } = await params;
  return <JobProgressClient jobId={id} />;
}
