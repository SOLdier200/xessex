import AgeGateContent from "./AgeGateContent";

type AgeGatePageProps = {
  searchParams?: any;
};

export default async function AgeGatePage({ searchParams }: AgeGatePageProps) {
  const resolvedParams = await Promise.resolve(searchParams);
  const nextValue = resolvedParams?.next;
  const next = Array.isArray(nextValue) ? nextValue[0] : nextValue;
  return <AgeGateContent next={next} />;
}
